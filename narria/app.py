"""
NARR'IA — Application graphique
================================

Interface web locale pour le système NARR'IA de détection du plagiat d'intrigue.

Lance un serveur Flask local et ouvre le navigateur par défaut sur l'interface.
Aucune donnée n'est envoyée sur internet : tout le traitement est effectué
localement sur la machine de l'utilisateur.

Usage:
    python -m narria.app

Ou plus simplement :
    ./NARRIA.sh      (Linux / macOS)
    NARRIA.bat       (Windows)
"""

import os
import sys
import json
import re
import threading
import webbrowser
from datetime import datetime
from pathlib import Path
import pathlib
import logging

_logger = logging.getLogger('narria')

try:
    from flask import (Flask, render_template, request, jsonify, send_file,
                       session, redirect, url_for, g)
except ImportError:
    print("ERREUR : Flask n'est pas installé.")
    print("Exécutez d'abord : ./install.sh (Linux/macOS) ou install.bat (Windows)")
    sys.exit(1)

# ─── Import des modules NARR'IA ─────────────────────────────────────
from narria.m1_segmentation.segmenter import NarrativeSegmenter
from narria.m2_extraction.extractor import GraphExtractor
from narria.m2_extraction.llm_extractor import LLMGraphExtractor
from narria.m3_comparison.comparator import NarrativeComparator
from narria.m4_database.storage import GraphStore
from narria.m4_database.history import AnalysisHistory
from narria.m5_reporting.reporter import ReportGenerator
from narria.core.models import NarrativeGraph
from narria.llm.config import get_config
from narria.llm.claude_client import (
    ClaudeClient, ANTHROPIC_AVAILABLE, DEFAULT_MODEL,
    PRICE_INPUT_PER_MTOK, PRICE_OUTPUT_PER_MTOK,
)
from narria.io.file_extractor import FileExtractor

# ─── Configuration Flask ────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
app = Flask(
    __name__,
    template_folder=str(BASE_DIR / 'templates'),
    static_folder=str(BASE_DIR / 'static'),
)
# Secret key : en production, OBLIGATOIRE de définir SECRET_KEY dans l'environnement
# (Render/Fly.io etc.). En local, on génère un secret éphémère (perdu au redémarrage).
import secrets as _secrets
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or _secrets.token_hex(32)
app.config['MAX_CONTENT_LENGTH'] = 300 * 1024 * 1024  # 300 MB max upload (for very large works)

# ─── Initialisation des modules ─────────────────────────────────────
segmenter = NarrativeSegmenter()
local_extractor = GraphExtractor()
comparator = NarrativeComparator()
store = GraphStore()
history = AnalysisHistory()
reporter = ReportGenerator()
narria_config = get_config()
file_extractor = FileExtractor(clean_text=True)


# ─── Sécurité : chemins de tokens de réinitialisation ───────────────
# Protège contre les attaques de type "path traversal" : un attaquant
# qui tenterait d'envoyer un token contenant des caractères comme
# ../../etc/passwd ne pourra pas sortir du dossier /data/reset_tokens/.
RESET_TOKENS_DIR = pathlib.Path("/data/reset_tokens").resolve()

def _safe_token_path(token: str) -> pathlib.Path:
    """Construit un chemin sécurisé pour le fichier d'un token de réinitialisation.

    Valide que le token ne contient que des caractères URL-safe (ce que
    secrets.token_urlsafe produit) et que le chemin final reste bien
    confiné dans RESET_TOKENS_DIR.
    """
    if not re.fullmatch(r'[A-Za-z0-9_\-]{20,64}', token):
        raise ValueError("Token invalide")
    path = (RESET_TOKENS_DIR / f"{token}.json").resolve()
    if not str(path).startswith(str(RESET_TOKENS_DIR)):
        raise ValueError("Tentative de path traversal détectée")
    return path


# ─── Sécurité : gestion des erreurs serveur ─────────────────────────
# Journalise l'erreur complète côté serveur (logs Render), mais ne
# renvoie qu'un message générique au client. Évite de révéler la
# structure interne du serveur (chemins, modules, versions) à un
# attaquant potentiel via les tracebacks Python.
def _error_response(e: Exception, user_message: str, status: int = 500):
    """Journalise l'erreur serveur et retourne un message générique au client."""
    _logger.exception(user_message)
    if app.debug:
        import traceback as _tb
        return jsonify({'error': str(e), 'traceback': _tb.format_exc()}), status
    return jsonify({'error': user_message}), status


def get_active_extractor():
    """
    Retourne l'extracteur à utiliser selon la configuration.
    - Si une clé Claude est configurée et le SDK anthropic est installé → LLMGraphExtractor
    - Sinon → GraphExtractor (mode local, heuristique par mots-clés)
    """
    if narria_config.is_configured() and ANTHROPIC_AVAILABLE:
        try:
            api_key = narria_config.get_api_key()
            claude_client = ClaudeClient(api_key=api_key)
            return LLMGraphExtractor(claude_client), 'llm'
        except Exception as e:
            print(f"[NARR'IA] Échec de l'initialisation LLM, fallback local : {e}")
            return local_extractor, 'local'
    return local_extractor, 'local'

# Storage for session work (in-memory, resets on restart)
SESSION = {
    'graphs': {},         # graph_id -> NarrativeGraph
    'analyses': {},        # analysis_id -> comparison result
    'last_report': None,
}


# ═══════════════════════════════════════════════════════════════════
#  ROUTES
# ═══════════════════════════════════════════════════════════════════

@app.route('/')
def index():
    """Page d'accueil de l'application."""
    # Si AUTH activé et utilisateur non connecté, rediriger vers login
    if _auth_enabled() and not session.get('user_id'):
        return redirect(url_for('login_page'))
    return render_template('index.html', version='2.0.0')


# ═══════════════════════════════════════════════════════════════════
#  ROUTES D'AUTHENTIFICATION
# ═══════════════════════════════════════════════════════════════════
# L'authentification est activée uniquement si NARRIA_AUTH_ENABLED=true
# (en production sur Render). En local, l'auth est désactivée par défaut
# pour permettre l'usage personnel sans friction.

def _auth_enabled() -> bool:
    return os.environ.get('NARRIA_AUTH_ENABLED', '').lower() == 'true'


@app.route('/login', methods=['GET'])
def login_page():
    """Affiche la page de connexion."""
    if not _auth_enabled():
        return redirect(url_for('home'))
    if session.get('user_id'):
        return redirect(url_for('home'))
    return render_template('login.html')


@app.route('/register', methods=['GET'])
def register_page():
    """Affiche la page d'inscription."""
    if not _auth_enabled():
        return redirect(url_for('home'))
    if session.get('user_id'):
        return redirect(url_for('home'))
    return render_template('register.html')
@app.route('/forgot-password', methods=['GET'])
def forgot_password_page():
    """Affiche la page de mot de passe oublié."""
    if not _auth_enabled():
        return redirect(url_for('home'))
    return render_template('forgot_password.html')



@app.route('/api/auth/forgot-password', methods=['POST'])
def api_forgot_password():
    """Envoie un email de réinitialisation de mot de passe."""
    import requests as http_requests
    import json
    from narria.auth.users import UserStore
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    if not email:
        return jsonify({'error': 'Email requis'}), 400
    user = UserStore().get_user_by_email(email)
    if user:
        token = secrets.token_urlsafe(32)
        RESET_TOKENS_DIR.mkdir(parents=True, exist_ok=True)
        token_file = _safe_token_path(token)
        token_file.write_text(
            json.dumps({'email': email, 'expires': (datetime.now() + timedelta(hours=1)).isoformat()}),
            encoding='utf-8'
        )
        reset_link = f"https://narria.tech/reset-password?token={token}"
        brevo_api_key = os.environ.get('BREVO_API_KEY')
        resp = http_requests.post(
            'https://api.brevo.com/v3/smtp/email',
            headers={'api-key': brevo_api_key, 'Content-Type': 'application/json'},
            json={
                'sender': {'name': "NARR'IA", 'email': 'noreply@narria.tech'},
                'to': [{'email': email}],
                'subject': "Réinitialisation de votre mot de passe NARR'IA",
                'textContent': f"Bonjour,\n\nCliquez sur ce lien :\n{reset_link}\n\nCe lien expire dans 1 heure.\n\nL'équipe NARR'IA"
            }
        )
        if resp.status_code != 201:
            print(f"[NARR'IA] Erreur Brevo : {resp.text}")
    return jsonify({'message': 'Si cet email existe, un lien a été envoyé.'})

@app.route('/reset-password', methods=['GET'])
def reset_password_page():
    """Affiche la page de réinitialisation de mot de passe."""
    if not _auth_enabled():
        return redirect(url_for('home'))
    return render_template('reset_password.html')


@app.route('/api/auth/reset-password', methods=['POST'])
def api_reset_password():
    """Réinitialise le mot de passe avec le token reçu par email."""
    import os
    import secrets
    from datetime import datetime, timedelta
    from narria.auth.users import UserStore
    data = request.get_json()
    token = data.get('token', '')
    password = data.get('password', '')
    if not token or not password:
        return jsonify({'error': 'Données manquantes'}), 400
    try:
        token_file = _safe_token_path(token)
    except ValueError:
        return jsonify({'error': 'Lien invalide ou expiré'}), 400
    if not token_file.exists():
        return jsonify({'error': 'Lien invalide ou expiré'}), 400
    token_data = json.loads(token_file.read_text(encoding='utf-8'))
    expires = datetime.fromisoformat(token_data['expires'])
    if datetime.now() > expires:
        return jsonify({'error': 'Lien expiré'}), 400
    email = token_data['email']
    store = UserStore()
    user = store.get_user_by_email(email)
    if not user:
        return jsonify({'error': 'Utilisateur introuvable'}), 404
    store.change_password(user['id'], password)
    token_file.unlink()
    return jsonify({'message': 'Mot de passe modifié avec succès'})

@app.route('/api/auth/register', methods=['POST'])
def api_register():
    """Inscription d'un nouvel utilisateur."""
    if not _auth_enabled():
        return jsonify({'error': 'Authentification non activée'}), 400
    
    from narria.auth.users import UserStore
    
    data = request.get_json() or {}
    email = (data.get('email') or '').strip()
    password = data.get('password') or ''
    full_name = (data.get('full_name') or '').strip()
    affiliation = (data.get('affiliation') or '').strip()
    
    try:
        store = UserStore()
        user = store.create_user(
            email=email,
            password=password,
            full_name=full_name,
            affiliation=affiliation,
            is_admin=False,
            quota_daily=5,
            quota_monthly=50,
        )
        # Auto-login après inscription
        session['user_id'] = user['id']
        session['user_email'] = user['email']
        session.permanent = True
        return jsonify({
            'success': True,
            'user': {
                'id': user['id'],
                'email': user['email'],
                'full_name': user['full_name'],
                'is_admin': bool(user['is_admin']),
            }
        })
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Erreur interne : {e}'}), 500


@app.route('/api/auth/login', methods=['POST'])
def api_login():
    """Connexion d'un utilisateur."""
    if not _auth_enabled():
        return jsonify({'error': 'Authentification non activée'}), 400
    
    from narria.auth.users import UserStore
    
    data = request.get_json() or {}
    email = (data.get('email') or '').strip()
    password = data.get('password') or ''
    
    if not email or not password:
        return jsonify({'error': 'E-mail et mot de passe requis'}), 400
    
    store = UserStore()
    user = store.authenticate(email, password)
    if not user:
        return jsonify({'error': 'E-mail ou mot de passe incorrect'}), 401
    
    session['user_id'] = user['id']
    session['user_email'] = user['email']
    session.permanent = True
    
    return jsonify({
        'success': True,
        'user': {
            'id': user['id'],
            'email': user['email'],
            'full_name': user['full_name'],
            'is_admin': bool(user['is_admin']),
        }
    })


