"""
narria.m3_comparison.comparator — Module 3 : Analyse comparative.

Compare deux graphes narratifs et produit les scores SNS, SS, ST, SRJ
décrits dans le chapitre 8 de l'ouvrage. Implémente une cascade de phases :

    Phase 1 : recherche de candidats proches (ANN) — inutile en comparaison 1-vs-1
    Phase 2 : isomorphisme de sous-graphes (NARR'IA-VF2 simplifié)
    Phase 3 : distance d'édition de graphes (GED narrative)
    Phase 4 : similitude des séquences de fonctions (DTW approximé)
    Phase 5 : score SNS composite + classification de modalité
"""

from __future__ import annotations

import math
import re
from typing import List, Dict, Any, Tuple

from narria.core.models import NarrativeGraph, NarrativeNode, ComparisonResult


class NarrativeComparator:
    """
    Comparateur de graphes narratifs. Produit un ComparisonResult complet.
    """
    
    # Pondérations du SNS composite
    W_ISO = 0.25
    W_GED = 0.20
    W_FUNC = 0.25
    W_ACT = 0.15
    W_TENS = 0.15
    
    def compare(self, graph_ref: NarrativeGraph, graph_cand: NarrativeGraph) -> ComparisonResult:
        """Comparaison complète de deux graphes narratifs."""
        
        # ─── Phase 2 : Isomorphisme ─────────────────────────
        s_iso, iso_correspondences = self._score_isomorphism(graph_ref, graph_cand)
        
        # ─── Phase 3 : GED narrative ────────────────────────
        s_ged = self._score_ged(graph_ref, graph_cand)
        
        # ─── Phase 4 : DTW des séquences fonctionnelles ─────
        s_func = self._score_function_sequence(graph_ref, graph_cand)
        
        # ─── Phase 4b : Chaîne actantielle ──────────────────
        s_act = self._score_actantial_chain(graph_ref, graph_cand)
        
        # ─── Phase 4c : Signature tensive ───────────────────
        s_tens = self._score_tension_profile(graph_ref, graph_cand)
        
        # ─── Phase 5 : SNS composite ────────────────────────
        sns = (self.W_ISO * s_iso + self.W_GED * s_ged +
               self.W_FUNC * s_func + self.W_ACT * s_act +
               self.W_TENS * s_tens)
        
        # Normalisation : pour le prototype, le SNS_N est le SNS brut rapporté
        # à la distribution de référence (simplifiée ici).
        sns_normalized = min(1.0, sns * 1.15)
        
        # Score de Spécificité : inverse du SNS attendu en convergence indépendante
        # Plus la similarité est élevée au-delà de 0.4 (base de genre), plus SS est élevé
        ss = max(0.0, (sns - 0.4) / 0.6)
        
        # Score de Transformation : mesure composite à 5 dimensions
        st = self._score_transformation(graph_ref, graph_cand, s_iso)
        
        # Classification de modalité
        modality = self._classify_modality(
            graph_ref, graph_cand, s_iso, s_func, s_tens, st
        )
        
        # Score de Risque Juridique
        srj, srj_level = self._evaluate_srj(sns, ss, modality)
        
        # Verdict interprétatif
        verdict = self._build_verdict(sns, ss, st, modality)
        
        # Warnings éthiques
        warnings = self._build_warnings(sns, graph_ref, graph_cand)
        
        return ComparisonResult(
            sns=sns,
            sns_normalized=sns_normalized,
            ss=ss,
            st=st,
            srj=srj,
            srj_level=srj_level,
            s_iso=s_iso,
            s_ged=s_ged,
            s_func=s_func,
            s_act=s_act,
            s_tens=s_tens,
            detected_modality=modality,
            verdict=verdict,
            correspondences=iso_correspondences,
            warnings=warnings,
        )
    
    # ───────────────────────────────────────────────────────
    #  SCORES INDIVIDUELS
    # ───────────────────────────────────────────────────────
    
    def _score_isomorphism(self, g_ref: NarrativeGraph,
                            g_cand: NarrativeGraph) -> Tuple[float, List[Dict[str, Any]]]:
        """
        Score d'isomorphisme : proportion de nœuds du candidat qui ont une
        correspondance de fonction et d'actants dans la référence.
        """
        if not g_ref.nodes or not g_cand.nodes:
            return 0.0, []
        
        correspondences = []
        matched = 0
        
        for c_node in g_cand.nodes:
            best_match = None
            best_score = 0.0
            
            for r_node in g_ref.nodes:
                score = self._node_similarity(r_node, c_node)
                if score > best_score:
                    best_score = score
                    best_match = r_node
            
            if best_match and best_score > 0.3:
                matched += 1
                correspondences.append({
                    'cand_node': c_node.node_id,
                    'cand_function': c_node.function_code or '—',
                    'ref_node': best_match.node_id,
                    'ref_function': best_match.function_code or '—',
                    'similarity': best_score,
                })
        
        score = matched / len(g_cand.nodes)
        # Sort correspondences by similarity desc
        correspondences.sort(key=lambda c: -c['similarity'])
        return score, correspondences
    
    def _node_similarity(self, n1: NarrativeNode, n2: NarrativeNode) -> float:
        """Similarité entre deux nœuds : fonction + actants + modalités + tension."""
        score = 0.0
        
        # Fonction (40 %)
        if n1.function_code and n2.function_code:
            if n1.function_code == n2.function_code:
                score += 0.40
            elif n1.function_family == n2.function_family:
                score += 0.25
        
        # Famille actantielle (30 %) — on compare le nombre d'actants
        if n1.actants and n2.actants:
            if abs(len(n1.actants) - len(n2.actants)) <= 1:
                score += 0.20
            # Bonus si rôles analogues
            if len(n1.actants) >= 1 and len(n2.actants) >= 1:
                score += 0.10
        
        # Phase (10 %)
        if n1.phase == n2.phase:
            score += 0.10
        
        # Tension (10 %) — tolérance de 0.25
        if abs(n1.tension - n2.tension) < 0.25:
            score += 0.10
        
        # Modalités (10 %)
        if n1.modalities and n2.modalities:
            mod_sim = self._modality_similarity(n1.modalities, n2.modalities)
            score += 0.10 * mod_sim
        
        return score
    
    def _modality_similarity(self, m1: Dict[str, float], m2: Dict[str, float]) -> float:
        """Similarité cosinus simplifiée entre deux vecteurs modaux."""
        keys = set(m1.keys()) | set(m2.keys())
        if not keys:
            return 0.0
        dot = sum(m1.get(k, 0) * m2.get(k, 0) for k in keys)
        n1 = math.sqrt(sum(v * v for v in m1.values()))
        n2 = math.sqrt(sum(v * v for v in m2.values()))
        if n1 == 0 or n2 == 0:
            return 0.0
        return dot / (n1 * n2)
    
    def _score_ged(self, g_ref: NarrativeGraph, g_cand: NarrativeGraph) -> float:
        """
        Distance d'édition de graphes normalisée. Approximation :
        on compare les tailles + la proportion de fonctions communes.
        Retourne une similarité [0, 1] (1 = graphes identiques).
        """
        if not g_ref.nodes or not g_cand.nodes:
            return 0.0
        
        # Fonctions présentes dans chaque graphe
        funcs_ref = set(n.function_code for n in g_ref.nodes if n.function_code)
        funcs_cand = set(n.function_code for n in g_cand.nodes if n.function_code)
        
        if not funcs_ref and not funcs_cand:
            return 0.5
        if not funcs_ref or not funcs_cand:
            return 0.0
        
        # Jaccard
        intersection = len(funcs_ref & funcs_cand)
        union = len(funcs_ref | funcs_cand)
        jaccard = intersection / union if union > 0 else 0.0
        
        # Pénalité de taille
        size_diff = abs(len(g_ref.nodes) - len(g_cand.nodes))
        size_max = max(len(g_ref.nodes), len(g_cand.nodes))
        size_penalty = size_diff / size_max if size_max > 0 else 0.0
        
        return max(0.0, jaccard * (1 - 0.3 * size_penalty))
    
    def _score_function_sequence(self, g_ref: NarrativeGraph,
                                  g_cand: NarrativeGraph) -> float:
        """
        Similarité des séquences de fonctions (DTW approximé).
        """
        seq_ref = g_ref.function_sequence()
        seq_cand = g_cand.function_sequence()
        
        if not seq_ref or not seq_cand:
            return 0.0
        
        # DTW simplifié via Longest Common Subsequence
        m, n = len(seq_ref), len(seq_cand)
        dp = [[0] * (n + 1) for _ in range(m + 1)]
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if seq_ref[i-1] == seq_cand[j-1]:
                    dp[i][j] = dp[i-1][j-1] + 1
                else:
                    dp[i][j] = max(dp[i-1][j], dp[i][j-1])
        lcs = dp[m][n]
        return lcs / max(m, n)
    
    def _score_actantial_chain(self, g_ref: NarrativeGraph,
                                g_cand: NarrativeGraph) -> float:
        """
        Score actantiel composite combinant deux mesures :
        1. Persistance des actants nommés dans les nœuds (chaîne actantielle)
        2. Alignement des schémas greimassiens principaux (avec sélection de la
           configuration v1/v2 maximisant la cohérence inter-œuvres)
        
        Le S_ACT final est la moyenne de ces deux mesures.
        
        LIMITES CONNUES (calibration empirique en cours) :
        - La similarité Jaccard sur les actants nommés ("Loup" vs "Le Loup
          (agent prédateur)") est trop stricte et confond paraphrases avec
          différences. Une version future devrait utiliser des embeddings
          sémantiques (SentenceTransformers) pour une comparaison plus juste.
        - La pondération à 50/50 entre persistance et alignement greimassien
          n'est pas calibrée empiriquement. Pour des œuvres courtes (fables),
          le schéma greimassien serait plus stable que les actants nommés.
        - Le mécanisme de double extraction v1/v2 n'est efficace que si le LLM
          fournit effectivement les deux configurations distinctes, ce qui
          n'est pas toujours le cas.
        """
        # --- Mesure 1 : chaîne actantielle classique ---
        chain_score = self._score_actantial_persistence(g_ref, g_cand)
        
        # --- Mesure 2 : alignement des schémas greimassiens (avec sélection v1/v2) ---
        greimas_score, best_combo = self._score_greimas_alignment(g_ref, g_cand)
        
        # Stocker la combinaison retenue pour la transparence dans le rapport
        # (sera lue par le comparator principal pour annoter le verdict)
        if not hasattr(self, '_last_actantial_combo'):
            self._last_actantial_combo = None
        self._last_actantial_combo = best_combo
        
        # Combinaison équilibrée des deux mesures
        return (chain_score + greimas_score) / 2.0
    
    def _score_actantial_persistence(self, g_ref: NarrativeGraph,
                                       g_cand: NarrativeGraph) -> float:
        """
        Mesure historique : compare la persistance des actants présents dans
        les nœuds narratifs.
        """
        if not g_ref.nodes or not g_cand.nodes:
            return 0.0
        
        # Count de tous les actants présents
        actants_ref = {}
        for node in g_ref.nodes:
            for a in node.actants:
                actants_ref[a] = actants_ref.get(a, 0) + 1
        
        actants_cand = {}
        for node in g_cand.nodes:
            for a in node.actants:
                actants_cand[a] = actants_cand.get(a, 0) + 1
        
        if not actants_ref or not actants_cand:
            return 0.0
        
        # Compare the distribution of actantial importance (rank-based)
        top_ref = sorted(actants_ref.values(), reverse=True)
        top_cand = sorted(actants_cand.values(), reverse=True)
        
        # Similarity = ratio of top-3 actant importance
        k = min(3, len(top_ref), len(top_cand))
        if k == 0:
            return 0.0
        
        sum_ref = sum(top_ref[:k])
        sum_cand = sum(top_cand[:k])
        
        if max(sum_ref, sum_cand) == 0:
            return 0.0
        
        return min(sum_ref, sum_cand) / max(sum_ref, sum_cand)
    
    def _score_greimas_alignment(self, g_ref: NarrativeGraph,
                                   g_cand: NarrativeGraph) -> Tuple[float, str]:
        """
        Aligne les schémas actantiels greimassiens (Sujet/Objet/etc.) entre
        deux œuvres en testant toutes les combinaisons des configurations
        v1 (focus agent_actif) et v2 (focus patient_central) extraites par le LLM.
        
        Retourne le meilleur score et la combinaison retenue (par exemple "v1↔v1").
        """
        meta_ref = g_ref.metadata or {}
        meta_cand = g_cand.metadata or {}
        
        # Récupérer les deux configurations possibles pour chaque œuvre
        # Compatibilité : si v1/v2 absents, utiliser main_actants (mode legacy)
        ref_v1 = meta_ref.get('main_actants_v1') or meta_ref.get('main_actants') or {}
        ref_v2 = meta_ref.get('main_actants_v2') or meta_ref.get('main_actants') or {}
        cand_v1 = meta_cand.get('main_actants_v1') or meta_cand.get('main_actants') or {}
        cand_v2 = meta_cand.get('main_actants_v2') or meta_cand.get('main_actants') or {}
        
        # Si aucune configuration disponible, retourner score neutre
        if not (ref_v1 or ref_v2) or not (cand_v1 or cand_v2):
            return 0.5, "indisponible"
        
        # Tester les 4 combinaisons et retenir la meilleure
        combinations = [
            (ref_v1, cand_v1, "v1↔v1"),
            (ref_v1, cand_v2, "v1↔v2"),
            (ref_v2, cand_v1, "v2↔v1"),
            (ref_v2, cand_v2, "v2↔v2"),
        ]
        
        best_score = 0.0
        best_combo = "v1↔v1"
        for ref_config, cand_config, label in combinations:
            score = self._compare_actant_configs(ref_config, cand_config)
            if score > best_score:
                best_score = score
                best_combo = label
        
        return best_score, best_combo
    
    def _compare_actant_configs(self, config_a: Dict, config_b: Dict) -> float:
        """
        Compare deux configurations actantielles greimassiennes.
        
        Mesure la cohérence des rôles : pour chaque position (Sujet, Objet, etc.),
        regarde si les actants désignés se ressemblent (présence de mots communs,
        proximité sémantique simple).
        """
        if not config_a or not config_b:
            return 0.0
        
        positions = ['protagoniste', 'objet', 'destinateur', 'destinataire',
                     'adjuvant', 'opposant']
        
        scores = []
        for pos in positions:
            val_a = (config_a.get(pos) or '').strip().lower()
            val_b = (config_b.get(pos) or '').strip().lower()
            
            if not val_a or not val_b:
                # Position vide des deux côtés = neutre
                if not val_a and not val_b:
                    scores.append(0.5)
                continue
            
            # Comparaison de mots communs (méthode simple mais robuste)
            words_a = set(re.findall(r'\b[a-zàâäéèêëïîôöùûüç]{3,}\b', val_a))
            words_b = set(re.findall(r'\b[a-zàâäéèêëïîôöùûüç]{3,}\b', val_b))
            
            # Retirer les mots vides très courants
            stopwords = {'les', 'des', 'que', 'qui', 'son', 'sont', 'pour',
                          'avec', 'dans', 'par', 'sur', 'cette', 'ces', 'ses',
                          'leur', 'leurs', 'tout', 'tous', 'aucun', 'aucune'}
            words_a -= stopwords
            words_b -= stopwords
            
            if not words_a or not words_b:
                continue
            
            # Jaccard similarity
            intersection = len(words_a & words_b)
            union = len(words_a | words_b)
            jaccard = intersection / union if union > 0 else 0.0
            scores.append(jaccard)
        
        if not scores:
            return 0.0
        
        return sum(scores) / len(scores)
    
    def _score_transformation(self, g_ref: NarrativeGraph,
                                g_cand: NarrativeGraph,
                                s_iso: float) -> float:
        """
        Score de Transformation composite à 5 dimensions, chacune pondérée à 20%.
        
        Mesure les transformations entre l'œuvre de référence et l'œuvre candidate :
        - ST_struct  : transformations structurelles (basé sur l'inverse de s_iso)
        - ST_form    : transformations formelles (prose vs vers, longueur)
        - ST_register: transformations de registre (narratif, poétique, lyrique...)
        - ST_focus   : transformations de focalisation (changement de Sujet greimassien)
        - ST_moral   : ajout/retrait de moralité explicite ou intervention narrative
        
        Le ST mesure l'ampleur des transformations identifiables entre les deux
        œuvres. Un ST élevé sur fond de SNS élevé signe une transposition
        (réécriture assumée). Un ST faible sur fond de SNS élevé signe une
        reproduction structurelle servile. C'est cette combinaison qui caractérise
        la modalité retenue dans le verdict NARR'IA.
        
        LIMITES CONNUES (calibration empirique en cours) :
        - Les dimensions ST_form, ST_register, ST_moral dépendent du bloc
          formal_features extrait par le LLM. Quand ce bloc est absent
          (cas fréquent), ces dimensions retombent sur leurs valeurs par
          défaut, plombant le score composite.
        - Les pondérations égales (20% chacune) n'ont pas été calibrées sur
          un corpus empirique. Pour des couples avec isomorphisme parfait,
          ST_struct = 0 dilue mécaniquement le score, alors que les autres
          dimensions sont plus pertinentes.
        - Une calibration future sur 8-12 cas tests documentés (transpositions
          assumées, plagiats avérés, convergences indépendantes) permettrait
          de calibrer empiriquement les poids et seuils.
        """
        # ST1 — Transformation structurelle (complément de l'isomorphisme)
        st_struct = 1.0 - s_iso
        
        # ST2-5 — Transformations à partir des formal_features extraites par le LLM
        meta_ref = g_ref.metadata or {}
        meta_cand = g_cand.metadata or {}
        ff_ref = meta_ref.get('formal_features') or {}
        ff_cand = meta_cand.get('formal_features') or {}
        
        # ST2 — Transformation formelle (forme + longueur)
        st_form = self._delta_formal(ff_ref, ff_cand)
        
        # ST3 — Transformation de registre
        st_register = self._delta_register(ff_ref, ff_cand)
        
        # ST4 — Transformation de focalisation actantielle
        st_focus = self._delta_focus(meta_ref, meta_cand)
        
        # ST5 — Transformation moralisante / narrative
        st_moral = self._delta_moral_layer(ff_ref, ff_cand, g_ref, g_cand)
        
        # Combinaison : moyenne pondérée également (20% chacune)
        st_composite = (st_struct + st_form + st_register + st_focus + st_moral) / 5.0
        
        # Clamp dans [0, 1]
        return max(0.0, min(1.0, st_composite))
    
    def _delta_formal(self, ff_ref: Dict, ff_cand: Dict) -> float:
        """
        Mesure la transformation formelle : forme (prose/vers) et longueur.
        Score 0 = identique, 1 = transformation maximale.
        """
        form_ref = (ff_ref.get('form') or '').lower()
        form_cand = (ff_cand.get('form') or '').lower()
        
        # Différence de forme : 0 si identique, 1 si différente
        delta_form = 0.0 if form_ref == form_cand else 1.0
        
        # Différence de longueur (selon catégorie)
        len_categories = {
            'tres_court': 1, 'court': 2, 'moyen': 3, 'long': 4, 'tres_long': 5
        }
        cat_ref = len_categories.get(
            (ff_ref.get('narrative_length_category') or 'moyen').lower(), 3
        )
        cat_cand = len_categories.get(
            (ff_cand.get('narrative_length_category') or 'moyen').lower(), 3
        )
        delta_length = abs(cat_ref - cat_cand) / 4.0  # max delta = 4
        
        # Combinaison équilibrée
        return (delta_form + delta_length) / 2.0
    
    def _delta_register(self, ff_ref: Dict, ff_cand: Dict) -> float:
        """
        Mesure la transformation de registre.
        """
        reg_ref = (ff_ref.get('register') or '').lower()
        reg_cand = (ff_cand.get('register') or '').lower()
        
        if not reg_ref or not reg_cand:
            return 0.5  # neutre si information manquante
        
        if reg_ref == reg_cand:
            return 0.0
        
        # Distances relatives entre registres (proximité subjective)
        register_proximity = {
            ('narratif_neutre', 'didactique'): 0.3,
            ('narratif_neutre', 'poetique'): 0.7,
            ('narratif_neutre', 'lyrique'): 0.7,
            ('narratif_neutre', 'dramatique'): 0.6,
            ('narratif_neutre', 'comique'): 0.5,
            ('narratif_neutre', 'satirique'): 0.5,
            ('narratif_neutre', 'epique'): 0.6,
            ('didactique', 'poetique'): 0.6,
            ('didactique', 'satirique'): 0.4,
            ('poetique', 'lyrique'): 0.2,
            ('poetique', 'epique'): 0.4,
            ('comique', 'satirique'): 0.3,
        }
        
        # Recherche bidirectionnelle
        key = (reg_ref, reg_cand)
        rev_key = (reg_cand, reg_ref)
        if key in register_proximity:
            return register_proximity[key]
        if rev_key in register_proximity:
            return register_proximity[rev_key]
        
        # Registres différents non recensés : transformation moyenne
        return 0.7
    
    def _delta_focus(self, meta_ref: Dict, meta_cand: Dict) -> float:
        """
        Mesure la transformation de focalisation actantielle.
        Si les configurations greimassiennes principales (Sujet) sont
        substantiellement différentes, ST_focus est élevé.
        """
        ref_v1 = meta_ref.get('main_actants_v1') or meta_ref.get('main_actants') or {}
        cand_v1 = meta_cand.get('main_actants_v1') or meta_cand.get('main_actants') or {}
        
        if not ref_v1 or not cand_v1:
            return 0.5
        
        # Comparer les protagonistes
        proto_ref = (ref_v1.get('protagoniste') or '').lower().strip()
        proto_cand = (cand_v1.get('protagoniste') or '').lower().strip()
        
        if not proto_ref or not proto_cand:
            return 0.5
        
        # Mots communs dans les protagonistes
        words_ref = set(re.findall(r'\b[a-zàâäéèêëïîôöùûüç]{3,}\b', proto_ref))
        words_cand = set(re.findall(r'\b[a-zàâäéèêëïîôöùûüç]{3,}\b', proto_cand))
        
        if not words_ref or not words_cand:
            return 0.5
        
        # Si les protagonistes partagent des mots clés, transformation faible
        intersection = len(words_ref & words_cand)
        union = len(words_ref | words_cand)
        similarity = intersection / union if union > 0 else 0.0
        
        return 1.0 - similarity
    
    def _delta_moral_layer(self, ff_ref: Dict, ff_cand: Dict,
                              g_ref: NarrativeGraph, g_cand: NarrativeGraph) -> float:
        """
        Mesure les ajouts/retraits de couches morales ou de voix narrative.
        Détecte par exemple l'ajout d'une moralité finale chez La Fontaine
        absente chez Ésope.
        """
        # Sources : formal_features explicites, ou détection sur les nœuds
        moral_ref = ff_ref.get('has_explicit_morality')
        moral_cand = ff_cand.get('has_explicit_morality')
        
        # Fallback : détecter F49 (Sentence morale) dans les nœuds
        if moral_ref is None:
            moral_ref = any(n.function_code == 'F49' for n in g_ref.nodes)
        if moral_cand is None:
            moral_cand = any(n.function_code == 'F49' for n in g_cand.nodes)
        
        narrator_ref = ff_ref.get('has_narrator_intervention')
        narrator_cand = ff_cand.get('has_narrator_intervention')
        
        # Différences sur les deux dimensions
        delta_moral = 0.0 if moral_ref == moral_cand else 1.0
        
        if narrator_ref is None or narrator_cand is None:
            delta_narrator = 0.0
        else:
            delta_narrator = 0.0 if narrator_ref == narrator_cand else 1.0
        
        return (delta_moral + delta_narrator) / 2.0
    
    def _score_tension_profile(self, g_ref: NarrativeGraph,
                                g_cand: NarrativeGraph) -> float:
        """
        Corrélation des signatures tensives (courbes de tension dramatique).
        """
        sig_ref = g_ref.tension_profile()
        sig_cand = g_cand.tension_profile()
        
        if not sig_ref or not sig_cand:
            return 0.0
        
        # Rééchantillonnage à la même longueur (interpolation linéaire)
        target_len = min(len(sig_ref), len(sig_cand), 20)
        if target_len < 3:
            return 0.5
        
        sig_ref_resampled = self._resample(sig_ref, target_len)
        sig_cand_resampled = self._resample(sig_cand, target_len)
        
        # Corrélation de Pearson
        mean_ref = sum(sig_ref_resampled) / target_len
        mean_cand = sum(sig_cand_resampled) / target_len
        
        num = sum((sig_ref_resampled[i] - mean_ref) * (sig_cand_resampled[i] - mean_cand)
                  for i in range(target_len))
        den_ref = math.sqrt(sum((v - mean_ref) ** 2 for v in sig_ref_resampled))
        den_cand = math.sqrt(sum((v - mean_cand) ** 2 for v in sig_cand_resampled))
        
        if den_ref == 0 or den_cand == 0:
            return 0.5
        
        corr = num / (den_ref * den_cand)
        # Remap from [-1, 1] to [0, 1]
        return (corr + 1) / 2
    
    def _resample(self, seq: List[float], target_len: int) -> List[float]:
        """Rééchantillonnage linéaire d'une séquence à la longueur cible."""
        if len(seq) == target_len:
            return list(seq)
        result = []
        for i in range(target_len):
            # Position relative dans la séquence source
            src_pos = i * (len(seq) - 1) / (target_len - 1) if target_len > 1 else 0
            lo = int(src_pos)
            hi = min(lo + 1, len(seq) - 1)
            frac = src_pos - lo
            result.append(seq[lo] * (1 - frac) + seq[hi] * frac)
        return result
    
    # ───────────────────────────────────────────────────────
    #  CLASSIFICATION DE MODALITÉ
    # ───────────────────────────────────────────────────────
    
    def _classify_modality(self, g_ref: NarrativeGraph, g_cand: NarrativeGraph,
                            s_iso: float, s_func: float, s_tens: float,
                            st: float) -> str:
        """
        Classifie la modalité de vol d'intrigue parmi les cinq :
        Transposition, Amplification, Condensation, Inversion, Hybridation.
        Retourne "Aucune modalité significative" si SNS trop bas.
        """
        if s_iso < 0.25:
            return "Aucune modalité significative"
        
        len_ref = len(g_ref.nodes)
        len_cand = len(g_cand.nodes)
        size_ratio = len_cand / max(len_ref, 1)
        
        # Amplification : candidat sensiblement plus long avec même squelette
        if size_ratio > 1.4 and s_func > 0.4:
            return "Amplification"
        # Condensation : candidat sensiblement plus court avec même squelette
        if size_ratio < 0.7 and s_func > 0.4:
            return "Condensation"
        # Inversion : tension profile inversé
        if s_tens < 0.3 and s_iso > 0.4:
            return "Inversion (valences inversées)"
        # Transposition : forte iso + même taille + ST moyen
        if s_iso > 0.5 and 0.8 < size_ratio < 1.3:
            return "Transposition (contextes différents)"
        # Hybridation : iso moyen mais non-localisé
        if 0.30 < s_iso < 0.50:
            return "Possible hybridation"
        
        return "Correspondance partielle non classifiée"
    
    def _evaluate_srj(self, sns: float, ss: float, modality: str) -> Tuple[float, str]:
        """Évalue le Score de Risque Juridique et son niveau qualitatif."""
        srj = 0.4 * sns + 0.4 * ss + 0.2 * (0.5 if "Aucune" not in modality else 0.0)
        
        if srj < 0.25:
            level = "Faible"
        elif srj < 0.55:
            level = "Modéré"
        elif srj < 0.80:
            level = "Élevé"
        else:
            level = "Critique"
        
        return srj, level
    
    def _build_verdict(self, sns: float, ss: float, st: float, modality: str) -> str:
        """Génère un verdict interprétatif lisible."""
        if sns < 0.30:
            return ("Les deux œuvres présentent des structures narratives substantiellement "
                    "différentes. Le SNS est faible et ne suggère pas de correspondance "
                    "structurale significative. Cela n'exclut pas un emprunt textuel de surface, "
                    "qui serait détecté par un outil distinct.")
        elif sns < 0.50:
            return ("Les deux œuvres partagent certaines caractéristiques structurales. "
                    "Cette similarité pourrait relever de conventions génériques communes "
                    "plutôt que d'un emprunt spécifique (Score de Spécificité = {:.2f}). "
                    "Une analyse experte est recommandée pour vérifier si les correspondances "
                    "relèvent de l'intertextualité légitime ou de l'emprunt non déclaré.".format(ss))
        elif sns < 0.70:
            return ("Les deux œuvres présentent des correspondances structurales notables "
                    "(modalité détectée : {}). Le score dépasse ce qui est attendu d'une "
                    "convergence indépendante dans le même genre. Il est fortement recommandé "
                    "de consulter un narratologue et, le cas échéant, un juriste spécialisé "
                    "en propriété intellectuelle avant toute conclusion.".format(modality))
        else:
            return ("Les deux œuvres partagent une structure narrative profonde remarquablement "
                    "similaire (modalité détectée : {}). Cette similarité est difficilement "
                    "explicable par la seule convergence indépendante. Une expertise narratologique "
                    "et juridique approfondie est nécessaire. Ce résultat ne constitue PAS une "
                    "preuve de plagiat : il est une indication à investiguer plus avant.".format(modality))
    
    def _build_warnings(self, sns: float, g_ref: NarrativeGraph,
                         g_cand: NarrativeGraph) -> List[str]:
        """Avertissements éthiques et méthodologiques."""
        warnings = []
        
        if len(g_ref.nodes) < 5 or len(g_cand.nodes) < 5:
            warnings.append(
                "L'un des deux textes est très court (moins de 5 nœuds narratifs identifiés). "
                "Les scores sont à interpréter avec prudence : un texte plus long "
                "permettrait une analyse plus fiable.")
        
        if sns > 0.70:
            warnings.append(
                "Un SNS élevé ne constitue jamais une preuve de plagiat. "
                "Cette analyse est une aide à la décision — jamais un verdict. "
                "Une expertise humaine qualifiée reste indispensable.")
        
        # Fonctions non identifiées
        funcs_ref = sum(1 for n in g_ref.nodes if n.function_code)
        total_ref = len(g_ref.nodes)
        if total_ref > 0 and funcs_ref / total_ref < 0.4:
            warnings.append(
                "Plus de 60 % des nœuds de l'œuvre de référence n'ont pas de fonction "
                "narrative identifiée. Les scores peuvent sous-estimer la similarité réelle.")
        
        return warnings
