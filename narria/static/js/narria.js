/* ═══════════════════════════════════════════════════════
   NARR'IA — Interface JavaScript
   ═══════════════════════════════════════════════════════ */

const STATE = {
    graphRefId: null,
    graphCandId: null,
    lastAnalysisId: null,
};

// ─── Gestion des onglets ───
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tabName}"]`)?.classList.add('active');
    document.getElementById(`tab-${tabName}`)?.classList.add('active');
    if (tabName === 'repertoire') loadRepertoire();
}

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

// ─── Chargement d'un échantillon ───
async function loadSample(sampleId, target) {
    try {
        const response = await fetch(`/api/sample/${sampleId}`);
        const data = await response.json();
        
        if (target === 'analyze') {
            document.getElementById('analyze-title').value = data.title || '';
            document.getElementById('analyze-author').value = data.author || '';
            document.getElementById('analyze-text').value = data.text || '';
        } else if (target === 'ref') {
            document.getElementById('ref-title').value = data.title || '';
            document.getElementById('ref-author').value = data.author || '';
            document.getElementById('ref-text').value = data.text || '';
        } else if (target === 'cand') {
            document.getElementById('cand-title').value = data.title || '';
            document.getElementById('cand-author').value = data.author || '';
            document.getElementById('cand-text').value = data.text || '';
        }
    } catch (err) {
        alert('Erreur de chargement de l\'échantillon : ' + err.message);
    }
}

// ─── Utilitaire : envoyer une analyse ───
async function submitAnalysis(title, author, text, statusElement) {
    statusElement.textContent = '⏳ Analyse en cours (Modules 1 + 2)…';
    statusElement.className = 'status';
    
    const response = await fetch('/api/analyze-text', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({title, author, text}),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        statusElement.textContent = '✗ ' + (data.error || 'Erreur');
        statusElement.className = 'status error';
        throw new Error(data.error || 'Erreur d\'analyse');
    }
    
    statusElement.textContent = `✓ Analyse terminée : ${data.n_nodes} nœuds, ${data.n_edges} transitions`;
    statusElement.className = 'status success';
    return data;
}

// ─── Rendu des résultats d'analyse ───
function renderAnalysisResults(data, container) {
    const africanPrefixes = ['FN']; // African function indicator
    const tensionMax = Math.max(...data.tension_profile, 1);
    
    const tensionBars = data.tension_profile.map(t => {
        const height = (t / tensionMax * 100).toFixed(0);
        return `<div class="bar" style="height: ${height}%;" title="${t.toFixed(2)}"></div>`;
    }).join('');
    
    const functionTags = data.functions.map(f => {
        const isAfrican = africanPrefixes.some(p => f.startsWith(p));
        return `<span class="function-tag ${isAfrican ? 'african' : ''}">${f}</span>`;
    }).join('');
    
    container.innerHTML = `
        <div class="results-grid">
            <div class="result-card">
                <div class="result-label">Segments narratifs</div>
                <div class="result-value">${data.n_segments}</div>
                <div class="result-detail">unités découpées</div>
            </div>
            <div class="result-card highlight">
                <div class="result-label">Nœuds du graphe</div>
                <div class="result-value">${data.n_nodes}</div>
                <div class="result-detail">fonctions cardinales</div>
            </div>
            <div class="result-card">
                <div class="result-label">Transitions</div>
                <div class="result-value">${data.n_edges}</div>
                <div class="result-detail">liens causaux</div>
            </div>
            <div class="result-card">
                <div class="result-label">Actants</div>
                <div class="result-value">${data.actants.length}</div>
                <div class="result-detail">agents narratifs</div>
            </div>
        </div>
        
        <h4>Fonctions narratives identifiées</h4>
        <div class="function-tags">${functionTags || '<em>Aucune fonction cardinale détectée</em>'}</div>
        
        <h4>Signature tensive (courbe de tension dramatique)</h4>
        <div class="tension-profile">${tensionBars}</div>
        
        <h4>Actants identifiés</h4>
        <p>${data.actants.join(' · ') || '<em>Aucun actant identifié</em>'}</p>
        
        <div class="info-box">
            <h4>ℹ Interprétation</h4>
            <p>
                Ce graphe narratif (NarRep-Graph) représente l'<strong>ADN de l'intrigue</strong> de votre texte.
                Il peut maintenant être comparé avec d'autres graphes narratifs pour détecter d'éventuelles
                correspondances structurales. Allez dans l'onglet <strong>« Comparer deux textes »</strong>
                pour effectuer une comparaison.
            </p>
        </div>
    `;
}

// ─── Form : analyze ───
document.getElementById('analyze-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('analyze-title').value.trim();
    const author = document.getElementById('analyze-author').value.trim();
    const text = document.getElementById('analyze-text').value.trim();
    const status = document.getElementById('analyze-status');
    
    if (text.length < 200) {
        status.textContent = '✗ Le texte doit contenir au moins 200 caractères (≈ 30 mots)';
        status.className = 'status error';
        return;
    }
    
    try {
        const data = await submitAnalysis(title, author, text, status);
        const container = document.getElementById('analyze-output');
        renderAnalysisResults(data, container);
        document.getElementById('analyze-results').classList.remove('hidden');
    } catch (err) {
        console.error(err);
    }
});

// ─── Form : ref ───
document.getElementById('ref-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('ref-title').value.trim();
    const author = document.getElementById('ref-author').value.trim();
    const text = document.getElementById('ref-text').value.trim();
    const status = document.getElementById('ref-status');
    
    try {
        const data = await submitAnalysis(title, author, text, status);
        STATE.graphRefId = data.graph_id;
        updateCompareButton();
    } catch (err) {
        console.error(err);
    }
});

// ─── Form : candidate ───
document.getElementById('cand-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('cand-title').value.trim();
    const author = document.getElementById('cand-author').value.trim();
    const text = document.getElementById('cand-text').value.trim();
    const status = document.getElementById('cand-status');
    
    try {
        const data = await submitAnalysis(title, author, text, status);
        STATE.graphCandId = data.graph_id;
        updateCompareButton();
    } catch (err) {
        console.error(err);
    }
});

function updateCompareButton() {
    const btn = document.getElementById('btn-compare');
    btn.disabled = !(STATE.graphRefId && STATE.graphCandId);
}