@app.route('/api/auth/logout', methods=['POST'])
def api_logout():
    """Déconnexion."""
    session.clear()
    return jsonify({'success': True})


@app.route('/api/auth/me', methods=['GET'])
def api_auth_me():
    """Retourne les infos de l'utilisateur connecté."""
    if not _auth_enabled():
        return jsonify({'auth_enabled': False, 'user': None})
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'auth_enabled': True, 'user': None})
    
    from narria.auth.users import UserStore
    from narria.auth.quotas import QuotaManager
    
    store = UserStore()
    user = store.get_user_by_id(user_id)
    if not user or not user['is_active']:
        session.clear()
        return jsonify({'auth_enabled': True, 'user': None})
    
    quota = QuotaManager()
    status = quota.get_status(user['id'], user['quota_daily'], user['quota_monthly'])
    
    return jsonify({
        'auth_enabled': True,
        'user': {
            'id': user['id'],
            'email': user['email'],
            'full_name': user['full_name'],
            'affiliation': user['affiliation'],
            'is_admin': bool(user['is_admin']),
        },
        'quota': status,
    })


@app.route('/home')
def home():
    """Alias vers /"""
    return redirect(url_for('index'))


# ═══════════════════════════════════════════════════════════════════
#  ROUTES ADMIN
# ═══════════════════════════════════════════════════════════════════

@app.route('/admin')
def admin_page():
    """Page d'administration (réservée admin)."""
    if not _auth_enabled():
        return "Authentification non activée", 400
    
    user_id = session.get('user_id')
    if not user_id:
        return redirect(url_for('login_page', next='/admin'))
    
    from narria.auth.users import UserStore
    user = UserStore().get_user_by_id(user_id)
    if not user or not user['is_admin']:
        return "Accès réservé aux administrateurs", 403
    
    return render_template('admin.html')


@app.route('/api/admin/users', methods=['GET'])
def api_admin_list_users():
    """Liste tous les utilisateurs avec leur consommation."""
    if not _auth_enabled():
        return jsonify({'error': 'Auth non activée'}), 400
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Auth requise'}), 401
    
    from narria.auth.users import UserStore
    from narria.auth.quotas import QuotaManager
    
    store = UserStore()
    me = store.get_user_by_id(user_id)
    if not me or not me['is_admin']:
        return jsonify({'error': 'Privilèges admin requis'}), 403
    
    quota = QuotaManager()
    users = store.list_users()
    
    enriched = []
    for u in users:
        usage = quota.get_usage_summary(u['id'], days=30)
        enriched.append({
            'id': u['id'],
            'email': u['email'],
            'full_name': u['full_name'],
            'affiliation': u['affiliation'],
            'is_admin': bool(u['is_admin']),
            'is_active': bool(u['is_active']),
            'created_at': u['created_at'],
            'last_login_at': u['last_login_at'],
            'quota_daily': u['quota_daily'],
            'quota_monthly': u['quota_monthly'],
            'usage': usage,
            'used_24h': quota.get_usage_24h(u['id']),
            'used_30d': quota.get_usage_30d(u['id']),
        })
    
    total_cost = quota.get_total_cost_all_users(days=30)
    
    return jsonify({
        'users': enriched,
        'total_cost_30d_usd': total_cost,
        'total_users': len(enriched),
    })


@app.route('/api/admin/user/<int:user_id>/quota', methods=['POST'])
def api_admin_set_quota(user_id):
    """Modifie le quota d'un utilisateur."""
    if not _auth_enabled():
        return jsonify({'error': 'Auth non activée'}), 400
    
    me_id = session.get('user_id')
    if not me_id:
        return jsonify({'error': 'Auth requise'}), 401
    
    from narria.auth.users import UserStore
    store = UserStore()
    me = store.get_user_by_id(me_id)
    if not me or not me['is_admin']:
        return jsonify({'error': 'Privilèges admin requis'}), 403
    
    data = request.get_json() or {}
    daily = int(data.get('quota_daily', 5))
    monthly = int(data.get('quota_monthly', 50))
    
    if daily < 0 or monthly < 0 or daily > 1000 or monthly > 10000:
        return jsonify({'error': 'Valeurs hors limites raisonnables'}), 400
    
    store.set_quota(user_id, daily, monthly)
    return jsonify({'success': True})


@app.route('/api/admin/user/<int:user_id>/active', methods=['POST'])
def api_admin_set_active(user_id):
    """Active/désactive un compte."""
    if not _auth_enabled():
        return jsonify({'error': 'Auth non activée'}), 400
    
    me_id = session.get('user_id')
    if not me_id:
        return jsonify({'error': 'Auth requise'}), 401
    
    from narria.auth.users import UserStore
    store = UserStore()
    me = store.get_user_by_id(me_id)
    if not me or not me['is_admin']:
        return jsonify({'error': 'Privilèges admin requis'}), 403
    
    data = request.get_json() or {}
    active = bool(data.get('active', True))
    
    # On ne peut pas désactiver son propre compte
    if user_id == me_id and not active:
        return jsonify({'error': 'Impossible de désactiver votre propre compte'}), 400
    
    store.set_active(user_id, active)
    return jsonify({'success': True})


# ═══════════════════════════════════════════════════════════════════
#  HEALTHCHECK (pour Render)
# ═══════════════════════════════════════════════════════════════════

@app.route('/api/health')
def api_health():
    """Endpoint de santé pour le monitoring de l'hébergeur."""
    return jsonify({
        'status': 'ok',
        'version': '2.0.0',
        'auth_enabled': _auth_enabled(),
    })


@app.route('/api/upload-file', methods=['POST'])
def api_upload_file():
    """
    Téléverse un fichier (.txt, .docx, .pdf, .odt) et extrait son texte.
    Retourne le texte extrait + métadonnées (nb de mots, avertissements, titre, auteur).
    """
    if 'file' not in request.files:
        return jsonify({'error': 'Aucun fichier fourni'}), 400
    
    uploaded = request.files['file']
    if not uploaded or not uploaded.filename:
        return jsonify({'error': 'Fichier vide'}), 400
    
    # Check file extension
    filename = uploaded.filename
    suffix = '.' + filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if suffix not in FileExtractor.SUPPORTED_FORMATS:
        return jsonify({
            'error': f'Format non supporté : {suffix}. '
                     f'Formats acceptés : {", ".join(sorted(FileExtractor.SUPPORTED_FORMATS))}'
        }), 400
    
    # Save to a temp file (needed for pypdf/python-docx which require a path)
    import tempfile
    temp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        uploaded.save(temp.name)
        temp.close()
        
        # Extract text
        try:
            result = file_extractor.extract(temp.name)
        except (ValueError, FileNotFoundError, ImportError) as e:
            return jsonify({'error': str(e)}), 400
        
        # Preserve original filename in result
        result.source_filename = filename
        
        # Warn if text is too short
        if result.word_count < 30:
            result.warnings.append(
                f"Le texte extrait ne contient que {result.word_count} mots. "
                "Il est possible que le fichier n'ait pas pu être correctement lu, "
                "ou qu'il soit trop court pour une analyse narratologique utile."
            )
        
        return jsonify(result.to_dict())
    
    except Exception as e:
        return _error_response(e, "Erreur lors du traitement du fichier. Veuillez réessayer.")
    finally:
        # Clean up temp file
        try:
            Path(temp.name).unlink(missing_ok=True)
        except Exception:
            pass


@app.route('/api/analyze-text', methods=['POST'])
def api_analyze_text():
    """
    Analyse un texte : segmentation (M1) + extraction du graphe narratif (M2).
    Retourne le graphe narratif au format JSON.
    """
    # ─── AUTH + QUOTAS (si activés) ───
    user = None
    if _auth_enabled():
        from narria.auth.users import UserStore
        from narria.auth.quotas import QuotaManager
        
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Authentification requise'}), 401
        
        user = UserStore().get_user_by_id(user_id)
        if not user or not user['is_active']:
            session.clear()
            return jsonify({'error': 'Compte invalide ou désactivé'}), 401
    
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({'error': 'Aucun texte fourni'}), 400
    
    text = data['text']
    title = data.get('title', 'Texte sans titre')
    author = data.get('author', 'Auteur inconnu')
    
    if len(text.strip()) < 200:
        return jsonify({'error': 'Le texte doit contenir au moins 200 caractères (≈ 30 mots) pour produire une analyse significative'}), 400
    
    # ─── VÉRIFICATION DU QUOTA (uniquement pour le mode LLM) ───
    # On ne vérifie le quota qu'avant d'appeler le LLM (mode local = gratuit)
    will_use_llm = False
    if _auth_enabled() and user:
        from narria.auth.quotas import QuotaManager
        # Détermine si le mode LLM sera utilisé
        active_extractor, will_mode = get_active_extractor()
        will_use_llm = (will_mode == 'llm')
        
        if will_use_llm:
            quota_mgr = QuotaManager()
            check = quota_mgr.can_perform_action(
                user['id'], user['quota_daily'], user['quota_monthly']
            )
            if not check['allowed']:
                return jsonify({
                    'error': check['reason'],
                    'quota_blocked': True,
                }), 429  # Too Many Requests
    
    try:
        # Module 1 — Segmentation
        segments = segmenter.segment(text)
        
        # Module 2 — Extraction du graphe narratif (local ou LLM selon config)
        active_extractor, mode = get_active_extractor()
        
        # Le LLMGraphExtractor accepte le texte complet pour meilleure analyse
        if mode == 'llm':
            graph = active_extractor.extract(
                segments=segments,
                metadata={'title': title, 'author': author},
                full_text=text,
            )
        else:
            graph = active_extractor.extract(
                segments=segments,
                metadata={'title': title, 'author': author}
            )
        
        # Stockage temporaire pour comparaison ultérieure
        graph_id = f"g_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
        SESSION['graphs'][graph_id] = graph
        # Override the graph's own ID with the session-friendly one
        graph.graph_id = graph_id
        
        # Persist to history (so the analysis survives across sessions)
        try:
            history_entry = history.record_analysis(
                graph_id=graph_id,
                graph_dict=graph.to_dict(),
                mode=mode,
                source_filename=None,  # could be added if uploaded via file
                original_text=text,
            )
        except Exception as e:
            print(f"[NARR'IA] Erreur d'archivage historique : {e}")
            history_entry = None
        
        # Enrich response based on mode
        response_data = {
            'graph_id': graph_id,
            'mode': mode,
            'title': title,
            'author': author,
            'n_segments': len(segments),
            'n_nodes': len(graph.nodes),
            'n_edges': len(graph.edges),
            'functions': [n.function_code for n in graph.nodes if n.function_code],
            'actants': list(set(a for n in graph.nodes for a in (n.actants or []))),
            'tension_profile': [n.tension for n in graph.nodes],
            'graph': graph.to_dict(),
        }
        
        # Add LLM-specific fields if applicable
        if mode == 'llm' and graph.metadata:
            response_data['summary'] = graph.metadata.get('summary', '')
            response_data['genre'] = graph.metadata.get('genre', '')
            response_data['tradition'] = graph.metadata.get('tradition', '')
            response_data['main_actants'] = graph.metadata.get('main_actants', {})
            response_data['thematic_keywords'] = graph.metadata.get('thematic_keywords', [])
            response_data['llm_usage'] = graph.metadata.get('llm_usage', {})
            # Chunking metadata if applicable
            if graph.metadata.get('chunked'):
                response_data['chunked'] = True
                response_data['n_chunks'] = graph.metadata.get('n_chunks', 0)
                response_data['merge_info'] = graph.metadata.get('merge_info', {})
                if graph.metadata.get('warning'):
                    response_data['chunk_warning'] = graph.metadata['warning']
            if 'error' in graph.metadata:
                response_data['llm_error'] = graph.metadata['error']
        
        # ─── JOURNALISATION DE L'USAGE (si auth activé et mode LLM) ───
        if _auth_enabled() and user and mode == 'llm':
            from narria.auth.quotas import QuotaManager
            cost = float(graph.metadata.get('llm_usage', {}).get('cost_usd', 0)) if graph.metadata else 0
            tokens = int(graph.metadata.get('llm_usage', {}).get('input_tokens', 0)
                         + graph.metadata.get('llm_usage', {}).get('output_tokens', 0)) if graph.metadata else 0
            try:
                QuotaManager().log_action(
                    user_id=user['id'],
                    action='analyze_llm',
                    cost_usd=cost,
                    tokens=tokens,
                    metadata=f"title={title[:50]};graph_id={graph_id}"
                )
            except Exception as e:
                print(f"[NARR'IA] Erreur de journalisation quota : {e}")
        
        return jsonify(response_data)
    except Exception as e:
        return _error_response(e, "Erreur lors de l'analyse. Veuillez réessayer.")


