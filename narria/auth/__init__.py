"""
narria.auth — Module d'authentification et de quotas pour la version en ligne.

Architecture :
- users : gestion des comptes utilisateurs (inscription, login, hash des mots de passe)
- quotas : limites par utilisateur (jour, mois) et compteur de consommation
- decorators : @login_required, @admin_required, @check_quota

Stockage : base SQLite dans NARRIA_DATA_DIR/auth.db (volume persistant en production).
"""

from narria.auth.users import UserStore, hash_password, verify_password
from narria.auth.quotas import QuotaManager
from narria.auth.decorators import login_required, admin_required

__all__ = [
    'UserStore', 'hash_password', 'verify_password',
    'QuotaManager',
    'login_required', 'admin_required',
]
