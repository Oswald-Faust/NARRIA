"""
narria.llm.claude_client — Client pour l'API Anthropic Claude.

Ce module encapsule les appels à l'API Claude pour l'analyse narratologique.
Utilisé par le GraphExtractor en mode LLM pour identifier les fonctions
narratives avec précision, avec justifications textuelles.

Modèle par défaut : claude-sonnet-4-5 (optimal pour la qualité/coût)
Fenêtre de contexte : 200 000 tokens ≈ 150 000 mots

Tarifs (avril 2026) :
    - Input : 3 USD / million de tokens
    - Output : 15 USD / million de tokens
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Optional, Dict, Any, List

try:
    from anthropic import Anthropic, APIError, AuthenticationError, APIConnectionError
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    Anthropic = None


# Modèle par défaut : équilibre qualité/coût
DEFAULT_MODEL = 'claude-sonnet-4-5'

# Tarifs en USD par million de tokens (avril 2026, Claude Sonnet 4.5)
PRICE_INPUT_PER_MTOK = 3.0
PRICE_OUTPUT_PER_MTOK = 15.0

# Estimation grossière : 1 token ≈ 4 caractères en français
CHARS_PER_TOKEN_APPROX = 4


@dataclass
class LLMUsage:
    """Suivi de l'usage (tokens et coût)."""
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    
    def add(self, other: 'LLMUsage') -> None:
        self.input_tokens += other.input_tokens
        self.output_tokens += other.output_tokens
        self.cost_usd += other.cost_usd
    
    @classmethod
    def from_response(cls, response) -> 'LLMUsage':
        """Crée un LLMUsage à partir d'une réponse Anthropic."""
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        cost = (input_tokens * PRICE_INPUT_PER_MTOK
                + output_tokens * PRICE_OUTPUT_PER_MTOK) / 1_000_000
        return cls(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost,
        )


