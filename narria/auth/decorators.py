"""
narria.auth.decorators — Décorateurs pour protéger les routes Flask.

Usage :
    @app.route('/api/secure')
    @login_required
    def my_route():
        user = g.user
        return ...

    @app.route('/api/admin/stats')
    @admin_required
    def admin_stats():
        return ...
"""

from __future__ import annotations

from functools import wraps
from flask import session, jsonify, g, redirect, url_for, request


def _get_current_user():
    """Récupère l'utilisateur courant depuis la session."""
    user_id = session.get('user_id')
    if not user_id:
        return None
    
    from narria.auth.users import UserStore
    store = UserStore()
    return store.get_user_by_id(user_id)


def login_required(f):
    """Exige une session active. Sinon : 401 (API) ou redirect (HTML)."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        user = _get_current_user()
        if not user:
            # API request → JSON 401
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Authentification requise'}), 401
            # HTML request → redirect to login
            return redirect(url_for('login_page', next=request.path))
        
        if not user['is_active']:
            session.clear()
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Compte désactivé'}), 403
            return redirect(url_for('login_page'))
        
        # Stash user in g for the request
        g.user = user
        return f(*args, **kwargs)
    return wrapper


def admin_required(f):
    """Exige une session admin."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        user = _get_current_user()
        if not user:
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Authentification requise'}), 401
            return redirect(url_for('login_page', next=request.path))
        
        if not user['is_active'] or not user['is_admin']:
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Privilèges admin requis'}), 403
            return redirect(url_for('home'))
        
        g.user = user
        return f(*args, **kwargs)
    return wrapper
