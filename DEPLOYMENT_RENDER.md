# NARR'IA — Guide de déploiement sur Render

Ce guide vous accompagne pas à pas dans la mise en ligne de NARR'IA sur Render,
avec connexion au domaine narria.tech via Cloudflare. Le déploiement complet
prend environ **1 à 2 heures** la première fois.

---

## Prérequis

Avant de commencer, vérifiez que vous disposez de :

- Un compte **Render** créé sur https://render.com (gratuit pour démarrer)
- Un compte **GitHub** (gratuit) pour héberger le code source de NARR'IA
- Votre domaine **narria.tech** déjà acquis chez Cloudflare (✓ déjà fait)
- Une **clé API Anthropic** valide (commence par `sk-ant-`) avec un plafond de 100 USD/mois configuré
- L'outil **Git** installé sur votre ordinateur (pour pousser le code vers GitHub)

---

## Étape 1 — Mettre le code source de NARR'IA sur GitHub

Render déploie depuis un dépôt Git, donc nous allons d'abord publier NARR'IA
sur GitHub (en privé, le code n'est pas exposé publiquement).

### 1.1 — Créer un dépôt privé sur GitHub

1. Connectez-vous à https://github.com
2. Cliquez sur **+** en haut à droite, puis **New repository**
3. Nom du dépôt : `narria` (ou ce que vous voulez)
4. Description : "NARR'IA — Narratologie computationnelle du plagiat d'intrigue"
5. Cochez **Private** (important : garde votre code confidentiel)
6. Ne cochez aucune option d'initialisation
7. Cliquez sur **Create repository**

GitHub vous affiche les commandes à exécuter. Notez l'URL du dépôt
(par exemple `https://github.com/votre-pseudo/narria.git`).

### 1.2 — Pousser le code de NARR'IA sur GitHub

Depuis le dossier de NARR'IA sur votre ordinateur, ouvrez un terminal :

```bash
# Initialiser Git
git init
git add .
git commit -m "Version initiale 2.0.0 — production-ready"

# Lier au dépôt GitHub
git branch -M main
git remote add origin https://github.com/VOTRE-PSEUDO/narria.git

# Pousser
git push -u origin main
```

GitHub vous demandera vos identifiants. Si vous avez activé l'authentification
à deux facteurs, utilisez un **Personal Access Token** au lieu de votre mot
de passe (à créer dans Settings → Developer settings → Personal access tokens).

---

## Étape 2 — Créer le service web sur Render

### 2.1 — Connecter GitHub à Render

1. Connectez-vous à https://dashboard.render.com
2. Cliquez sur **New +** → **Web Service**
3. Cliquez sur **Connect a repository**
4. Autorisez Render à accéder à votre compte GitHub
5. Sélectionnez le dépôt **narria**
6. Cliquez sur **Connect**

### 2.2 — Configurer le service

Render vous propose un formulaire de configuration. Renseignez :

| Champ | Valeur |
|---|---|
| **Name** | `narria` |
| **Region** | Frankfurt (proche de l'Afrique de l'Ouest et de l'Europe) |
| **Branch** | `main` |
| **Root Directory** | (laisser vide) |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `gunicorn narria.app:app --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 300` |
| **Instance Type** | **Starter** ($7/mois, suffisant pour 15-20 testeurs) |

### 2.3 — Configurer les variables d'environnement

Dans la section **Environment Variables** du formulaire, ajoutez :

| Variable | Valeur |
|---|---|
| `ANTHROPIC_API_KEY` | Votre clé API (commence par `sk-ant-...`) |
| `SECRET_KEY` | Une longue chaîne aléatoire (générez-en une avec `openssl rand -hex 32` ou utilisez https://generate-secret.vercel.app/64) |
| `NARRIA_AUTH_ENABLED` | `true` |
| `NARRIA_DATA_DIR` | `/data` |
| `NARRIA_ENV` | `production` |
| `PYTHON_VERSION` | `3.11.9` |

**Important :** la `SECRET_KEY` doit être une chaîne aléatoire de 64+ caractères.
Ne la partagez avec personne, et ne la regenerez pas une fois en production
(cela invaliderait toutes les sessions actives).

### 2.4 — Configurer le volume persistant

C'est l'étape qui sauvegarde la base de données utilisateurs et l'historique
des analyses entre les redémarrages.

1. Faites défiler jusqu'à la section **Disks** (en bas du formulaire)
2. Cliquez sur **Add Disk**
3. Renseignez :
   - **Name** : `narria-data`
   - **Mount Path** : `/data`
   - **Size** : `1 GB` (largement suffisant pour la phase bêta)

### 2.5 — Lancer le déploiement

Cliquez sur **Create Web Service** en bas du formulaire.

Render commence le déploiement, ce qui prend **5 à 10 minutes**. Vous voyez
les logs en temps réel. Attendez le message :

```
==> Your service is live 🎉
```

Notez l'URL temporaire que Render vous attribue (par exemple
`https://narria-xyz.onrender.com`). Vous pouvez déjà tester l'application
sur cette URL.

---

## Étape 3 — Créer votre compte administrateur

L'inscription via le formulaire crée des comptes **non-admin** par défaut.
Pour avoir les droits admin, vous devez modifier votre compte directement
en base de données après la première inscription.

### 3.1 — Inscription initiale

1. Allez sur l'URL Render (par exemple `https://narria-xyz.onrender.com/register`)
2. Inscrivez-vous avec votre e-mail (`adekambi@univ-kindia.gn` ou autre)
3. Vous êtes connecté en tant qu'utilisateur standard

### 3.2 — Élévation en admin

Connectez-vous au shell Render :

1. Sur le tableau de bord Render, ouvrez votre service `narria`
2. Cliquez sur **Shell** dans le menu latéral
3. Exécutez :

```bash
python3 -c "
from narria.auth.users import UserStore
store = UserStore()
user = store.get_user_by_email('VOTRE-EMAIL@kindia.gn')
store.set_admin(user['id'], True)
store.set_quota(user['id'], 9999, 99999)
print('OK admin défini')
"
```

Remplacez `VOTRE-EMAIL@kindia.gn` par l'e-mail avec lequel vous vous êtes
inscrit. Déconnectez-vous puis reconnectez-vous : vous verrez maintenant le
lien **Admin** dans la barre du haut.

---

## Étape 4 — Connecter le domaine narria.tech

### 4.1 — Configurer le domaine personnalisé sur Render

1. Sur le tableau de bord Render, ouvrez votre service `narria`
2. Cliquez sur **Settings** → **Custom Domains**
3. Cliquez sur **Add Custom Domain**
4. Saisissez `narria.tech`
5. Render vous donne une cible DNS de type CNAME, par exemple
   `narria-xyz.onrender.com`. Notez-la précisément.

### 4.2 — Configurer le DNS chez Cloudflare

1. Connectez-vous à https://dash.cloudflare.com
2. Sélectionnez le domaine **narria.tech**
3. Allez dans **DNS** → **Records**
4. Cliquez sur **Add record** et créez :

| Type | Name | Content | Proxy status |
|---|---|---|---|
| CNAME | `@` (apex) | `narria-xyz.onrender.com` | DNS only (gris) |
| CNAME | `www` | `narria-xyz.onrender.com` | DNS only (gris) |

**Important** : le proxy Cloudflare doit être **désactivé** (nuage gris, pas
orange). Render gère lui-même le certificat SSL via Let's Encrypt, et le
proxy Cloudflare interfère avec ce processus.

5. Attendez 5 à 30 minutes que la propagation DNS se fasse
6. Retournez sur Render → Custom Domains. Le statut doit passer de
   **Pending** à **Verified**, puis le certificat SSL se génère automatiquement.

### 4.3 — Vérifier

Ouvrez https://narria.tech dans votre navigateur. Vous devriez voir la page
de connexion NARR'IA.

---

## Étape 5 — Inviter vos collègues testeurs

Maintenant que NARR'IA est en ligne, vous pouvez communiquer l'URL à vos
testeurs. Pour chaque testeur :

1. Envoyez-leur l'URL https://narria.tech
2. Demandez-leur de cliquer sur **Créer un compte** et de s'inscrire avec
   leur e-mail institutionnel
3. Ils ont automatiquement un quota de 5 analyses par jour, 50 par mois
4. Si un testeur a besoin de plus, vous pouvez augmenter son quota depuis
   votre console **Admin**

---

## Étape 6 — Suivre la consommation

### Sur Render

- **Logs** : Service → Logs (voir les erreurs en temps réel)
- **Métriques** : Service → Metrics (CPU, RAM, requêtes)

### Sur Anthropic

Connectez-vous à https://console.anthropic.com :
- **Usage** : suivi quotidien de la consommation API
- **Limits** : vérifiez que votre plafond mensuel de 100 USD est bien actif
- **Notifications** : configurez des alertes par e-mail à 50%, 80% et 95% du plafond

### Dans NARR'IA

La page **Admin** (https://narria.tech/admin) affiche en temps réel :
- La liste de tous les testeurs et leur dernière connexion
- La consommation 24h et 30j de chacun
- Le coût mensuel total
- Les actions admin (modifier quotas, désactiver un compte)

---

## Mises à jour ultérieures

Pour publier une nouvelle version de NARR'IA :

```bash
# Sur votre ordinateur, dans le dossier de NARR'IA
git add .
git commit -m "Description des changements"
git push origin main
```

Render détecte automatiquement le push GitHub et redéploie en 5-10 minutes.
La base de données utilisateurs et l'historique sont préservés grâce au
volume persistant `/data`.

---

## Coûts récapitulatifs

Pour la phase bêta avec 15-20 testeurs :

| Poste | Coût mensuel |
|---|---|
| Render Starter (web service) | 7 USD |
| Disque persistant 1 GB | 0,25 USD |
| API Anthropic (estimé) | 20-80 USD selon usage |
| **Total** | **~30-90 USD/mois** |

Le plafond Anthropic à 100 USD vous protège des dérapages.

---

## Dépannage

### Le service ne démarre pas

Vérifiez les logs Render. Causes fréquentes :
- Variable `ANTHROPIC_API_KEY` manquante ou invalide
- Variable `SECRET_KEY` non définie
- Erreur dans `requirements.txt`

### "502 Bad Gateway" sur narria.tech

- Vérifiez que le DNS Cloudflare est en mode **DNS only** (pas Proxied)
- Attendez la propagation DNS (jusqu'à 24h dans de rares cas)

### Les utilisateurs sont déconnectés à chaque redémarrage

Vérifiez que `SECRET_KEY` est bien définie en variable d'environnement et
ne change pas entre les déploiements.

### "Quota mensuel atteint" alors que le testeur n'a rien fait

Le compteur compte les 30 derniers jours glissants, pas le mois calendaire.
Pour réinitialiser un testeur, augmentez son quota dans la console admin.

---

## Étapes ultérieures (pour plus tard)

Une fois le système stable et après le colloque, vous pourrez ajouter :

- **Confirmation par e-mail à l'inscription** (service SendGrid ou Mailgun)
- **Récupération de mot de passe par e-mail**
- **Conditions Générales d'Utilisation** (RGPD, CNIL)
- **Modèle BYOK** (l'utilisateur fournit sa propre clé API Anthropic)
- **Monétisation** (abonnement Stripe pour les analyses au-delà des quotas)

Mais pour la phase bêta avec vos collègues testeurs, ce que vous avez
maintenant suffit largement.

---

© 2026 Adéchinan David Adékambi · Université de Kindia
