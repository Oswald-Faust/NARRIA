#!/usr/bin/env bash
#
# Créer un raccourci NARR'IA sur le Bureau (Linux)
# ──────────────────────────────────────────────────
# Double-cliquez ce fichier pour installer le raccourci, ou exécutez-le
# depuis un terminal : bash Installer_raccourci_Linux.sh
# Une icône NARRIA sera placée sur votre Bureau.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NARRIA_SH="$SCRIPT_DIR/NARRIA.sh"

if [ ! -f "$NARRIA_SH" ]; then
    echo "ERREUR : NARRIA.sh introuvable dans $SCRIPT_DIR"
    echo "Placez ce script dans le dossier de NARR'IA et recommencez."
    exit 1
fi

# Détection du Bureau (gestion multi-langue : Desktop / Bureau / Escritorio)
DESKTOP=""
for d in "Desktop" "Bureau" "Escritorio" "桌面" "Schreibtisch"; do
    if [ -d "$HOME/$d" ]; then
        DESKTOP="$HOME/$d"
        break
    fi
done

# Si aucun bureau localisé, utilise xdg-user-dir si disponible
if [ -z "$DESKTOP" ] && command -v xdg-user-dir > /dev/null; then
    DESKTOP="$(xdg-user-dir DESKTOP)"
fi

# Fallback final
if [ -z "$DESKTOP" ] || [ ! -d "$DESKTOP" ]; then
    DESKTOP="$HOME"
fi

DESKTOP_FILE="$DESKTOP/narria.desktop"

# Créer le fichier .desktop (norme freedesktop.org)
cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=NARR'IA
GenericName=Narratologie computationnelle
Comment=Système d'analyse narratologique du plagiat d'intrigue
Exec=bash "$NARRIA_SH"
Path=$SCRIPT_DIR
Icon=text-x-generic
Terminal=true
Categories=Education;Science;
Keywords=narratologie;analyse;texte;
EOF

chmod +x "$DESKTOP_FILE"

# Sur GNOME récent, marquer le raccourci comme « approuvé »
if command -v gio > /dev/null 2>&1; then
    gio set "$DESKTOP_FILE" "metadata::trusted" true 2>/dev/null || true
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✓ Raccourci installé : $DESKTOP_FILE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Vous pouvez maintenant lancer NARR'IA en double-cliquant"
echo "l'icône NARR'IA sur votre Bureau."
echo ""
echo "Sur certaines distributions, vous devrez peut-être faire un"
echo "clic-droit → « Autoriser le lancement » la première fois."
echo ""