class ClaudeClient:
    """
    Client pour l'API Claude, configuré pour l'analyse narratologique.
    """
    
    def __init__(self, api_key: str, model: str = DEFAULT_MODEL):
        if not ANTHROPIC_AVAILABLE:
            raise ImportError(
                "Le SDK anthropic n'est pas installé. "
                "Installez-le avec : pip install anthropic"
            )
        if not api_key or not api_key.startswith('sk-ant-'):
            raise ValueError(
                "Clé API Anthropic invalide. "
                "Elle doit commencer par 'sk-ant-'."
            )
        
        self.client = Anthropic(api_key=api_key)
        self.model = model
        self.total_usage = LLMUsage()
    
    def test_connection(self) -> Dict[str, Any]:
        """
        Teste la validité de la clé avec un petit appel.
        Retourne {'success': bool, 'message': str, 'model': str}.
        """
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=10,
                messages=[{
                    'role': 'user',
                    'content': 'Réponds par "OK" uniquement.'
                }]
            )
            usage = LLMUsage.from_response(response)
            return {
                'success': True,
                'message': f'Connexion réussie. Modèle : {self.model}',
                'model': self.model,
                'input_tokens': usage.input_tokens,
                'output_tokens': usage.output_tokens,
            }
        except AuthenticationError as e:
            return {
                'success': False,
                'message': f'Clé API invalide ou révoquée : {str(e)}',
            }
        except APIConnectionError as e:
            return {
                'success': False,
                'message': f'Impossible de contacter l\'API Anthropic : {str(e)}',
            }
        except APIError as e:
            return {
                'success': False,
                'message': f'Erreur API : {str(e)}',
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'Erreur : {str(e)}',
            }
    
    def analyze_narrative(self, text: str, title: str = "",
                          author: str = "") -> Dict[str, Any]:
        """
        Analyse narratologique complète d'un texte.
        
        Retourne un dict avec :
        - 'segments': liste de segments narratifs identifiés
        - 'nodes': liste de nœuds narratifs (fonctions, actants, modalités)
        - 'edges': transitions entre nœuds
        - 'actants': dict des actants principaux et leurs rôles
        - 'tension_profile': courbe tensive
        - 'usage': informations sur l'usage (tokens, coût)
        """
        prompt = self._build_analysis_prompt(text, title, author)
        
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=16000,  # Large enough for detailed analysis
                messages=[{
                    'role': 'user',
                    'content': prompt,
                }],
                system=SYSTEM_PROMPT_NARRATOLOGY,
            )
        except AuthenticationError:
            raise ValueError("Clé API invalide. Vérifiez votre configuration.")
        except APIConnectionError as e:
            raise ConnectionError(f"Impossible de contacter l'API Anthropic : {e}")
        except APIError as e:
            raise RuntimeError(f"Erreur de l'API : {e}")
        
        # Track usage
        usage = LLMUsage.from_response(response)
        self.total_usage.add(usage)
        
        # Extract the text response
        response_text = ""
        for block in response.content:
            if hasattr(block, 'text'):
                response_text += block.text
        
        # Parse the JSON response
        parsed = self._parse_analysis_response(response_text)
        parsed['usage'] = {
            'input_tokens': usage.input_tokens,
            'output_tokens': usage.output_tokens,
            'cost_usd': usage.cost_usd,
        }
        
        return parsed
    
    def _build_analysis_prompt(self, text: str, title: str, author: str) -> str:
        """Construit le prompt d'analyse narratologique."""
        meta = ""
        if title:
            meta += f"Titre : {title}\n"
        if author:
            meta += f"Auteur : {author}\n"
        if meta:
            meta = meta + "\n"
        
        return f"""{meta}Voici le texte à analyser :

<texte>
{text}
</texte>

Analyse ce récit en produisant un graphe narratif structuré au format JSON.

Pour chaque fonction narrative identifiée, tu dois fournir :
1. Le code de la fonction parmi les 52 du répertoire NARR'IA (voir ta liste de référence dans le system prompt)
2. Les actants principaux impliqués (noms des personnages avec leur rôle)
3. Les valeurs modales greimassiennes (vouloir, devoir, pouvoir, savoir entre 0.0 et 1.0)
4. La tension dramatique estimée (entre 0.0 et 1.0, selon la courbe de Freytag)
5. La phase dramatique (Exposition / Complication / Climax / Résolution)
6. **Une justification textuelle citant un court extrait du texte qui appuie ton identification**
7. Un index de séquence (ordre narratif : 1, 2, 3, ...)

Réponds UNIQUEMENT avec un objet JSON valide structuré ainsi :

```json
{{
  "summary": "Résumé synthétique de l'intrigue en 2-3 phrases",
  "genre": "Genre narratif détecté (tragédie, quête initiatique, roman d'apprentissage, etc.)",
  "tradition": "Tradition narrative dominante (classique occidentale, africaine orale, réaliste moderne, etc.)",
  "formal_features": {{
    "form": "prose | vers_libre | vers_metrique | mixte | drame | dialogue",
    "register": "narratif_neutre | poetique | lyrique | dramatique | didactique | comique | satirique | epique",
    "narrative_length_category": "tres_court | court | moyen | long | tres_long",
    "approximate_word_count": 250,
    "has_explicit_morality": true,
    "has_narrator_intervention": true,
    "uses_dialogue": true,
    "stylistic_signature": "Description en 1-2 phrases du style dominant (sobre, fleuri, archaïsant, oral, etc.)"
  }},
  "nodes": [
    {{
      "sequence": 1,
      "function_code": "F10",
      "function_name": "Rencontre",
      "function_family": "Quête et cheminement",
      "actants": ["Roméo (sujet)", "Juliette (objet de désir)"],
      "modalities": {{"vouloir": 0.8, "devoir": 0.2, "pouvoir": 0.5, "savoir": 0.3}},
      "tension": 0.4,
      "phase": "Exposition",
      "text_excerpt": "Roméo aperçoit Juliette au bal",
      "justification": "Premier contact entre les deux protagonistes principaux, déclencheur de l'intrigue amoureuse"
    }},
    ...
  ],
  "main_actants_v1": {{
    "_focus": "agent_actif",
    "_description": "Configuration où le Sujet est l'agent qui pose et conduit l'action principale (souvent un antagoniste actif dans les fables)",
    "protagoniste": "L'agent qui conduit l'action (peut être un antagoniste prédateur, un héros conquérant, etc.)",
    "objet": "Ce que cet agent cherche à obtenir / accomplir",
    "destinateur": "Force qui motive cet agent",
    "destinataire": "Bénéficiaire de l'action de cet agent",
    "adjuvant": "Forces qui aident cet agent",
    "opposant": "Forces qui résistent à cet agent"
  }},
  "main_actants_v2": {{
    "_focus": "patient_central",
    "_description": "Configuration alternative où le Sujet est celui qui subit l'action principale ou qui en est l'enjeu central (souvent une victime ou un récepteur)",
    "protagoniste": "Le personnage central qui subit ou autour duquel tout converge",
    "objet": "Ce que ce personnage cherche (souvent : survie, justice, vérité, libération)",
    "destinateur": "Force qui pousse ce personnage à agir ou à subir",
    "destinataire": "Pour qui / pour quoi ce personnage agit ou souffre",
    "adjuvant": "Aides éventuelles de ce personnage",
    "opposant": "Forces qui agissent contre lui (souvent l'agent actif de v1)"
  }},
  "thematic_keywords": ["amour", "haine", "réconciliation", ...]
}}
```

**Sur les deux schémas actantiels** : tu fournis SYSTÉMATIQUEMENT les deux configurations v1 et v2, même si l'une te paraît plus naturelle que l'autre. C'est le système NARR'IA qui choisira la combinaison la plus cohérente lors d'une comparaison entre deux œuvres. Si l'œuvre n'a vraiment qu'un seul actant central possible (par exemple un monologue introspectif), tu peux dupliquer la même configuration dans v1 et v2.

Règles importantes :
- **Granularité d'extraction (consigne précise)**. Le nombre de nœuds que tu identifies doit être indexé sur la LONGUEUR du texte, et non sur une « complexité » que tu apprécierais librement. La règle est :
  • Calcule d'abord, en interne, le nombre approximatif de mots du texte fourni.
  • Vise UN nœud par tranche d'environ 400 mots.
  • Applique un plancher de 5 nœuds (en deçà, le récit perd sa structure analysable) et un plafond de 35 nœuds (au-delà, le graphe devient inexploitable pour la comparaison).
  • Une tolérance de plus ou moins 15 % autour de la cible est admise pour les récits réellement denses ou réellement étalés — pas davantage.
  Cette règle prévaut sur ton appréciation subjective : deux récits de longueurs voisines doivent produire des graphes de tailles voisines, indépendamment de l'impression de richesse narrative que t'en donne la lecture.
- **Découpage régulier et reproductible**. Tu privilégies un découpage en événements cardinaux RÉGULIÈREMENT espacés dans le texte, plutôt qu'un découpage concentré sur les passages qui te paraissent saillants. Une seconde analyse du même texte doit pouvoir produire un découpage équivalent au tien : évite donc tout choix idiosyncratique de granularité, et préfère, à scènes ou chapitres équivalents, un nombre équivalent de nœuds.
- Utilise les codes exacts du répertoire NARR'IA (F01-F56 et FN...)

# RESTRICTION CULTURELLE STRICTE pour les fonctions africaines (FN*)

Les sept fonctions FNAL, FNANC, FNBENI, FNCOMM, FNGR, FNMALA, FNPROV sont 
des catégories culturellement situées. Elles désignent des dispositifs 
narratifs propres aux traditions africaines, afro-caribéennes et 
afrodescendantes.

Avant d'attribuer une fonction FN* à un nœud, tu DOIS d'abord déterminer 
la tradition narrative de l'œuvre. Si l'œuvre relève d'une tradition non 
afrodescendante (européenne, asiatique, américaine non afro, etc.), tu 
n'attribues JAMAIS de fonction FN*, même si un élément textuel ressemble 
formellement à un dispositif africain.

Cas typique de faux positif à éviter : la moralité finale d'une fable de 
La Fontaine n'est PAS un FNPROV (Proverbe narratif africain) mais une 
F49 (Sentence morale, fonction occidentale). Une bénédiction parentale 
dans un roman bourgeois européen n'est PAS un FNBENI mais une F44 
(Pardon) ou une F11 (Don/Réception) selon le contexte.

En cas de doute sur la tradition narrative, demande-toi : « cette œuvre 
s'inscrit-elle explicitement dans un héritage narratif africain 
identifiable (auteur africain ou afrodescendant, œuvre référençant des 
cosmogonies, des langues, des dispositifs culturels africains) ? » 
Si la réponse n'est pas un oui clair, écarte les fonctions FN*.

Tu indiques explicitement dans le champ "tradition" si l'œuvre est 
considérée comme afrodescendante (valeur exacte commençant par 
"Africaine" ou "Afro-") ou non.

# Autres règles importantes

- La justification doit citer un segment du texte original, pas inventer
- Si le texte est trop court pour identifier certaines fonctions, n'invente pas — indique un nombre moindre de nœuds
- Réponds UNIQUEMENT avec le JSON, sans préambule ni explication autour"""
    
    def _parse_analysis_response(self, response_text: str) -> Dict[str, Any]:
        """Parse la réponse JSON de Claude."""
        # Strip markdown code fences if present
        text = response_text.strip()
        
        # Match ```json ... ``` or just the JSON
        match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
        if match:
            text = match.group(1)
        elif text.startswith('```'):
            # Remove code fence without language tag
            text = re.sub(r'^```[a-z]*\n?', '', text)
            text = re.sub(r'\n?```$', '', text)
        
        # Try to find the first { and last } to extract the JSON object
        start = text.find('{')
        end = text.rfind('}')
        if start >= 0 and end > start:
            text = text[start:end + 1]
        
        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            # Return a graceful error structure
            return {
                'error': f'Erreur de parsing de la réponse : {str(e)}',
                'raw_response': response_text[:500],
                'nodes': [],
                'main_actants': {},
                'summary': 'Analyse indisponible (erreur de format)',
            }
        
        # Compatibilité ascendante : si Claude a fourni main_actants_v1 et v2,
        # utiliser v1 comme main_actants principal pour le reste du système
        if 'main_actants_v1' in data and 'main_actants' not in data:
            data['main_actants'] = data['main_actants_v1']
        # Compatibilité descendante : si Claude a fourni seulement main_actants
        # (ancien format), créer v1 et v2 identiques
        elif 'main_actants' in data and 'main_actants_v1' not in data:
            data['main_actants_v1'] = data['main_actants']
            data['main_actants_v2'] = data['main_actants']
        
        # Filet de sécurité : appliquer la restriction culturelle des fonctions FN*
        data = self._enforce_cultural_restriction(data)
        return data
    
    # Mapping des fonctions africaines vers leurs équivalents occidentaux
    # quand attribuées à tort à une œuvre non afrodescendante
    AFRICAN_TO_WESTERN_FALLBACK = {
        'FNPROV': ('F49', 'Sentence morale'),     # Proverbe → Moralité finale
        'FNBENI': ('F11', 'Don / Réception'),     # Bénédiction → Don
        'FNMALA': ('F47', 'Punition'),            # Malédiction → Punition
        'FNANC':  ('F31', 'Révélation'),          # Ancêtre-arbitre → Révélation
        'FNGR':   ('F32', 'Dissimulation'),       # Griot-narrateur → voix narrative classique
        'FNAL':   ('F51', 'Union'),               # Alliance matrimoniale → Union
        'FNCOMM': ('F49', 'Sentence morale'),     # Interpellation communautaire → Moralité
    }
    
    def _enforce_cultural_restriction(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Filet de sécurité : retire les fonctions FN* attribuées à tort à des
        œuvres non afrodescendantes, et les remplace par leur équivalent
        occidental le plus proche.
        
        Cette vérification complète la règle stricte du prompt système, au cas
        où le LLM oublie ou ignore la consigne.
        """
        tradition = (data.get('tradition') or '').strip().lower()
        
        # Identifier si l'œuvre est afrodescendante
        is_afro = (
            tradition.startswith('africain') or
            tradition.startswith('afro') or
            'afrique' in tradition or
            'caribéen' in tradition or
            'afrodescendant' in tradition
        )
        
        if is_afro:
            # Œuvre africaine : aucune correction nécessaire
            return data
        
        # Œuvre non africaine : retirer toute fonction FN* trouvée
        nodes = data.get('nodes', [])
        corrections_log = []
        
        for node in nodes:
            code = node.get('function_code', '')
            if code.startswith('FN'):
                fallback = self.AFRICAN_TO_WESTERN_FALLBACK.get(
                    code, ('F49', 'Sentence morale')
                )
                old_code = code
                node['function_code'] = fallback[0]
                node['function_name'] = fallback[1]
                # Mémoriser la correction pour la transparence
                node['_cultural_correction'] = (
                    f"Fonction {old_code} (africaine) recodée en {fallback[0]} "
                    f"car la tradition '{data.get('tradition', '?')}' n'est pas afrodescendante"
                )
                corrections_log.append((old_code, fallback[0]))
        
        if corrections_log:
            # Ajouter une note dans l'analyse pour transparence
            note = data.get('cultural_corrections_note', '')
            note += (
                f" [Filet de sécurité culturelle : {len(corrections_log)} fonction(s) "
                f"africaine(s) recodée(s) en équivalent occidental car la tradition "
                f"détectée n'est pas afrodescendante.]"
            )
            data['cultural_corrections_note'] = note.strip()
        
        return data
    
    def estimate_cost(self, text: str) -> Dict[str, Any]:
        """
        Estime le coût d'analyse d'un texte avant de lancer l'appel.
        Utile pour informer l'utilisateur.
        """
        # Rough token estimation
        n_chars = len(text)
        estimated_input_tokens = n_chars // CHARS_PER_TOKEN_APPROX + 2000  # +prompt overhead
        estimated_output_tokens = min(16000, max(2000, n_chars // 20))  # scales with input
        
        estimated_cost = (
            estimated_input_tokens * PRICE_INPUT_PER_MTOK +
            estimated_output_tokens * PRICE_OUTPUT_PER_MTOK
        ) / 1_000_000
        
        return {
            'estimated_input_tokens': estimated_input_tokens,
            'estimated_output_tokens': estimated_output_tokens,
            'estimated_cost_usd': round(estimated_cost, 4),
            'estimated_cost_eur': round(estimated_cost * 0.93, 4),  # Rate ~Apr 2026
            'model': self.model,
        }


# ═══════════════════════════════════════════════════════════════════
# SYSTEM PROMPT (préserve le système NARR'IA dans chaque analyse)
# ═══════════════════════════════════════════════════════════════════

SYSTEM_PROMPT_NARRATOLOGY = """Tu es un expert en narratologie structurale et computationnelle. Tu analyses des textes narratifs selon le cadre théorique du système NARR'IA développé par Adéchinan David Adékambi (Université de Kindia, République de Guinée).

# Cadre théorique

Le système NARR'IA combine trois traditions narratologiques :
1. La morphologie proppienne (fonctions des personnages)
2. Le schéma actantiel greimassien (Sujet, Objet, Destinateur, Destinataire, Adjuvant, Opposant)
3. La théorie des possibles narratifs de Claude Bremond (bifurcations, séquences)

Il y ajoute des apports originaux :
- Sept fonctions narratives spécifiques aux traditions africaines
- Le concept de « vol d'intrigue » (reprise non déclarée de structure narrative profonde)
- Une modélisation tensive de la courbe dramatique

# Répertoire des 53 fonctions narratives NARR'IA

## Famille 1 — Rupture initiale
- F01 Départ / F02 Désir / Quête / F03 Manque / F04 Interdiction / F05 Transgression
- F06 Exil initial / F07 Mandat

## Famille 2 — Quête et cheminement
- F10 Rencontre / F11 Don / Réception / F12 Entrée dans l'épreuve
- F13 Cheminement / F14 Reconnaissance du mentor
- F15 Épreuve qualifiante / F16 Obtention du moyen

## Famille 3 — Obstacles et conflits
- F20 Combat / F21 Trahison / F22 Menace / F23 Meurtre
- F24 Blessure / F25 Enlèvement / F26 Duel
- F27 Poursuite / F28 Épreuve principale

## Famille 4 — Pivot et reconnaissance
- F30 Reconnaissance / F31 Révélation / F32 Dissimulation
- F33 Métamorphose / F34 Renversement / F35 Anagnorisis

## Famille 5 — Résolution
- F40 Libération / F41 Triomphe / F42 Échec / F43 Mort
- F44 Pardon / F45 Vengeance / F46 Rédemption
- F47 Punition / F48 Récompense / F49 Sentence morale (moralité finale, leçon explicite)

## Famille 6 — Liaisons et relations
- F50 Amour / F51 Union / F52 Rejet / F53 Séparation
- F54 Retour / F55 Héritage / F56 Filiation

## Famille 7 — Fonctions africaines (apport NARR'IA)
- FNAL Alliance matrimoniale / clanique
- FNANC Ancêtre-arbitre (rêve, vision, oracle qui tranche un conflit)
- FNBENI Bénédiction (transmission rituelle de force par un aîné)
- FNCOMM Interpellation communautaire (voix narrative s'adressant à la communauté)
- FNGR Griot-narrateur (figure qui commente l'action)
- FNMALA Malédiction (symétrique inverse de FNBENI)
- FNPROV Proverbe narratif (sentence qui commente ou préfigure)

# Ton rôle

Tu dois analyser le récit fourni par l'utilisateur et produire un graphe narratif structuré (NarRep-Graph) au format JSON strict, sans préambule ni commentaire autour. Tu identifies les fonctions cardinales, les configurations actantielles, les transformations modales et la signature tensive. Tu justifies chaque identification par un extrait textuel.

Règles de rigueur :
- N'invente jamais d'extrait textuel — cite toujours le texte réel
- Si une fonction peut être interprétée de plusieurs manières, privilégie la plus conservatrice
- Pour les récits africains francophones, sois attentif aux fonctions FN* qui capturent des dimensions invisibles aux grilles occidentales
- Si le texte ne contient pas de trame narrative claire (description, essai, dialogue non narratif), indique-le dans summary et retourne peu ou pas de nœuds
- Reste fidèle à la succession chronologique du sjuzet (ordre de présentation dans le texte), pas à la fabula reconstituée"""