// ─── Lancement de la comparaison ───
document.getElementById('btn-compare').addEventListener('click', async () => {
    const btn = document.getElementById('btn-compare');
    const status = document.getElementById('compare-status');
    status.textContent = '⏳ Comparaison en cours (Module 3)…';
    status.className = 'status';
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/compare', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                graph_id_ref: STATE.graphRefId,
                graph_id_cand: STATE.graphCandId,
            }),
        });
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || 'Erreur');
        
        STATE.lastAnalysisId = data.analysis_id;
        renderComparisonResults(data);
        status.textContent = '✓ Comparaison terminée';
        status.className = 'status success';
        document.getElementById('compare-results').classList.remove('hidden');
    } catch (err) {
        status.textContent = '✗ ' + err.message;
        status.className = 'status error';
    } finally {
        btn.disabled = false;
    }
});

// ─── Rendu des résultats de comparaison ───
function renderComparisonResults(data) {
    const container = document.getElementById('compare-output');
    
    // SRJ verdict styling
    const srjColor = {
        'Faible': 'accent',
        'Modéré': 'accent',
        'Élevé': 'gold',
        'Critique': 'danger'
    }[data.srj_level] || 'accent';
    
    const correspondencesTable = (data.correspondences && data.correspondences.length)
        ? `
        <h4>Top correspondances structurales détectées</h4>
        <table class="narria-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Nœud de référence</th>
                    <th>Nœud candidat</th>
                    <th>Similarité</th>
                </tr>
            </thead>
            <tbody>
                ${data.correspondences.map((c, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td><code>${c.ref_node}</code> (${c.ref_function})</td>
                        <td><code>${c.cand_node}</code> (${c.cand_function})</td>
                        <td>${(c.similarity * 100).toFixed(1)}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ` : '';
    
    const warnings = data.warnings && data.warnings.length
        ? `<div class="verdict-box warning">
                <h4>⚠ Avertissements</h4>
                <ul>${data.warnings.map(w => `<li>${w}</li>`).join('')}</ul>
           </div>`
        : '';
    
    container.innerHTML = `
        <div class="results-grid">
            <div class="result-card highlight">
                <div class="result-label">SNS — Similarité narrative</div>
                <div class="result-value">${data.sns}</div>
                <div class="result-detail">score global sur 1.000</div>
            </div>
            <div class="result-card">
                <div class="result-label">SNS_N — normalisé par genre</div>
                <div class="result-value">${data.sns_n}</div>
                <div class="result-detail">percentile</div>
            </div>
            <div class="result-card">
                <div class="result-label">SS — Spécificité</div>
                <div class="result-value">${data.ss}</div>
                <div class="result-detail">particularité</div>
            </div>
            <div class="result-card">
                <div class="result-label">ST — Transformation</div>
                <div class="result-value">${data.st}</div>
                <div class="result-detail">degré de réécriture</div>
            </div>
            <div class="result-card">
                <div class="result-label">SRJ — Risque juridique</div>
                <div class="result-value">${data.srj}</div>
                <div class="result-detail"><strong>${data.srj_level}</strong></div>
            </div>
        </div>
        
        <div class="verdict-box">
            <h4>Verdict NARR'IA</h4>
            <p><strong>Modalité détectée :</strong> ${data.modality || 'Aucune modalité spécifique'}</p>
            <p><strong>Interprétation :</strong> ${data.verdict}</p>
        </div>
        
        ${warnings}
        
        <h4>Détail des composantes du SNS</h4>
        <table class="narria-table">
            <tr><td>S_ISO (isomorphisme de sous-graphes)</td><td>${data.details.s_iso}</td></tr>
            <tr><td>S_GED (distance d'édition narrative)</td><td>${data.details.s_ged}</td></tr>
            <tr><td>S_FUNC (DTW séquences fonctionnelles)</td><td>${data.details.s_func}</td></tr>
            <tr><td>S_ACT (chaînes actantielles)</td><td>${data.details.s_act}</td></tr>
            <tr><td>S_TENS (signatures tensives)</td><td>${data.details.s_tens}</td></tr>
        </table>
        
        ${correspondencesTable}
        
        <div class="info-box">
            <h4>⚠ Rappel</h4>
            <p>
                Ces scores sont des <strong>estimations probabilistes</strong>, non des verdicts
                définitifs de plagiat. Leur interprétation exige une analyse experte humaine,
                une vérification des antériorités, et le cas échéant un avis juridique.
                Aucune accusation publique ne doit être formulée sur cette seule base.
            </p>
        </div>
    `;
}

// ─── Génération du rapport ───
document.getElementById('btn-report').addEventListener('click', async () => {
    if (!STATE.lastAnalysisId) return;
    const btn = document.getElementById('btn-report');
    btn.disabled = true;
    btn.textContent = '⏳ Génération du rapport…';
    
    try {
        const response = await fetch(`/api/generate-report/${STATE.lastAnalysisId}`, {method: 'POST'});
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erreur');
        
        // Open in new tab
        window.open(data.report_url, '_blank');
        btn.textContent = '✓ Rapport ouvert dans un nouvel onglet';
        setTimeout(() => {
            btn.textContent = '📄 Générer le rapport complet';
            btn.disabled = false;
        }, 2500);
    } catch (err) {
        btn.textContent = '✗ ' + err.message;
        setTimeout(() => {
            btn.textContent = '📄 Générer le rapport complet';
            btn.disabled = false;
        }, 2500);
    }
});

// ─── Chargement du répertoire ───
async function loadRepertoire() {
    const container = document.getElementById('repertoire-content');
    if (container.dataset.loaded === 'true') return;
    
    try {
        const response = await fetch('/api/repertoire');
        const data = await response.json();
        
        let html = '';
        for (const family of data.families) {
            html += `
                <div class="repertoire-family">
                    <h3>${family.name} <em style="font-weight:normal;font-size:0.85rem;opacity:0.8;">(${family.functions.length} fonctions)</em></h3>
                    <ul>
                        ${family.functions.map(f => `
                            <li>
                                <code>${f.code}</code>
                                <strong>${f.name}</strong>
                                — ${f.description}
                                ${f.african ? ' <span class="function-tag african">Afrique</span>' : ''}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }
        container.innerHTML = html;
        container.dataset.loaded = 'true';
    } catch (err) {
        container.innerHTML = `<p class="loading">Erreur de chargement : ${err.message}</p>`;
    }
}

// ─── Initialisation ───
console.log('NARR\'IA — Interface chargée. Prêt à analyser.');

/* ═══════════════════════════════════════════════════════
   CONFIGURATION & MODE MANAGEMENT
   ═══════════════════════════════════════════════════════ */

let CURRENT_MODE = 'local';

