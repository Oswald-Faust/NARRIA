"""
narria.llm.chunker — Découpage de longs textes et fusion des graphes partiels.

Pour les œuvres dépassant la fenêtre de contexte de Claude (≈ 150 000 mots),
ce module :
  1. Estime le nombre de tokens du texte
  2. Si nécessaire, découpe le texte en blocs avec recouvrement narratif
  3. Permet d'analyser chaque bloc séparément
  4. Fusionne les graphes partiels en un graphe global cohérent

Stratégie de découpage :
  - Taille cible par bloc : 80 000 mots (~110 000 tokens) — laisse de la marge
    pour le system prompt et la sortie
  - Recouvrement : 5 000 mots entre blocs consécutifs (3% de chevauchement)
  - Découpage aux frontières naturelles (paragraphes) plutôt qu'au milieu de phrases

Stratégie de fusion :
  - Chaque sous-graphe a sa propre numérotation séquentielle
  - On normalise les noms d'actants par fuzzy matching (Levenshtein ≤ 2)
  - On élimine les nœuds dupliqués dans les zones de recouvrement
  - La courbe de tension globale est concaténée avec lissage aux jointures
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple


# Constantes
CHARS_PER_TOKEN = 4  # Estimation française approximative
MODEL_CONTEXT_LIMIT = 200_000  # Claude Sonnet 4.5

# Marges réservées dans la fenêtre de contexte :
#   - System prompt narratologique : ~3 000 tokens
#   - Instructions utilisateur (titre, auteur, format demandé) : ~500 tokens
#   - Sortie attendue (max_tokens dans l'API) : 16 000 tokens
#   - Marge de sécurité contre les sous-estimations : 40 000 tokens
# La marge a été augmentée à 60 000 tokens après avoir constaté que l'estimation
# (1 token ≈ 4 caractères × 1,05) sous-estime fortement les textes anciens,
# les traductions classiques (Apulée, Homère…) et les œuvres avec beaucoup de
# noms propres latins/grecs ou de vocabulaire rare, où Claude tokenise plus
# finement que la moyenne du français contemporain.
SAFETY_MARGIN = 60_000

# Seuil au-delà duquel le découpage devient obligatoire
# (texte seul, hors prompt et sortie)
CHUNK_THRESHOLD = MODEL_CONTEXT_LIMIT - SAFETY_MARGIN  # = 140_000 tokens

# Taille cible d'un bloc lors du découpage
# Plus petite que le seuil pour permettre les variations dans l'estimation
TARGET_CHUNK_TOKENS = 90_000  # ~ 65 000 mots — réduit pour les textes anciens

# Recouvrement entre blocs consécutifs
# Suffisant pour préserver les actants et la continuité narrative
OVERLAP_TOKENS = 6_000  # ~ 4 500 mots


@dataclass
class TextChunk:
    """Un bloc de texte issu du découpage d'une œuvre."""
    index: int                      # Numéro du bloc (0-indexé)
    total_chunks: int               # Nombre total de blocs
    text: str                       # Texte du bloc
    char_start: int                 # Position de début dans le texte original
    char_end: int                   # Position de fin
    estimated_tokens: int           # Estimation des tokens
    has_overlap_before: bool        # Recouvrement avec le bloc précédent
    has_overlap_after: bool         # Recouvrement avec le bloc suivant
    
    @property
    def label(self) -> str:
        return f"Bloc {self.index + 1}/{self.total_chunks}"


def estimate_tokens(text: str) -> int:
    """Estime grossièrement le nombre de tokens d'un texte français.

    Pondération conservatrice (1,20 au lieu de 1,05) après avoir constaté que
    les textes anciens, les traductions classiques et les œuvres avec beaucoup
    de noms propres latins/grecs (Apulée, Homère, hagiographies, etc.) sont
    tokenisés plus finement par Claude que la moyenne du français contemporain.
    Mieux vaut surestimer et déclencher le découpage à temps que sous-estimer
    et déclencher un rejet 400 de l'API.
    """
    if not text:
        return 0
    # Approximation : 1 token ≈ 4 caractères en français contemporain
    # Multiplicateur 1,20 pour absorber les textes anciens et les noms propres
    # tokenisés caractère par caractère.
    return int(len(text) / CHARS_PER_TOKEN * 1.20)


