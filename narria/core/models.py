"""
narria.core.models — Modèles de données centraux du système NARR'IA.

Classes de données simples (sans dépendance à pydantic) pour représenter
le graphe narratif (NarRep-Graph), les nœuds, les transitions, etc.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


@dataclass
class NarrativeNode:
    """Un nœud du graphe narratif : une fonction cardinale identifiée dans le récit."""
    node_id: str
    segment_id: str
    function_code: Optional[str] = None       # Ex. "F05" (fonction cardinale)
    function_family: Optional[str] = None     # Ex. "Rupture"
    function_name: Optional[str] = None       # Ex. "Méfait"
    actants: List[str] = field(default_factory=list)  # Personnages impliqués
    modalities: Dict[str, float] = field(default_factory=dict)  # vouloir, pouvoir, devoir, savoir
    tension: float = 0.5                       # Valeur d'intensité dramatique [0, 1]
    phase: Optional[str] = None                # Phase dramatique (Exposition, Complication, etc.)
    text_excerpt: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'node_id': self.node_id,
            'segment_id': self.segment_id,
            'function_code': self.function_code,
            'function_family': self.function_family,
            'function_name': self.function_name,
            'actants': self.actants,
            'modalities': self.modalities,
            'tension': self.tension,
            'phase': self.phase,
            'text_excerpt': self.text_excerpt[:150],
        }


@dataclass
class NarrativeEdge:
    """Une transition narrative entre deux nœuds."""
    edge_id: str
    source: str    # node_id source
    target: str    # node_id target
    transition_type: str = "causal"   # causal, temporal, contrast, etc.
    weight: float = 1.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'edge_id': self.edge_id,
            'source': self.source,
            'target': self.target,
            'transition_type': self.transition_type,
            'weight': self.weight,
        }


@dataclass
class NarrativeGraph:
    """
    Graphe narratif complet — le NarRep-Graph.
    Représente l'ADN d'intrigue d'une œuvre narrative.
    """
    graph_id: str
    metadata: Dict[str, Any]
    nodes: List[NarrativeNode] = field(default_factory=list)
    edges: List[NarrativeEdge] = field(default_factory=list)
    
    def function_sequence(self) -> List[str]:
        """Séquence des codes de fonctions dans l'ordre narratif."""
        return [n.function_code for n in self.nodes if n.function_code]
    
    def actantial_chain(self) -> List[List[str]]:
        """Chaîne actantielle : liste des configurations actantielles par nœud."""
        return [n.actants for n in self.nodes]
    
    def tension_profile(self) -> List[float]:
        """Signature tensive : séquence des valeurs d'intensité."""
        return [n.tension for n in self.nodes]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'graph_id': self.graph_id,
            'metadata': self.metadata,
            'nodes': [n.to_dict() for n in self.nodes],
            'edges': [e.to_dict() for e in self.edges],
            'n_nodes': len(self.nodes),
            'n_edges': len(self.edges),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'NarrativeGraph':
        nodes = [
            NarrativeNode(
                node_id=n['node_id'],
                segment_id=n['segment_id'],
                function_code=n.get('function_code'),
                function_family=n.get('function_family'),
                function_name=n.get('function_name'),
                actants=n.get('actants', []),
                modalities=n.get('modalities', {}),
                tension=n.get('tension', 0.5),
                phase=n.get('phase'),
                text_excerpt=n.get('text_excerpt', ''),
            )
            for n in data.get('nodes', [])
        ]
        edges = [
            NarrativeEdge(
                edge_id=e['edge_id'],
                source=e['source'],
                target=e['target'],
                transition_type=e.get('transition_type', 'causal'),
                weight=e.get('weight', 1.0),
            )
            for e in data.get('edges', [])
        ]
        return cls(
            graph_id=data['graph_id'],
            metadata=data.get('metadata', {}),
            nodes=nodes,
            edges=edges,
        )
    


@dataclass
class ComparisonResult:
    """Résultat d'une comparaison de deux graphes narratifs (Module 3)."""
    sns: float                          # Score Narratif de Similarité (composite)
    sns_normalized: float               # SNS normalisé par genre (percentile)
    ss: float                           # Score de Spécificité
    st: float                           # Score de Transformation
    srj: float                          # Score de Risque Juridique
    srj_level: str                      # "Faible" / "Modéré" / "Élevé" / "Critique"
    
    # Composantes du SNS
    s_iso: float
    s_ged: float
    s_func: float
    s_act: float
    s_tens: float
    
    # Classification
    detected_modality: str              # Transposition / Amplification / Condensation / Inversion / Hybridation / Aucune
    verdict: str                        # Texte interprétatif
    
    # Correspondances trouvées
    correspondences: List[Dict[str, Any]] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