async function refreshModeIndicator() {
    try {
        const response = await fetch('/api/config/status');
        const data = await response.json();
        CURRENT_MODE = data.mode;
        
        const indicator = document.getElementById('mode-indicator');
        const label = indicator.querySelector('.mode-label');
        
        indicator.classList.remove('mode-local', 'mode-llm');
        indicator.classList.add(`mode-${data.mode}`);
        
        if (data.mode === 'llm') {
            label.textContent = `Claude (${data.model})`;
            indicator.title = `Analyse via Claude ${data.model}`;
        } else {
            label.textContent = 'Local';
            indicator.title = 'Analyse locale par heuristiques (aucune clé LLM configurée)';
        }
        
        // Update config display if visible
        updateConfigModeDisplay(data);
    } catch (err) {
        console.error('Erreur de récupération du mode :', err);
    }
}

function updateConfigModeDisplay(data) {
    const display = document.getElementById('config-mode-display');
    if (!display) return;
    
    if (data.mode === 'llm') {
        display.classList.add('mode-active');
        display.innerHTML = `
            <p class="mode-title">🟢 Mode LLM actif (Claude)</p>
            <p><strong>Modèle :</strong> ${data.model}</p>
            <p><strong>Clé configurée :</strong> <code>${data.key_masked}</code></p>
            <p><strong>Tarif actuel :</strong> ${data.price_input_per_mtok_usd} USD / MTok entrée, ${data.price_output_per_mtok_usd} USD / MTok sortie</p>
        `;
    } else {
        display.classList.remove('mode-active');
        const reason = data.llm_available 
            ? 'Aucune clé API configurée.' 
            : 'Le SDK anthropic n\'est pas installé sur cette machine.';
        display.innerHTML = `
            <p class="mode-title">🟡 Mode local actif (heuristiques)</p>
            <p>${reason}</p>
            <p>Le mode local utilise des heuristiques par mots-clés. Il fonctionne sans connexion Internet et sans coût, mais son analyse est limitée aux textes qui utilisent les verbes narratifs reconnus.</p>
            <p>Configurez une clé API ci-dessous pour activer l'analyse profonde via Claude.</p>
        `;
    }
}

// ─── Save key ───
document.getElementById('btn-save-key')?.addEventListener('click', async () => {
    const keyInput = document.getElementById('config-api-key');
    const status = document.getElementById('config-status');
    const key = keyInput.value.trim();
    
    if (!key) {
        status.textContent = '✗ Veuillez saisir une clé';
        status.className = 'status error';
        return;
    }
    
    status.textContent = '⏳ Enregistrement...';
    status.className = 'status';
    
    try {
        const response = await fetch('/api/config/set-key', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({api_key: key}),
        });
        const data = await response.json();
        
        if (!response.ok) {
            status.textContent = '✗ ' + data.error;
            status.className = 'status error';
            return;
        }
        
        status.textContent = '✓ ' + data.message;
        status.className = 'status success';
        keyInput.value = '';
        
        await refreshModeIndicator();
    } catch (err) {
        status.textContent = '✗ ' + err.message;
        status.className = 'status error';
    }
});

// ─── Test connection ───
document.getElementById('btn-test-key')?.addEventListener('click', async () => {
    const status = document.getElementById('config-status');
    status.textContent = '⏳ Test en cours (appel API) ...';
    status.className = 'status';
    
    try {
        const response = await fetch('/api/config/test-connection', {method: 'POST'});
        const data = await response.json();
        
        if (data.success) {
            status.textContent = '✓ ' + data.message;
            status.className = 'status success';
        } else {
            status.textContent = '✗ ' + data.message;
            status.className = 'status error';
        }
    } catch (err) {
        status.textContent = '✗ ' + err.message;
        status.className = 'status error';
    }
});

// ─── Remove key ───
document.getElementById('btn-remove-key')?.addEventListener('click', async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer la clé API ? L\'application fonctionnera en mode local.')) {
        return;
    }
    const status = document.getElementById('config-status');
    try {
        const response = await fetch('/api/config/remove-key', {method: 'POST'});
        const data = await response.json();
        status.textContent = '✓ ' + data.message;
        status.className = 'status success';
        await refreshModeIndicator();
    } catch (err) {
        status.textContent = '✗ ' + err.message;
        status.className = 'status error';
    }
});

// ─── Refresh indicator on load and tab switch ───
refreshModeIndicator();
document.querySelectorAll('.tab').forEach(tab => {
    const original = tab.onclick;
    tab.addEventListener('click', () => {
        if (tab.dataset.tab === 'config') {
            refreshModeIndicator();
        }
    });
});

// ─── Override submitAnalysis to show cost estimation in LLM mode ───
// We patch submitAnalysis to add a pre-estimate step when in LLM mode
const originalSubmitAnalysis = submitAnalysis;
window.submitAnalysis = async function(title, author, text, statusElement) {
    // If LLM mode, show cost estimate and require confirmation
    if (CURRENT_MODE === 'llm') {
        statusElement.textContent = '⏳ Estimation du coût...';
        statusElement.className = 'status';
        
        try {
            const estResponse = await fetch('/api/estimate-cost', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({text}),
            });
            const est = await estResponse.json();
            
            if (est.mode === 'llm') {
                const costUsd = est.estimated_cost_usd.toFixed(4);
                const costEur = est.estimated_cost_eur.toFixed(4);
                
                let dialogText;
                
                if (est.will_be_chunked) {
                    // Texte trop long : annonce du découpage automatique
                    const totalTokens = (est.total_text_tokens || 0).toLocaleString();
                    const nChunks = est.n_chunks || 0;
                    const inputTokens = (est.estimated_input_tokens || 0).toLocaleString();
                    const outputTokens = (est.estimated_output_tokens || 0).toLocaleString();
                    
                    dialogText =
                        `⚠ TEXTE LONG — Découpage automatique nécessaire\n\n` +
                        `Votre texte fait environ ${totalTokens} tokens, ce qui dépasse la fenêtre ` +
                        `de contexte de Claude (170 000 tokens utiles).\n\n` +
                        `NARR'IA va donc :\n` +
                        `  1. Découper le texte en ${nChunks} blocs avec recouvrement narratif\n` +
                        `  2. Analyser chaque bloc séparément via Claude (${est.model})\n` +
                        `  3. Fusionner les graphes partiels en un graphe global cohérent\n\n` +
                        `Coût total estimé :\n` +
                        `  • ${costUsd} USD (≈ ${costEur} EUR)\n` +
                        `  • ${inputTokens} tokens d'entrée cumulés\n` +
                        `  • ${outputTokens} tokens de sortie cumulés\n` +
                        `  • Durée estimée : ${nChunks * 30}-${nChunks * 60} secondes\n\n` +
                        `LIMITES À CONNAÎTRE :\n` +
                        `  • La fusion peut introduire de légères incohérences (actants nommés ` +
                        `différemment dans des blocs adjacents, par exemple)\n` +
                        `  • La courbe tensive globale est une concaténation lissée, pas une analyse ` +
                        `unifiée comme pour les textes courts\n` +
                        `  • Pour les œuvres très volumineuses, vérifiez les résultats avec un esprit ` +
                        `critique narratologique\n\n` +
                        `Continuer l'analyse en ${nChunks} blocs ?`;
                } else {
                    // Texte de taille normale
                    dialogText =
                        `Analyse via Claude (${est.model})\n\n` +
                        `Coût estimé :\n` +
                        `  • ${costUsd} USD (≈ ${costEur} EUR)\n` +
                        `  • ${(est.estimated_input_tokens || 0).toLocaleString()} tokens d'entrée\n` +
                        `  • ${(est.estimated_output_tokens || 0).toLocaleString()} tokens de sortie\n\n` +
                        `Ce coût sera débité de votre compte Anthropic.\n\n` +
                        `Continuer l'analyse ?`;
                }
                
                const confirmed = confirm(dialogText);
                if (!confirmed) {
                    statusElement.textContent = '✗ Analyse annulée';
                    statusElement.className = 'status error';
                    throw new Error('Analyse annulée par l\'utilisateur');
                }
                
                if (est.will_be_chunked) {
                    statusElement.textContent = `⏳ Analyse en ${est.n_chunks} blocs en cours… Cela peut prendre quelques minutes.`;
                    statusElement.className = 'status';
                }
            }
        } catch (err) {
            if (err.message === 'Analyse annulée par l\'utilisateur') throw err;
            console.warn('Estimation de coût indisponible :', err);
        }
    }
    
    // Call the original function
    return await originalSubmitAnalysis(title, author, text, statusElement);
};