def needs_chunking(text: str) -> bool:
    """Indique si un texte dépasse le seuil au-delà duquel le découpage est nécessaire."""
    return estimate_tokens(text) > CHUNK_THRESHOLD


def chunk_text(text: str,
               target_tokens: int = TARGET_CHUNK_TOKENS,
               overlap_tokens: int = OVERLAP_TOKENS) -> List[TextChunk]:
    """
    Découpe un texte en blocs avec recouvrement, en respectant les frontières
    naturelles (paragraphes).
    
    Args:
        text: texte à découper
        target_tokens: taille cible d'un bloc en tokens
        overlap_tokens: recouvrement entre blocs en tokens
    
    Returns:
        Liste de TextChunk.
    """
    if not text or not text.strip():
        return []
    
    # Si le texte tient dans un seul bloc, retourner directement
    if estimate_tokens(text) <= target_tokens:
        return [TextChunk(
            index=0, total_chunks=1, text=text,
            char_start=0, char_end=len(text),
            estimated_tokens=estimate_tokens(text),
            has_overlap_before=False, has_overlap_after=False,
        )]
    
    # Convertir les seuils tokens → caractères
    target_chars = target_tokens * CHARS_PER_TOKEN
    overlap_chars = overlap_tokens * CHARS_PER_TOKEN
    
    # Découper en paragraphes (respect des frontières narratives)
    paragraphs = _split_paragraphs(text)
    
    chunks_raw = []  # liste de tuples (text, char_start, char_end)
    current_paras = []
    current_size = 0
    
    def finalize_current():
        """Finalise le bloc courant et l'ajoute à chunks_raw."""
        if not current_paras:
            return
        chunk_text_str = '\n\n'.join(p[0] for p in current_paras)
        chunks_raw.append((
            chunk_text_str,
            current_paras[0][1],
            current_paras[-1][2]
        ))
    
    def compute_overlap_paras():
        """Construit les paragraphes d'overlap pour démarrer le bloc suivant."""
        overlap_paras = []
        overlap_size = 0
        for op in reversed(current_paras):
            op_len = op[2] - op[1]
            # Ne pas inclure si ça dépasserait l'overlap cible (sauf si on n'a rien)
            if overlap_size + op_len > overlap_chars and overlap_paras:
                break
            overlap_paras.insert(0, op)
            overlap_size += op_len
            if overlap_size >= overlap_chars:
                break
        return overlap_paras, overlap_size
    
    for p_text, p_start, p_end in paragraphs:
        p_len = p_end - p_start
        
        # Cas spécial : ce paragraphe seul dépasse la cible
        # → flush ce qu'on a, puis pousser ce paragraphe seul comme bloc isolé
        if p_len > target_chars:
            if current_paras:
                finalize_current()
                current_paras = []
                current_size = 0
            chunks_raw.append((p_text, p_start, p_end))
            continue
        
        # Si ajouter ce paragraphe dépasserait la cible : finaliser et redémarrer
        if current_size + p_len > target_chars and current_paras:
            finalize_current()
            
            overlap_paras, overlap_size = compute_overlap_paras()
            current_paras = list(overlap_paras)
            current_size = overlap_size
            
            # Vérification : si l'overlap + ce paragraphe dépassent encore la cible,
            # on doit aussi finaliser l'overlap seul (cas où l'overlap est gros)
            if current_size + p_len > target_chars and current_paras:
                finalize_current()
                current_paras = []
                current_size = 0
        
        # Ajouter le paragraphe au bloc courant
        current_paras.append((p_text, p_start, p_end))
        current_size += p_len
    
    # Finaliser le dernier bloc
    finalize_current()
    
    # Convertir en TextChunk avec métadonnées
    total = len(chunks_raw)
    chunks = []
    for i, (chunk_str, c_start, c_end) in enumerate(chunks_raw):
        chunks.append(TextChunk(
            index=i,
            total_chunks=total,
            text=chunk_str,
            char_start=c_start,
            char_end=c_end,
            estimated_tokens=estimate_tokens(chunk_str),
            has_overlap_before=(i > 0),
            has_overlap_after=(i < total - 1),
        ))
    
    return chunks


