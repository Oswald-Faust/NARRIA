# NARR'IA — Narratologie computationnelle du plagiat d'intrigue

Version 1.0.0 · Adéchinan David Adékambi · Université de Kindia, 2025

---

## Qu'est-ce que NARR'IA ?

**NARR'IA** est un logiciel d'analyse narratologique qui détecte, quantifie et qualifie le **vol d'intrigue** — c'est-à-dire la reprise non déclarée et substantiellement identique de la **structure narrative profonde** d'une œuvre antérieure.

Contrairement aux outils de détection de plagiat textuel (qui comparent des mots), NARR'IA compare des **structures** : l'enchaînement des fonctions narratives, les configurations actantielles, les trajectoires modales et la signature tensive de chaque œuvre.

Le système s'appuie sur les théorisations exposées dans :

> Adékambi, A. D. (2025). *NARR'IA — Vers une narratologie computationnelle du plagiat d'intrigue*. Paris : L'Harmattan.

## Lancer l'application — en 30 secondes

### Sur Linux ou macOS

Ouvrez un terminal dans le dossier `narria-app`, puis :

```bash
chmod +x NARRIA.sh
./NARRIA.sh
```

### Sur Windows

Double-cliquez sur **`NARRIA.bat`** dans le dossier `narria-app`.

---

Le script gère automatiquement :
- la création d'un environnement virtuel Python (dossier caché `.venv/`),
- l'installation de Flask (seule dépendance requise),
- le démarrage du serveur local,
- l'ouverture de l'interface dans votre navigateur par défaut.

Au premier lancement, comptez une minute (installation des dépendances). Les lancements suivants seront instantanés.

## Que voit l'utilisateur ?

Votre navigateur s'ouvre sur une interface avec cinq onglets :

| Onglet | Fonction |
|--------|----------|
| **Accueil** | Présentation du système et accès rapide aux fonctionnalités |
| **Analyser un texte** | Décompose un texte en graphe narratif (fonctions, actants, tension) |
| **Comparer deux textes** | Produit les scores SNS, SS, ST, SRJ entre deux œuvres |
| **Répertoire des fonctions** | Consultation des 53 fonctions narratives en 7 familles |
| **À propos** | Documentation et licence |