// ─── Enhance renderAnalysisResults to show LLM-specific data ───
const originalRenderAnalysisResults = renderAnalysisResults;
window.renderAnalysisResults = function(data, container) {
    originalRenderAnalysisResults(data, container);
    
    // If mode is LLM, prepend additional info (summary, genre, tradition, usage)
    if (data.mode === 'llm') {
        let llmHtml = '<div class="llm-summary">';
        llmHtml += '<h4>📘 Analyse par Claude — synthèse</h4>';
        
        // Chunking warning if applicable
        if (data.chunked) {
            const merge = data.merge_info || {};
            llmHtml += `<div class="chunk-banner">`;
            llmHtml += `<strong>⚠ Texte long analysé par découpage :</strong> `;
            llmHtml += `${data.n_chunks} blocs analysés séparément, `;
            llmHtml += `puis fusionnés en un graphe global.`;
            if (merge.n_duplicates_removed) {
                llmHtml += ` ${merge.n_duplicates_removed} doublons éliminés dans les zones de recouvrement.`;
            }
            if (data.chunk_warning) {
                llmHtml += `<br><em>${escapeHtml(data.chunk_warning)}</em>`;
            }
            llmHtml += `<br><small>La fusion peut introduire de légères incohérences. Vérifiez les actants et la courbe tensive avec un esprit critique narratologique.</small>`;
            llmHtml += `</div>`;
        }
        
        if (data.summary) {
            llmHtml += `<p><strong>Résumé :</strong> ${escapeHtml(data.summary)}</p>`;
        }
        
        llmHtml += '<div class="llm-meta">';
        if (data.genre) {
            llmHtml += `<div class="llm-meta-item"><div class="llm-meta-label">Genre</div><div class="llm-meta-value">${escapeHtml(data.genre)}</div></div>`;
        }
        if (data.tradition) {
            llmHtml += `<div class="llm-meta-item"><div class="llm-meta-label">Tradition</div><div class="llm-meta-value">${escapeHtml(data.tradition)}</div></div>`;
        }
        if (data.llm_usage) {
            const cost = (data.llm_usage.cost_usd || 0).toFixed(4);
            llmHtml += `<div class="llm-meta-item"><div class="llm-meta-label">Coût réel</div><div class="llm-meta-value">${cost} USD</div></div>`;
            llmHtml += `<div class="llm-meta-item"><div class="llm-meta-label">Tokens</div><div class="llm-meta-value">${(data.llm_usage.input_tokens || 0) + (data.llm_usage.output_tokens || 0)}</div></div>`;
        }
        llmHtml += '</div>';
        
        // Main actants
        if (data.main_actants && Object.keys(data.main_actants).length > 0) {
            llmHtml += '<h4 style="margin-top:1rem;">Schéma actantiel identifié</h4>';
            llmHtml += '<table class="narria-table"><tbody>';
            const labels = {
                protagoniste: 'Sujet (protagoniste)',
                objet: 'Objet de la quête',
                destinateur: 'Destinateur',
                destinataire: 'Destinataire',
                adjuvant: 'Adjuvant(s)',
                opposant: 'Opposant(s)',
            };
            for (const [key, label] of Object.entries(labels)) {
                if (data.main_actants[key]) {
                    llmHtml += `<tr><td><strong>${label}</strong></td><td>${escapeHtml(data.main_actants[key])}</td></tr>`;
                }
            }
            llmHtml += '</tbody></table>';
            
            // Visual greimassian actantial diagram
            llmHtml += renderActantialDiagram(data.main_actants);
        }
        
        if (data.thematic_keywords && data.thematic_keywords.length > 0) {
            llmHtml += `<p style="margin-top:1rem;"><strong>Thématiques :</strong> ${data.thematic_keywords.map(k => `<span class="function-tag">${escapeHtml(k)}</span>`).join(' ')}</p>`;
        }
        
        llmHtml += '</div>';
        
        // Insert at top of the container
        container.insertAdjacentHTML('afterbegin', llmHtml);
    }
};

function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/* ═══════════════════════════════════════════════════════
   FILE UPLOAD (drag-and-drop + browse)
   ═══════════════════════════════════════════════════════ */

// Upload a file to the server and return the parsed result
async function uploadFile(file, target) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/upload-file', {
        method: 'POST',
        body: formData,
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Erreur de téléversement');
    }
    return data;
}

