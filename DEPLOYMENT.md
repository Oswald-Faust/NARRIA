# Guide de déploiement de NARR'IA en site web public

Ce guide explique comment **mettre NARR'IA en ligne** sous une URL publique avec HTTPS, par exemple `https://narria.votre-domaine.org`. Lisez-le entièrement avant de commencer.

## ⚠️ Avertissements préalables

Avant tout déploiement public, considérez ces implications :

### 1. Coûts récurrents

| Poste | Coût annuel approximatif |
|------|--------------------------|
| Nom de domaine (ex. `narria.org`) | 12-25 EUR |
| Hébergement (Render, Railway, Fly.io) | 60-180 USD |
| Clé API Anthropic (si vous payez pour vos utilisateurs) | **Variable, potentiellement élevé** |
| **Total minimum** | **~80 USD/an** sans clé partagée |

### 2. La question de la clé API

Avec un site public, le problème de la clé devient critique :

**Option A — Chaque utilisateur entre sa clé (recommandé) :**
- L'utilisateur visite votre site
- Crée un compte (vous gérez l'authentification)
- Y entre sa propre clé Anthropic
- Vous stockez la clé chiffrée dans votre base de données
- Implications : authentification, RGPD, base de données, complexité accrue

**Option B — Vous payez pour vos utilisateurs :**
- Votre clé est sur le serveur, jamais exposée
- Tous les utilisateurs partagent votre crédit Anthropic
- Implications : facture potentiellement explosive, rate-limiting nécessaire

**Option C — Mode local uniquement :**
- Vous distribuez le ZIP comme actuellement
- Le site web n'est utilisé que pour des démos en mode local (heuristiques)
- Implications : moins puissant, mais zéro coût LLM

### 3. Responsabilités juridiques

Un service en ligne en France ou en Europe (votre université étant en Guinée, mais vos utilisateurs potentiellement européens) implique :
- **Mention légale** obligatoire
- **Politique de confidentialité** RGPD
- **Conditions d'utilisation** explicitant que vous ne garantissez aucun résultat
- Si vous traitez des œuvres sous droit d'auteur via Anthropic, **risque de contestation** par les ayants droit

## Recommandation : commencez par un déploiement universitaire interne

Avant de viser un site public ouvert, **demandez à votre service informatique de l'Université de Kindia s'il peut héberger NARR'IA en interne**. Vous obtiendriez ainsi :

- Une URL du type `narria.uniki.edu.gn` ou similaire
- Un accès limité aux étudiants et chercheurs de l'université
- Aucun coût supplémentaire pour vous
- Aucune responsabilité juridique personnelle (l'université porte le service)
- Une légitimité institutionnelle

C'est de loin la meilleure première étape. Le service informatique aura besoin de :
- Un serveur Linux avec Python 3.10+
- Le ZIP de NARR'IA (la version actuelle)
- 2-4 Go de RAM
- Un nom DNS dans le sous-domaine de l'université

Si vous décidez ensuite d'aller plus loin avec un site public ouvert, ce guide vous explique comment.

---

## Plan de déploiement public (si vous optez pour cette voie)

### Étape 1 — Acheter un nom de domaine

**Registraires recommandés :**
- [OVH](https://www.ovhcloud.com/fr/) (français, ~12 EUR/an pour `.com`/`.org`)
- [Gandi](https://www.gandi.net/fr) (européen, ~15 EUR/an)
- [Namecheap](https://www.namecheap.com/) (international, ~10 USD/an)

**Suggestions de nom :**
- `narria.org` (sobre, académique)
- `narria-app.org`
- `narria.science`
- `narria.tools`

### Étape 2 — Choisir un hébergeur

| Hébergeur | Prix mensuel | Difficulté | Avantages |
|-----------|-------------|------------|-----------|
| **Render.com** | 7 USD | Facile | HTTPS automatique, déploiement par git push |
| **Railway.app** | ~5 USD | Facile | Très simple, excellent support Python |
| **Fly.io** | ~5 USD | Moyenne | Performant, mondial |
| **PythonAnywhere** | 5 USD | Facile | Spécialisé Python |
| **VPS OVH/Hetzner** | 4 EUR | Difficile | Plus de contrôle, mais demande des compétences sysadmin |

Pour un premier déploiement, **je recommande Render.com**.

### Étape 3 — Préparer NARR'IA pour la production

Le code actuel utilise le serveur de développement Flask (`app.run()`), qui n'est **pas adapté à la production**. Pour un déploiement, il faut utiliser un serveur WSGI comme **Gunicorn**.

#### 3.1 — Ajout de Gunicorn aux dépendances

Modifier `requirements.txt` :
```
Flask>=3.0.0
anthropic>=0.40.0
python-docx>=1.0.0
pypdf>=5.0.0
odfpy>=1.4.0
ebooklib>=0.18
beautifulsoup4>=4.12.0
gunicorn>=21.0.0
```

#### 3.2 — Créer un point d'entrée pour Gunicorn

Créer `wsgi.py` à la racine du projet :
```python
"""Point d'entrée WSGI pour le déploiement en production."""
from narria.app import app

if __name__ == "__main__":
    app.run()
```

#### 3.3 — Variables d'environnement

En production, certaines configurations doivent venir de l'environnement, jamais d'un fichier de code :

- `ANTHROPIC_API_KEY` : si vous payez pour les utilisateurs (option B)
- `NARRIA_DATA_DIR` : où stocker l'historique (peut être un volume persistant)
- `FLASK_SECRET_KEY` : pour la sécurité des sessions

Modifier `narria/app.py` pour lire ces variables :
```python
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'narria-dev-only')
NARRIA_DATA_DIR = os.environ.get('NARRIA_DATA_DIR', str(Path.home() / '.narria'))
# Puis utiliser NARRIA_DATA_DIR au lieu de Path.home() partout
```

#### 3.4 — Fichier de configuration Render

Créer `render.yaml` à la racine :
```yaml
services:
  - type: web
    name: narria
    env: python
    buildCommand: "pip install -r requirements.txt"
    startCommand: "gunicorn wsgi:app --bind 0.0.0.0:$PORT --timeout 300 --workers 2"
    envVars:
      - key: PYTHON_VERSION
        value: 3.11.0
      - key: NARRIA_DATA_DIR
        value: /var/data/narria
    disk:
      name: narria-data
      mountPath: /var/data
      sizeGB: 2
```

### Étape 4 — Déployer sur Render

1. Créez un compte sur [render.com](https://render.com)
2. Créez un dépôt GitHub avec votre code (privé pour ne pas exposer la clé API)
3. Sur Render : « New Web Service » → connectez le dépôt
4. Render détecte `render.yaml` et configure tout automatiquement
5. Render vous donne une URL `https://narria-XXXX.onrender.com`

### Étape 5 — Connecter votre nom de domaine

1. Dans Render : « Settings » → « Custom Domain » → ajoutez `narria.votre-domaine.org`
2. Render vous donne une cible CNAME (ex. `narria-xxxx.onrender.com`)
3. Chez votre registraire : créez un enregistrement CNAME pointant `narria` vers cette cible
4. Render active automatiquement HTTPS via Let's Encrypt (en quelques minutes)

### Étape 6 — Mentions légales et confidentialité

**Obligatoire** pour un service européen accessible publiquement. Vous aurez besoin de :

- **Mentions légales** (votre nom, statut universitaire, contact)
- **Politique de confidentialité** RGPD (quelles données collectées, durée, droit d'accès)
- **Conditions d'utilisation** (responsabilité limitée, usage académique uniquement, etc.)

Je peux vous écrire ces trois textes adaptés à NARR'IA si vous décidez de déployer.

---

## Variante : déploiement institutionnel sur serveur universitaire

Si votre service informatique accepte l'hébergement, voici les étapes simplifiées :

### Sur un serveur Linux Ubuntu/Debian

```bash
# Installation des prérequis
sudo apt update
sudo apt install python3 python3-pip python3-venv nginx certbot python3-certbot-nginx

# Création d'un utilisateur dédié
sudo useradd -m -s /bin/bash narria
sudo su - narria

# Déploiement de l'application
cd ~
unzip NARRIA-1.4.0.zip
cd NARRIA-1.4.0
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install gunicorn

# Test
gunicorn wsgi:app --bind 127.0.0.1:8000

# Service systemd (en root)
sudo tee /etc/systemd/system/narria.service > /dev/null << 'EOF'
[Unit]
Description=NARR'IA service
After=network.target

[Service]
User=narria
WorkingDirectory=/home/narria/NARRIA-1.4.0
Environment="PATH=/home/narria/NARRIA-1.4.0/.venv/bin"
ExecStart=/home/narria/NARRIA-1.4.0/.venv/bin/gunicorn wsgi:app --bind 127.0.0.1:8000 --workers 2 --timeout 300
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable narria
sudo systemctl start narria

# Configuration Nginx en reverse proxy
sudo tee /etc/nginx/sites-available/narria > /dev/null << 'EOF'
server {
    listen 80;
    server_name narria.uniki.edu.gn;
    
    client_max_body_size 320M;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/narria /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Certificat HTTPS via Let's Encrypt (gratuit)
sudo certbot --nginx -d narria.uniki.edu.gn
```

Une fois terminé, NARR'IA est accessible sur `https://narria.uniki.edu.gn` avec HTTPS automatique.

---

## Quand vous serez prêt

Si vous décidez d'aller dans cette direction, dites-moi :
1. Quelle option de clé API (A, B, ou C) ?
2. Hébergement universitaire ou public ?
3. Si public, quel hébergeur ?

Je préparerai alors le code adapté (mode production, lecture des variables d'environnement, sécurité), les fichiers de configuration, les mentions légales si nécessaire, et un script de déploiement automatisé. C'est typiquement 2-3 heures de travail supplémentaire.

D'ici là, le ZIP NARR'IA-1.4.0 reste pleinement fonctionnel pour un usage local, et c'est à mon avis la bonne base pour la phase suivante.
