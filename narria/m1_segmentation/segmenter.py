"""
narria.m1_segmentation.segmenter — Module 1 : Segmentation narrative.

Découpage automatique du texte brut en unités narratives (segments) de
granularité appropriée pour l'extraction ultérieure du graphe narratif.

Utilise uniquement des heuristiques robustes (pas d'appel à une API externe).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List, Dict, Any


@dataclass
class NarrativeSegment:
    """Un segment narratif : unité d'analyse du Module 1."""
    segment_id: str
    text: str
    start_char: int
    end_char: int
    word_count: int
    entities: List[str] = field(default_factory=list)
    actions: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'segment_id': self.segment_id,
            'text': self.text[:200] + ('…' if len(self.text) > 200 else ''),
            'word_count': self.word_count,
            'entities': self.entities,
            'actions': self.actions,
        }


class NarrativeSegmenter:
    """
    Segmenteur narratif : découpe un texte en segments significatifs,
    identifie les entités (personnages, lieux) et les actions principales.
    """
    
    ACTION_VERBS = {
        "part", "partit", "quitte", "quitta", "voulut", "veut", "décida", "décide",
        "rencontre", "rencontra", "cherche", "chercha", "recherche",
        "frappe", "frappa", "attaque", "attaqua", "combat", "combattit",
        "tue", "tua", "blessa", "blesse", "menace", "menaça",
        "aime", "aima", "épouse", "épousa", "déteste", "détesta", "trahit",
        "promet", "promit", "accepte", "accepta", "refuse", "refusa",
        "découvre", "découvrit", "comprend", "comprit", "apprend", "apprit",
        "révèle", "révéla", "avoue", "avoua", "cache", "cacha",
        "meurt", "mourut", "sauve", "sauva", "libère", "libéra", "triomphe",
        "échoue", "échoua", "pardonne", "pardonna", "vengea", "venge",
        "bénit", "maudit", "prie", "invoqua", "offre",
        "arrive", "arriva", "entra", "entre", "sortit", "sort",
        "donna", "donne", "reçut", "reçoit", "prit", "prend",
        "vit", "voit", "entendit", "entend", "parla", "parle",
    }
    
    CHARACTER_HINTS = re.compile(r'\b([A-Z][a-zà-ÿ]+(?:\s+(?:de |d\')?[A-Z][a-zà-ÿ]+)?)\b')
    
    def segment(self, text: str) -> List[NarrativeSegment]:
        if not text or len(text.strip()) < 50:
            return []
        
        paragraphs = self._split_paragraphs(text)
        
        # Adapt target size to text length: shorter texts get smaller segments
        total_words = sum(len(p.split()) for p in paragraphs)
        if total_words < 200:
            target = 40   # Very short text: many small segments
        elif total_words < 500:
            target = 80
        elif total_words < 1500:
            target = 150
        else:
            target = 180
        
        chunks = self._group_chunks(paragraphs, target_words=target)
        
        segments = []
        char_offset = 0
        for i, chunk in enumerate(chunks):
            start = text.find(chunk[:50], char_offset) if len(chunk) >= 50 else char_offset
            end = start + len(chunk) if start >= 0 else char_offset + len(chunk)
            
            entities = self._extract_entities(chunk)
            actions = self._extract_actions(chunk)
            word_count = len(chunk.split())
            
            segments.append(NarrativeSegment(
                segment_id=f"s{i+1:03d}",
                text=chunk,
                start_char=max(0, start),
                end_char=end,
                word_count=word_count,
                entities=entities,
                actions=actions,
            ))
            char_offset = end
        
        return segments
    
    def _split_paragraphs(self, text: str) -> List[str]:
        text = re.sub(r'\r\n?', '\n', text)
        paras = re.split(r'\n\s*\n+', text)
        return [p.strip() for p in paras if p.strip()]
    
    def _group_chunks(self, paragraphs: List[str], target_words: int = 180) -> List[str]:
        chunks = []
        current = []
        current_words = 0
        
        for para in paragraphs:
            wc = len(para.split())
            
            if wc > target_words * 2:
                if current:
                    chunks.append('\n\n'.join(current))
                    current = []
                    current_words = 0
                chunks.extend(self._split_long(para, target_words))
            elif current_words + wc > target_words and current:
                chunks.append('\n\n'.join(current))
                current = [para]
                current_words = wc
            else:
                current.append(para)
                current_words += wc
        
        if current:
            chunks.append('\n\n'.join(current))
        
        return chunks
    
    def _split_long(self, paragraph: str, target_words: int) -> List[str]:
        sentences = re.split(r'(?<=[.!?])\s+(?=[A-ZÉÀÊÎÔ])', paragraph)
        
        chunks = []
        current = []
        current_words = 0
        for sent in sentences:
            wc = len(sent.split())
            if current_words + wc > target_words and current:
                chunks.append(' '.join(current))
                current = [sent]
                current_words = wc
            else:
                current.append(sent)
                current_words += wc
        if current:
            chunks.append(' '.join(current))
        return chunks
    
    def _extract_entities(self, text: str) -> List[str]:
        STOP_NAMES = {
            'Il', 'Elle', 'Ils', 'Elles', 'On', 'Je', 'Tu', 'Nous', 'Vous',
            'Un', 'Une', 'Des', 'Le', 'La', 'Les', 'Ce', 'Cette', 'Ces',
            'Mais', 'Cependant', 'Lorsque', 'Quand', 'Alors', 'Ainsi',
            'Puis', 'Ensuite', 'Tout', 'Tous', 'Toute', 'Toutes', 'Aussi',
            'Après', 'Avant', 'Depuis', 'Pour', 'Avec', 'Sans', 'Sous',
            'Dans', 'Sur', 'Chez', 'Par', 'Voici', 'Voilà', 'Oui', 'Non',
            'Car', 'Donc', 'Or', 'Ni',
        }
        
        matches = self.CHARACTER_HINTS.findall(text)
        from collections import Counter
        counter = Counter(matches)
        
        entities = []
        seen = set()
        for name, count in counter.most_common(20):
            if name in STOP_NAMES or name in seen:
                continue
            if len(name) < 3:
                continue
            if count >= 2 or len(entities) < 3:
                entities.append(name)
                seen.add(name)
        
        return entities[:10]
    
    def _extract_actions(self, text: str) -> List[str]:
        text_lower = text.lower()
        actions = []
        for verb in self.ACTION_VERBS:
            if re.search(r'\b' + re.escape(verb) + r'\b', text_lower):
                actions.append(verb)
        return actions[:8]