// Apply the uploaded text to the right textarea/fields based on target
function applyUploadedFile(data, target) {
    // Map target to field IDs
    const ids = {
        analyze: {title: 'analyze-title', author: 'analyze-author', text: 'analyze-text', info: 'analyze-file-info'},
        ref: {title: 'ref-title', author: 'ref-author', text: 'ref-text', info: 'ref-file-info'},
        cand: {title: 'cand-title', author: 'cand-author', text: 'cand-text', info: 'cand-file-info'},
    }[target];
    
    if (!ids) return;
    
    // Set the text
    document.getElementById(ids.text).value = data.text;
    
    // If title/author fields are empty and metadata was extracted, fill them
    const titleField = document.getElementById(ids.title);
    const authorField = document.getElementById(ids.author);
    
    if (titleField && !titleField.value.trim() && data.title) {
        titleField.value = data.title;
    }
    if (authorField && !authorField.value.trim() && data.author) {
        authorField.value = data.author;
    }
    
    // If no title was set and no metadata, use the filename
    if (titleField && !titleField.value.trim() && data.source_filename) {
        // Remove extension
        const name = data.source_filename.replace(/\.[^.]+$/, '');
        titleField.value = name;
    }
    
    // Show file info
    const infoBox = document.getElementById(ids.info);
    if (infoBox) {
        const hasWarnings = data.warnings && data.warnings.length > 0;
        infoBox.classList.remove('hidden');
        infoBox.classList.toggle('warning', hasWarnings);
        
        let html = `<strong>Fichier importé :</strong> <span class="file-name">${escapeHtml(data.source_filename)}</span>`;
        html += ` · <strong>${data.word_count.toLocaleString('fr-FR')} mots</strong>`;
        
        if (data.page_count) {
            html += ` · ${data.page_count} pages`;
        } else if (data.paragraph_count) {
            html += ` · ${data.paragraph_count} paragraphes`;
        }
        
        html += ` &nbsp;<button type="button" class="clear-file" data-target="${target}">effacer</button>`;
        
        if (hasWarnings) {
            html += '<ul>';
            for (const w of data.warnings) {
                html += `<li>${escapeHtml(w)}</li>`;
            }
            html += '</ul>';
        }
        
        infoBox.innerHTML = html;
        
        // Wire up the "clear" button
        infoBox.querySelector('.clear-file')?.addEventListener('click', () => {
            document.getElementById(ids.text).value = '';
            infoBox.classList.add('hidden');
            infoBox.innerHTML = '';
        });
    }
}

// Handle file input (from click or drag)
async function handleFile(file, target) {
    // Validate file type
    const suffix = '.' + (file.name.split('.').pop() || '').toLowerCase();
    const allowed = ['.txt', '.docx', '.pdf', '.odt', '.epub'];
    if (!allowed.includes(suffix)) {
        alert(`Format non supporté : ${suffix}\nFormats acceptés : ${allowed.join(', ')}`);
        return;
    }
    
    // Validate size (300 MB max)
    const maxSize = 300 * 1024 * 1024;
    if (file.size > maxSize) {
        alert(`Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum : 300 Mo.`);
        return;
    }
    
    // Show progress in the info box
    const infoIds = {
        analyze: 'analyze-file-info',
        ref: 'ref-file-info',
        cand: 'cand-file-info',
    };
    const infoBox = document.getElementById(infoIds[target]);
    if (infoBox) {
        infoBox.classList.remove('hidden', 'warning');
        infoBox.innerHTML = `⏳ Extraction en cours : <span class="file-name">${escapeHtml(file.name)}</span> (${(file.size / 1024).toFixed(0)} Ko)…`;
    }
    
    // Mark dropzone as uploading
    const dropzone = document.getElementById(target + '-dropzone');
    if (dropzone) dropzone.classList.add('uploading');
    
    try {
        const data = await uploadFile(file, target);
        applyUploadedFile(data, target);
    } catch (err) {
        if (infoBox) {
            infoBox.classList.add('warning');
            infoBox.innerHTML = `✗ Erreur : ${escapeHtml(err.message)}`;
        }
    } finally {
        if (dropzone) dropzone.classList.remove('uploading');
    }
}

// Wire up file inputs (click to browse)
document.querySelectorAll('.upload-browse-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const target = btn.dataset.target;
        const input = document.getElementById(target + '-file-input');
        if (input) input.click();
    });
});

// Wire up file input change handlers
document.querySelectorAll('input[type="file"]').forEach(input => {
    input.addEventListener('change', (e) => {
        const target = input.dataset.target;
        const file = input.files[0];
        if (file) {
            handleFile(file, target);
            input.value = '';  // Reset so the same file can be re-uploaded
        }
    });
});

// Wire up drag-and-drop on dropzones
document.querySelectorAll('.upload-dropzone').forEach(dropzone => {
    const target = dropzone.dataset.target;
    
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('drag-over');
    });
    
    dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('drag-over');
    });
    
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleFile(files[0], target);
        }
    });
    
    // Also make the dropzone itself clickable (opens the file input)
    dropzone.addEventListener('click', (e) => {
        // Don't trigger if user clicked the explicit button (already handled)
        if (e.target.closest('.upload-browse-btn')) return;
        const input = document.getElementById(target + '-file-input');
        if (input) input.click();
    });
});

/* ═══════════════════════════════════════════════════════
   HISTORIQUE DES ANALYSES
   ═══════════════════════════════════════════════════════ */

async function loadHistory() {
    const statsEl = document.getElementById('history-stats');
    const analysesEl = document.getElementById('history-analyses-list');
    const comparisonsEl = document.getElementById('history-comparisons-list');
    
    if (!statsEl) return;
    
    statsEl.innerHTML = '<div class="loading">Chargement...</div>';
    
    try {
        const rv = await fetch('/api/history/list');
        const data = await rv.json();
        
        renderHistoryStats(statsEl, data.stats);
        renderAnalysesList(analysesEl, data.analyses);
        renderComparisonsList(comparisonsEl, data.comparisons);
    } catch (err) {
        statsEl.innerHTML = `<div class="error">Erreur de chargement : ${escapeHtml(err.message)}</div>`;
    }
}

function renderHistoryStats(el, stats) {
    if (!stats || stats.n_analyses === 0) {
        el.innerHTML = `
            <div class="history-empty">
              <p>Aucune analyse archivée pour le moment.</p>
              <p>Lancez une analyse depuis l'onglet « Analyser un texte » pour commencer à constituer votre historique.</p>
            </div>`;
        return;
    }
    
    el.innerHTML = `
        <div class="stat-card">
          <div class="stat-value">${stats.n_analyses}</div>
          <div class="stat-label">analyses</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.n_comparisons}</div>
          <div class="stat-label">comparaisons</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.n_local_analyses}</div>
          <div class="stat-label">en mode local</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.n_llm_analyses}</div>
          <div class="stat-label">en mode LLM</div>
        </div>
        <div class="stat-card stat-card-cost">
          <div class="stat-value">${(stats.total_cost_usd || 0).toFixed(4)}</div>
          <div class="stat-label">USD total dépensés</div>
        </div>
    `;
}

