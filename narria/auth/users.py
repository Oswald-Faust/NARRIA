"""
narria.auth.users — Gestion des comptes utilisateurs.

Le hash des mots de passe utilise PBKDF2-SHA256 (inclus dans la stdlib Python),
pas besoin de dépendance externe. Coût d'itération : 600 000 (recommandation
OWASP 2023).
"""

from __future__ import annotations

import os
import sqlite3
import secrets
import hashlib
import time
from pathlib import Path
from typing import Optional, Dict, Any, List


# ───────────────────────────────────────────────────────────────────
#  HASHING DES MOTS DE PASSE
# ───────────────────────────────────────────────────────────────────

PBKDF2_ITERATIONS = 600_000
PBKDF2_HASH = 'sha256'
SALT_BYTES = 16


def hash_password(password: str) -> str:
    """
    Produit un hash sécurisé du mot de passe avec PBKDF2-SHA256.
    Format : pbkdf2_sha256$<iter>$<salt_hex>$<hash_hex>
    """
    if not password:
        raise ValueError("Mot de passe vide")
    
    salt = secrets.token_bytes(SALT_BYTES)
    derived = hashlib.pbkdf2_hmac(
        PBKDF2_HASH,
        password.encode('utf-8'),
        salt,
        PBKDF2_ITERATIONS
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${derived.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Vérifie qu'un mot de passe correspond au hash stocké."""
    if not password or not stored_hash:
        return False
    
    try:
        algo, iter_str, salt_hex, hash_hex = stored_hash.split('$')
        if algo != 'pbkdf2_sha256':
            return False
        iterations = int(iter_str)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
        
        derived = hashlib.pbkdf2_hmac(
            PBKDF2_HASH,
            password.encode('utf-8'),
            salt,
            iterations
        )
        # Comparaison à temps constant pour éviter les attaques par timing
        return secrets.compare_digest(derived, expected)
    except (ValueError, IndexError):
        return False


# ───────────────────────────────────────────────────────────────────
#  BASE DE DONNÉES SQLITE
# ───────────────────────────────────────────────────────────────────

def _get_db_path() -> Path:
    """Retourne le chemin de la base SQLite des utilisateurs."""
    base = os.environ.get('NARRIA_DATA_DIR')
    if base:
        base_path = Path(base)
    else:
        base_path = Path.home() / '.narria'
    base_path.mkdir(parents=True, exist_ok=True)
    return base_path / 'auth.db'


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    password_hash TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at REAL NOT NULL,
    last_login_at REAL,
    quota_daily INTEGER DEFAULT 5,
    quota_monthly INTEGER DEFAULT 50,
    affiliation TEXT,
    note TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS usage_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    cost_usd REAL DEFAULT 0,
    tokens INTEGER DEFAULT 0,
    timestamp REAL NOT NULL,
    metadata TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_log(timestamp);
"""


# ───────────────────────────────────────────────────────────────────
#  USER STORE
# ───────────────────────────────────────────────────────────────────

class UserStore:
    """Gestionnaire des comptes utilisateurs."""
    
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or _get_db_path()
        self._init_db()
    
    def _init_db(self) -> None:
        """Crée les tables si nécessaire."""
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.executescript(SCHEMA)
            conn.commit()
    
    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn
    
    # ─── Création ───
    
    def create_user(self, email: str, password: str,
                     full_name: str = '',
                     affiliation: str = '',
                     is_admin: bool = False,
                     quota_daily: int = 5,
                     quota_monthly: int = 50) -> Dict[str, Any]:
        """
        Crée un nouvel utilisateur.
        Retourne le dict utilisateur ou lève ValueError en cas de conflit.
        """
        email = (email or '').strip().lower()
        if not email or '@' not in email:
            raise ValueError("Adresse e-mail invalide")
        if not password or len(password) < 8:
            raise ValueError("Le mot de passe doit faire au moins 8 caractères")
        
        password_hash = hash_password(password)
        now = time.time()
        
        with self._connect() as conn:
            try:
                cur = conn.execute("""
                    INSERT INTO users (
                        email, full_name, password_hash, is_admin, is_active,
                        created_at, quota_daily, quota_monthly, affiliation
                    ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
                """, (email, full_name.strip(), password_hash,
                      1 if is_admin else 0, now,
                      quota_daily, quota_monthly, affiliation.strip()))
                user_id = cur.lastrowid
                conn.commit()
            except sqlite3.IntegrityError:
                raise ValueError("Un compte existe déjà avec cette adresse e-mail")
        
        return self.get_user_by_id(user_id)
    
    # ─── Lecture ───
    
    def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE id = ?", (user_id,)
            ).fetchone()
            return dict(row) if row else None
    
    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        email = (email or '').strip().lower()
        if not email:
            return None
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE email = ?", (email,)
            ).fetchone()
            return dict(row) if row else None
    
    def list_users(self) -> List[Dict[str, Any]]:
        """Liste tous les utilisateurs (pour la page admin)."""
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM users ORDER BY created_at DESC"
            ).fetchall()
            return [dict(r) for r in rows]
    
    # ─── Authentification ───
    
    def authenticate(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """Vérifie les identifiants. Retourne l'utilisateur ou None."""
        user = self.get_user_by_email(email)
        if not user:
            return None
        if not user['is_active']:
            return None
        if not verify_password(password, user['password_hash']):
            return None
        
        # Update last_login_at
        with self._connect() as conn:
            conn.execute(
                "UPDATE users SET last_login_at = ? WHERE id = ?",
                (time.time(), user['id'])
            )
            conn.commit()
        
        return user
    
    # ─── Mise à jour ───
    
    def set_quota(self, user_id: int, daily: int, monthly: int) -> None:
        """Modifie le quota d'un utilisateur (admin)."""
        with self._connect() as conn:
            conn.execute(
                "UPDATE users SET quota_daily = ?, quota_monthly = ? WHERE id = ?",
                (daily, monthly, user_id)
            )
            conn.commit()
    
    def set_active(self, user_id: int, active: bool) -> None:
        """Active/désactive un compte (admin)."""
        with self._connect() as conn:
            conn.execute(
                "UPDATE users SET is_active = ? WHERE id = ?",
                (1 if active else 0, user_id)
            )
            conn.commit()
    
    def set_admin(self, user_id: int, is_admin: bool) -> None:
        """Donne/retire les droits admin."""
        with self._connect() as conn:
            conn.execute(
                "UPDATE users SET is_admin = ? WHERE id = ?",
                (1 if is_admin else 0, user_id)
            )
            conn.commit()
    
    def change_password(self, user_id: int, new_password: str) -> None:
        """Change le mot de passe d'un utilisateur."""
        if not new_password or len(new_password) < 8:
            raise ValueError("Le mot de passe doit faire au moins 8 caractères")
        new_hash = hash_password(new_password)
        with self._connect() as conn:
            conn.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?",
                (new_hash, user_id)
            )
            conn.commit()