@app.route('/api/compare', methods=['POST'])
def api_compare():
    """
    Compare deux graphes narratifs préalablement analysés.
    Retourne les scores SNS, SS, ST, SRJ et les correspondances détectées.
    """
    # ─── AUTH + QUOTAS ───
    user = None
    if _auth_enabled():
        from narria.auth.users import UserStore
        from narria.auth.quotas import QuotaManager
        
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Authentification requise'}), 401
        
        user = UserStore().get_user_by_id(user_id)
        if not user or not user['is_active']:
            session.clear()
            return jsonify({'error': 'Compte invalide ou désactivé'}), 401
        
        # Quota check (la comparaison compte même sans LLM, car c'est une action analytique)
        check = QuotaManager().can_perform_action(
            user['id'], user['quota_daily'], user['quota_monthly']
        )
        if not check['allowed']:
            return jsonify({
                'error': check['reason'],
                'quota_blocked': True,
            }), 429
    
    data = request.get_json()
    graph_id_ref = data.get('graph_id_ref')
    graph_id_cand = data.get('graph_id_cand')

    # ─── RÉCUPÉRATION DES GRAPHES (mémoire, puis repli disque) ───
    # En multi-workers, la requête peut tomber sur un worker qui n'a pas
    # le graphe en mémoire (parce qu'il a été créé par un autre worker).
    # On relit alors depuis le disque, puis on remet en cache local pour
    # accélérer les requêtes suivantes sur ce worker.
    def _retrieve_graph(gid):
        if gid in SESSION['graphs']:
            return SESSION['graphs'][gid]
        graph_dict = history.get_graph_dict(gid)
        if not graph_dict:
            return None
        from narria.core.models import NarrativeGraph
        graph = NarrativeGraph.from_dict(graph_dict)
        SESSION['graphs'][gid] = graph
        return graph

    graph_ref = _retrieve_graph(graph_id_ref)
    if graph_ref is None:
        return jsonify({'error': 'Graphe de référence introuvable. Analysez d\'abord le texte.'}), 404
    graph_cand = _retrieve_graph(graph_id_cand)
    if graph_cand is None:
        return jsonify({'error': 'Graphe candidat introuvable. Analysez d\'abord le texte.'}), 404

    try:
        # Module 3 — Comparaison
        result = comparator.compare(graph_ref, graph_cand)
        
        # Stockage
        analysis_id = f"a_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
        SESSION['analyses'][analysis_id] = {
            'result': result,
            'graph_ref': graph_ref,
            'graph_cand': graph_cand,
            'timestamp': datetime.now().isoformat(),
        }
        
        # Build the response payload first (we'll reuse it for history)
        response_payload = {
            'analysis_id': analysis_id,
            'sns': round(result.sns, 3),
            'sns_n': round(result.sns_normalized, 3),
            'ss': round(result.ss, 3),
            'st': round(result.st, 3),
            'srj': round(result.srj, 3),
            'srj_level': result.srj_level,
            'srj_class': result.srj_level,
            'modality': result.detected_modality,
            'verdict': result.verdict,
            'details': {
                's_iso': round(result.s_iso, 3),
                's_ged': round(result.s_ged, 3),
                's_func': round(result.s_func, 3),
                's_act': round(result.s_act, 3),
                's_tens': round(result.s_tens, 3),
            },
            'correspondences': result.correspondences[:20],
            'warnings': result.warnings,
        }
        
        # Persist comparison in history (le comp_id retourné devient l'identifiant
        # canonique : il permet au frontend de retrouver la comparaison sur disque
        # même si elle n'est plus en mémoire ; nécessaire en multi-workers).
        persisted_comp_id = None
        try:
            comp_entry = history.record_comparison(
                ref_id=graph_id_ref,
                cand_id=graph_id_cand,
                comparison_result=response_payload,
            )
            persisted_comp_id = comp_entry.get('comparison_id')
        except Exception as e:
            print(f"[NARR'IA] Erreur d'archivage de la comparaison : {e}")

        # On utilise le comp_id comme analysis_id pour le frontend, afin que la
        # génération de rapport puisse retrouver la comparaison sur disque.
        # Si la persistance a échoué, on retombe sur l'ancien identifiant mémoire.
        if persisted_comp_id:
            SESSION['analyses'][persisted_comp_id] = SESSION['analyses'][analysis_id]
            response_payload['analysis_id'] = persisted_comp_id
        
        # ─── JOURNALISATION QUOTA ───
        if _auth_enabled() and user:
            from narria.auth.quotas import QuotaManager
            try:
                QuotaManager().log_action(
                    user_id=user['id'],
                    action='comparison',
                    cost_usd=0.0,  # La comparaison ne consomme pas de LLM
                    tokens=0,
                    metadata=f"ref={graph_id_ref};cand={graph_id_cand}"
                )
            except Exception as e:
                print(f"[NARR'IA] Erreur de journalisation quota : {e}")
        
        return jsonify(response_payload)
    except Exception as e:
        return _error_response(e, "Erreur lors de la comparaison. Veuillez réessayer.")


@app.route('/api/generate-report/<analysis_id>', methods=['POST'])
def api_generate_report(analysis_id):
    """Génère un rapport complet (HTML) pour une analyse.

    Cherche d'abord en mémoire (SESSION). Si absent — cas typique en multi-workers
    où la requête tombe sur un worker différent de celui qui a fait la
    comparaison — recharge la comparaison et les graphes depuis le disque.
    """
    try:
        # ─── PISTE 1 : mémoire vive (worker chanceux) ───
        if analysis_id in SESSION['analyses']:
            analysis = SESSION['analyses'][analysis_id]
            report_html = reporter.generate_html(
                result=analysis['result'],
                graph_ref=analysis['graph_ref'],
                graph_cand=analysis['graph_cand'],
            )
        else:
            # ─── PISTE 2 : repli disque (multi-workers) ───
            # On accepte ici un comparison_id (c_*) — c'est ce que renvoie
            # désormais api_compare comme analysis_id.
            comp = history.get_comparison(analysis_id)
            if not comp:
                return jsonify({'error': 'Analyse introuvable (ni en mémoire, ni sur disque).'}), 404

            ref_graph_id = comp.get('ref_graph_id')
            cand_graph_id = comp.get('cand_graph_id')
            full_result = comp.get('full_result') or {}

            graph_ref_dict = history.get_graph_dict(ref_graph_id) if ref_graph_id else None
            graph_cand_dict = history.get_graph_dict(cand_graph_id) if cand_graph_id else None
            if not graph_ref_dict or not graph_cand_dict:
                return jsonify({'error': 'Les graphes de la comparaison sont introuvables sur disque.'}), 404

            # Reconstruction des objets Python depuis les dicts
            from narria.core.models import NarrativeGraph, ComparisonResult
            graph_ref = NarrativeGraph.from_dict(graph_ref_dict)
            graph_cand = NarrativeGraph.from_dict(graph_cand_dict)

            details = full_result.get('details') or {}
            result = ComparisonResult(
                sns=full_result.get('sns', 0.0),
                sns_normalized=full_result.get('sns_n', 0.0),
                ss=full_result.get('ss', 0.0),
                st=full_result.get('st', 0.0),
                srj=full_result.get('srj', 0.0),
                srj_level=full_result.get('srj_level') or full_result.get('srj_class', 'Faible'),
                s_iso=details.get('s_iso', 0.0),
                s_ged=details.get('s_ged', 0.0),
                s_func=details.get('s_func', 0.0),
                s_act=details.get('s_act', 0.0),
                s_tens=details.get('s_tens', 0.0),
                detected_modality=full_result.get('modality', 'Aucune'),
                verdict=full_result.get('verdict', ''),
                correspondences=full_result.get('correspondences', []),
                warnings=full_result.get('warnings', []),
            )
            report_html = reporter.generate_html(
                result=result,
                graph_ref=graph_ref,
                graph_cand=graph_cand,
            )

        # ─── ÉCRITURE DU RAPPORT SUR DISQUE ───
        reports_dir = BASE_DIR / 'reports'
        reports_dir.mkdir(exist_ok=True)
        report_path = reports_dir / f"rapport_{analysis_id}.html"
        report_path.write_text(report_html, encoding='utf-8')

        SESSION['last_report'] = str(report_path)

        return jsonify({
            'success': True,
            'report_path': str(report_path),
            'report_url': f'/reports/{report_path.name}',
        })
    except Exception as e:
        return _error_response(e, "Erreur lors de la génération du rapport. Veuillez réessayer.")


@app.route('/reports/<path:filename>')
def serve_report(filename):
    """Sert les rapports HTML générés."""
    reports_dir = BASE_DIR / 'reports'
    return send_file(reports_dir / filename)


@app.route('/api/samples')
def api_samples():
    """Liste les textes-échantillons fournis pour démonstration."""
    samples_dir = BASE_DIR / 'samples'
    samples = []
    if samples_dir.exists():
        for f in sorted(samples_dir.glob('*.json')):
            try:
                data = json.loads(f.read_text(encoding='utf-8'))
                samples.append({
                    'id': f.stem,
                    'title': data.get('title', f.stem),
                    'author': data.get('author', 'Inconnu'),
                    'summary': data.get('summary', ''),
                })
            except Exception:
                pass
    return jsonify({'samples': samples})


@app.route('/api/sample/<sample_id>')
def api_sample(sample_id):
    """Renvoie un texte-échantillon complet."""
    samples_dir = BASE_DIR / 'samples'
    sample_path = samples_dir / f'{sample_id}.json'
    if not sample_path.exists():
        return jsonify({'error': 'Échantillon introuvable'}), 404
    return jsonify(json.loads(sample_path.read_text(encoding='utf-8')))


@app.route('/api/repertoire')
def api_repertoire():
    """Retourne le répertoire des fonctions narratives (53 fonctions, 7 familles)."""
    from narria.repertoire.functions import FUNCTION_REPERTOIRE
    return jsonify(FUNCTION_REPERTOIRE)