function renderAnalysesList(el, analyses) {
    if (!el) return;
    if (!analyses || analyses.length === 0) {
        el.innerHTML = '<p class="empty-state">Aucune analyse archivée.</p>';
        return;
    }
    
    let html = '<table class="history-table"><thead><tr>';
    html += '<th>Date</th><th>Œuvre</th><th>Auteur</th><th>Mode</th>';
    html += '<th>Nœuds</th><th>Coût</th><th>Actions</th></tr></thead><tbody>';
    
    for (const a of analyses) {
        const modeBadge = a.mode === 'llm'
            ? '<span class="badge badge-llm">LLM</span>'
            : '<span class="badge badge-local">local</span>';
        const cost = (a.cost_usd != null) ? `${a.cost_usd.toFixed(4)} $` : '—';
        
        html += `<tr>
            <td>${escapeHtml(a.date_human || '?')}</td>
            <td><strong>${escapeHtml(a.title || '?')}</strong></td>
            <td>${escapeHtml(a.author || '?')}</td>
            <td>${modeBadge}</td>
            <td>${a.n_nodes || 0}</td>
            <td>${cost}</td>
            <td class="actions">
                <button class="btn-link btn-pdf" onclick="downloadAnalysis('${a.analysis_id}', 'pdf')">PDF</button>
                <button class="btn-link" onclick="downloadAnalysis('${a.analysis_id}', 'html')">HTML</button>
                <button class="btn-link" onclick="downloadAnalysis('${a.analysis_id}', 'md')">MD</button>
                <button class="btn-link" onclick="downloadAnalysis('${a.analysis_id}', 'txt')">TXT</button>
                <button class="btn-link" onclick="downloadAnalysis('${a.analysis_id}', 'json')">JSON</button>
                <button class="btn-link" onclick="window.open('/api/diagnose-pdf/${a.analysis_id}', '_blank')" title="Diagnostiquer la génération PDF">🔧</button>
                <button class="btn-link btn-danger-link" onclick="deleteAnalysis('${a.analysis_id}')">✗</button>
            </td>
        </tr>`;
    }
    html += '</tbody></table>';
    el.innerHTML = html;
}

function renderComparisonsList(el, comparisons) {
    if (!el) return;
    if (!comparisons || comparisons.length === 0) {
        el.innerHTML = '<p class="empty-state">Aucune comparaison archivée.</p>';
        return;
    }
    
    let html = '<table class="history-table"><thead><tr>';
    html += '<th>Date</th><th>Référence</th><th>Candidate</th><th>SNS</th><th>SRJ</th><th>Modalité</th><th>Actions</th></tr></thead><tbody>';
    
    for (const c of comparisons) {
        const sns = (c.sns != null) ? c.sns.toFixed(3) : '—';
        const srj = (c.srj != null) ? `${c.srj.toFixed(3)} <span class="srj-class">${escapeHtml(c.srj_class || '')}</span>` : '—';
        
        html += `<tr>
            <td>${escapeHtml(c.date_human || '?')}</td>
            <td><strong>${escapeHtml(c.ref_title || '?')}</strong><br><small>${escapeHtml(c.ref_author || '')}</small></td>
            <td><strong>${escapeHtml(c.cand_title || '?')}</strong><br><small>${escapeHtml(c.cand_author || '')}</small></td>
            <td>${sns}</td>
            <td>${srj}</td>
            <td>${escapeHtml(c.modality || '?')}</td>
            <td class="actions">
                <button class="btn-link btn-pdf" onclick="downloadComparison('${c.comparison_id}', 'pdf')">PDF</button>
                <button class="btn-link" onclick="downloadComparison('${c.comparison_id}', 'html')">HTML</button>
                <button class="btn-link" onclick="downloadComparison('${c.comparison_id}', 'md')">MD</button>
                <button class="btn-link" onclick="downloadComparison('${c.comparison_id}', 'json')">JSON</button>
                <button class="btn-link btn-danger-link" onclick="deleteComparison('${c.comparison_id}')">✗</button>
            </td>
        </tr>`;
    }
    html += '</tbody></table>';
    el.innerHTML = html;
}

function downloadAnalysis(analysisId, format) {
    return downloadWithProgress(`/api/download/analysis/${analysisId}/${format}`, format, 'analyse');
}

function downloadComparison(compId, format) {
    return downloadWithProgress(`/api/download/comparison/${compId}/${format}`, format, 'comparaison');
}

async function downloadWithProgress(url, format, label) {
    // Pour les formats rapides (json, txt, md, html), utiliser le téléchargement direct
    // Pour le PDF qui peut prendre du temps, afficher une barre de progression.
    if (format !== 'pdf') {
        window.location.href = url;
        return;
    }
    
    // Créer un toast de progression
    const toast = document.createElement('div');
    toast.className = 'download-toast';
    toast.innerHTML = `
        <div class="download-toast-spinner"></div>
        <div class="download-toast-text">
            <strong>Génération du PDF…</strong><br>
            <small>Cela peut prendre 10-30 secondes pour les analyses détaillées</small>
        </div>
    `;
    document.body.appendChild(toast);
    
    // Mise à jour automatique du message après 30s pour rassurer
    const updateMsgTimer = setTimeout(() => {
        if (toast.parentNode) {
            const textDiv = toast.querySelector('.download-toast-text');
            if (textDiv) {
                textDiv.innerHTML = '<strong>Génération en cours…</strong><br><small>Le serveur prend plus de temps que prévu, patientez encore…</small>';
            }
        }
    }, 30000);
    
    // Timeout strict côté client : 90 secondes maximum
    // (le serveur a son propre timeout à 30s, ceci est un filet de sécurité)
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 90000);
    
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(abortTimer);
        clearTimeout(updateMsgTimer);
        
        if (!response.ok) {
            // Lire l'erreur du serveur si elle est en JSON
            let errorMessage = `Erreur HTTP ${response.status}`;
            try {
                const errData = await response.json();
                if (errData.error) errorMessage = errData.error;
            } catch (e) {
                // Pas un JSON, garder le code HTTP
            }
            throw new Error(errorMessage);
        }
        
        const blob = await response.blob();
        
        // Récupérer le nom du fichier depuis Content-Disposition si présent
        const contentDisposition = response.headers.get('Content-Disposition') || '';
        let filename = `narria_${label}.${format}`;
        const match = contentDisposition.match(/filename="?([^";]+)"?/);
        if (match) filename = match[1];
        
        // Créer un lien de téléchargement et le déclencher
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Libérer l'URL après un court délai
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        
        // Mettre à jour le toast en succès
        toast.className = 'download-toast download-toast-success';
        toast.innerHTML = `
            <div class="download-toast-icon">✓</div>
            <div class="download-toast-text">
                <strong>PDF téléchargé</strong><br>
                <small>${escapeHtml(filename)}</small>
            </div>
        `;
        setTimeout(() => toast.remove(), 3000);
    } catch (err) {
        clearTimeout(abortTimer);
        clearTimeout(updateMsgTimer);
        
        // Distinguer les types d'erreur
        let userMsg;
        if (err.name === 'AbortError') {
            userMsg = 'Le serveur a mis plus de 90 secondes à répondre. Essayez le format HTML à la place.';
        } else {
            userMsg = err.message;
        }
        
        toast.className = 'download-toast download-toast-error';
        toast.innerHTML = `
            <div class="download-toast-icon">✗</div>
            <div class="download-toast-text">
                <strong>Échec du téléchargement</strong><br>
                <small>${escapeHtml(userMsg)}</small>
            </div>
        `;
        setTimeout(() => toast.remove(), 8000);
    }
}