Trois textes-échantillons sont fournis pour démonstration immédiate :
- *Roméo et Juliette* (synopsis romancé d'après Shakespeare)
- *Les Amants de Conakry* (fiction originale illustrant une transposition africaine)
- *Saison des pluies* (fiction originale de structure narrative différente)

## Pré-requis techniques

- **Python 3.10 ou supérieur** ([téléchargement](https://www.python.org/downloads/))
- **Un navigateur web** (Chrome, Firefox, Safari, Edge — tous récents)
- **Une connexion Internet** uniquement pour la première installation de Flask (ensuite, tout est local)

## Téléverser des fichiers

Au lieu de copier-coller le texte manuellement, vous pouvez **téléverser directement un fichier** — solution indispensable pour les romans ou ouvrages longs. Dans les onglets « Analyser un texte » et « Comparer deux textes », une zone de téléversement est désormais présente à côté de chaque champ de texte.

**Formats supportés :**
- `.txt` — texte brut (UTF-8 ou Latin-1)
- `.docx` — Microsoft Word
- `.pdf` — Adobe PDF (avec couche texte — les PDFs scannés ne sont pas pris en charge)
- `.odt` — OpenDocument Text (LibreOffice)
- `.epub` — livres numériques (EPUB 2 et EPUB 3)

**Comment l'utiliser :**
- **Glissez-déposez** le fichier directement sur la zone prévue
- Ou cliquez sur « parcourir » pour le sélectionner dans le navigateur de fichiers
- Taille maximale : 300 Mo

**Ce qui se passe ensuite :**
- Le texte est extrait et placé automatiquement dans le champ d'analyse
- Le titre et l'auteur sont pré-remplis s'ils figurent dans les métadonnées du fichier
- Un encadré vous indique le nombre de mots extraits et d'éventuels avertissements (PDF détecté comme scan, texte trop court, etc.)
- Vous pouvez encore modifier le texte avant de lancer l'analyse
- Un bouton « effacer » permet de retirer le fichier importé si vous changez d'avis

**Cas particuliers :**
- Pour les **PDFs scannés** (images sans couche texte), NARR'IA vous prévient mais ne fait pas d'OCR. Utilisez un outil externe (Tesseract, Adobe Acrobat Pro, etc.) pour OCR-iser d'abord, puis téléversez le résultat.
- Pour les **ouvrages avec notes de bas de page abondantes**, les notes seront intégrées dans le texte analysé. Pour une analyse narratologique pure, c'est généralement sans conséquence majeure, mais gardez-le en tête pour les cas limites.
- Les **headers/footers récurrents** des PDFs (comme « *Titre du livre* · page 12 ») sont automatiquement détectés et retirés par une heuristique de répétition.



NARR'IA fonctionne en deux modes :

- **Mode local** (par défaut) : tout le traitement est effectué sur votre machine, aucune donnée n'est envoyée sur Internet. Utilise des heuristiques par mots-clés — rapide et gratuit, mais l'analyse est limitée aux textes qui utilisent les verbes narratifs reconnus par le système.

- **Mode LLM** (optionnel) : les textes sont analysés par Claude (Anthropic) pour une identification beaucoup plus précise des fonctions narratives, des actants et des modalités, avec justifications textuelles. Nécessite une clé API personnelle et une connexion Internet. Chaque analyse consomme des tokens facturés à votre compte Anthropic.

Les graphes narratifs sont toujours stockés localement dans `~/.narria/graphs/`, quel que soit le mode.

## Activer le mode LLM (analyse profonde par Claude)

Le mode LLM offre une analyse narratologique d'une toute autre qualité que le mode local. Il reconnaît les fonctions narratives indépendamment du lexique employé, identifie correctement les actants et leurs rôles greimassiens, et fournit une justification textuelle pour chaque identification.

**Pour obtenir une clé API Anthropic :**

1. Créez un compte gratuit sur [console.anthropic.com](https://console.anthropic.com)
2. À la création du compte, Anthropic offre un crédit gratuit d'environ 5 USD (suffisant pour analyser une vingtaine de textes courts)
3. Dans la console, allez dans « API Keys » et créez une nouvelle clé. La clé commence par `sk-ant-`
4. Copiez cette clé (elle ne sera affichée qu'une seule fois)

**Pour configurer la clé dans NARR'IA :**

1. Lancez l'application (`./NARRIA.sh` ou `NARRIA.bat`)
2. Dans l'interface, cliquez sur l'onglet « ⚙ Configuration »
3. Collez votre clé dans le champ prévu
4. Cliquez sur « Enregistrer la clé », puis « Tester la connexion »
5. L'indicateur en haut à droite doit passer au vert et afficher « Claude (claude-sonnet-4-5) »

La clé est stockée dans `~/.narria/config.json` avec des permissions restrictives (lecture/écriture par l'utilisateur uniquement sur Unix).

**Coûts indicatifs :**
- Claude Sonnet 4.5 : 3 USD / million de tokens d'entrée, 15 USD / million de tokens de sortie
- Analyse d'un roman de 80 000 mots : environ 0,50 USD
- Comparaison de deux romans : environ 1 USD (deux analyses)
- L'application affiche l'estimation de coût avant chaque analyse et demande confirmation

## Arrêter l'application

Dans la fenêtre du terminal (Linux/macOS) ou Invite de commandes (Windows) où le serveur tourne, appuyez sur `Ctrl+C`.

## Architecture technique

NARR'IA s'articule en cinq modules interdépendants :

| Module | Rôle |
|--------|------|
| **M1 — Segmentation** | Découpage du texte en unités narratives |
| **M2 — Extraction** | Construction du graphe narratif (NarRep-Graph) |
| **M3 — Comparaison** | Calcul des scores SNS, SS, ST, SRJ |
| **M4 — Base de données** | Stockage local des graphes analysés |
| **M5 — Rapports** | Génération de rapports HTML avec garde-fous éthiques |

## Avertissement scientifique et éthique

NARR'IA produit des **estimations probabilistes** de similarité structurale, non des verdicts définitifs de plagiat. Ses résultats doivent être interprétés par un expert humain (narratologue, juriste) et ne peuvent en aucun cas constituer à eux seuls une preuve de plagiat. Toute utilisation des sorties de NARR'IA pour formuler une accusation publique exige une investigation complémentaire et, le cas échéant, un avis juridique.

## En cas de problème

### « Python n'est pas installé »

Téléchargez-le depuis [python.org](https://www.python.org/downloads/). Sur Windows, cochez impérativement **« Add Python to PATH »** pendant l'installation. Sur Ubuntu/Debian : `sudo apt install python3 python3-pip python3-venv`.

### Le navigateur ne s'ouvre pas tout seul

Ouvrez votre navigateur et rendez-vous à l'adresse **http://127.0.0.1:5000**

### « Port 5000 déjà utilisé »

Un autre programme utilise ce port. Fermez-le, ou lancez NARR'IA sur un autre port :
- Linux/macOS : `NARRIA_PORT=5001 ./NARRIA.sh`
- Windows : ouvrez une Invite de commandes dans le dossier, puis `set NARRIA_PORT=5001 && NARRIA.bat`

### Tests automatiques

Pour vérifier que tout fonctionne :

```bash
cd narria-app
python3 tests/test_core.py
```

## Licence

MIT License — © 2025 Adéchinan David Adékambi, Université de Kindia, République de Guinée.

## Contact

- **Institution :** Département de Lettres Modernes, Université de Kindia
- **Éditeur académique :** L'Harmattan (Paris)
- **Ouvrage de référence :** *NARR'IA — Vers une narratologie computationnelle du plagiat d'intrigue* (manuscrit en cours de finalisation, à paraître)

## Historique des analyses

NARR'IA conserve désormais un **historique complet** de toutes les analyses et comparaisons que vous réalisez. Accessible via l'onglet « 📚 Historique », il vous permet de :

- Consulter toutes vos analyses passées avec leurs métadonnées (date, mode, coût LLM)
- Télécharger chaque analyse en quatre formats : **HTML** (rapport visuel), **Markdown** (édition), **TXT** (plat), **JSON** (machine)
- Exporter vos comparaisons avec leurs scores complets
- Voir des statistiques globales (analyses LLM vs locales, coût total cumulé)
- Supprimer sélectivement ou effacer tout l'historique

Les données sont stockées dans `~/.narria/` sur votre machine. Aucune donnée ne quitte votre ordinateur (sauf en mode LLM, où les textes transitent par les serveurs Anthropic le temps de l'analyse).

## Capacité de téléversement

Limite désormais portée à **300 Mo par fichier**, ce qui couvre les œuvres très volumineuses (sagas complètes, ouvrages collectifs, corpus assemblés en un seul document).

## Analyse des textes très longs

Pour les œuvres dépassant la fenêtre de contexte de Claude (au-delà d'environ 130 000 mots), NARR'IA applique automatiquement un **découpage avec recouvrement narratif** :

1. Le texte est divisé en blocs de ~75 000 mots, avec un chevauchement de ~4 500 mots entre blocs consécutifs
2. Chaque bloc est analysé séparément par Claude
3. Les graphes partiels sont fusionnés en un graphe global cohérent : déduplication des nœuds présents dans les zones de recouvrement, harmonisation des actants principaux, concaténation des résumés par partie

L'application **détecte automatiquement** quand un texte dépasse la limite et **demande confirmation** avant de lancer le découpage, en affichant : le nombre de blocs prévus, le coût total cumulé, la durée estimée, et les limites méthodologiques de la fusion (légères incohérences possibles aux jointures).

Pour vous donner une idée des volumes : un roman fleuve de 200 000 mots sera typiquement analysé en 3 blocs pour un coût total d'environ 1,50 USD ; une saga de 500 000 mots demandera 7-8 blocs pour environ 4 USD.

## Déploiement en site web professionnel

Si vous souhaitez héberger NARR'IA sur une URL publique (`https://narria.votre-domaine.org`) plutôt que de le lancer localement, consultez le fichier `DEPLOYMENT.md` joint dans le ZIP. Ce guide détaille les options techniques, les coûts, les implications juridiques, et propose plusieurs voies (hébergement universitaire interne, hébergement cloud, etc.).

## Nouveautés v1.6

**Export PDF des rapports.** Chaque analyse et chaque comparaison peuvent désormais être téléchargées au format **PDF**, en plus des formats HTML, Markdown, TXT et JSON. Le PDF reprend la charte typographique de NARR'IA (titres bleu accent, filets gold, encadrés métadonnées) et est prêt à être joint à un email, imprimé, ou archivé.

**Schéma actantiel visuel.** Les analyses en mode LLM affichent désormais un véritable **schéma greimassien dessiné en SVG** : les six positions actantielles (Sujet, Objet, Destinateur, Destinataire, Adjuvant, Opposant) sont positionnées dans le dispositif matriciel classique, avec les trois axes (désir, communication, pouvoir) clairement matérialisés et colorés selon leur fonction.

**Raccourcis de bureau.** Trois scripts d'installation (`Installer_raccourci_macOS.command`, `Installer_raccourci_Windows.bat`, `Installer_raccourci_Linux.sh`) sont fournis dans l'archive. Double-cliquez celui correspondant à votre système d'exploitation pour installer un **raccourci NARR'IA sur votre Bureau**. Vous pourrez ensuite lancer l'application en double-cliquant simplement l'icône, sans plus jamais ouvrir de terminal.

## Nouveautés v1.7

- **Raccourci Windows robuste** : nouvel installeur avec triple fallback (VBScript natif → PowerShell → raccourci Internet) compatible avec les configurations Windows 11 Pro qui restreignent PowerShell
- **Téléchargement PDF avec progression** : indicateur visuel pendant la génération, message d'erreur clair si la conversion échoue, plus de blocage silencieux du navigateur
- **Schéma actantiel dans les PDFs** : le diagramme greimassien est désormais inclus dans le rapport PDF des analyses LLM
- **Justification du texte** : les paragraphes de prose sont justifiés (alignés à gauche ET à droite) pour une esthétique typographique académique
- **Mentions de version dynamiques** : tous les rapports affichent maintenant la version réelle du système (plus de mention obsolète v1.0.0) ; année 2026 partout

## Nouveautés v1.8

- **Raccourci Windows v3** : nouvel installeur avec **vérification de l'existence réelle du fichier après création** (corrige le bug où le script disait "succès" sans que le raccourci apparaisse). Détection multi-méthodes du Bureau via le registre Windows. Quatre méthodes de fallback successives. **Génère un fichier `Installer_diagnostic.log`** que vous pouvez consulter ou me partager si l'installation échoue.
- **Génération PDF robuste** : protection timeout de 30 secondes par tentative + fallback automatique sur version sans SVG si la première tentative échoue. Logs `[NARR'IA]` détaillés dans la console pour diagnostic. Serveur Flask multi-thread pour ne plus bloquer la file d'attente.

## Nouveautés v1.9

- **Logo NARR'IA professionnel** : un logo SVG vectoriel propre au système, intégrant la lettre N stylisée, un triangle actantiel discret en arrière-plan et trois nœuds narratifs sur la diagonale (clin d'œil au modèle greimassien et aux graphes narratifs). Affiché dans le header de la plateforme, en favicon de l'onglet navigateur, en icône du raccourci de bureau Windows, et dans tous les rapports HTML/PDF générés.
- **Génération PDF blindée** : timeout client/serveur double, sanitization Unicode, AbortController, toast qui disparaît systématiquement même en cas d'erreur. Plus de tournage indéfini. Si la conversion échoue, message d'erreur clair et explicite proposant de basculer sur le format HTML.

## Nouveautés v1.9.5 — Corrections scientifiques

Cette version corrige trois faiblesses identifiées lors du test Ésope / La Fontaine :

**Restriction culturelle stricte des fonctions africaines (FN\*).** Les sept fonctions FNAL, FNANC, FNBENI, FNCOMM, FNGR, FNMALA, FNPROV sont désormais réservées exclusivement aux œuvres relevant de traditions narratives afrodescendantes. Le prompt LLM impose cette règle, et un filet de sécurité Python recode automatiquement toute fonction FN* attribuée à tort à une œuvre non africaine vers son équivalent occidental le plus proche (FNPROV → F49, FNBENI → F11, etc.). La nouvelle fonction **F49 « Sentence morale »** comble le vide laissé par cette restriction pour les moralités classiques (fables de La Fontaine, etc.).

**Schéma actantiel à double extraction.** Le LLM extrait désormais deux configurations greimassiennes par œuvre : v1 (focus agent_actif) et v2 (focus patient_central). Lors d'une comparaison, le système teste les quatre combinaisons possibles et retient celle qui maximise la cohérence inter-œuvres. Sur Ésope/La Fontaine, ce mécanisme aurait fait passer le S_ACT de 0,000 (asymétrie Loup vs Agneau) à 0,472 (combinaison Loup↔Loup retenue automatiquement).

**Score de Transformation refondu.** L'ancien ST = 1 - s_iso, qui retournait 0 sur tout cas d'isomorphisme parfait, est remplacé par une mesure composite à cinq dimensions pondérées équitablement : ST_struct (transformations structurelles), ST_form (forme et longueur), ST_register (registre stylistique), ST_focus (focalisation actantielle) et ST_moral (couche morale et voix narrative). Sur Ésope/La Fontaine, le ST passe de 0,000 à 0,445, reflétant fidèlement la nature de la transposition : structure conservée mais transformations formelles substantielles. Le LLM extrait désormais les `formal_features` nécessaires à ce calcul.

## Nouveautés v1.9.6 — Robustesse de l'extraction

Diagnostic empirique sur les JSON de v1.9.5 a révélé que Claude omettait souvent les nouveaux champs `formal_features`, `main_actants_v1` et `main_actants_v2` malgré le prompt. La v1.9.6 ajoute deux corrections :

**Directive impérative en tête du prompt JSON** : un encadré ⚠️ liste explicitement les trois champs nouveaux comme OBLIGATOIRES, avec une consigne claire de ne jamais les laisser vides.

**Mécanisme de réinjection (filet de sécurité)** : après l'extraction principale, le code vérifie la présence des champs critiques. Si l'un d'eux manque, un **second appel ciblé** au LLM récupère uniquement ces champs manquants, en lui donnant le contexte de l'œuvre et un extrait du texte. Ce second appel coûte environ 0,005-0,01 USD additionnels mais garantit la complétude de l'extraction. Le coût total est ajouté au compteur d'usage.

Sur le cas Ésope/La Fontaine, cette correction devrait faire passer le ST de 0,245 (où il est tombé faute de `formal_features`) à environ 0,545, qui reflète correctement la nature de la transposition (structure conservée mais transformations formelles substantielles).

## Version 1.9.7 — Stabilisation

Cette version stabilise NARR'IA après les itérations 1.9.4–1.9.6 :

- Le mécanisme de réinjection LLM de la v1.9.6, qui ne se déclenchait pas dans les conditions réelles, est retiré.
- La directive ⚠️ en tête du prompt JSON, qui n'a pas modifié le comportement du LLM, est retirée.
- Sont conservés tous les acquis empiriquement validés de la v1.9.5 : la restriction culturelle stricte des fonctions FN*, l'ajout de F49 « Sentence morale », le filet de sécurité Python recodant FNPROV en F49, le double schéma actantiel v1/v2 avec sélection optimale, et le ST composite à 5 dimensions.
- Une **note méthodologique** est ajoutée dans chaque rapport de comparaison. Elle distingue les indicateurs primaires (SNS, S_ISO, S_TENS, verdict modal) des sous-scores secondaires (S_ACT, ST) qui restent en cours de calibration empirique. Cette transparence permet une lecture juste des résultats, en privilégiant l'expertise humaine pour interpréter les sous-scores variables.
- Les limites algorithmiques connues du S_ACT et du ST sont documentées dans le code source du comparator pour traçabilité et travaux futurs.

Cette version est destinée à être stable sur la durée. Une calibration empirique sur un corpus de 8–12 cas tests documentés (transpositions assumées, plagiats avérés, convergences indépendantes) constituerait l'étape naturelle suivante pour affiner les pondérations et seuils des sous-scores secondaires.

## Version 2.0.0 — Mise en ligne

Cette version majeure transforme NARR'IA en une application web déployable sur un serveur de production. Les améliorations clés :

**Architecture serveur** : code adapté pour le déploiement WSGI (Gunicorn), variables d'environnement pour la configuration (clé API Anthropic, répertoire de stockage, secret de session), endpoint de santé `/api/health` pour le monitoring, désactivation automatique du mode développement en production.

**Module d'authentification** : nouveau module `narria/auth/` avec gestion des comptes utilisateurs (hash PBKDF2-SHA256 avec 600 000 itérations selon les recommandations OWASP 2023), inscription par e-mail, sessions sécurisées, page de connexion et d'inscription au design cohérent.

**Système de quotas** : quotas configurables par utilisateur (5 analyses par jour, 50 par mois par défaut), vérification systématique avant chaque action consommatrice de LLM, journalisation détaillée de l'usage avec coût en USD et nombre de tokens.

**Console d'administration** : tableau de bord à `/admin` permettant à l'administrateur de visualiser tous les testeurs, leur consommation 24h et 30j, le coût mensuel total, et d'ajuster les quotas individuels ou de désactiver des comptes.

**Documentation de déploiement** : guide pas-à-pas dans `DEPLOYMENT_RENDER.md` couvrant la configuration GitHub, le service web Render, le volume persistant, les variables d'environnement, le DNS Cloudflare, et les étapes post-déploiement.

L'authentification est activée uniquement quand `NARRIA_AUTH_ENABLED=true`. En usage local, NARR'IA continue de fonctionner sans authentification, comme avant.