@app.route('/api/status')
def api_status():
    """État de la session."""
    _, mode = get_active_extractor()
    return jsonify({
        'mode': mode,
        'llm_configured': narria_config.is_configured(),
        'llm_available': ANTHROPIC_AVAILABLE,
        'llm_model': DEFAULT_MODEL if mode == 'llm' else None,
        'n_graphs': len(SESSION['graphs']),
        'n_analyses': len(SESSION['analyses']),
        'graphs': [
            {
                'id': gid,
                'title': g.metadata.get('title', 'Sans titre'),
                'author': g.metadata.get('author', 'Inconnu'),
                'n_nodes': len(g.nodes),
            }
            for gid, g in SESSION['graphs'].items()
        ],
    })


# ═══════════════════════════════════════════════════════════════════
#  ROUTES DE CONFIGURATION (LLM / API KEY)
# ═══════════════════════════════════════════════════════════════════

@app.route('/api/config/status')
def api_config_status():
    """Retourne l'état de la configuration LLM."""
    is_configured = narria_config.is_configured()
    return jsonify({
        'llm_configured': is_configured,
        'llm_available': ANTHROPIC_AVAILABLE,
        'model': DEFAULT_MODEL,
        'price_input_per_mtok_usd': PRICE_INPUT_PER_MTOK,
        'price_output_per_mtok_usd': PRICE_OUTPUT_PER_MTOK,
        'key_masked': _mask_key(narria_config.get_api_key()) if is_configured else None,
        'mode': 'llm' if is_configured and ANTHROPIC_AVAILABLE else 'local',
    })


def _mask_key(api_key):
    """Masque une clé API pour affichage : sk-ant-xxxx...xxxx"""
    if not api_key or len(api_key) < 15:
        return '***'
    return f"{api_key[:10]}…{api_key[-4:]}"


@app.route('/api/config/set-key', methods=['POST'])
def api_config_set_key():
    """Enregistre une clé API Anthropic."""
    data = request.get_json()
    if not data or 'api_key' not in data:
        return jsonify({'error': 'Aucune clé fournie'}), 400
    
    api_key = data['api_key'].strip()
    
    # Validation basique
    if not api_key.startswith('sk-ant-'):
        return jsonify({'error': 'Clé invalide : doit commencer par "sk-ant-"'}), 400
    if len(api_key) < 40:
        return jsonify({'error': 'Clé invalide : trop courte'}), 400
    
    # Save without testing (test is a separate endpoint)
    narria_config.set_api_key(api_key)
    
    return jsonify({
        'success': True,
        'message': 'Clé enregistrée. Vous pouvez maintenant tester la connexion.',
        'key_masked': _mask_key(api_key),
    })


@app.route('/api/config/remove-key', methods=['POST'])
def api_config_remove_key():
    """Supprime la clé API (retour en mode local)."""
    narria_config.remove_api_key()
    return jsonify({
        'success': True,
        'message': 'Clé supprimée. L\'application fonctionnera en mode local.',
    })


@app.route('/api/config/test-connection', methods=['POST'])
def api_config_test_connection():
    """Teste la connexion à l'API Anthropic avec la clé configurée."""
    if not ANTHROPIC_AVAILABLE:
        return jsonify({
            'success': False,
            'message': 'Le SDK anthropic n\'est pas installé. Exécutez : pip install anthropic',
        }), 500
    
    api_key = narria_config.get_api_key()
    if not api_key:
        return jsonify({
            'success': False,
            'message': 'Aucune clé API configurée.',
        }), 400
    
    try:
        client = ClaudeClient(api_key=api_key)
        result = client.test_connection()
        return jsonify(result)
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Erreur : {str(e)}',
        }), 500


