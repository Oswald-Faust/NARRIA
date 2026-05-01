"""
narria.m4_database.history — Historique persistant des analyses.

Étend GraphStore avec un suivi complet des analyses réalisées :
- Métadonnées de l'analyse (date, mode local/LLM, coût, résumé)
- Liens vers les graphes individuels
- Liens vers les comparaisons effectuées

Stockage dans ~/.narria/history/ :
  - analyses/<analysis_id>.json   : métadonnées d'analyse + ref au graph_id
  - comparisons/<comp_id>.json    : résultats de comparaison
  - index.json                    : index global pour listing rapide
"""

from __future__ import annotations

import json
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List


class AnalysisHistory:
    """
    Gestion de l'historique des analyses réalisées par l'utilisateur.
    """
    
    def __init__(self, base_dir: Optional[Path] = None):
        if base_dir is None:
            # En production, NARRIA_DATA_DIR permet de pointer sur un volume persistant
            import os as _os
            env_dir = _os.environ.get('NARRIA_DATA_DIR')
            if env_dir:
                base_dir = Path(env_dir)
            else:
                base_dir = Path.home() / '.narria'
        self.base_dir = Path(base_dir)
        self.analyses_dir = self.base_dir / 'analyses'
        self.comparisons_dir = self.base_dir / 'comparisons'
        self.graphs_dir = self.base_dir / 'graphs'
        self.index_file = self.base_dir / 'history_index.json'
        
        # Create directories
        for d in (self.analyses_dir, self.comparisons_dir, self.graphs_dir):
            d.mkdir(parents=True, exist_ok=True)
    
    # ─────────────────────────────────────────────────────
    #  ENREGISTREMENT D'ANALYSE
    # ─────────────────────────────────────────────────────
    
    def record_analysis(self, graph_id: str, graph_dict: Dict[str, Any],
                         mode: str = 'local',
                         source_filename: Optional[str] = None,
                         original_text: Optional[str] = None) -> Dict[str, Any]:
        """
        Enregistre une analyse dans l'historique.
        
        Args:
            graph_id: identifiant du graphe
            graph_dict: graphe sérialisé (dict)
            mode: 'local' ou 'llm'
            source_filename: nom de fichier d'origine si applicable
            original_text: texte original (optionnel, peut être tronqué pour stockage)
        
        Returns:
            dict avec les métadonnées de l'analyse (analysis_id, timestamp, etc.)
        """
        analysis_id = f"a_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
        timestamp = datetime.now().isoformat()
        
        meta = graph_dict.get('metadata', {}) or {}
        
        # Build analysis entry
        analysis_entry = {
            'analysis_id': analysis_id,
            'graph_id': graph_id,
            'timestamp': timestamp,
            'date_human': datetime.now().strftime('%d/%m/%Y à %H:%M'),
            'mode': mode,
            'title': meta.get('title', 'Sans titre'),
            'author': meta.get('author', 'Inconnu'),
            'n_nodes': len(graph_dict.get('nodes', [])),
            'n_edges': len(graph_dict.get('edges', [])),
            'source_filename': source_filename,
            'word_count_estimate': len((original_text or '').split()) if original_text else None,
        }
        
        # LLM-specific fields
        if mode == 'llm':
            analysis_entry['summary'] = meta.get('summary', '')
            analysis_entry['genre'] = meta.get('genre', '')
            analysis_entry['tradition'] = meta.get('tradition', '')
            usage = meta.get('llm_usage', {}) or {}
            analysis_entry['cost_usd'] = usage.get('cost_usd', 0)
            analysis_entry['tokens_total'] = (usage.get('input_tokens', 0)
                                               + usage.get('output_tokens', 0))
        
        # Save graph (full)
        graph_path = self.graphs_dir / f"{graph_id}.json"
        graph_path.write_text(
            json.dumps(graph_dict, ensure_ascii=False, indent=2),
            encoding='utf-8'
        )
        
        # Save analysis metadata
        analysis_path = self.analyses_dir / f"{analysis_id}.json"
        analysis_path.write_text(
            json.dumps(analysis_entry, ensure_ascii=False, indent=2),
            encoding='utf-8'
        )
        
        # Optionally save text excerpt
        if original_text:
            preview_text = original_text[:5000]  # First 5000 chars only
            analysis_entry['text_preview'] = preview_text
        
        # Update the global index
        self._update_index_for_analysis(analysis_entry)
        
        return analysis_entry
    
    def record_comparison(self, ref_id: str, cand_id: str,
                           comparison_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enregistre une comparaison dans l'historique.
        
        Args:
            ref_id: graph_id de référence
            cand_id: graph_id de candidate
            comparison_result: dict du résultat (scores, verdict, etc.)
        
        Returns:
            dict avec les métadonnées de la comparaison
        """
        comp_id = f"c_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
        timestamp = datetime.now().isoformat()
        
        # Look up the analysis entries to enrich the comparison
        ref_analysis = self._find_analysis_by_graph_id(ref_id)
        cand_analysis = self._find_analysis_by_graph_id(cand_id)
        
        comp_entry = {
            'comparison_id': comp_id,
            'timestamp': timestamp,
            'date_human': datetime.now().strftime('%d/%m/%Y à %H:%M'),
            'ref_graph_id': ref_id,
            'cand_graph_id': cand_id,
            'ref_title': ref_analysis.get('title', 'Inconnu') if ref_analysis else '?',
            'ref_author': ref_analysis.get('author', 'Inconnu') if ref_analysis else '?',
            'cand_title': cand_analysis.get('title', 'Inconnu') if cand_analysis else '?',
            'cand_author': cand_analysis.get('author', 'Inconnu') if cand_analysis else '?',
            'sns': comparison_result.get('sns'),
            'ss': comparison_result.get('ss'),
            'st': comparison_result.get('st'),
            'srj': comparison_result.get('srj'),
            'srj_class': comparison_result.get('srj_class'),
            'modality': comparison_result.get('modality'),
            'full_result': comparison_result,
        }
        
        # Save comparison
        comp_path = self.comparisons_dir / f"{comp_id}.json"
        comp_path.write_text(
            json.dumps(comp_entry, ensure_ascii=False, indent=2),
            encoding='utf-8'
        )
        
        self._update_index_for_comparison(comp_entry)
        
        return comp_entry
    
    # ─────────────────────────────────────────────────────
    #  CONSULTATION
    # ─────────────────────────────────────────────────────
    
    def list_analyses(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Liste toutes les analyses, les plus récentes en premier."""
        analyses = []
        for f in sorted(self.analyses_dir.glob('*.json'), reverse=True):
            try:
                data = json.loads(f.read_text(encoding='utf-8'))
                analyses.append(data)
            except Exception:
                continue
        if limit:
            analyses = analyses[:limit]
        return analyses
    
    def list_comparisons(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Liste toutes les comparaisons, les plus récentes en premier."""
        comparisons = []
        for f in sorted(self.comparisons_dir.glob('*.json'), reverse=True):
            try:
                data = json.loads(f.read_text(encoding='utf-8'))
                # Strip 'full_result' from list view to keep it light
                comp_summary = {k: v for k, v in data.items() if k != 'full_result'}
                comparisons.append(comp_summary)
            except Exception:
                continue
        if limit:
            comparisons = comparisons[:limit]
        return comparisons
    
    def get_analysis(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        """Récupère une analyse par son ID, avec son graphe complet."""
        path = self.analyses_dir / f"{analysis_id}.json"
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text(encoding='utf-8'))
        except Exception:
            return None
        
        # Load the graph too
        graph_id = data.get('graph_id')
        if graph_id:
            graph_path = self.graphs_dir / f"{graph_id}.json"
            if graph_path.exists():
                try:
                    data['graph'] = json.loads(graph_path.read_text(encoding='utf-8'))
                except Exception:
                    pass
        return data
    
    def get_comparison(self, comparison_id: str) -> Optional[Dict[str, Any]]:
        """Récupère une comparaison par son ID."""
        path = self.comparisons_dir / f"{comparison_id}.json"
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding='utf-8'))
        except Exception:
            return None
    
    def get_graph_dict(self, graph_id: str) -> Optional[Dict[str, Any]]:
        """Récupère un graphe brut par son graph_id."""
        path = self.graphs_dir / f"{graph_id}.json"
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding='utf-8'))
        except Exception:
            return None
    
    # ─────────────────────────────────────────────────────
    #  SUPPRESSION
    # ─────────────────────────────────────────────────────
    
    def delete_analysis(self, analysis_id: str) -> bool:
        """Supprime une analyse et son graphe associé."""
        path = self.analyses_dir / f"{analysis_id}.json"
        if not path.exists():
            return False
        try:
            data = json.loads(path.read_text(encoding='utf-8'))
            graph_id = data.get('graph_id')
            if graph_id:
                graph_path = self.graphs_dir / f"{graph_id}.json"
                graph_path.unlink(missing_ok=True)
            path.unlink()
            self._rebuild_index()
            return True
        except Exception:
            return False
    
    def delete_comparison(self, comparison_id: str) -> bool:
        """Supprime une comparaison."""
        path = self.comparisons_dir / f"{comparison_id}.json"
        if not path.exists():
            return False
        path.unlink()
        self._rebuild_index()
        return True
    
    def clear_all(self) -> Dict[str, int]:
        """Efface tout l'historique. Retourne les compteurs supprimés."""
        n_analyses = len(list(self.analyses_dir.glob('*.json')))
        n_comparisons = len(list(self.comparisons_dir.glob('*.json')))
        n_graphs = len(list(self.graphs_dir.glob('*.json')))
        
        for f in self.analyses_dir.glob('*.json'):
            f.unlink()
        for f in self.comparisons_dir.glob('*.json'):
            f.unlink()
        for f in self.graphs_dir.glob('*.json'):
            f.unlink()
        
        if self.index_file.exists():
            self.index_file.unlink()
        
        return {
            'n_analyses': n_analyses,
            'n_comparisons': n_comparisons,
            'n_graphs': n_graphs,
        }
    
    # ─────────────────────────────────────────────────────
    #  STATISTIQUES
    # ─────────────────────────────────────────────────────
    
    def get_stats(self) -> Dict[str, Any]:
        """Retourne des statistiques globales sur l'historique."""
        analyses = self.list_analyses()
        comparisons = self.list_comparisons()
        
        n_local = sum(1 for a in analyses if a.get('mode') == 'local')
        n_llm = sum(1 for a in analyses if a.get('mode') == 'llm')
        total_cost = sum(a.get('cost_usd', 0) or 0 for a in analyses)
        total_tokens = sum(a.get('tokens_total', 0) or 0 for a in analyses)
        
        # First and last analysis dates
        first_date = analyses[-1]['timestamp'] if analyses else None
        last_date = analyses[0]['timestamp'] if analyses else None
        
        return {
            'n_analyses': len(analyses),
            'n_comparisons': len(comparisons),
            'n_local_analyses': n_local,
            'n_llm_analyses': n_llm,
            'total_cost_usd': round(total_cost, 4),
            'total_tokens': total_tokens,
            'first_analysis_date': first_date,
            'last_analysis_date': last_date,
        }
    
    # ─────────────────────────────────────────────────────
    #  INDEX (interne)
    # ─────────────────────────────────────────────────────
    
    def _find_analysis_by_graph_id(self, graph_id: str) -> Optional[Dict[str, Any]]:
        """Trouve une analyse correspondant à un graph_id donné."""
        for a in self.list_analyses():
            if a.get('graph_id') == graph_id:
                return a
        return None
    
    def _update_index_for_analysis(self, entry: Dict[str, Any]) -> None:
        """Met à jour l'index avec une nouvelle analyse (best-effort)."""
        try:
            self._rebuild_index()
        except Exception:
            pass
    
    def _update_index_for_comparison(self, entry: Dict[str, Any]) -> None:
        """Met à jour l'index avec une nouvelle comparaison."""
        try:
            self._rebuild_index()
        except Exception:
            pass
    
    def _rebuild_index(self) -> None:
        """Reconstruit l'index global."""
        index = {
            'analyses': [
                {'id': a['analysis_id'], 'title': a.get('title'),
                 'timestamp': a['timestamp']}
                for a in self.list_analyses()
            ],
            'comparisons': [
                {'id': c['comparison_id'],
                 'ref': c.get('ref_title'),
                 'cand': c.get('cand_title'),
                 'timestamp': c['timestamp']}
                for c in self.list_comparisons()
            ],
            'updated': datetime.now().isoformat(),
        }
        self.index_file.write_text(
            json.dumps(index, ensure_ascii=False, indent=2),
            encoding='utf-8'
        )
