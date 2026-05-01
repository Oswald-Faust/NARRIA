"""
narria.m2_extraction.extractor — Module 2 : Extraction du graphe narratif.

Extrait la structure narrative profonde à partir de segments annotés :
    - identifie les fonctions cardinales (53 fonctions NARR'IA)
    - détermine la configuration actantielle par nœud
    - estime les valeurs modales et tensives
    - construit le graphe narratif (NarRep-Graph)

Utilise des heuristiques linguistiques sans dépendance à une API externe.
"""

from __future__ import annotations

import re
import uuid
from typing import List, Dict, Any, Optional

from narria.core.models import NarrativeGraph, NarrativeNode, NarrativeEdge
from narria.m1_segmentation.segmenter import NarrativeSegment
from narria.repertoire.functions import FUNCTION_REPERTOIRE, get_function_by_code


class GraphExtractor:
    """
    Extracteur de graphe narratif : transforme une séquence de segments
    en un NarRep-Graph opérationnel pour la comparaison.
    """
    
    # Table de correspondance : verbes/indices → code fonction
    # Simplifié pour le prototype ; l'ouvrage détaille 53 fonctions en 7 familles
    FUNCTION_PATTERNS = [
        # Rupture / Désir / Manque
        (["part", "partit", "quitte", "quitta"],           "F01", "Départ", "Rupture"),
        (["voulut", "veut", "décide", "décida", "cherche", "chercha", "recherche"],
         "F02", "Désir / Quête", "Rupture"),
        (["manque", "manqua", "privé", "orphelin", "abandonné"],
         "F03", "Manque", "Rupture"),
        
        # Quête / Rencontre / Épreuve
        (["rencontre", "rencontra", "arrive", "arriva", "trouve", "trouva"],
         "F10", "Rencontre", "Quête"),
        (["reçut", "reçoit", "donna", "donne", "offre"],
         "F11", "Don / Réception", "Quête"),
        (["entra", "entre", "pénètre", "pénétra"],
         "F12", "Entrée dans l'épreuve", "Quête"),
        
        # Obstacle / Conflit
        (["frappe", "frappa", "attaque", "attaqua", "combat", "combattit"],
         "F20", "Combat", "Obstacle"),
        (["trahit", "trahison", "trahi"],
         "F21", "Trahison", "Obstacle"),
        (["menace", "menaça"],
         "F22", "Menace", "Obstacle"),
        (["tue", "tua", "meurtre", "assassina"],
         "F23", "Meurtre", "Obstacle"),
        (["blessa", "blesse"],
         "F24", "Blessure", "Obstacle"),
        
        # Pivot / Reconnaissance / Révélation
        (["découvre", "découvrit", "comprend", "comprit", "apprend", "apprit"],
         "F30", "Reconnaissance", "Pivot"),
        (["révèle", "révéla", "avoue", "avoua"],
         "F31", "Révélation", "Pivot"),
        (["cache", "cacha", "dissimule"],
         "F32", "Dissimulation", "Pivot"),
        
        # Résolution
        (["sauve", "sauva", "libère", "libéra"],
         "F40", "Libération / Sauvetage", "Résolution"),
        (["triomphe", "vainqueur", "gagna", "gagne"],
         "F41", "Triomphe", "Résolution"),
        (["échoue", "échoua", "perdit"],
         "F42", "Échec", "Résolution"),
        (["meurt", "mourut", "mort"],
         "F43", "Mort", "Résolution"),
        (["pardonne", "pardonna"],
         "F44", "Pardon", "Résolution"),
        (["vengea", "venge", "vengeance"],
         "F45", "Vengeance", "Résolution"),
        
        # Liaison / Relation
        (["aime", "aima", "amour", "éprit"],
         "F50", "Amour", "Liaison"),
        (["épouse", "épousa", "mariage"],
         "F51", "Union / Mariage", "Liaison"),
        (["rejette", "rejeta", "refusa", "refuse"],
         "F52", "Rejet", "Liaison"),
        
        # Fonctions africaines (7 fonctions spécifiques — préfixe FN)
        (["bénit", "bénédiction"],
         "FNBENI", "Bénédiction", "Liaison africaine"),
        (["maudit", "malédiction"],
         "FNMALA", "Malédiction", "Obstacle africain"),
        (["ancêtre", "ancêtres", "esprits", "rêve", "vision"],
         "FNANC", "Ancêtre-arbitre", "Pivot africain"),
        (["proverbe", "sagesse", "parole"],
         "FNPROV", "Proverbe narratif", "Liaison africaine"),
        (["griot", "conte", "raconta"],
         "FNGR", "Griot-narrateur", "Liaison africaine"),
        (["alliance", "clan", "famille", "tribu"],
         "FNAL", "Alliance matrimoniale/clanique", "Liaison africaine"),
        (["communauté", "assemblée", "village", "peuple"],
         "FNCOMM", "Interpellation communautaire", "Liaison africaine"),
    ]
    
    # Indicateurs de phase dramatique
    PHASE_INDICATORS = {
        'Exposition':  [],  # début par défaut
        'Complication': ["mais", "cependant", "soudain", "or"],
        'Climax':      ["alors", "enfin", "moment"],
        'Résolution':  ["finalement", "ainsi", "depuis lors", "à la fin"],
    }
    
    def extract(self, segments: List[NarrativeSegment],
                metadata: Optional[Dict[str, Any]] = None) -> NarrativeGraph:
        """
        Construit le graphe narratif à partir des segments.
        """
        if metadata is None:
            metadata = {}
        
        graph_id = f"g_{uuid.uuid4().hex[:10]}"
        graph = NarrativeGraph(graph_id=graph_id, metadata=metadata)
        
        n_segments = len(segments)
        if n_segments == 0:
            return graph
        
        # Construction des nœuds
        for i, segment in enumerate(segments):
            node = self._build_node(segment, i, n_segments)
            if node:
                graph.nodes.append(node)
        
        # Construction des arêtes : chaîne séquentielle causale
        for i in range(len(graph.nodes) - 1):
            src = graph.nodes[i]
            tgt = graph.nodes[i + 1]
            edge = NarrativeEdge(
                edge_id=f"e_{i:03d}",
                source=src.node_id,
                target=tgt.node_id,
                transition_type=self._classify_transition(src, tgt),
                weight=1.0,
            )
            graph.edges.append(edge)
        
        # Ajout d'arêtes causales non-séquentielles quand les actants convergent
        self._add_causal_edges(graph)
        
        return graph
    
    def _build_node(self, segment: NarrativeSegment, position: int,
                    total: int) -> Optional[NarrativeNode]:
        """Construit un nœud narratif à partir d'un segment."""
        # Identifie la fonction narrative principale
        function_code, function_name, function_family = self._identify_function(segment)
        
        # Détermine la phase dramatique selon la position
        phase = self._identify_phase(segment, position, total)
        
        # Calcule la tension dramatique
        tension = self._estimate_tension(segment, position, total)
        
        # Estime les modalités
        modalities = self._estimate_modalities(segment)
        
        # Extrait l'excerpt
        text_excerpt = segment.text[:150]
        
        return NarrativeNode(
            node_id=f"n{position+1:03d}",
            segment_id=segment.segment_id,
            function_code=function_code,
            function_name=function_name,
            function_family=function_family,
            actants=segment.entities[:6],  # Top 6 actants
            modalities=modalities,
            tension=tension,
            phase=phase,
            text_excerpt=text_excerpt,
        )
    
    def _identify_function(self, segment: NarrativeSegment) -> tuple:
        """
        Identifie la fonction cardinale principale du segment.
        Retourne (code, nom, famille) ou (None, None, None) si aucune.
        """
        text_lower = segment.text.lower()
        
        # Score chaque fonction par nombre de mots-clés trouvés
        scores = []
        for keywords, code, name, family in self.FUNCTION_PATTERNS:
            matches = 0
            for kw in keywords:
                if re.search(r'\b' + re.escape(kw) + r'\b', text_lower):
                    matches += 1
            if matches > 0:
                scores.append((matches, code, name, family))
        
        if not scores:
            return (None, None, None)
        
        # Retourne la fonction avec le plus de correspondances
        scores.sort(key=lambda x: -x[0])
        _, code, name, family = scores[0]
        return (code, name, family)
    
    def _identify_phase(self, segment: NarrativeSegment,
                        position: int, total: int) -> str:
        """Détermine la phase dramatique du segment selon position + indices."""
        text_lower = segment.text.lower()
        
        # Détection d'indices explicites
        for phase, indicators in self.PHASE_INDICATORS.items():
            for ind in indicators:
                if re.search(r'\b' + re.escape(ind) + r'\b', text_lower):
                    return phase
        
        # Par défaut : attribue selon la position
        ratio = position / max(total - 1, 1)
        if ratio < 0.20:
            return 'Exposition'
        elif ratio < 0.55:
            return 'Complication'
        elif ratio < 0.80:
            return 'Climax'
        else:
            return 'Résolution'
    
    def _estimate_tension(self, segment: NarrativeSegment,
                          position: int, total: int) -> float:
        """
        Estime la tension dramatique du segment [0.0, 1.0].
        
        Heuristique : nombre d'actions intenses (combat, trahison, mort) × position.
        Suit globalement une courbe en cloche (Freytag) : montée, climax, descente.
        """
        text_lower = segment.text.lower()
        
        # Mots-clés de tension élevée
        high_tension = ["combat", "guerre", "mort", "tue", "tua", "trahison", "blessa",
                        "terrible", "horreur", "cri", "hurla", "sang", "douleur",
                        "attaque", "fuir", "paniqua", "déchira"]
        # Mots-clés de tension faible
        low_tension = ["calme", "paix", "sereine", "doux", "lumineux", "heureux",
                       "tranquille", "pardonna", "embrassa", "sourit"]
        
        base_tension = 0.3 + 0.5 * (1 - abs((position / max(total - 1, 1)) - 0.7))
        
        h_count = sum(1 for w in high_tension if w in text_lower)
        l_count = sum(1 for w in low_tension if w in text_lower)
        
        tension = base_tension + 0.08 * h_count - 0.05 * l_count
        return max(0.0, min(1.0, tension))
    
    def _estimate_modalities(self, segment: NarrativeSegment) -> Dict[str, float]:
        """
        Estime les valeurs modales greimassiennes : vouloir, devoir, pouvoir, savoir.
        Heuristique : présence de verbes modaux associés.
        """
        text_lower = segment.text.lower()
        
        def score(keywords):
            return min(1.0, sum(0.3 for kw in keywords if kw in text_lower))
        
        return {
            'vouloir': score(["veut", "voulut", "désire", "désira", "souhaite", "souhaita", "rêve"]),
            'devoir':  score(["doit", "dut", "faut", "fallut", "doit", "obligé", "promet", "promit"]),
            'pouvoir': score(["peut", "pouvait", "put", "parvient", "parvint", "réussit"]),
            'savoir':  score(["sait", "savait", "sut", "apprend", "apprit", "découvrit", "comprit"]),
        }
    
    def _classify_transition(self, src: NarrativeNode, tgt: NarrativeNode) -> str:
        """Classifie le type de transition entre deux nœuds."""
        # Shared actants = causal continuity
        shared = set(src.actants) & set(tgt.actants)
        if shared:
            return 'causal'
        # Different phase = temporal
        if src.phase != tgt.phase:
            return 'temporal'
        return 'sequential'
    
    def _add_causal_edges(self, graph: NarrativeGraph) -> None:
        """
        Ajoute des arêtes causales non séquentielles : un événement tardif
        dont les actants se retrouvent dans un nœud antérieur crée un lien rétroactif.
        """
        # Limited to pairs (i, j) where j > i + 1 to avoid duplicating sequential
        for i in range(len(graph.nodes) - 2):
            for j in range(i + 2, min(i + 5, len(graph.nodes))):
                shared = set(graph.nodes[i].actants) & set(graph.nodes[j].actants)
                if len(shared) >= 2:  # Need strong overlap to add causal edge
                    edge = NarrativeEdge(
                        edge_id=f"ec_{i:03d}_{j:03d}",
                        source=graph.nodes[i].node_id,
                        target=graph.nodes[j].node_id,
                        transition_type='causal-distant',
                        weight=0.6,
                    )
                    graph.edges.append(edge)
                    break  # One per starting node
