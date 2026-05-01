"""
narria.m5_reporting.reporter — Module 5 : Génération de rapports.

Produit des rapports HTML complets et autoportants pour chaque analyse,
intégrant tous les garde-fous éthiques de NARR'IA (rappels, avertissements,
limites documentées).
"""

from __future__ import annotations

from datetime import datetime
from typing import Dict, Any

from narria import __version__

from narria.core.models import NarrativeGraph, ComparisonResult


class ReportGenerator:
    """Génère des rapports HTML pour une comparaison NARR'IA."""
    
    def generate_html(self, result: ComparisonResult,
                      graph_ref: NarrativeGraph,
                      graph_cand: NarrativeGraph) -> str:
        """Génère un rapport HTML autoportant (pas de dépendance externe)."""
        
        timestamp = datetime.now().strftime('%d %B %Y, %H:%M')
        
        title_ref = graph_ref.metadata.get('title', 'Œuvre de référence')
        author_ref = graph_ref.metadata.get('author', 'Auteur inconnu')
        title_cand = graph_cand.metadata.get('title', 'Œuvre candidate')
        author_cand = graph_cand.metadata.get('author', 'Auteur inconnu')
        
        # SRJ color
        srj_colors = {
            'Faible': '#107C10',
            'Modéré': '#1F4E79',
            'Élevé': '#C55A11',
            'Critique': '#D13438',
        }
        srj_color = srj_colors.get(result.srj_level, '#595959')
        
        # Build correspondences table
        correspondences_rows = ""
        for i, c in enumerate(result.correspondences[:15]):
            correspondences_rows += f"""
                <tr>
                    <td>{i+1}</td>
                    <td><code>{c.get('ref_node', '—')}</code> ({c.get('ref_function', '—')})</td>
                    <td><code>{c.get('cand_node', '—')}</code> ({c.get('cand_function', '—')})</td>
                    <td>{c.get('similarity', 0) * 100:.1f}%</td>
                </tr>
            """
        
        # Build warnings
        warnings_html = ""
        if result.warnings:
            warnings_html = "<div class='warnings'><h3>⚠ Avertissements méthodologiques</h3><ul>"
            for w in result.warnings:
                warnings_html += f"<li>{w}</li>"
            warnings_html += "</ul></div>"
        
        # Tension profile sparkline
        def tension_bars(profile, color):
            if not profile:
                return ''
            max_t = max(profile) if profile else 1
            bars = ''
            for t in profile:
                h = int(t / max_t * 50) if max_t > 0 else 0
                bars += f'<div class="tbar" style="height: {h}px; background: {color};"></div>'
            return f'<div class="tension-container">{bars}</div>'
        
        return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport NARR'IA — {title_ref} vs {title_cand}</title>