def _split_paragraphs(text: str) -> List[Tuple[str, int, int]]:
    """
    Découpe un texte en paragraphes en préservant les positions de caractères.
    
    Si le texte ne contient pas de paragraphes typographiques (pas de doubles
    sauts de ligne), un découpage par phrases puis par blocs de caractères
    est appliqué pour assurer un découpage exploitable.
    
    Returns:
        Liste de tuples (texte_paragraphe, char_start, char_end).
    """
    paragraphs = []
    # Split sur les doubles sauts de ligne (paragraphes typographiques)
    pattern = re.compile(r'\n\s*\n')
    
    last_end = 0
    for match in pattern.finditer(text):
        para_text = text[last_end:match.start()].strip()
        if para_text:
            real_start = last_end
            while real_start < match.start() and text[real_start].isspace():
                real_start += 1
            paragraphs.append((para_text, real_start, match.start()))
        last_end = match.end()
    
    # Dernier paragraphe
    if last_end < len(text):
        para_text = text[last_end:].strip()
        if para_text:
            real_start = last_end
            while real_start < len(text) and text[real_start].isspace():
                real_start += 1
            paragraphs.append((para_text, real_start, len(text)))
    
    # Cas où il n'y a pas de doubles sauts de ligne : tout est un paragraphe
    if not paragraphs and text.strip():
        paragraphs.append((text.strip(), 0, len(text)))
    
    # Si le découpage par paragraphes a produit des blocs trop gros
    # (cas d'un texte sans paragraphes), on subdivise par phrases puis par blocs.
    max_para_chars = TARGET_CHUNK_TOKENS * CHARS_PER_TOKEN
    refined = []
    for para_text, p_start, p_end in paragraphs:
        if (p_end - p_start) <= max_para_chars:
            refined.append((para_text, p_start, p_end))
        else:
            # Subdiviser ce paragraphe
            refined.extend(_split_oversized_paragraph(para_text, p_start, max_para_chars))
    
    return refined


def _split_oversized_paragraph(text: str, base_offset: int,
                                target_chars: int) -> List[Tuple[str, int, int]]:
    """
    Subdivise un paragraphe trop volumineux d'abord par phrases, puis par
    blocs de caractères si nécessaire.
    """
    pieces = []
    
    # Tentative 1 : découpage par phrases (point, point d'exclamation, point d'interrogation)
    sentence_pattern = re.compile(r'(?<=[.!?])\s+(?=[A-ZÉÈÀÂÎÔÛÜŒÆ])')
    sentences = []
    last = 0
    for match in sentence_pattern.finditer(text):
        sentences.append((text[last:match.start()].strip(), last, match.start()))
        last = match.end()
    if last < len(text):
        sentences.append((text[last:].strip(), last, len(text)))
    
    # Si on a au moins quelques phrases, regrouper par taille cible
    if len(sentences) >= 3:
        current_text = []
        current_start = sentences[0][1]
        current_end = sentences[0][1]
        current_size = 0
        
        for s_text, s_start, s_end in sentences:
            s_len = s_end - s_start
            if current_size + s_len > target_chars and current_text:
                # Finaliser le bloc courant
                pieces.append((
                    ' '.join(current_text),
                    base_offset + current_start,
                    base_offset + current_end
                ))
                current_text = [s_text]
                current_start = s_start
                current_end = s_end
                current_size = s_len
            else:
                if not current_text:
                    current_start = s_start
                current_text.append(s_text)
                current_end = s_end
                current_size += s_len
        
        if current_text:
            pieces.append((
                ' '.join(current_text),
                base_offset + current_start,
                base_offset + current_end
            ))
        
        # Vérifier que les blocs sont raisonnables
        if all((e - s) <= target_chars * 1.2 for _, s, e in
               [(t, s - base_offset, e - base_offset) for t, s, e in pieces]):
            return pieces
    
    # Fallback final : découpage brut par blocs de caractères
    pieces = []
    pos = 0
    while pos < len(text):
        end = min(pos + target_chars, len(text))
        # Chercher un point ou espace dans les 200 derniers caractères
        if end < len(text):
            for breakpoint in range(end, max(end - 200, pos + 1), -1):
                if text[breakpoint] in ' .!?':
                    end = breakpoint + 1
                    break
        pieces.append((
            text[pos:end].strip(),
            base_offset + pos,
            base_offset + end
        ))
        pos = end
    
    return pieces


