"""
narria.m4_database.storage — Module 4 : Stockage des graphes narratifs.

Simple stockage sur disque au format JSON. Un graph_id = un fichier.
Pour la version production, ce module sera remplacé par une base de données
avec indexation vectorielle (FAISS) pour la recherche ANN.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import List, Dict, Any, Optional

from narria.core.models import NarrativeGraph, NarrativeNode, NarrativeEdge


class GraphStore:
    """Stockage simple de graphes narratifs sur le disque local."""
    
    def __init__(self, base_dir: Optional[str] = None):
        if base_dir is None:
            import os as _os
            env_dir = _os.environ.get('NARRIA_DATA_DIR')
            if env_dir:
                base_dir = str(Path(env_dir) / 'graphs')
            else:
                base_dir = str(Path.home() / '.narria' / 'graphs')
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
    
    def save(self, graph: NarrativeGraph) -> str:
        """Sauvegarde un graphe. Retourne le chemin du fichier."""
        path = self.base_dir / f"{graph.graph_id}.json"
        path.write_text(json.dumps(graph.to_dict(), ensure_ascii=False, indent=2),
                        encoding='utf-8')
        return str(path)
    
    def load(self, graph_id: str) -> Optional[NarrativeGraph]:
        """Charge un graphe depuis le disque."""
        path = self.base_dir / f"{graph_id}.json"
        if not path.exists():
            return None
        data = json.loads(path.read_text(encoding='utf-8'))
        return self._dict_to_graph(data)
    
    def list_all(self) -> List[Dict[str, Any]]:
        """Liste toutes les métadonnées des graphes stockés."""
        graphs = []
        for f in sorted(self.base_dir.glob('*.json')):
            try:
                data = json.loads(f.read_text(encoding='utf-8'))
                graphs.append({
                    'graph_id': data.get('graph_id'),
                    'title': data.get('metadata', {}).get('title', 'Sans titre'),
                    'author': data.get('metadata', {}).get('author', 'Inconnu'),
                    'n_nodes': data.get('n_nodes', 0),
                })
            except Exception:
                pass
        return graphs
    
    def delete(self, graph_id: str) -> bool:
        """Supprime un graphe stocké."""
        path = self.base_dir / f"{graph_id}.json"
        if path.exists():
            path.unlink()
            return True
        return False
    
    def _dict_to_graph(self, data: Dict[str, Any]) -> NarrativeGraph:
        """Reconstruit un NarrativeGraph à partir d'un dict."""
        nodes = [NarrativeNode(**n) for n in data.get('nodes', [])]
        edges = [NarrativeEdge(**e) for e in data.get('edges', [])]
        return NarrativeGraph(
            graph_id=data['graph_id'],
            metadata=data.get('metadata', {}),
            nodes=nodes,
            edges=edges,
        )