async function deleteAnalysis(analysisId) {
    if (!confirm('Supprimer cette analyse de l\'historique ? (irréversible)')) return;
    try {
        await fetch(`/api/history/analysis/${analysisId}`, {method: 'DELETE'});
        await loadHistory();
    } catch (err) {
        alert('Erreur : ' + err.message);
    }
}

async function deleteComparison(compId) {
    if (!confirm('Supprimer cette comparaison de l\'historique ? (irréversible)')) return;
    try {
        await fetch(`/api/history/comparison/${compId}`, {method: 'DELETE'});
        await loadHistory();
    } catch (err) {
        alert('Erreur : ' + err.message);
    }
}

document.getElementById('btn-refresh-history')?.addEventListener('click', loadHistory);

document.getElementById('btn-clear-history')?.addEventListener('click', async () => {
    if (!confirm('Effacer TOUT l\'historique ? Cette action est irréversible. Voulez-vous vraiment continuer ?')) return;
    if (!confirm('Confirmation supplémentaire : tous vos graphes, analyses et comparaisons seront définitivement perdus. Continuer ?')) return;
    try {
        const rv = await fetch('/api/history/clear', {method: 'POST'});
        const data = await rv.json();
        alert(`Historique effacé : ${data.deleted.n_analyses} analyses et ${data.deleted.n_comparisons} comparaisons supprimées.`);
        await loadHistory();
    } catch (err) {
        alert('Erreur : ' + err.message);
    }
});

// Auto-refresh history when entering the History tab
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        if (tab.dataset.tab === 'history') {
            loadHistory();
        }
    });
});

/* ═══════════════════════════════════════════════════════
   BOUTONS DE TÉLÉCHARGEMENT DANS LES RÉSULTATS D'ANALYSE
   ═══════════════════════════════════════════════════════ */

// After an analysis completes, attach a download button bar to the results
const _origRenderAnalysisResults2 = window.renderAnalysisResults;
window.renderAnalysisResults = function(data, container) {
    if (_origRenderAnalysisResults2) {
        _origRenderAnalysisResults2(data, container);
    }
    
    // Find the latest analysis_id from the history (most recent)
    // This is a small race but works in practice
    setTimeout(async () => {
        try {
            const rv = await fetch('/api/history/list?limit=1');
            const histData = await rv.json();
            if (histData.analyses && histData.analyses.length > 0) {
                const aid = histData.analyses[0].analysis_id;
                const downloadBar = document.createElement('div');
                downloadBar.className = 'download-bar';
                downloadBar.innerHTML = `
                    <strong>📥 Télécharger cette analyse :</strong>
                    <button class="btn-link btn-pdf" onclick="downloadAnalysis('${aid}', 'pdf')">PDF</button>
                    <button class="btn-link" onclick="downloadAnalysis('${aid}', 'html')">HTML</button>
                    <button class="btn-link" onclick="downloadAnalysis('${aid}', 'md')">Markdown</button>
                    <button class="btn-link" onclick="downloadAnalysis('${aid}', 'txt')">Texte</button>
                    <button class="btn-link" onclick="downloadAnalysis('${aid}', 'json')">JSON</button>
                `;
                // Insert at top of container
                container.insertAdjacentElement('afterbegin', downloadBar);
            }
        } catch (err) {
            console.warn('Cannot attach download bar:', err);
        }
    }, 200);
};

/* ═══════════════════════════════════════════════════════
   SCHÉMA ACTANTIEL GREIMASSIEN VISUEL (SVG)
   ═══════════════════════════════════════════════════════ */

