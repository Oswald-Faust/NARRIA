"""
narria.llm — Intégration des grands modèles de langage pour l'analyse narratologique.

Fournit un client Claude pour l'identification précise des fonctions narratives,
des actants, des modalités et de la signature tensive, avec justifications
textuelles appuyées sur des citations du texte analysé.

Usage :
    from narria.llm import ClaudeClient, get_config
    
    config = get_config()
    if config.is_configured():
        client = ClaudeClient(api_key=config.get_api_key())
        result = client.analyze_narrative(text, title="…", author="…")
"""

from narria.llm.config import NarriaConfig, get_config
from narria.llm.claude_client import (
    ClaudeClient, LLMUsage,
    DEFAULT_MODEL, PRICE_INPUT_PER_MTOK, PRICE_OUTPUT_PER_MTOK,
    ANTHROPIC_AVAILABLE,
)