# ═══════════════════════════════════════════════════════════════
#  FUSION DES GRAPHES PARTIELS
# ═══════════════════════════════════════════════════════════════

def merge_partial_graphs(partial_results: List[Dict[str, Any]],
                          chunks: List[TextChunk]) -> Dict[str, Any]:
    """
    Fusionne plusieurs résultats d'analyse en un graphe global cohérent.
    
    Args:
        partial_results: liste de dicts (un par bloc), au format renvoyé par
                         ClaudeClient.analyze_narrative()
        chunks: liste des TextChunk correspondants (pour gérer les recouvrements)
    
    Returns:
        Un dict au même format qu'une analyse unique, mais représentant
        l'ensemble du texte. Inclut un champ 'merge_info' avec les détails
        de la fusion.
    """
    if not partial_results:
        return {
            'summary': '', 'genre': '', 'tradition': '',
            'nodes': [], 'main_actants': {}, 'thematic_keywords': [],
            'usage': {'input_tokens': 0, 'output_tokens': 0, 'cost_usd': 0.0},
            'merge_info': {'n_chunks': 0, 'n_nodes_before_dedup': 0, 'n_nodes_after_dedup': 0},
        }
    
    if len(partial_results) == 1:
        # Pas de fusion nécessaire, mais on annote quand même
        result = dict(partial_results[0])
        result['merge_info'] = {'n_chunks': 1, 'n_nodes_before_dedup': len(result.get('nodes', [])),
                                  'n_nodes_after_dedup': len(result.get('nodes', []))}
        return result
    
    # ─── 1. Synthèse globale ───
    # On prend le résumé du premier bloc comme amorce, et on agrège les
    # autres champs. Les genres/traditions doivent être cohérents : on prend
    # les plus fréquents.
    
    from collections import Counter
    genres = [r.get('genre', '') for r in partial_results if r.get('genre')]
    traditions = [r.get('tradition', '') for r in partial_results if r.get('tradition')]
    
    most_common_genre = Counter(genres).most_common(1)[0][0] if genres else ''
    most_common_tradition = Counter(traditions).most_common(1)[0][0] if traditions else ''
    
    # Concaténation des résumés (un par bloc) en un résumé global
    summaries = [r.get('summary', '') for r in partial_results if r.get('summary')]
    global_summary = _synthesize_summaries(summaries, len(partial_results))
    
    # ─── 2. Mots-clés thématiques (union) ───
    all_keywords = []
    for r in partial_results:
        for kw in r.get('thematic_keywords', []) or []:
            if kw and kw not in all_keywords:
                all_keywords.append(kw)
    
    # ─── 3. Actants principaux (par fréquence + position) ───
    main_actants = _merge_main_actants([r.get('main_actants', {}) or {} for r in partial_results])
    
    # ─── 4. Nœuds : déduplication et renumérotation ───
    all_nodes = []
    for chunk_idx, result in enumerate(partial_results):
        for node in result.get('nodes', []):
            node_copy = dict(node)
            node_copy['_chunk_index'] = chunk_idx  # Marqueur d'origine
            all_nodes.append(node_copy)
    
    n_before = len(all_nodes)
    deduped_nodes = _deduplicate_overlap_nodes(all_nodes, chunks)
    n_after = len(deduped_nodes)
    
    # Renumérotation séquentielle continue
    for i, node in enumerate(deduped_nodes):
        node['sequence'] = i + 1
        # Retirer le marqueur interne de fusion (il sera dans merge_info)
        node.pop('_chunk_index', None)
    
    # ─── 5. Cumul des coûts ───
    total_input_tokens = sum(r.get('usage', {}).get('input_tokens', 0) for r in partial_results)
    total_output_tokens = sum(r.get('usage', {}).get('output_tokens', 0) for r in partial_results)
    total_cost = sum(r.get('usage', {}).get('cost_usd', 0) for r in partial_results)
    
    # ─── 6. Construction du résultat fusionné ───
    return {
        'summary': global_summary,
        'genre': most_common_genre,
        'tradition': most_common_tradition,
        'nodes': deduped_nodes,
        'main_actants': main_actants,
        'thematic_keywords': all_keywords[:20],  # Cap à 20 pour rester lisible
        'usage': {
            'input_tokens': total_input_tokens,
            'output_tokens': total_output_tokens,
            'cost_usd': total_cost,
        },
        'merge_info': {
            'n_chunks': len(partial_results),
            'n_nodes_before_dedup': n_before,
            'n_nodes_after_dedup': n_after,
            'n_duplicates_removed': n_before - n_after,
        },
    }