function renderActantialDiagram(actants) {
    if (!actants) return '';
    
    // Si aucun actant n'est rempli, ne rien dessiner
    const hasAny = ['protagoniste', 'objet', 'destinateur', 'destinataire', 'adjuvant', 'opposant']
        .some(k => actants[k] && actants[k].trim());
    if (!hasAny) return '';
    
    // Helper: tronque un nom long en gardant l'essentiel
    const truncate = (s, maxLen) => {
        if (!s) return '—';
        s = s.trim();
        return s.length > maxLen ? s.substring(0, maxLen - 1) + '…' : s;
    };
    
    const sujet = truncate(actants.protagoniste || actants.sujet || '', 24);
    const objet = truncate(actants.objet || '', 24);
    const destinateur = truncate(actants.destinateur || '', 24);
    const destinataire = truncate(actants.destinataire || '', 24);
    const adjuvant = truncate(actants.adjuvant || '', 24);
    const opposant = truncate(actants.opposant || '', 24);
    
    // Helper: dessine un cartouche
    const cartouche = (cx, cy, w, h, label, value, color, bgColor) => `
        <rect x="${cx - w/2}" y="${cy - h/2}" width="${w}" height="${h}"
              rx="8" ry="8"
              fill="${bgColor}" stroke="${color}" stroke-width="2"/>
        <text x="${cx}" y="${cy - 8}"
              text-anchor="middle"
              font-family="Garamond, Georgia, serif"
              font-size="11"
              fill="${color}"
              font-weight="bold"
              text-transform="uppercase"
              letter-spacing="1.5">${label}</text>
        <text x="${cx}" y="${cy + 14}"
              text-anchor="middle"
              font-family="Garamond, Georgia, serif"
              font-size="13"
              fill="#1a1a1a"
              font-style="italic">${escapeHtml(value)}</text>
    `;
    
    // Couleurs par axe (charte NARR'IA)
    const ACCENT = '#1F4E79';   // bleu : axe du désir (Sujet → Objet)
    const GOLD = '#C55A11';     // gold : axe de communication (Destinateur → Destinataire)
    const GRAY = '#595959';     // gris : axe du pouvoir (Adjuvant ↔ Opposant)
    const BG_BLUE = '#E8F0F7';
    const BG_GOLD = '#FCEFE5';
    const BG_GRAY = '#F2F2F2';
    
    // Dimensions du SVG
    const W = 720;  // largeur
    const H = 480;  // hauteur
    const boxW = 160;
    const boxH = 56;
    
    // Positions (coordonnées du centre de chaque cartouche)
    const positions = {
        destinateur: {x: 130, y: 80},
        objet:        {x: W/2, y: 80},
        destinataire: {x: W - 130, y: 80},
        adjuvant:    {x: 130, y: H - 80},
        sujet:        {x: W/2, y: H - 80},
        opposant:    {x: W - 130, y: H - 80},
    };
    
    // Construction du SVG
    let svg = `
        <div class="actantial-diagram">
            <h4>Schéma actantiel (modèle greimassien)</h4>
            <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Schéma actantiel">
                <defs>
                    <marker id="arrow-blue" viewBox="0 0 10 10" refX="9" refY="5"
                            markerWidth="8" markerHeight="8" orient="auto">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="${ACCENT}"/>
                    </marker>
                    <marker id="arrow-gold" viewBox="0 0 10 10" refX="9" refY="5"
                            markerWidth="8" markerHeight="8" orient="auto">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="${GOLD}"/>
                    </marker>
                    <marker id="arrow-gray" viewBox="0 0 10 10" refX="9" refY="5"
                            markerWidth="8" markerHeight="8" orient="auto">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="${GRAY}"/>
                    </marker>
                </defs>
    `;
    
    // ─── AXES (lignes) ───
    
    // Axe du désir : Sujet → Objet (vertical, bleu, traversant)
    svg += `
        <line x1="${positions.sujet.x}" y1="${positions.sujet.y - boxH/2 - 5}"
              x2="${positions.objet.x}" y2="${positions.objet.y + boxH/2 + 8}"
              stroke="${ACCENT}" stroke-width="3"
              marker-end="url(#arrow-blue)"/>
        <text x="${W/2 + 12}" y="${H/2}"
              font-family="Arial, sans-serif"
              font-size="10"
              fill="${ACCENT}"
              font-weight="bold"
              text-transform="uppercase"
              letter-spacing="2">AXE DU DÉSIR</text>
    `;
    
    // Axe de communication : Destinateur → Destinataire (horizontal haut, gold)
    // Passant *derrière* l'objet, ou le contournant légèrement
    svg += `
        <line x1="${positions.destinateur.x + boxW/2 + 5}" y1="${positions.destinateur.y}"
              x2="${positions.objet.x - boxW/2 - 5}" y2="${positions.objet.y}"
              stroke="${GOLD}" stroke-width="2"/>
        <line x1="${positions.objet.x + boxW/2 + 5}" y1="${positions.objet.y}"
              x2="${positions.destinataire.x - boxW/2 - 8}" y2="${positions.destinataire.y}"
              stroke="${GOLD}" stroke-width="2"
              marker-end="url(#arrow-gold)"/>
        <text x="${W/2}" y="${positions.objet.y - boxH/2 - 12}"
              text-anchor="middle"
              font-family="Arial, sans-serif"
              font-size="10"
              fill="${GOLD}"
              font-weight="bold"
              text-transform="uppercase"
              letter-spacing="2">AXE DE COMMUNICATION</text>
    `;
    
    // Axe du pouvoir : Adjuvant ↔ Sujet ↔ Opposant (horizontal bas, gris)
    svg += `
        <line x1="${positions.adjuvant.x + boxW/2 + 5}" y1="${positions.adjuvant.y}"
              x2="${positions.sujet.x - boxW/2 - 8}" y2="${positions.sujet.y}"
              stroke="${GRAY}" stroke-width="2"
              marker-end="url(#arrow-gray)"/>
        <line x1="${positions.opposant.x - boxW/2 - 5}" y1="${positions.opposant.y}"
              x2="${positions.sujet.x + boxW/2 + 8}" y2="${positions.sujet.y}"
              stroke="${GRAY}" stroke-width="2"
              stroke-dasharray="6 3"
              marker-end="url(#arrow-gray)"/>
        <text x="${W/2}" y="${positions.sujet.y + boxH/2 + 22}"
              text-anchor="middle"
              font-family="Arial, sans-serif"
              font-size="10"
              fill="${GRAY}"
              font-weight="bold"
              text-transform="uppercase"
              letter-spacing="2">AXE DU POUVOIR</text>
    `;
    
    // ─── CARTOUCHES (sur les lignes) ───
    
    svg += cartouche(positions.destinateur.x, positions.destinateur.y, boxW, boxH,
                     'Destinateur', destinateur, GOLD, BG_GOLD);
    svg += cartouche(positions.objet.x, positions.objet.y, boxW, boxH,
                     'Objet', objet, ACCENT, BG_BLUE);
    svg += cartouche(positions.destinataire.x, positions.destinataire.y, boxW, boxH,
                     'Destinataire', destinataire, GOLD, BG_GOLD);
    svg += cartouche(positions.adjuvant.x, positions.adjuvant.y, boxW, boxH,
                     'Adjuvant', adjuvant, GRAY, BG_GRAY);
    svg += cartouche(positions.sujet.x, positions.sujet.y, boxW, boxH,
                     'Sujet', sujet, ACCENT, BG_BLUE);
    svg += cartouche(positions.opposant.x, positions.opposant.y, boxW, boxH,
                     'Opposant', opposant, GRAY, BG_GRAY);
    
    svg += `
            </svg>
            <p class="diagram-caption">
                <small>D'après le modèle actantiel d'A. J. Greimas (Sémantique structurale, 1966).
                Les axes verticaux représentent le désir (Sujet ↔ Objet), horizontaux supérieurs la
                communication (Destinateur ↔ Destinataire), horizontaux inférieurs le pouvoir
                (Adjuvant ↔ Sujet ← Opposant).</small>
            </p>
        </div>
    `;
    
    return svg;
}
