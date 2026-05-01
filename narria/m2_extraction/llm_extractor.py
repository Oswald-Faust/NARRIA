"""
narria.m2_extraction.llm_extractor — Extraction du graphe narratif via LLM.

Utilise Claude (Anthropic) pour identifier avec précision les fonctions
narratives, les actants, les modalités greimassiennes et la signature tensive.

Cet extracteur est le pendant "haute précision" du GraphExtractor local :
- Le GraphExtractor local utilise des heuristiques par mots-clés (rapide, imprécis)
- Le LLMGraphExtractor utilise Claude (précis, payant, nécessite Internet)

L'application bascule entre les deux selon la configuration de l'utilisateur.
"""

from __future__ import annotations

import uuid
from typing import List, Dict, Any, Optional

from narria.core.models import NarrativeGraph, NarrativeNode, NarrativeEdge
from narria.m1_segmentation.segmenter import NarrativeSegment


class LLMGraphExtractor:
    """
    Extracteur de graphe narratif utilisant Claude pour l'analyse précise.
    
    Contrairement au GraphExtractor local (heuristique par mots-clés), ce
    module effectue une analyse sémantique profonde via LLM, ce qui lui
    permet d'identifier les fonctions narratives indépendamment du lexique
    employé dans le texte.
    """
    
    def __init__(self, claude_client):
        """
        Args:
            claude_client: instance de narria.llm.ClaudeClient configurée.
        """
        self.claude = claude_client
        self.last_usage = None  # Track usage of most recent call
    
    def extract(self, segments: List[NarrativeSegment],
                metadata: Optional[Dict[str, Any]] = None,
                full_text: Optional[str] = None) -> NarrativeGraph:
        """
        Construit le graphe narratif à partir du texte via Claude.
        
        Pour les textes courts (< 180 000 tokens ≈ 135 000 mots), envoie le
        texte complet à Claude en une seule requête.
        
        Pour les textes longs, applique automatiquement un découpage avec
        recouvrement narratif et fusionne les graphes partiels.
        
        Args:
            segments: segments produits par le Module 1 (pour fallback si
                      full_text est None, on reconstitue le texte à partir
                      des segments)
            metadata: dict avec 'title' et 'author'
            full_text: texte complet original (recommandé pour meilleure analyse)
        """
        if metadata is None:
            metadata = {}
        
        # Reconstitute text from segments if not provided
        if full_text is None:
            full_text = '\n\n'.join(seg.text for seg in segments)
        
        # Detect if chunking is needed
        from narria.llm.chunker import (
            estimate_tokens, needs_chunking, chunk_text, merge_partial_graphs,
        )
        
        if needs_chunking(full_text):
            return self._extract_with_chunking(full_text, metadata)
        
        # Standard path: single request
        analysis = self.claude.analyze_narrative(
            text=full_text,
            title=metadata.get('title', ''),
            author=metadata.get('author', ''),
        )
        
        self.last_usage = analysis.get('usage', {})
        
        if 'error' in analysis:
            return self._build_error_graph(metadata, analysis)
        
        return self._build_graph_from_analysis(analysis, metadata)
    
    def _extract_with_chunking(self, full_text: str,
                                metadata: Dict[str, Any]) -> 'NarrativeGraph':
        """
        Pipeline d'analyse pour les textes dépassant le contexte de Claude.
        Découpe → analyse de chaque bloc → fusion.
        """
        from narria.llm.chunker import chunk_text, merge_partial_graphs
        
        chunks = chunk_text(full_text)
        
        if not chunks:
            return self._build_error_graph(metadata, {
                'error': 'Texte vide ou inutilisable après découpage'
            })
        
        # Analyser chaque bloc séquentiellement
        partial_results = []
        title = metadata.get('title', '')
        author = metadata.get('author', '')
        
        for chunk in chunks:
            # On annote le titre pour aider Claude à savoir où on est dans l'œuvre
            chunk_title = f"{title} ({chunk.label})" if title else chunk.label
            
            try:
                result = self.claude.analyze_narrative(
                    text=chunk.text,
                    title=chunk_title,
                    author=author,
                )
                partial_results.append(result)
            except Exception as e:
                # Erreur sur un bloc : on l'enregistre mais on continue
                partial_results.append({
                    'error': f"Erreur sur {chunk.label} : {str(e)}",
                    'nodes': [],
                    'main_actants': {},
                    'usage': {'input_tokens': 0, 'output_tokens': 0, 'cost_usd': 0.0},
                })
        
        # Vérifier qu'on a au moins un résultat utilisable
        valid_results = [r for r in partial_results if 'error' not in r and r.get('nodes')]
        if not valid_results:
            errors = [r.get('error') for r in partial_results if 'error' in r]
            return self._build_error_graph(metadata, {
                'error': f"Aucun bloc n'a pu être analysé. Erreurs : {'; '.join(errors[:3])}"
            })
        
        # Fusion des résultats partiels
        merged = merge_partial_graphs(partial_results, chunks)
        
        # Track usage cumulé
        self.last_usage = merged.get('usage', {})
        
        # Construire le graphe final
        graph = self._build_graph_from_analysis(merged, metadata)
        
        # Annoter le graphe avec les infos de fusion
        graph.metadata['chunked'] = True
        graph.metadata['n_chunks'] = len(chunks)
        graph.metadata['merge_info'] = merged.get('merge_info', {})
        
        # Si certains blocs ont échoué, le signaler
        n_errors = sum(1 for r in partial_results if 'error' in r)
        if n_errors > 0:
            graph.metadata['chunk_errors'] = n_errors
            graph.metadata['warning'] = (
                f"{n_errors} bloc(s) sur {len(chunks)} n'ont pas pu être analysés. "
                "Le graphe résultant peut être incomplet."
            )
        
        return graph
    
    def _build_graph_from_analysis(self, analysis: Dict[str, Any],
                                    metadata: Dict[str, Any]) -> NarrativeGraph:
        """Construit un NarrativeGraph à partir de la réponse structurée de Claude."""
        graph_id = f"g_{uuid.uuid4().hex[:10]}"
        
        # Enrich metadata with Claude's analysis results
        enriched_meta = dict(metadata)
        enriched_meta['mode'] = 'llm'
        enriched_meta['summary'] = analysis.get('summary', '')
        enriched_meta['genre'] = analysis.get('genre', '')
        enriched_meta['tradition'] = analysis.get('tradition', '')
        enriched_meta['main_actants'] = analysis.get('main_actants', {})
        enriched_meta['thematic_keywords'] = analysis.get('thematic_keywords', [])
        enriched_meta['llm_usage'] = analysis.get('usage', {})
        
        graph = NarrativeGraph(graph_id=graph_id, metadata=enriched_meta)
        
        # Build nodes from the LLM response
        llm_nodes = analysis.get('nodes', [])
        for i, llm_node in enumerate(llm_nodes):
            node = self._build_node_from_llm(llm_node, i)
            if node:
                graph.nodes.append(node)
        
        # Build sequential edges
        for i in range(len(graph.nodes) - 1):
            src = graph.nodes[i]
            tgt = graph.nodes[i + 1]
            edge_type = self._classify_transition(src, tgt)
            edge = NarrativeEdge(
                edge_id=f"e_{i:03d}",
                source=src.node_id,
                target=tgt.node_id,
                transition_type=edge_type,
                weight=1.0,
            )
            graph.edges.append(edge)
        
        # Add causal edges between distant but related nodes
        self._add_causal_edges(graph)
        
        return graph
    
    def _build_node_from_llm(self, llm_node: Dict[str, Any], position: int) -> Optional[NarrativeNode]:
        """Construit un NarrativeNode à partir d'une entrée de la réponse Claude."""
        sequence = llm_node.get('sequence', position + 1)
        function_code = llm_node.get('function_code')
        function_name = llm_node.get('function_name')
        function_family = llm_node.get('function_family')
        
        actants = llm_node.get('actants', [])
        if not isinstance(actants, list):
            actants = []
        
        modalities = llm_node.get('modalities', {})
        if not isinstance(modalities, dict):
            modalities = {}
        
        # Clamp modality values to [0, 1]
        clean_modalities = {}
        for key in ('vouloir', 'devoir', 'pouvoir', 'savoir'):
            val = modalities.get(key, 0.0)
            try:
                val = float(val)
                clean_modalities[key] = max(0.0, min(1.0, val))
            except (ValueError, TypeError):
                clean_modalities[key] = 0.0
        
        # Clamp tension
        tension = llm_node.get('tension', 0.5)
        try:
            tension = max(0.0, min(1.0, float(tension)))
        except (ValueError, TypeError):
            tension = 0.5
        
        phase = llm_node.get('phase', 'Exposition')
        text_excerpt = llm_node.get('text_excerpt', '')
        justification = llm_node.get('justification', '')
        
        # Build node. We add justification to the text_excerpt for richer display.
        combined_excerpt = text_excerpt
        if justification and justification != text_excerpt:
            combined_excerpt = f"{text_excerpt}\n— {justification}"
        
        return NarrativeNode(
            node_id=f"n{sequence:03d}",
            segment_id=f"llm_{sequence:03d}",
            function_code=function_code,
            function_name=function_name,
            function_family=function_family,
            actants=actants[:8],  # Cap at 8 to keep things manageable
            modalities=clean_modalities,
            tension=tension,
            phase=phase,
            text_excerpt=combined_excerpt[:400],
        )
    
    def _classify_transition(self, src: NarrativeNode, tgt: NarrativeNode) -> str:
        """Classifie le type de transition entre deux nœuds."""
        # Extract character names from "Name (role)" format
        def get_character_names(actants):
            names = []
            for a in actants:
                if '(' in a:
                    names.append(a.split('(')[0].strip().lower())
                else:
                    names.append(a.strip().lower())
            return set(names)
        
        src_chars = get_character_names(src.actants)
        tgt_chars = get_character_names(tgt.actants)
        
        if src_chars & tgt_chars:
            return 'causal'
        if src.phase != tgt.phase:
            return 'temporal'
        return 'sequential'
    
    def _add_causal_edges(self, graph: NarrativeGraph) -> None:
        """
        Ajoute des arêtes causales non séquentielles pour les nœuds reliés
        par le retour d'actants communs (comme dans l'extracteur local).
        """
        def get_names(actants):
            names = []
            for a in actants:
                if '(' in a:
                    names.append(a.split('(')[0].strip().lower())
                else:
                    names.append(a.strip().lower())
            return set(names)
        
        for i in range(len(graph.nodes) - 2):
            for j in range(i + 2, min(i + 5, len(graph.nodes))):
                shared = get_names(graph.nodes[i].actants) & get_names(graph.nodes[j].actants)
                if len(shared) >= 2:
                    edge = NarrativeEdge(
                        edge_id=f"ec_{i:03d}_{j:03d}",
                        source=graph.nodes[i].node_id,
                        target=graph.nodes[j].node_id,
                        transition_type='causal-distant',
                        weight=0.6,
                    )
                    graph.edges.append(edge)
                    break
    
    def _build_error_graph(self, metadata: Dict[str, Any],
                            analysis: Dict[str, Any]) -> NarrativeGraph:
        """Construit un graphe minimal en cas d'erreur d'analyse."""
        graph_id = f"g_error_{uuid.uuid4().hex[:8]}"
        enriched_meta = dict(metadata)
        enriched_meta['mode'] = 'llm'
        enriched_meta['error'] = analysis.get('error', 'Erreur inconnue')
        enriched_meta['raw_response'] = analysis.get('raw_response', '')[:200]
        return NarrativeGraph(graph_id=graph_id, metadata=enriched_meta)
