"""
narria.llm.config — Gestion sécurisée de la clé API Anthropic.

La clé est stockée dans ~/.narria/config.json avec permissions 600 (owner-only
read/write) sur les systèmes Unix. Sur Windows, on s'appuie sur le répertoire
utilisateur standard et la sécurité du système de fichiers Windows.
"""

from __future__ import annotations

import json
import os
import stat
from pathlib import Path
from typing import Optional, Dict, Any


class NarriaConfig:
    """Gestion de la configuration utilisateur de NARR'IA."""
    
    def __init__(self, config_dir: Optional[Path] = None):
        if config_dir is None:
            # En production, NARRIA_DATA_DIR permet de pointer sur un volume persistant
            # En local, fallback sur ~/.narria/
            env_dir = os.environ.get('NARRIA_DATA_DIR')
            if env_dir:
                config_dir = Path(env_dir)
            else:
                config_dir = Path.home() / '.narria'
        self.config_dir = config_dir
        self.config_file = config_dir / 'config.json'
        self.config_dir.mkdir(parents=True, exist_ok=True)
        
        # On Unix, ensure the directory has restrictive permissions (700)
        if os.name != 'nt':
            try:
                os.chmod(config_dir, stat.S_IRWXU)  # 0o700
            except Exception:
                pass
    
    def load(self) -> Dict[str, Any]:
        """Charge la configuration. Retourne un dict vide si absente."""
        if not self.config_file.exists():
            return {}
        try:
            with self.config_file.open('r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return {}
    
    def save(self, config: Dict[str, Any]) -> None:
        """Sauvegarde la configuration avec permissions restrictives (600)."""
        with self.config_file.open('w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        # Secure permissions on Unix: 0o600 (owner read/write only)
        if os.name != 'nt':
            try:
                os.chmod(self.config_file, stat.S_IRUSR | stat.S_IWUSR)
            except Exception:
                pass
    
    def get_api_key(self) -> Optional[str]:
        """Retourne la clé API stockée, ou None."""
        # Priority 1: environment variable (useful for testing/CI)
        env_key = os.environ.get('ANTHROPIC_API_KEY')
        if env_key and env_key.strip():
            return env_key.strip()
        
        # Priority 2: config file
        config = self.load()
        key = config.get('anthropic_api_key')
        if key and isinstance(key, str) and key.strip():
            return key.strip()
        
        return None
    
    def set_api_key(self, api_key: str) -> None:
        """Stocke la clé API dans la configuration."""
        config = self.load()
        config['anthropic_api_key'] = api_key.strip()
        self.save(config)
    
    def remove_api_key(self) -> None:
        """Supprime la clé API de la configuration."""
        config = self.load()
        if 'anthropic_api_key' in config:
            del config['anthropic_api_key']
            self.save(config)
    
    def get_setting(self, key: str, default: Any = None) -> Any:
        """Récupère un paramètre de configuration."""
        return self.load().get(key, default)
    
    def set_setting(self, key: str, value: Any) -> None:
        """Définit un paramètre de configuration."""
        config = self.load()
        config[key] = value
        self.save(config)
    
    def is_configured(self) -> bool:
        """Retourne True si une clé API valide est présente."""
        key = self.get_api_key()
        if not key:
            return False
        # Clé Anthropic valide : commence par sk-ant- et fait au moins 40 caractères
        return key.startswith('sk-ant-') and len(key) >= 40


# Instance globale partagée
_config_instance: Optional[NarriaConfig] = None

def get_config() -> NarriaConfig:
    """Retourne l'instance de configuration globale."""
    global _config_instance
    if _config_instance is None:
        _config_instance = NarriaConfig()
    return _config_instance