<style>
body {{
    font-family: Georgia, serif;
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem;
    color: #1A1A1A;
    background: #FAFAFA;
    line-height: 1.6;
}}
h1 {{ color: #1F4E79; border-bottom: 4px solid #C55A11; padding-bottom: 0.5rem; }}
h2 {{ color: #1F4E79; border-bottom: 2px solid #BDD7EE; padding-bottom: 0.3rem; margin-top: 2rem; }}
h3 {{ color: #C55A11; }}
.header-meta {{ background: #F2F2F2; padding: 1rem; border-radius: 4px; margin-bottom: 2rem; }}
.header-meta p {{ margin: 0.3rem 0; }}
.works {{ display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1.5rem 0; }}
.work {{ background: white; padding: 1rem; border-radius: 4px; border-left: 4px solid #1F4E79; }}
.work.cand {{ border-left-color: #C55A11; }}
.scores {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin: 1.5rem 0; }}
.score-card {{ background: white; padding: 1rem; border-radius: 4px; text-align: center; border-top: 3px solid #1F4E79; }}
.score-card.highlight {{ border-top-color: #C55A11; background: #FCE4D6; }}
.score-label {{ font-size: 0.8rem; color: #595959; text-transform: uppercase; font-family: Arial, sans-serif; }}
.score-value {{ font-size: 2.2rem; font-weight: bold; color: #1F4E79; font-family: Arial, sans-serif; }}
.score-card.highlight .score-value {{ color: #C55A11; }}
.verdict {{ background: #BDD7EE; padding: 1.2rem; border-left: 4px solid #1F4E79; border-radius: 4px; margin: 1.5rem 0; }}
.verdict.warning {{ background: #FCE4D6; border-left-color: #C55A11; }}
.warnings {{ background: #FCE4D6; padding: 1rem 1.5rem; border-left: 4px solid #C55A11; border-radius: 4px; margin: 1.5rem 0; }}
.methodological-note {{ background: #F2F2F2; padding: 1rem 1.5rem; border-left: 4px solid #888888; border-radius: 4px; margin: 1.5rem 0; font-size: 0.95em; }}
.methodological-note h3 {{ margin-top: 0; color: #555555; font-size: 1.05em; }}
.methodological-note p {{ margin: 0.5rem 0; }}
.warnings ul {{ margin: 0.3rem 0; padding-left: 1.5rem; }}
table {{ width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.92rem; }}
th {{ background: #1F4E79; color: white; padding: 0.5rem; text-align: left; font-family: Arial, sans-serif; }}
td {{ padding: 0.5rem; border-bottom: 1px solid #CCCCCC; }}
tr:nth-child(even) {{ background: #F2F2F2; }}
code {{ background: #FCE4D6; padding: 0.1rem 0.4rem; border-radius: 2px; font-size: 0.88rem; font-weight: bold; color: #C55A11; }}
.tension-container {{ display: flex; align-items: flex-end; gap: 2px; height: 60px; padding: 0.5rem 0; }}
.tbar {{ width: 12px; border-radius: 2px 2px 0 0; }}
.srj-badge {{ display: inline-block; padding: 0.3rem 0.8rem; border-radius: 3px; color: white; font-weight: bold; font-family: Arial, sans-serif; }}
.footer {{ margin-top: 3rem; padding-top: 1rem; border-top: 2px solid #1F4E79; font-size: 0.85rem; color: #595959; text-align: center; }}
.footer p {{ margin: 0.3rem 0; }}
</style>
</head>
<body>

<h1>Rapport NARR'IA</h1>

<div class="header-meta">
    <p><strong>Date d'analyse :</strong> {timestamp}</p>
    <p><strong>Système :</strong> NARR'IA v{__version__} — Narratologie computationnelle du plagiat d'intrigue</p>
    <p><strong>Nature :</strong> Analyse de similarité structurale entre deux œuvres narratives</p>
</div>

<h2>Œuvres comparées</h2>
<div class="works">
    <div class="work">
        <h3>Œuvre de référence</h3>
        <p><strong>{title_ref}</strong></p>
        <p><em>{author_ref}</em></p>
        <p>Graphe narratif : <code>{graph_ref.graph_id}</code> — {len(graph_ref.nodes)} nœuds, {len(graph_ref.edges)} transitions</p>
        {tension_bars(graph_ref.tension_profile(), '#1F4E79')}
    </div>
    <div class="work cand">
        <h3>Œuvre candidate</h3>
        <p><strong>{title_cand}</strong></p>
        <p><em>{author_cand}</em></p>
        <p>Graphe narratif : <code>{graph_cand.graph_id}</code> — {len(graph_cand.nodes)} nœuds, {len(graph_cand.edges)} transitions</p>
        {tension_bars(graph_cand.tension_profile(), '#C55A11')}
    </div>
</div>

{self._render_llm_metadata(graph_ref, graph_cand)}

<h2>Scores composites</h2>
<div class="scores">
    <div class="score-card highlight">
        <div class="score-label">SNS</div>
        <div class="score-value">{result.sns:.3f}</div>
        <div>Similarité narrative</div>
    </div>
    <div class="score-card">
        <div class="score-label">SNS_N</div>
        <div class="score-value">{result.sns_normalized:.3f}</div>
        <div>Normalisé / genre</div>
    </div>
    <div class="score-card">
        <div class="score-label">SS</div>
        <div class="score-value">{result.ss:.3f}</div>
        <div>Spécificité</div>
    </div>
    <div class="score-card">
        <div class="score-label">ST</div>
        <div class="score-value">{result.st:.3f}</div>
        <div>Transformation</div>
    </div>
    <div class="score-card">
        <div class="score-label">SRJ</div>
        <div class="score-value">{result.srj:.3f}</div>
        <div><span class="srj-badge" style="background: {srj_color};">{result.srj_level}</span></div>
    </div>
</div>

<h2>Verdict interprétatif</h2>
<div class="verdict {'warning' if result.sns > 0.5 else ''}">
    <p><strong>Modalité détectée :</strong> {result.detected_modality}</p>
    <p>{result.verdict}</p>
</div>

{warnings_html}

<h2>Détail des composantes du SNS</h2>
<table>
    <tr><th>Composante</th><th>Description</th><th>Score</th></tr>
    <tr><td>S_ISO</td><td>Isomorphisme de sous-graphes narratifs (NARR'IA-VF2)</td><td>{result.s_iso:.3f}</td></tr>
    <tr><td>S_GED</td><td>Distance d'édition de graphes narratifs (GED narrative)</td><td>{result.s_ged:.3f}</td></tr>
    <tr><td>S_FUNC</td><td>Similarité des séquences de fonctions narratives (DTW)</td><td>{result.s_func:.3f}</td></tr>
    <tr><td>S_ACT</td><td>Similarité des chaînes actantielles</td><td>{result.s_act:.3f}</td></tr>
    <tr><td>S_TENS</td><td>Corrélation des signatures tensives</td><td>{result.s_tens:.3f}</td></tr>
</table>

<div class="methodological-note">
    <h3>Note méthodologique sur la lecture des scores</h3>
    <p>Les indicateurs primaires de NARR'IA, sur lesquels l'interprétation
    doit principalement s'appuyer, sont le <strong>SNS</strong> (similarité
    narrative composite), le <strong>S_ISO</strong> (isomorphisme structural)
    et le <strong>S_TENS</strong> (signature tensive), ainsi que le
    <strong>verdict modal</strong>. Ces indicateurs reposent sur des
    algorithmes structurellement stables.</p>
    <p>Les sous-scores <strong>S_ACT</strong> (chaînes actantielles) et
    <strong>ST</strong> (transformations) relèvent d'algorithmes
    sensibles à la formulation des actants extraits par le LLM et aux
    métadonnées formelles fournies. Ils constituent des <em>indicateurs
    secondaires</em> en cours de calibration empirique. Une certaine
    variabilité de ces deux scores entre exécutions est attendue et ne
    remet pas en cause la fiabilité du verdict global.</p>
    <p>Pour toute analyse rigoureuse, il convient d'interpréter ces deux
    sous-scores avec prudence et de privilégier l'expertise humaine du
    narratologue pour qualifier la nature exacte des transformations
    entre œuvres.</p>
</div>

<h2>Correspondances structurales principales</h2>
<table>
    <thead>
        <tr>
            <th>#</th>
            <th>Nœud de référence</th>
            <th>Nœud candidat</th>
            <th>Similarité</th>
        </tr>
    </thead>
    <tbody>
        {correspondences_rows if correspondences_rows else '<tr><td colspan="4"><em>Aucune correspondance forte détectée.</em></td></tr>'}
    </tbody>
</table>

<h2>Limites et avertissements</h2>
<div class="warnings">
    <h3>À retenir impérativement</h3>
    <ul>
        <li>Les scores NARR'IA sont des <strong>estimations probabilistes</strong>, jamais des verdicts définitifs de plagiat.</li>
        <li>L'interprétation des résultats exige une <strong>expertise humaine</strong> (narratologue, juriste selon le contexte).</li>
        <li>Un SNS élevé peut refléter une <strong>convergence indépendante</strong> due à des conventions génériques communes, sans emprunt réel.</li>
        <li>Une accusation publique de plagiat <strong>ne peut en aucun cas</strong> se fonder sur ces seuls scores.</li>
        <li>Ce rapport ne constitue <strong>pas un avis juridique</strong>. Pour toute suite judiciaire, consulter un avocat spécialisé en propriété intellectuelle.</li>
    </ul>
</div>

<div class="footer">
    <p>Rapport généré par NARR'IA v{__version__} — Système de narratologie computationnelle</p>
    <p>© 2026 Adéchinan David Adékambi · Département de Lettres Modernes, Université de Kindia · République de Guinée</p>
    <p>Ouvrage de référence : <em>NARR'IA — Vers une narratologie computationnelle du plagiat d'intrigue</em> (en cours de finalisation)</p>
</div>

</body>
</html>
"""
    
    def _render_llm_metadata(self, graph_ref, graph_cand) -> str:
        """
        Si l'une des deux œuvres a été analysée en mode LLM, produit un bloc
        synthétique avec les informations sémantiques extraites par Claude :
        résumé, genre, tradition, schéma actantiel principal.
        """
        ref_meta = graph_ref.metadata or {}
        cand_meta = graph_cand.metadata or {}
        ref_is_llm = ref_meta.get('mode') == 'llm'
        cand_is_llm = cand_meta.get('mode') == 'llm'
        
        if not ref_is_llm and not cand_is_llm:
            return ''
        
        def work_block(meta, label):
            if meta.get('mode') != 'llm':
                return f'<div class="work"><h4>{label}</h4><p><em>Analyse en mode local (heuristiques)</em></p></div>'
            
            summary = meta.get('summary', '')
            genre = meta.get('genre', '')
            tradition = meta.get('tradition', '')
            keywords = meta.get('thematic_keywords', [])
            actants = meta.get('main_actants', {}) or {}
            usage = meta.get('llm_usage', {}) or {}
            
            html = f'<div class="work"><h4>{label}</h4>'
            if summary:
                html += f'<p><strong>Résumé :</strong> {summary}</p>'
            if genre:
                html += f'<p><strong>Genre :</strong> {genre}</p>'
            if tradition:
                html += f'<p><strong>Tradition :</strong> {tradition}</p>'
            if keywords:
                html += f'<p><strong>Thématiques :</strong> {", ".join(keywords)}</p>'
            if actants:
                actant_items = []
                for k in ('protagoniste', 'objet', 'destinateur', 'destinataire', 'adjuvant', 'opposant'):
                    if actants.get(k):
                        actant_items.append(f'<li><strong>{k.capitalize()} :</strong> {actants[k]}</li>')
                if actant_items:
                    html += '<p><strong>Schéma actantiel :</strong></p><ul style="font-size:0.9rem;margin:0.3rem 0;">' + ''.join(actant_items) + '</ul>'
            if usage:
                cost = usage.get('cost_usd', 0)
                html += f'<p style="font-size:0.85rem;color:#595959;"><em>Analyse LLM : {cost:.4f} USD consommés</em></p>'
            html += '</div>'
            return html
        
        return f'''
<h2>Analyse sémantique (mode LLM)</h2>
<div class="works">
    {work_block(ref_meta, "Œuvre de référence")}
    {work_block(cand_meta, "Œuvre candidate")}
</div>
'''