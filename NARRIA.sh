#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# NARR'IA — Script de lancement (Linux / macOS)
# ═══════════════════════════════════════════════════════════════
#
# Usage :
#     1. Ouvrez un terminal dans le dossier narria-app
#     2. Rendez ce script exécutable : chmod +x NARRIA.sh
#     3. Lancez-le : ./NARRIA.sh
#
# Le script vérifiera l'installation des dépendances, lancera le serveur
# local, et ouvrira automatiquement l'interface dans votre navigateur.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   NARR'IA — Lancement de l'application                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ─── Vérification de Python 3 ───
if ! command -v python3 &> /dev/null; then
    echo "❌ ERREUR : Python 3 n'est pas installé sur votre système."
    echo ""
    echo "Pour l'installer :"
    echo "  • Ubuntu/Debian : sudo apt install python3 python3-pip python3-venv"
    echo "  • macOS        : brew install python3  (ou télécharger sur python.org)"
    echo ""
    exit 1
fi

PY_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "✓ Python $PY_VERSION détecté"

# ─── Environnement virtuel ───
VENV_DIR="$SCRIPT_DIR/.venv"

if [ ! -d "$VENV_DIR" ]; then
    echo "⏳ Première utilisation : création de l'environnement virtuel..."
    python3 -m venv "$VENV_DIR"
    echo "✓ Environnement virtuel créé"
fi

# Activate venv
source "$VENV_DIR/bin/activate"

# ─── Installation des dépendances ───
NEEDS_INSTALL=0
for pkg in flask anthropic docx pypdf odf ebooklib bs4 xhtml2pdf; do
    if ! python -c "import $pkg" 2>/dev/null; then
        NEEDS_INSTALL=1
        break
    fi
done

if [ $NEEDS_INSTALL -eq 1 ]; then
    echo "⏳ Installation des dépendances (Flask + anthropic + parseurs de fichiers)..."
    pip install --quiet --upgrade pip
    pip install --quiet -r requirements.txt
    echo "✓ Dépendances installées"
fi

# ─── Lancement ───
echo ""
echo "🚀 Lancement de NARR'IA..."
echo ""

exec python -m narria.app