@app.route('/api/estimate-cost', methods=['POST'])
def api_estimate_cost():
    """
    Estime le coût d'une analyse avant son exécution.
    
    Si le texte dépasse la fenêtre de contexte de Claude, indique également
    le découpage qui sera appliqué (nombre de blocs, coût multiplié).
    """
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({'error': 'Aucun texte fourni'}), 400
    
    text = data['text']
    
    if not narria_config.is_configured() or not ANTHROPIC_AVAILABLE:
        return jsonify({
            'mode': 'local',
            'estimated_cost_usd': 0.0,
            'estimated_cost_eur': 0.0,
            'will_be_chunked': False,
            'message': 'Mode local : aucun coût',
        })
    
    try:
        from narria.llm.chunker import (
            estimate_tokens, needs_chunking, chunk_text,
            CHUNK_THRESHOLD, TARGET_CHUNK_TOKENS,
        )
        
        api_key = narria_config.get_api_key()
        client = ClaudeClient(api_key=api_key)
        
        will_chunk = needs_chunking(text)
        total_tokens = estimate_tokens(text)
        
        if not will_chunk:
            estimate = client.estimate_cost(text)
            estimate['mode'] = 'llm'
            estimate['will_be_chunked'] = False
            estimate['total_text_tokens'] = total_tokens
            return jsonify(estimate)
        
        # Texte long : découpage prévu
        chunks = chunk_text(text)
        n_chunks = len(chunks)
        
        # Estimer le coût total = somme des coûts par bloc
        total_input = 0
        total_output = 0
        for chunk in chunks:
            chunk_estimate = client.estimate_cost(chunk.text)
            total_input += chunk_estimate.get('estimated_input_tokens', 0)
            total_output += chunk_estimate.get('estimated_output_tokens', 0)
        
        from narria.llm.claude_client import PRICE_INPUT_PER_MTOK, PRICE_OUTPUT_PER_MTOK, DEFAULT_MODEL
        total_cost = (total_input * PRICE_INPUT_PER_MTOK
                      + total_output * PRICE_OUTPUT_PER_MTOK) / 1_000_000
        
        return jsonify({
            'mode': 'llm',
            'will_be_chunked': True,
            'n_chunks': n_chunks,
            'total_text_tokens': total_tokens,
            'estimated_input_tokens': total_input,
            'estimated_output_tokens': total_output,
            'estimated_cost_usd': round(total_cost, 4),
            'estimated_cost_eur': round(total_cost * 0.93, 4),
            'model': DEFAULT_MODEL,
            'chunks_info': [
                {
                    'index': c.index + 1,
                    'tokens': c.estimated_tokens,
                    'words': len(c.text.split()),
                    'has_overlap_before': c.has_overlap_before,
                }
                for c in chunks
            ],
            'chunk_threshold': CHUNK_THRESHOLD,
            'message': (
                f"Le texte dépasse la fenêtre de contexte de Claude "
                f"({total_tokens:,} tokens > {CHUNK_THRESHOLD:,}). "
                f"Il sera analysé en {n_chunks} blocs avec recouvrement narratif "
                f"puis fusionné en un graphe global."
            ),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ═══════════════════════════════════════════════════════════════════
#  ROUTES D'HISTORIQUE
# ═══════════════════════════════════════════════════════════════════

@app.route('/api/history/list')
def api_history_list():
    """Liste l'historique complet des analyses et comparaisons."""
    limit = request.args.get('limit', type=int)
    return jsonify({
        'analyses': history.list_analyses(limit=limit),
        'comparisons': history.list_comparisons(limit=limit),
        'stats': history.get_stats(),
    })


@app.route('/api/history/analysis/<analysis_id>')
def api_history_get_analysis(analysis_id):
    """Récupère une analyse archivée par son ID."""
    analysis = history.get_analysis(analysis_id)
    if not analysis:
        return jsonify({'error': 'Analyse introuvable'}), 404
    return jsonify(analysis)


@app.route('/api/history/comparison/<comparison_id>')
def api_history_get_comparison(comparison_id):
    """Récupère une comparaison archivée par son ID."""
    comp = history.get_comparison(comparison_id)
    if not comp:
        return jsonify({'error': 'Comparaison introuvable'}), 404
    return jsonify(comp)


@app.route('/api/history/analysis/<analysis_id>', methods=['DELETE'])
def api_history_delete_analysis(analysis_id):
    """Supprime une analyse de l'historique."""
    success = history.delete_analysis(analysis_id)
    if not success:
        return jsonify({'error': 'Analyse introuvable'}), 404
    return jsonify({'success': True, 'message': 'Analyse supprimée'})


@app.route('/api/history/comparison/<comparison_id>', methods=['DELETE'])
def api_history_delete_comparison(comparison_id):
    """Supprime une comparaison de l'historique."""
    success = history.delete_comparison(comparison_id)
    if not success:
        return jsonify({'error': 'Comparaison introuvable'}), 404
    return jsonify({'success': True, 'message': 'Comparaison supprimée'})


@app.route('/api/history/clear', methods=['POST'])
def api_history_clear():
    """Efface tout l'historique. Demande la confirmation explicite côté UI."""
    counters = history.clear_all()
    return jsonify({
        'success': True,
        'message': 'Historique effacé',
        'deleted': counters,
    })


# ═══════════════════════════════════════════════════════════════════
#  ROUTES DE TÉLÉCHARGEMENT
# ═══════════════════════════════════════════════════════════════════

@app.route('/api/diagnose-pdf/<analysis_id>')
def api_diagnose_pdf(analysis_id):
    """
    Route de diagnostic : tente la génération PDF en mode verbeux et
    retourne un rapport détaillé sur ce qui se passe à chaque étape.
    
    Affiche directement dans le navigateur (pas un téléchargement).
    Utile pour identifier la cause exacte d'un échec PDF sur une analyse
    précise.
    """
    import time
    import traceback
    
    analysis = history.get_analysis(analysis_id)
    if not analysis:
        return jsonify({'error': 'Analyse introuvable'}), 404
    
    report_lines = []
    report_lines.append(f"=== DIAGNOSTIC PDF — Analyse {analysis_id} ===\n")
    report_lines.append(f"Titre : {analysis.get('title', '?')}")
    report_lines.append(f"Mode : {analysis.get('mode', '?')}")
    report_lines.append(f"Date : {analysis.get('date_human', '?')}")
    
    graph = analysis.get('graph', {})
    nodes = graph.get('nodes', [])
    report_lines.append(f"Nombre de nœuds : {len(nodes)}")
    
    # Caractéristiques du contenu
    main_actants = analysis.get('main_actants') or graph.get('metadata', {}).get('main_actants', {}) or {}
    report_lines.append(f"Actants définis : {len([v for v in main_actants.values() if v])}/6")
    
    # Vérifier la présence de caractères suspects
    full_text_sample = ''
    full_text_sample += str(analysis.get('summary', ''))
    full_text_sample += str(analysis.get('genre', ''))
    for n in nodes:
        full_text_sample += str(n.get('text_excerpt', ''))
        for a in (n.get('actants') or []):
            full_text_sample += str(a)
    
    # Compter les caractères Unicode hors BMP (emojis, supplementary plane)
    high_unicode = sum(1 for c in full_text_sample if ord(c) > 0xFFFF)
    control_chars = sum(1 for c in full_text_sample if ord(c) < 32 and c not in '\n\t\r')
    
    report_lines.append(f"Caractères hors-BMP (emojis, etc.) : {high_unicode}")
    report_lines.append(f"Caractères de contrôle suspects : {control_chars}")
    
    if high_unicode > 0:
        # Lister les premiers
        seen = set()
        suspects = []
        for c in full_text_sample:
            if ord(c) > 0xFFFF and c not in seen:
                seen.add(c)
                suspects.append(f"  U+{ord(c):04X} '{c}'")
                if len(suspects) >= 5:
                    break
        report_lines.append("Exemples de caractères hors-BMP détectés :")
        report_lines.extend(suspects)
    
    report_lines.append("")
    
    # Tester chaque étape de la génération
    for attempt_name, render_fn, kwargs in [
        ("Essai 1 : HTML complet avec SVG", _render_analysis_html, {'include_svg': True}),
        ("Essai 2 : HTML sans SVG", _render_analysis_html, {'include_svg': False}),
        ("Essai 3 : HTML minimal", _render_analysis_html_minimal, {}),
    ]:
        report_lines.append(f"--- {attempt_name} ---")
        try:
            t0 = time.time()
            if 'include_svg' in kwargs:
                html = render_fn(analysis, **kwargs)
            else:
                html = render_fn(analysis)
            report_lines.append(f"  HTML rendu en {time.time()-t0:.2f}s ({len(html)} octets)")
            
            t0 = time.time()
            pdf = _html_to_pdf(html, timeout_seconds=30, fallback_on_failure=False)
            elapsed = time.time() - t0
            
            if pdf:
                report_lines.append(f"  ✓ PDF généré en {elapsed:.2f}s ({len(pdf)} octets)")
                break  # Inutile de continuer, on a réussi
            else:
                report_lines.append(f"  ✗ Échec après {elapsed:.2f}s (None retourné)")
        except Exception as e:
            report_lines.append(f"  ✗ Exception : {e}")
            report_lines.append(traceback.format_exc())
        
        report_lines.append("")
    
    diagnostic = '\n'.join(report_lines)
    
    return f'''<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Diagnostic PDF</title>
<style>body{{font-family:monospace;padding:2rem;max-width:900px;margin:auto;background:#f8f8f8;}}
pre{{white-space:pre-wrap;background:white;padding:1rem;border:1px solid #ccc;border-radius:4px;}}
h1{{color:#1F4E79;}}.note{{background:#FFF3E0;padding:1rem;border-left:4px solid #C55A11;margin-bottom:1rem;}}</style>
</head><body>
<h1>Diagnostic de génération PDF</h1>
<div class="note">
<b>Que faire de ce rapport ?</b><br>
Si l'un des essais s'est terminé par "✓ PDF généré", la génération PDF est <em>possible</em>
pour cette analyse. Si tous échouent ou prennent un temps anormalement long,
copiez ce rapport et partagez-le-moi pour analyse approfondie.
</div>
<pre>{_h(diagnostic)}</pre>
</body></html>
''', 200, {'Content-Type': 'text/html; charset=utf-8'}


@app.route('/api/download/analysis/<analysis_id>/<format>')
def api_download_analysis(analysis_id, format):
    """
    Télécharge une analyse au format demandé.
    
    Formats supportés :
      - json : graphe complet et métadonnées
      - txt  : résumé textuel lisible
      - html : rapport HTML autonome
      - md   : version Markdown du rapport
    """
    analysis = history.get_analysis(analysis_id)
    if not analysis:
        return jsonify({'error': 'Analyse introuvable'}), 404
    
    title = analysis.get('title', 'analyse').replace(' ', '_')
    safe_title = re.sub(r'[^\w\-_]', '', title)[:40] or 'analyse'
    
    if format == 'json':
        content = json.dumps(analysis, ensure_ascii=False, indent=2)
        filename = f"{safe_title}_{analysis_id}.json"
        mimetype = 'application/json; charset=utf-8'
    
    elif format == 'txt':
        content = _render_analysis_text(analysis)
        filename = f"{safe_title}_{analysis_id}.txt"
        mimetype = 'text/plain; charset=utf-8'
    
    elif format == 'md':
        content = _render_analysis_markdown(analysis)
        filename = f"{safe_title}_{analysis_id}.md"
        mimetype = 'text/markdown; charset=utf-8'
    
    elif format == 'html':
        content = _render_analysis_html(analysis)
        filename = f"{safe_title}_{analysis_id}.html"
        mimetype = 'text/html; charset=utf-8'
    
    elif format == 'pdf':
        # Generate PDF with multiple fallback strategies
        print(f"[NARR'IA] Demande PDF pour analyse {analysis_id}")
        
        # Premier essai : HTML complet avec schéma actantiel SVG
        html_content = _render_analysis_html(analysis, include_svg=True)
        print(f"[NARR'IA] Essai 1 (avec SVG, {len(html_content)} octets)")
        pdf_bytes = _html_to_pdf(html_content, timeout_seconds=30,
                                  fallback_on_failure=False)
        
        if pdf_bytes is None:
            # Deuxième essai : HTML simplifié sans SVG
            print(f"[NARR'IA] Essai 1 échoué, retry sans SVG...")
            html_content = _render_analysis_html(analysis, include_svg=False)
            print(f"[NARR'IA] Essai 2 (sans SVG, {len(html_content)} octets)")
            pdf_bytes = _html_to_pdf(html_content, timeout_seconds=30,
                                      fallback_on_failure=False)
        
        if pdf_bytes is None:
            # Troisième essai : HTML ultra-minimal (texte plat sans style avancé)
            print(f"[NARR'IA] Essai 2 échoué, retry en mode minimal...")
            html_content = _render_analysis_html_minimal(analysis)
            print(f"[NARR'IA] Essai 3 (minimal, {len(html_content)} octets)")
            pdf_bytes = _html_to_pdf(html_content, timeout_seconds=30,
                                      fallback_on_failure=False)
        
        if pdf_bytes is None:
            # Tous les essais ont échoué - sauvegarder le HTML pour diagnostic
            try:
                debug_dir = Path.home() / '.narria' / 'pdf_debug'
                debug_dir.mkdir(parents=True, exist_ok=True)
                debug_path = debug_dir / f'pdf_failed_{analysis_id}.html'
                debug_path.write_text(html_content, encoding='utf-8')
                print(f"[NARR'IA] HTML problématique sauvegardé : {debug_path}")
            except Exception as e:
                print(f"[NARR'IA] Impossible de sauvegarder le HTML diagnostic : {e}")
            
            return jsonify({
                'error': "Échec de la génération PDF malgré 3 tentatives. "
                         "Un fichier diagnostic a été sauvegardé dans ~/.narria/pdf_debug/. "
                         "Utilisez le bouton HTML pour télécharger le rapport en HTML."
            }), 500
        
        filename = f"{safe_title}_{analysis_id}.pdf"
        response = app.response_class(
            response=pdf_bytes,
            status=200,
            mimetype='application/pdf',
        )
        response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
    
    else:
        return jsonify({'error': f'Format non supporté : {format}. Utilisez json, txt, md, html ou pdf.'}), 400
    
    response = app.response_class(
        response=content.encode('utf-8'),
        status=200,
        mimetype=mimetype,
    )
    response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


@app.route('/api/download/comparison/<comparison_id>/<format>')
def api_download_comparison(comparison_id, format):
    """Télécharge une comparaison au format demandé (json, html, md)."""
    comp = history.get_comparison(comparison_id)
    if not comp:
        return jsonify({'error': 'Comparaison introuvable'}), 404
    
    safe_name = f"comparaison_{comparison_id}"
    
    if format == 'json':
        content = json.dumps(comp, ensure_ascii=False, indent=2)
        filename = f"{safe_name}.json"
        mimetype = 'application/json; charset=utf-8'
    
    elif format == 'html':
        # Reuse the existing reporter for full HTML
        ref_graph_dict = history.get_graph_dict(comp['ref_graph_id'])
        cand_graph_dict = history.get_graph_dict(comp['cand_graph_id'])
        if ref_graph_dict and cand_graph_dict:
            from narria.core.models import NarrativeGraph, NarrativeNode, NarrativeEdge, ComparisonResult
            
            def to_graph(d):
                nodes = [NarrativeNode(**n) for n in d.get('nodes', [])]
                edges = [NarrativeEdge(**e) for e in d.get('edges', [])]
                return NarrativeGraph(graph_id=d['graph_id'],
                                      metadata=d.get('metadata', {}),
                                      nodes=nodes, edges=edges)
            
            ref_g = to_graph(ref_graph_dict)
            cand_g = to_graph(cand_graph_dict)
            
            # Reconstruct ComparisonResult
            full = comp.get('full_result', {})
            details = full.get('details', {})
            cr = ComparisonResult(
                sns=full.get('sns', 0),
                sns_normalized=full.get('sns_n', full.get('sns', 0)),
                ss=full.get('ss', 0),
                st=full.get('st', 0),
                srj=full.get('srj', 0),
                srj_level=full.get('srj_level', ''),
                detected_modality=full.get('modality', ''),
                verdict=full.get('verdict', ''),
                s_iso=details.get('s_iso', 0),
                s_ged=details.get('s_ged', 0),
                s_func=details.get('s_func', 0),
                s_act=details.get('s_act', 0),
                s_tens=details.get('s_tens', 0),
                correspondences=full.get('correspondences', []),
                warnings=full.get('warnings', []),
            )
            content = reporter.generate_html(cr, ref_g, cand_g)
        else:
            content = _render_comparison_simple_html(comp)
        filename = f"{safe_name}.html"
        mimetype = 'text/html; charset=utf-8'
    
    elif format == 'md':
        content = _render_comparison_markdown(comp)
        filename = f"{safe_name}.md"
        mimetype = 'text/markdown; charset=utf-8'
    
    elif format == 'pdf':
        # Reuse the HTML generation, then convert to PDF
        ref_graph_dict = history.get_graph_dict(comp['ref_graph_id'])
        cand_graph_dict = history.get_graph_dict(comp['cand_graph_id'])
        if ref_graph_dict and cand_graph_dict:
            from narria.core.models import (
                NarrativeGraph, NarrativeNode, NarrativeEdge, ComparisonResult
            )
            
            def to_graph(d):
                nodes = [NarrativeNode(**n) for n in d.get('nodes', [])]
                edges = [NarrativeEdge(**e) for e in d.get('edges', [])]
                return NarrativeGraph(graph_id=d['graph_id'],
                                      metadata=d.get('metadata', {}),
                                      nodes=nodes, edges=edges)
            
            ref_g = to_graph(ref_graph_dict)
            cand_g = to_graph(cand_graph_dict)
            full = comp.get('full_result', {})
            details = full.get('details', {})
            cr = ComparisonResult(
                sns=full.get('sns', 0),
                sns_normalized=full.get('sns_n', full.get('sns', 0)),
                ss=full.get('ss', 0),
                st=full.get('st', 0),
                srj=full.get('srj', 0),
                srj_level=full.get('srj_level', ''),
                detected_modality=full.get('modality', ''),
                verdict=full.get('verdict', ''),
                s_iso=details.get('s_iso', 0),
                s_ged=details.get('s_ged', 0),
                s_func=details.get('s_func', 0),
                s_act=details.get('s_act', 0),
                s_tens=details.get('s_tens', 0),
                correspondences=full.get('correspondences', []),
                warnings=full.get('warnings', []),
            )
            html_content = reporter.generate_html(cr, ref_g, cand_g)
        else:
            html_content = _render_comparison_simple_html(comp)
        
        pdf_bytes = _html_to_pdf(html_content)
        if pdf_bytes is None:
            return jsonify({
                'error': "Échec de la génération PDF."
            }), 500
        
        filename = f"{safe_name}.pdf"
        response = app.response_class(
            response=pdf_bytes,
            status=200,
            mimetype='application/pdf',
        )
        response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
    
    else:
        return jsonify({'error': f'Format non supporté : {format}'}), 400
    
    response = app.response_class(
        response=content.encode('utf-8'),
        status=200,
        mimetype=mimetype,
    )
    response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


# ─── Rendering helpers ───

def _sanitize_html_for_pdf(html: str) -> str:
    """
    Nettoie le HTML pour éviter les caractères problématiques pour xhtml2pdf.
    
    xhtml2pdf peut bloquer ou mal rendre certains caractères Unicode rares
    (emojis, certaines ponctuations exotiques, caractères de contrôle...).
    On les remplace par des équivalents sûrs ou on les retire.
    """
    if not html:
        return html
    
    # Remplacer les caractères de contrôle (sauf espaces et retours ligne)
    import re
    html = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', html)
    
    # Remplacer les caractères de mise en forme typographique posant problème
    replacements = {
        '\u2028': ' ',   # Line Separator
        '\u2029': ' ',   # Paragraph Separator
        '\u200B': '',    # Zero-width space
        '\u200C': '',    # Zero-width non-joiner
        '\u200D': '',    # Zero-width joiner
        '\u2060': '',    # Word joiner
        '\uFEFF': '',    # BOM
    }
    for old, new in replacements.items():
        html = html.replace(old, new)
    
    # Remplacer les emojis et autres caracteres hors BMP courants par leur description
    # (xhtml2pdf ne supporte pas les caractères supplementaires sans police TTF)
    # On garde les caractères français courants (à, é, ç, etc.) qui sont en BMP
    def _safe_char(match):
        c = match.group(0)
        cp = ord(c)
        # Caractères supplementaires (au-dela du BMP) → retirer
        if cp > 0xFFFF:
            return ''
        return c
    
    html = re.sub(r'.', _safe_char, html)
    return html


def _html_to_pdf(html_content: str, timeout_seconds: int = 60,
                  fallback_on_failure: bool = True) -> bytes:
    """
    Convertit du HTML en PDF via xhtml2pdf, avec protection timeout.
    
    Args:
        html_content: HTML autonome à convertir
        timeout_seconds: durée maximum avant abandon (défaut 60s)
        fallback_on_failure: si True et la conversion échoue, retenter avec
                             une version simplifiée du HTML
    
    Returns:
        Les bytes du PDF, ou None en cas d'erreur ou de timeout.
    """
    import threading
    import time
    
    result_holder = {'pdf': None, 'error': None, 'done': False}
    
    def _do_conversion(html, holder):
        try:
            from xhtml2pdf import pisa
            from io import BytesIO
            
            # Sanitization avant conversion : remplacer les caracteres
            # qui peuvent faire planter xhtml2pdf
            html = _sanitize_html_for_pdf(html)
            
            pdf_html = _adapt_html_for_pdf(html)
            output = BytesIO()
            
            t0 = time.time()
            print(f"[NARR'IA] Début conversion PDF (HTML : {len(pdf_html)} octets)")
            
            pisa_result = pisa.CreatePDF(
                src=pdf_html,
                dest=output,
                encoding='UTF-8',
            )
            
            elapsed = time.time() - t0
            print(f"[NARR'IA] Conversion PDF terminée en {elapsed:.1f}s")
            
            if pisa_result.err:
                holder['error'] = f"xhtml2pdf a signalé {pisa_result.err} erreurs"
                print(f"[NARR'IA] {holder['error']}")
            else:
                holder['pdf'] = output.getvalue()
        except Exception as e:
            import traceback
            holder['error'] = str(e)
            print(f"[NARR'IA] Exception PDF : {e}")
            print(traceback.format_exc())
        finally:
            holder['done'] = True
    
    # Lancer la conversion dans un thread pour pouvoir l'interrompre
    thread = threading.Thread(target=_do_conversion, args=(html_content, result_holder), daemon=True)
    thread.start()
    thread.join(timeout=timeout_seconds)
    
    if not result_holder['done']:
        # Timeout : le thread continue de tourner en arrière-plan mais on l'abandonne
        print(f"[NARR'IA] TIMEOUT après {timeout_seconds}s — abandon de la conversion")
        result_holder['error'] = f"Timeout : la conversion PDF a dépassé {timeout_seconds}s"
    
    if result_holder['pdf']:
        return result_holder['pdf']
    
    # Si on a une erreur ou un timeout, et qu'on a le droit de fallback, retenter avec HTML simplifié
    if fallback_on_failure:
        print(f"[NARR'IA] Échec premier essai ({result_holder['error']}). Tentative en mode dégradé…")
        simplified = _simplify_html_for_pdf(html_content)
        # Récursion sans fallback pour éviter la boucle infinie
        return _html_to_pdf(simplified, timeout_seconds=timeout_seconds,
                             fallback_on_failure=False)
    
    return None


def _simplify_html_for_pdf(html: str) -> str:
    """
    Version dégradée du HTML : retire SVG, sections complexes, styles avancés.
    Utilisé en fallback si la version riche fait échouer xhtml2pdf.
    """
    import re
    # Retirer les balises SVG complètement
    html = re.sub(r'<svg.*?</svg>', '<p><em>[Schéma actantiel non disponible en version PDF dégradée]</em></p>',
                   html, flags=re.DOTALL | re.IGNORECASE)
    # Retirer les commentaires HTML
    html = re.sub(r'<!--.*?-->', '', html, flags=re.DOTALL)
    return html


def _adapt_html_for_pdf(html: str) -> str:
    """
    Adapte un HTML pour le rendu PDF via xhtml2pdf.
    
    xhtml2pdf supporte un sous-ensemble de CSS — on remplace donc certaines
    propriétés modernes par des équivalents qu'il sait rendre.
    """
    # Si le HTML est déjà autonome, on le retourne avec une feuille de style
    # ciblée pour PDF appendée. Sinon, on construit un document complet.
    if '<html' not in html.lower():
        html = f"<html><body>{html}</body></html>"
    
    # Feuille de style supplémentaire optimisée pour le PDF (xhtml2pdf)
    pdf_style = """
    <style>
        @page {
            size: A4;
            margin: 2cm 2cm 2.5cm 2cm;
            @frame footer {
                -pdf-frame-content: footerContent;
                bottom: 1cm;
                margin-left: 2cm;
                margin-right: 2cm;
                height: 0.8cm;
            }
        }
        body {
            font-family: 'Helvetica';
            font-size: 11pt;
            line-height: 1.5;
            color: #1a1a1a;
        }
        h1 {
            font-size: 22pt;
            color: #1F4E79;
            border-bottom: 2pt solid #C55A11;
            padding-bottom: 4pt;
        }
        h2 {
            font-size: 16pt;
            color: #1F4E79;
            border-bottom: 1pt solid #C55A11;
            padding-bottom: 3pt;
            margin-top: 20pt;
        }
        h3 {
            font-size: 13pt;
            color: #C55A11;
            margin-top: 14pt;
        }
        .meta {
            background-color: #F5F5F5;
            padding: 8pt;
            border-left: 3pt solid #1F4E79;
        }
        .node {
            background-color: #FAFAFA;
            padding: 8pt;
            margin: 6pt 0;
            border-left: 2pt solid #C55A11;
        }
        blockquote {
            border-left: 2pt solid #C55A11;
            padding-left: 8pt;
            color: #555;
            font-style: italic;
            margin: 4pt 0;
        }
        code {
            background-color: #EEE;
            padding: 1pt 3pt;
            font-family: 'Courier';
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 6pt 0;
        }
        th, td {
            padding: 4pt 6pt;
            border: 0.5pt solid #DDD;
            text-align: left;
            vertical-align: top;
        }
        th {
            background-color: #F5F5F5;
            font-weight: bold;
        }
        footer, .footer {
            font-size: 8pt;
            color: #777;
            text-align: center;
            margin-top: 20pt;
            border-top: 0.5pt solid #DDD;
            padding-top: 4pt;
        }
        .actant-diagram {
            margin: 14pt 0;
            text-align: center;
        }
    </style>
    """
    
    # Insertion de la feuille de style juste avant </head> ou au début du <body>
    if '</head>' in html.lower():
        idx = html.lower().rfind('</head>')
        html = html[:idx] + pdf_style + html[idx:]
    elif '<body' in html.lower():
        idx = html.lower().find('<body')
        # Find end of <body ...> opening tag
        end_idx = html.find('>', idx)
        if end_idx > 0:
            html = html[:end_idx + 1] + pdf_style + html[end_idx + 1:]
    else:
        html = pdf_style + html
    
    # Add a footer frame content if not present
    if 'footerContent' not in html:
        footer_html = (
            '<div id="footerContent" style="font-size:8pt; color:#777; text-align:center;">'
            'NARR\'IA — Système de narratologie computationnelle · '
            'Adéchinan David Adékambi · Université de Kindia'
            '</div>'
        )
        # Place at end of body
        if '</body>' in html.lower():
            idx = html.lower().rfind('</body>')
            html = html[:idx] + footer_html + html[idx:]
    
    return html


def _render_analysis_text(analysis: dict) -> str:
    """Rendu texte brut d'une analyse."""
    lines = []
    lines.append("═" * 70)
    lines.append(f"ANALYSE NARR'IA — {analysis.get('title', '?')}")
    lines.append(f"Auteur : {analysis.get('author', '?')}")
    lines.append(f"Date : {analysis.get('date_human', '?')}")
    lines.append(f"Mode : {analysis.get('mode', '?')}")
    lines.append("═" * 70)
    lines.append("")
    
    if analysis.get('summary'):
        lines.append("RÉSUMÉ")
        lines.append("-" * 70)
        lines.append(analysis['summary'])
        lines.append("")
    
    if analysis.get('genre'):
        lines.append(f"Genre identifié : {analysis['genre']}")
    if analysis.get('tradition'):
        lines.append(f"Tradition narrative : {analysis['tradition']}")
    
    graph = analysis.get('graph', {})
    nodes = graph.get('nodes', [])
    
    lines.append("")
    lines.append(f"GRAPHE NARRATIF — {len(nodes)} nœuds")
    lines.append("-" * 70)
    
    for i, n in enumerate(nodes, 1):
        lines.append(f"\nNœud {i} ({n.get('node_id', '?')})")
        if n.get('function_code'):
            lines.append(f"  Fonction : {n['function_code']} — {n.get('function_name', '')}")
        if n.get('function_family'):
            lines.append(f"  Famille : {n['function_family']}")
        if n.get('actants'):
            lines.append(f"  Actants : {', '.join(n['actants'])}")
        mods = n.get('modalities', {})
        if mods:
            mod_str = ", ".join(f"{k}={v:.2f}" for k, v in mods.items())
            lines.append(f"  Modalités : {mod_str}")
        if n.get('tension') is not None:
            lines.append(f"  Tension : {n['tension']:.2f}  |  Phase : {n.get('phase', '?')}")
        if n.get('text_excerpt'):
            lines.append(f"  Citation : « {n['text_excerpt'][:200]} »")
    
    if analysis.get('cost_usd') is not None:
        lines.append("")
        lines.append("─" * 70)
        lines.append(f"Coût d'analyse : {analysis['cost_usd']:.4f} USD")
        if analysis.get('tokens_total'):
            lines.append(f"Tokens utilisés : {analysis['tokens_total']:,}")
    
    lines.append("")
    lines.append("─" * 70)
    lines.append("Généré par NARR'IA — Système de narratologie computationnelle")
    lines.append("Adéchinan David Adékambi · Université de Kindia, Guinée")
    return '\n'.join(lines)


def _render_analysis_markdown(analysis: dict) -> str:
    """Rendu Markdown d'une analyse."""
    md = []
    md.append(f"# Analyse NARR'IA — {analysis.get('title', '?')}")
    md.append("")
    md.append(f"**Auteur :** {analysis.get('author', '?')}  ")
    md.append(f"**Date d'analyse :** {analysis.get('date_human', '?')}  ")
    md.append(f"**Mode :** {analysis.get('mode', '?')}")
    md.append("")
    
    if analysis.get('summary'):
        md.append("## Résumé")
        md.append("")
        md.append(analysis['summary'])
        md.append("")
    
    if analysis.get('genre') or analysis.get('tradition'):
        md.append("## Caractérisation")
        md.append("")
        if analysis.get('genre'):
            md.append(f"- **Genre :** {analysis['genre']}")
        if analysis.get('tradition'):
            md.append(f"- **Tradition narrative :** {analysis['tradition']}")
        md.append("")
    
    graph = analysis.get('graph', {})
    main_actants = (graph.get('metadata') or {}).get('main_actants', {})
    if main_actants:
        md.append("## Schéma actantiel")
        md.append("")
        for k, v in main_actants.items():
            if v:
                md.append(f"- **{k.capitalize()} :** {v}")
        md.append("")
    
    nodes = graph.get('nodes', [])
    md.append(f"## Graphe narratif ({len(nodes)} nœuds)")
    md.append("")
    
    for i, n in enumerate(nodes, 1):
        title = n.get('function_name') or n.get('function_code') or f"Nœud {i}"
        md.append(f"### Nœud {i} — {title}")
        if n.get('function_code'):
            md.append(f"- **Code :** `{n['function_code']}`")
        if n.get('function_family'):
            md.append(f"- **Famille :** {n['function_family']}")
        if n.get('actants'):
            md.append(f"- **Actants :** {', '.join(n['actants'])}")
        mods = n.get('modalities', {})
        if mods:
            mod_str = " · ".join(f"{k}={v:.2f}" for k, v in mods.items())
            md.append(f"- **Modalités :** {mod_str}")
        if n.get('tension') is not None:
            md.append(f"- **Tension :** {n['tension']:.2f} · **Phase :** {n.get('phase', '?')}")
        if n.get('text_excerpt'):
            md.append(f"- **Citation :** > {n['text_excerpt'][:300]}")
        md.append("")
    
    if analysis.get('cost_usd') is not None:
        md.append("---")
        md.append("")
        md.append(f"_Coût d'analyse : {analysis['cost_usd']:.4f} USD · {analysis.get('tokens_total', 0):,} tokens_")
        md.append("")
    
    md.append("---")
    md.append("")
    md.append("_Généré par NARR'IA — Système de narratologie computationnelle · Adéchinan David Adékambi, Université de Kindia, Guinée_")
    return '\n'.join(md)


def _render_analysis_html(analysis: dict, include_svg: bool = True) -> str:
    """
    Rendu HTML autonome d'une analyse, riche pour l'export PDF.
    
    Args:
        analysis: dictionnaire d'analyse complet
        include_svg: si True, inclut le schéma actantiel SVG
                     (peut être désactivé pour le PDF si problème de rendu)
    """
    title = analysis.get('title', '?')
    author = analysis.get('author', '?')
    
    nodes_html = []
    graph = analysis.get('graph', {})
    nodes = graph.get('nodes', [])
    meta = graph.get('metadata', {}) or {}
    
    # ─── Section LLM (résumé, genre, tradition, schéma actantiel) ───
    llm_section = ''
    if analysis.get('mode') == 'llm' or meta.get('mode') == 'llm':
        summary = analysis.get('summary') or meta.get('summary', '')
        genre = analysis.get('genre') or meta.get('genre', '')
        tradition = analysis.get('tradition') or meta.get('tradition', '')
        main_actants = analysis.get('main_actants') or meta.get('main_actants', {}) or {}
        keywords = analysis.get('thematic_keywords') or meta.get('thematic_keywords', []) or []
        
        if summary or genre or main_actants:
            llm_section = '<section class="llm-block">'
            llm_section += '<h2>Synthèse de l\'analyse</h2>'
            if summary:
                llm_section += f'<p><strong>Résumé :</strong> {_h(summary)}</p>'
            if genre:
                llm_section += f'<p><strong>Genre :</strong> {_h(genre)}</p>'
            if tradition:
                llm_section += f'<p><strong>Tradition narrative :</strong> {_h(tradition)}</p>'
            if keywords:
                llm_section += f'<p><strong>Thématiques :</strong> {_h(", ".join(keywords))}</p>'
            
            # Tableau actantiel
            if main_actants:
                llm_section += '<h3>Schéma actantiel identifié</h3>'
                llm_section += '<table class="actant-table">'
                labels = {
                    'protagoniste': 'Sujet (protagoniste)',
                    'objet': 'Objet de la quête',
                    'destinateur': 'Destinateur',
                    'destinataire': 'Destinataire',
                    'adjuvant': 'Adjuvant',
                    'opposant': 'Opposant',
                }
                for key, label in labels.items():
                    val = main_actants.get(key, '')
                    if val:
                        llm_section += f'<tr><td><strong>{label}</strong></td><td>{_h(val)}</td></tr>'
                llm_section += '</table>'
                
                # SVG schéma greimassien (conditionnel)
                if include_svg:
                    llm_section += _render_actantial_svg(main_actants)
            llm_section += '</section>'
    
    # ─── Nœuds narratifs ───
    for i, n in enumerate(nodes, 1):
        node_html = f'<div class="node"><h3>Nœud {i} — {_h(n.get("function_name") or n.get("function_code") or "?")}</h3>'
        if n.get('function_code'):
            node_html += f'<p><strong>Code :</strong> <code>{_h(n["function_code"])}</code></p>'
        if n.get('actants'):
            node_html += f'<p><strong>Actants :</strong> {_h(", ".join(n["actants"]))}</p>'
        mods = n.get('modalities', {})
        if mods:
            mod_str = " · ".join(f"{k}={v:.2f}" for k, v in mods.items())
            node_html += f'<p><strong>Modalités :</strong> {_h(mod_str)}</p>'
        if n.get('tension') is not None:
            node_html += f'<p><strong>Tension :</strong> {n["tension"]:.2f} · <strong>Phase :</strong> {_h(n.get("phase", "?"))}</p>'
        if n.get('text_excerpt'):
            node_html += f'<blockquote>{_h(n["text_excerpt"][:300])}</blockquote>'
        node_html += '</div>'
        nodes_html.append(node_html)
    
    cost_section = ''
    if analysis.get('cost_usd') is not None and analysis.get('mode') == 'llm':
        cost_section = (
            f'<p class="cost-info"><em>Analyse via Claude — coût : '
            f'{analysis["cost_usd"]:.4f} USD · '
            f'{analysis.get("tokens_total", 0):,} tokens</em></p>'
        )
    
    return f"""<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<title>Analyse NARR'IA — {_h(title)}</title>
<style>
  body {{ font-family: Garamond, Georgia, serif; max-width: 780px; margin: 2em auto; padding: 0 1em; color: #1a1a1a; line-height: 1.6; text-align: justify; }}
  .report-header {{ display: flex; align-items: center; gap: 1em; border-bottom: 3px solid #C55A11; padding-bottom: 0.5em; margin-bottom: 1em; }}
  .report-header img {{ width: 64px; height: 64px; }}
  h1 {{ color: #1F4E79; margin: 0; text-align: left; }}
  h2 {{ color: #1F4E79; border-bottom: 1px solid #C55A11; padding-bottom: 0.2em; margin-top: 1.5em; text-align: left; }}
  h3 {{ color: #C55A11; text-align: left; }}
  .meta {{ background: #F5F5F5; padding: 1em; border-left: 4px solid #1F4E79; }}
  .llm-block {{ background: #FCEFE5; padding: 1em; border-left: 4px solid #C55A11; margin: 1em 0; }}
  .node {{ background: #FAFAFA; padding: 1em; margin: 0.8em 0; border-left: 3px solid #C55A11; border-radius: 3px; }}
  blockquote {{ border-left: 3px solid #C55A11; padding-left: 1em; color: #555; font-style: italic; text-align: justify; }}
  code {{ background: #EEE; padding: 0.1em 0.4em; border-radius: 3px; }}
  table.actant-table {{ width: 100%; border-collapse: collapse; margin: 0.8em 0; }}
  table.actant-table td {{ padding: 0.4em 0.6em; border: 1px solid #DDD; }}
  table.actant-table td:first-child {{ background: #F5F5F5; width: 35%; }}
  .cost-info {{ font-size: 0.85em; color: #666; text-align: right; }}
  footer {{ margin-top: 3em; padding-top: 1em; border-top: 1px solid #DDD; color: #777; font-size: 0.85em; text-align: center; }}
</style></head><body>
<div class="report-header">
{_logo_img_tag()}
<h1>Analyse NARR'IA</h1>
</div>
<div class="meta">
  <p><strong>Œuvre :</strong> {_h(title)}<br>
     <strong>Auteur :</strong> {_h(author)}<br>
     <strong>Date d'analyse :</strong> {_h(analysis.get('date_human', '?'))}<br>
     <strong>Mode :</strong> {_h(analysis.get('mode', '?'))}</p>
</div>
{llm_section}
<section><h2>Graphe narratif ({len(nodes)} nœuds)</h2>
{''.join(nodes_html)}
</section>
{cost_section}
<footer>Généré par NARR'IA — Système de narratologie computationnelle.<br>
Adéchinan David Adékambi · Université de Kindia, République de Guinée.</footer>
</body></html>"""


def _render_analysis_html_minimal(analysis: dict) -> str:
    """
    Rendu HTML ULTRA-MINIMAL d'une analyse — fallback final.
    
    Aucun CSS avancé, pas de bordures gauche, pas d'images, pas de SVG.
    Cible : un PDF que xhtml2pdf peut convertir même sur les analyses
    qui ont fait planter les versions plus riches.
    """
    title = analysis.get('title', '?')
    author = analysis.get('author', '?')
    
    graph = analysis.get('graph', {})
    nodes = graph.get('nodes', [])
    meta = graph.get('metadata', {}) or {}
    
    parts = [f'<h1>Analyse NARR\'IA — {_h(title)}</h1>']
    parts.append(f'<p><b>Auteur :</b> {_h(author)}<br>')
    parts.append(f'<b>Date d\'analyse :</b> {_h(analysis.get("date_human", "?"))}<br>')
    parts.append(f'<b>Mode :</b> {_h(analysis.get("mode", "?"))}</p>')
    
    # Section synthèse LLM (sans SVG, sans tableau complexe)
    if analysis.get('mode') == 'llm' or meta.get('mode') == 'llm':
        summary = analysis.get('summary') or meta.get('summary', '')
        genre = analysis.get('genre') or meta.get('genre', '')
        tradition = analysis.get('tradition') or meta.get('tradition', '')
        main_actants = analysis.get('main_actants') or meta.get('main_actants', {}) or {}
        
        if summary:
            parts.append(f'<h2>Synthèse</h2>')
            parts.append(f'<p>{_h(summary)}</p>')
        if genre:
            parts.append(f'<p><b>Genre :</b> {_h(genre)}</p>')
        if tradition:
            parts.append(f'<p><b>Tradition :</b> {_h(tradition)}</p>')
        
        if main_actants:
            parts.append(f'<h2>Schéma actantiel</h2><p>')
            labels = {
                'protagoniste': 'Sujet', 'objet': 'Objet',
                'destinateur': 'Destinateur', 'destinataire': 'Destinataire',
                'adjuvant': 'Adjuvant', 'opposant': 'Opposant',
            }
            for key, label in labels.items():
                val = main_actants.get(key, '')
                if val:
                    parts.append(f'<b>{label} :</b> {_h(val)}<br>')
            parts.append('</p>')
    
    # Nœuds narratifs en liste simple
    parts.append(f'<h2>Graphe narratif ({len(nodes)} nœuds)</h2>')
    for i, n in enumerate(nodes, 1):
        node_title = n.get('function_name') or n.get('function_code') or '?'
        parts.append(f'<h3>Nœud {i} — {_h(node_title)}</h3><p>')
        if n.get('function_code'):
            parts.append(f'<b>Code :</b> {_h(n["function_code"])}<br>')
        if n.get('actants'):
            parts.append(f'<b>Actants :</b> {_h(", ".join(n["actants"]))}<br>')
        if n.get('tension') is not None:
            parts.append(f'<b>Tension :</b> {n["tension"]:.2f} — Phase : {_h(n.get("phase", "?"))}<br>')
        if n.get('text_excerpt'):
            # Limiter strictement la taille des extraits dans la version minimale
            excerpt = n['text_excerpt'][:200]
            parts.append(f'<i>« {_h(excerpt)} »</i>')
        parts.append('</p>')
    
    parts.append('<hr>')
    parts.append('<p><small>Généré par NARR\'IA · Adéchinan David Adékambi · Université de Kindia</small></p>')
    
    return ('<!DOCTYPE html><html><head><meta charset="utf-8">'
            '<title>Analyse NARR\'IA</title>'
            '<style>body{font-family:Helvetica,Arial,sans-serif;font-size:11pt;}'
            'h1{color:#1F4E79;}h2{color:#1F4E79;}h3{color:#C55A11;}</style>'
            '</head><body>' + ''.join(parts) + '</body></html>')


def _render_actantial_svg(actants: dict) -> str:
    """
    Génère le schéma actantiel greimassien en SVG, simplifié pour PDF.
    
    Version simplifiée par rapport à celle JavaScript : sans CSS
    avancé, géométrie réduite, pour que xhtml2pdf puisse le rendre.
    """
    if not actants:
        return ''
    
    def trunc(s, n=22):
        s = (s or '').strip()
        if not s:
            return '—'
        return s if len(s) <= n else s[:n-1] + '…'
    
    sujet = trunc(actants.get('protagoniste') or actants.get('sujet', ''))
    objet = trunc(actants.get('objet', ''))
    destinateur = trunc(actants.get('destinateur', ''))
    destinataire = trunc(actants.get('destinataire', ''))
    adjuvant = trunc(actants.get('adjuvant', ''))
    opposant = trunc(actants.get('opposant', ''))
    
    # Cartouches positions
    W, H = 720, 360
    boxW, boxH = 140, 50
    
    def box(cx, cy, label, value, color, bg):
        x = cx - boxW/2
        y = cy - boxH/2
        return (
            f'<rect x="{x}" y="{y}" width="{boxW}" height="{boxH}" '
            f'rx="6" ry="6" fill="{bg}" stroke="{color}" stroke-width="2"/>'
            f'<text x="{cx}" y="{cy - 6}" text-anchor="middle" '
            f'font-family="Helvetica" font-size="10" fill="{color}" '
            f'font-weight="bold">{_h(label)}</text>'
            f'<text x="{cx}" y="{cy + 14}" text-anchor="middle" '
            f'font-family="Helvetica" font-size="11" fill="#1a1a1a" '
            f'font-style="italic">{_h(value)}</text>'
        )
    
    return f'''
<div class="actantial-diagram-pdf" style="text-align: center; margin: 1em 0;">
<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" width="700" height="350">
    <!-- Axes -->
    <line x1="{W/2}" y1="{H-80-boxH/2-5}" x2="{W/2}" y2="{80+boxH/2+5}" 
          stroke="#1F4E79" stroke-width="3"/>
    <polygon points="{W/2-6},{80+boxH/2+10} {W/2+6},{80+boxH/2+10} {W/2},{80+boxH/2+2}" fill="#1F4E79"/>
    <text x="{W/2 + 10}" y="{H/2}" font-family="Helvetica" font-size="9" 
          fill="#1F4E79" font-weight="bold">AXE DU DÉSIR</text>
    
    <line x1="{130+boxW/2+5}" y1="80" x2="{W-130-boxW/2-5}" y2="80" 
          stroke="#C55A11" stroke-width="2"/>
    <polygon points="{W-130-boxW/2-3},75 {W-130-boxW/2-3},85 {W-130-boxW/2+5},80" fill="#C55A11"/>
    <text x="{W/2}" y="35" text-anchor="middle" font-family="Helvetica" font-size="9" 
          fill="#C55A11" font-weight="bold">AXE DE COMMUNICATION</text>
    
    <line x1="{130+boxW/2+5}" y1="{H-80}" x2="{W/2-boxW/2-5}" y2="{H-80}" 
          stroke="#595959" stroke-width="2"/>
    <polygon points="{W/2-boxW/2-3},{H-85} {W/2-boxW/2-3},{H-75} {W/2-boxW/2+5},{H-80}" fill="#595959"/>
    <line x1="{W-130-boxW/2-5}" y1="{H-80}" x2="{W/2+boxW/2+5}" y2="{H-80}" 
          stroke="#595959" stroke-width="2" stroke-dasharray="4 3"/>
    <polygon points="{W/2+boxW/2+3},{H-85} {W/2+boxW/2+3},{H-75} {W/2+boxW/2-5},{H-80}" fill="#595959"/>
    
    <!-- Boîtes -->
    {box(130, 80, 'DESTINATEUR', destinateur, '#C55A11', '#FCEFE5')}
    {box(W/2, 80, 'OBJET', objet, '#1F4E79', '#E8F0F7')}
    {box(W-130, 80, 'DESTINATAIRE', destinataire, '#C55A11', '#FCEFE5')}
    {box(130, H-80, 'ADJUVANT', adjuvant, '#595959', '#F2F2F2')}
    {box(W/2, H-80, 'SUJET', sujet, '#1F4E79', '#E8F0F7')}
    {box(W-130, H-80, 'OPPOSANT', opposant, '#595959', '#F2F2F2')}
</svg>
<p style="font-size: 0.8em; font-style: italic; color: #666; text-align: center;">
Schéma actantiel d'après A. J. Greimas (Sémantique structurale, 1966).
</p>
</div>
'''


def _render_comparison_simple_html(comp: dict) -> str:
    """Rendu HTML simple d'une comparaison (fallback si graphes indisponibles)."""
    return f"""<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<title>Comparaison NARR'IA</title>
<style>
  body {{ font-family: Garamond, Georgia, serif; max-width: 780px; margin: 2em auto; padding: 0 1em; line-height: 1.6; }}
  h1 {{ color: #1F4E79; border-bottom: 3px solid #C55A11; padding-bottom: 0.3em; }}
  table {{ width: 100%; border-collapse: collapse; margin: 1em 0; }}
  td, th {{ padding: 0.5em; border: 1px solid #DDD; text-align: left; }}
  th {{ background: #F5F5F5; }}
</style></head><body>
<h1>Comparaison NARR'IA</h1>
<table>
  <tr><th>Référence</th><td>{_h(comp.get('ref_title', '?'))} — {_h(comp.get('ref_author', '?'))}</td></tr>
  <tr><th>Candidate</th><td>{_h(comp.get('cand_title', '?'))} — {_h(comp.get('cand_author', '?'))}</td></tr>
  <tr><th>Date</th><td>{_h(comp.get('date_human', '?'))}</td></tr>
  <tr><th>SNS</th><td>{comp.get('sns', '?')}</td></tr>
  <tr><th>SS</th><td>{comp.get('ss', '?')}</td></tr>
  <tr><th>ST</th><td>{comp.get('st', '?')}</td></tr>
  <tr><th>SRJ</th><td>{comp.get('srj', '?')} ({_h(comp.get('srj_class', '?'))})</td></tr>
  <tr><th>Modalité</th><td>{_h(comp.get('modality', '?'))}</td></tr>
</table>
</body></html>"""


def _render_comparison_markdown(comp: dict) -> str:
    """Rendu Markdown d'une comparaison."""
    md = []
    md.append(f"# Comparaison NARR'IA")
    md.append("")
    md.append(f"**Date :** {comp.get('date_human', '?')}")
    md.append("")
    md.append("## Œuvres comparées")
    md.append("")
    md.append(f"- **Référence :** {comp.get('ref_title', '?')} — {comp.get('ref_author', '?')}")
    md.append(f"- **Candidate :** {comp.get('cand_title', '?')} — {comp.get('cand_author', '?')}")
    md.append("")
    md.append("## Scores")
    md.append("")
    md.append("| Métrique | Valeur |")
    md.append("|----------|--------|")
    md.append(f"| SNS (similarité narrative) | {comp.get('sns', '?')} |")
    md.append(f"| SS (spécificité) | {comp.get('ss', '?')} |")
    md.append(f"| ST (transformation) | {comp.get('st', '?')} |")
    md.append(f"| SRJ (risque juridique) | {comp.get('srj', '?')} ({comp.get('srj_class', '?')}) |")
    md.append("")
    md.append(f"**Modalité détectée :** {comp.get('modality', '?')}")
    md.append("")
    full = comp.get('full_result', {})
    if full.get('verdict'):
        md.append("## Verdict")
        md.append("")
        md.append(full['verdict'])
        md.append("")
    md.append("---")
    md.append("_Généré par NARR'IA · Adéchinan David Adékambi, Université de Kindia, Guinée_")
    return '\n'.join(md)


def _logo_img_tag() -> str:
    """
    Retourne une balise <img> avec le logo NARR'IA en base64.
    Permet l'inclusion du logo dans les rapports HTML/PDF autonomes.
    """
    try:
        import base64
        logo_path = BASE_DIR / 'static' / 'img' / 'logo.png'
        if not logo_path.exists():
            return ''
        with open(logo_path, 'rb') as f:
            data = base64.b64encode(f.read()).decode('ascii')
        return f'<img src="data:image/png;base64,{data}" alt="NARR\'IA" width="64" height="64">'
    except Exception:
        return ''


def _h(text):
    """Échappe HTML."""
    if text is None:
        return ''
    s = str(text)
    return (s.replace('&', '&amp;').replace('<', '&lt;')
             .replace('>', '&gt;').replace('"', '&quot;'))


# ═══════════════════════════════════════════════════════════════════
#  LANCEMENT
# ═══════════════════════════════════════════════════════════════════

def open_browser(port):
    """Ouvre le navigateur par défaut sur l'application."""
    webbrowser.open_new(f'http://127.0.0.1:{port}/')


def main():
    """Point d'entrée de l'application."""
    port = int(os.environ.get('NARRIA_PORT', 5000))
    host = os.environ.get('NARRIA_HOST', '127.0.0.1')
    debug = os.environ.get('NARRIA_DEBUG', '').lower() == 'true'
    
    # Banner
    print()
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║                                                              ║")
    print("║   NARR'IA — Narratologie computationnelle du plagiat        ║")
    print("║                                                              ║")
    print("║   Version 1.0.0                                              ║")
    print("║   Département de Lettres Modernes, Université de Kindia     ║")
    print("║                                                              ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    print()
    print(f"  ✓ Modules chargés : M1 · M2 · M3 · M4 · M5")
    print(f"  ✓ Répertoire      : 53 fonctions narratives en 7 familles")
    print(f"  ✓ Serveur local   : http://{host}:{port}")
    print()
    print("  L'application va s'ouvrir dans votre navigateur par défaut...")
    print("  Pour arrêter l'application : Ctrl+C dans cette fenêtre.")
    print()
    
    # Schedule browser opening (only in local mode, not in production)
    is_production = os.environ.get('NARRIA_ENV', '').lower() == 'production'
    if not debug and not is_production:
        threading.Timer(1.5, lambda: open_browser(port)).start()
    
    # Launch server (threaded=True so long PDF generations don't block other requests)
    try:
        app.run(host=host, port=port, debug=debug, use_reloader=False, threaded=True)
    except KeyboardInterrupt:
        print("\n\n  Application arrêtée. À bientôt !")
    except Exception as e:
        print(f"\n  ERREUR : {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
