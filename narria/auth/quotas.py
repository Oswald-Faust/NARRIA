"""
narria.auth.quotas — Gestion des quotas par utilisateur.

Compte les actions consommatrices (analyses LLM, comparaisons, retries) sur
des fenêtres glissantes (24h, 30 jours) et bloque quand le quota est atteint.

Une "action" coûteuse :
- 1 analyse LLM = 1 unité (coût typique : 0,05 USD)
- 1 comparaison = 1 unité (la comparaison ne consomme pas de LLM directement,
  mais nécessite que les deux analyses aient été faites au préalable)
"""

from __future__ import annotations

import sqlite3
import time
from pathlib import Path
from typing import Optional, Dict, Any

from narria.auth.users import _get_db_path


class QuotaManager:
    """Gestionnaire des quotas et de la journalisation d'usage."""
    
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or _get_db_path()
    
    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn
    
    # ───────────────────────────────────────────────────────────────
    #  CONSULTATION
    # ───────────────────────────────────────────────────────────────
    
    def get_usage_24h(self, user_id: int) -> int:
        """Retourne le nombre d'actions consommatrices dans les 24 dernières heures."""
        cutoff = time.time() - (24 * 3600)
        with self._connect() as conn:
            row = conn.execute("""
                SELECT COUNT(*) AS n FROM usage_log
                WHERE user_id = ? AND timestamp >= ?
                AND action IN ('analyze_llm', 'comparison')
            """, (user_id, cutoff)).fetchone()
            return row['n'] if row else 0
    
    def get_usage_30d(self, user_id: int) -> int:
        """Retourne le nombre d'actions consommatrices dans les 30 derniers jours."""
        cutoff = time.time() - (30 * 24 * 3600)
        with self._connect() as conn:
            row = conn.execute("""
                SELECT COUNT(*) AS n FROM usage_log
                WHERE user_id = ? AND timestamp >= ?
                AND action IN ('analyze_llm', 'comparison')
            """, (user_id, cutoff)).fetchone()
            return row['n'] if row else 0
    
    def get_total_cost(self, user_id: int, days: int = 30) -> float:
        """Coût total cumulé en USD sur la période."""
        cutoff = time.time() - (days * 24 * 3600)
        with self._connect() as conn:
            row = conn.execute("""
                SELECT COALESCE(SUM(cost_usd), 0) AS total FROM usage_log
                WHERE user_id = ? AND timestamp >= ?
            """, (user_id, cutoff)).fetchone()
            return float(row['total']) if row else 0.0
    
    def get_status(self, user_id: int, quota_daily: int, quota_monthly: int) -> Dict[str, Any]:
        """Retourne l'état complet des quotas pour un utilisateur."""
        used_24h = self.get_usage_24h(user_id)
        used_30d = self.get_usage_30d(user_id)
        return {
            'used_24h': used_24h,
            'quota_daily': quota_daily,
            'remaining_24h': max(0, quota_daily - used_24h),
            'used_30d': used_30d,
            'quota_monthly': quota_monthly,
            'remaining_30d': max(0, quota_monthly - used_30d),
            'cost_30d_usd': self.get_total_cost(user_id, days=30),
        }
    
    # ───────────────────────────────────────────────────────────────
    #  VÉRIFICATION AVANT ACTION
    # ───────────────────────────────────────────────────────────────
    
    def can_perform_action(self, user_id: int, quota_daily: int, quota_monthly: int) -> Dict[str, Any]:
        """
        Vérifie si l'utilisateur peut effectuer une nouvelle action consommatrice.
        Retourne dict avec 'allowed' (bool) et 'reason' (str) si refus.
        """
        used_24h = self.get_usage_24h(user_id)
        if used_24h >= quota_daily:
            return {
                'allowed': False,
                'reason': f"Quota journalier atteint ({used_24h}/{quota_daily}). "
                          f"Réessayez dans quelques heures.",
                'reset_in_hours': self._hours_until_reset(user_id),
            }
        
        used_30d = self.get_usage_30d(user_id)
        if used_30d >= quota_monthly:
            return {
                'allowed': False,
                'reason': f"Quota mensuel atteint ({used_30d}/{quota_monthly}). "
                          f"Contactez l'administrateur pour augmentation.",
            }
        
        return {'allowed': True}
    
    def _hours_until_reset(self, user_id: int) -> Optional[int]:
        """Estime le temps restant jusqu'à la libération de quota journalier."""
        cutoff = time.time() - (24 * 3600)
        with self._connect() as conn:
            row = conn.execute("""
                SELECT MIN(timestamp) AS earliest FROM usage_log
                WHERE user_id = ? AND timestamp >= ?
                AND action IN ('analyze_llm', 'comparison')
            """, (user_id, cutoff)).fetchone()
            
            if not row or not row['earliest']:
                return None
            
            reset_at = row['earliest'] + (24 * 3600)
            hours = max(0, int((reset_at - time.time()) / 3600))
            return hours
    
    # ───────────────────────────────────────────────────────────────
    #  ENREGISTREMENT D'UNE ACTION
    # ───────────────────────────────────────────────────────────────
    
    def log_action(self, user_id: int, action: str,
                    cost_usd: float = 0.0, tokens: int = 0,
                    metadata: str = '') -> None:
        """
        Enregistre une action dans le journal d'usage.
        action : 'analyze_llm', 'analyze_local', 'comparison', 'download', etc.
        """
        with self._connect() as conn:
            conn.execute("""
                INSERT INTO usage_log (
                    user_id, action, cost_usd, tokens, timestamp, metadata
                ) VALUES (?, ?, ?, ?, ?, ?)
            """, (user_id, action, cost_usd, tokens, time.time(), metadata))
            conn.commit()
    
    # ───────────────────────────────────────────────────────────────
    #  ADMIN : VUE GLOBALE
    # ───────────────────────────────────────────────────────────────
    
    def get_total_cost_all_users(self, days: int = 30) -> float:
        """Coût total cumulé tous utilisateurs confondus."""
        cutoff = time.time() - (days * 24 * 3600)
        with self._connect() as conn:
            row = conn.execute("""
                SELECT COALESCE(SUM(cost_usd), 0) AS total FROM usage_log
                WHERE timestamp >= ?
            """, (cutoff,)).fetchone()
            return float(row['total']) if row else 0.0
    
    def get_usage_summary(self, user_id: int, days: int = 30) -> Dict[str, Any]:
        """Résumé d'usage détaillé pour un utilisateur (pour la page admin)."""
        cutoff = time.time() - (days * 24 * 3600)
        with self._connect() as conn:
            row = conn.execute("""
                SELECT
                    COUNT(*) AS total_actions,
                    SUM(CASE WHEN action = 'analyze_llm' THEN 1 ELSE 0 END) AS llm_analyses,
                    SUM(CASE WHEN action = 'analyze_local' THEN 1 ELSE 0 END) AS local_analyses,
                    SUM(CASE WHEN action = 'comparison' THEN 1 ELSE 0 END) AS comparisons,
                    COALESCE(SUM(cost_usd), 0) AS total_cost,
                    COALESCE(SUM(tokens), 0) AS total_tokens
                FROM usage_log
                WHERE user_id = ? AND timestamp >= ?
            """, (user_id, cutoff)).fetchone()
            return dict(row) if row else {}
