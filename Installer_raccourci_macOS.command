#!/usr/bin/env bash
#
# Créer un raccourci NARR'IA sur le Bureau (macOS)
# ──────────────────────────────────────────────────
# Double-cliquez ce fichier pour installer le raccourci.
# Une icône "NARRIA.app" sera placée sur votre Bureau.
# Vous pourrez ensuite lancer NARR'IA en double-cliquant cette icône,
# sans plus jamais ouvrir de terminal.

set -e

# Détecter le répertoire où se trouve ce script (donc l'archive NARR'IA)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NARRIA_SH="$SCRIPT_DIR/NARRIA.sh"

if [ ! -f "$NARRIA_SH" ]; then
    osascript -e 'display alert "NARRIA.sh introuvable" message "Placez ce script dans le dossier de NARR'\''IA et recommencez."'
    exit 1
fi

DESKTOP="$HOME/Desktop"
APP_NAME="NARRIA.app"
APP_PATH="$DESKTOP/$APP_NAME"

# Supprimer un éventuel ancien raccourci
[ -e "$APP_PATH" ] && rm -rf "$APP_PATH"

# Construire la structure d'un .app macOS minimal
mkdir -p "$APP_PATH/Contents/MacOS"
mkdir -p "$APP_PATH/Contents/Resources"

# Le script lanceur : il appelle NARRIA.sh dans Terminal.app
# (sinon le navigateur s'ouvre mais le terminal reste invisible)
cat > "$APP_PATH/Contents/MacOS/NARRIA" << EOF
#!/usr/bin/env bash
osascript -e 'tell app "Terminal" to do script "bash \"$NARRIA_SH\""' \\
          -e 'tell app "Terminal" to activate'
EOF
chmod +x "$APP_PATH/Contents/MacOS/NARRIA"

# Info.plist (métadonnées de l'application)
cat > "$APP_PATH/Contents/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>NARRIA</string>
    <key>CFBundleIdentifier</key>
    <string>fr.uniki.narria</string>
    <key>CFBundleName</key>
    <string>NARRIA</string>
    <key>CFBundleDisplayName</key>
    <string>NARR'IA</string>
    <key>CFBundleShortVersionString</key>
    <string>1.7.0</string>
    <key>CFBundleVersion</key>
    <string>1.7.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
</dict>
</plist>
EOF

osascript -e 'display notification "Raccourci NARRIA.app installé sur le Bureau. Double-cliquez-le pour lancer NARR'\''IA." with title "NARR'\''IA installé"'

echo ""
echo "✓ Raccourci installé : $APP_PATH"
echo ""
echo "Vous pouvez maintenant lancer NARR'IA en double-cliquant"
echo "l'icône NARRIA.app sur votre Bureau."
echo ""
echo "Au premier lancement, macOS demandera peut-être l'autorisation"
echo "d'exécuter une application non signée. Cliquez sur « Ouvrir »"
echo "dans la boîte de dialogue (ou allez dans Préférences Système →"
echo "Sécurité → Ouvrir quand même)."