def _synthesize_summaries(summaries: List[str], n_chunks: int) -> str:
    """
    Concatène plusieurs résumés partiels en un résumé global.
    
    Comme les résumés sont déjà courts (2-3 phrases chacun), on les présente
    avec une mention explicite du découpage en parties.
    """
    if not summaries:
        return ''
    if len(summaries) == 1:
        return summaries[0]
    
    parts = []
    for i, s in enumerate(summaries, 1):
        parts.append(f"Partie {i}/{n_chunks} : {s}")
    return ' '.join(parts)


def _merge_main_actants(actants_dicts: List[Dict[str, str]]) -> Dict[str, str]:
    """
    Fusionne plusieurs schémas actantiels en un seul, avec une logique de
    cohérence : on garde l'actant le plus fréquent à chaque position.
    """
    from collections import Counter
    
    merged = {}
    keys = ('protagoniste', 'objet', 'destinateur', 'destinataire',
            'adjuvant', 'opposant')
    
    for key in keys:
        values = []
        for d in actants_dicts:
            v = d.get(key, '').strip()
            if v:
                values.append(v)
        
        if not values:
            continue
        
        # Prendre le plus fréquent
        most_common = Counter(values).most_common(1)[0][0]
        merged[key] = most_common
    
    return merged


def _deduplicate_overlap_nodes(all_nodes: List[Dict[str, Any]],
                                chunks: List[TextChunk]) -> List[Dict[str, Any]]:
    """
    Élimine les nœuds dupliqués qui apparaissent dans les zones de recouvrement
    entre blocs consécutifs.
    
    Heuristique de duplicat : deux nœuds avec function_code identique ET
    text_excerpt similaire (intersection de mots > 50%) ET de blocs adjacents.
    """
    if len(all_nodes) <= 1:
        return all_nodes
    
    keep = [True] * len(all_nodes)
    
    for i, node in enumerate(all_nodes):
        if not keep[i]:
            continue
        chunk_i = node.get('_chunk_index', -1)
        
        for j in range(i + 1, len(all_nodes)):
            if not keep[j]:
                continue
            other = all_nodes[j]
            chunk_j = other.get('_chunk_index', -1)
            
            # Seulement les blocs adjacents (zones de recouvrement)
            if abs(chunk_j - chunk_i) > 1:
                break  # plus loin dans le texte, on n'est plus dans un overlap
            if chunk_j == chunk_i:
                continue  # même bloc, on ne déduplique pas
            
            # Test de similarité
            if _is_duplicate_node(node, other):
                keep[j] = False
    
    return [n for i, n in enumerate(all_nodes) if keep[i]]


def _is_duplicate_node(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
    """
    Détermine si deux nœuds représentent le même événement narratif.
    """
    # Critère 1 : code de fonction identique
    code_a = a.get('function_code', '')
    code_b = b.get('function_code', '')
    if code_a and code_b and code_a != code_b:
        return False
    
    # Critère 2 : excerpt similaire
    text_a = (a.get('text_excerpt', '') or '').lower()
    text_b = (b.get('text_excerpt', '') or '').lower()
    if not text_a or not text_b:
        return False
    
    words_a = set(re.findall(r'\w{4,}', text_a))
    words_b = set(re.findall(r'\w{4,}', text_b))
    
    if not words_a or not words_b:
        return False
    
    intersection = len(words_a & words_b)
    smaller = min(len(words_a), len(words_b))
    overlap_ratio = intersection / smaller if smaller > 0 else 0
    
    return overlap_ratio > 0.5
