@echo off
REM ============================================================
REM  Installer un raccourci NARR'IA sur le Bureau (Windows)
REM  v5 - 100%% ASCII, robuste, garantie de pause finale
REM ============================================================

REM IMPORTANT : ce fichier ne contient AUCUN caractere non-ASCII
REM (pas d'accents, pas de caracteres speciaux) pour eviter les
REM problemes d'encodage avec cmd.exe sur Windows 11 Pro.

REM Forcer la code page UTF-8 pour eviter les soucis d'encodage
chcp 65001 >nul 2>&1

setlocal EnableDelayedExpansion

REM Capturer toute erreur pour empecher la fermeture immediate
echo.
echo ============================================================
echo   Installation du raccourci NARR'IA sur le Bureau
echo ============================================================
echo.

REM ---------- Detection du repertoire ----------
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "NARRIA_BAT=%SCRIPT_DIR%\NARRIA.bat"
set "NARRIA_ICON=%SCRIPT_DIR%\narria\static\img\logo.ico"
set "LOGFILE=%SCRIPT_DIR%\Installer_diagnostic.log"

REM ---------- Initialisation du log ----------
echo === Log d'installation NARR'IA === > "%LOGFILE%" 2>nul
echo Date    : %date% %time% >> "%LOGFILE%" 2>nul
echo User    : %USERNAME% >> "%LOGFILE%" 2>nul
echo Profile : %USERPROFILE% >> "%LOGFILE%" 2>nul
echo Script  : %SCRIPT_DIR% >> "%LOGFILE%" 2>nul
echo Cible   : %NARRIA_BAT% >> "%LOGFILE%" 2>nul
echo Icone   : %NARRIA_ICON% >> "%LOGFILE%" 2>nul
echo. >> "%LOGFILE%" 2>nul

REM ---------- Verifier que NARRIA.bat existe ----------
if not exist "%NARRIA_BAT%" (
    echo [ERREUR] NARRIA.bat introuvable.
    echo.
    echo Ce script doit etre place dans le meme dossier
    echo que NARRIA.bat.
    echo.
    echo Dossier actuel : %SCRIPT_DIR%
    echo.
    echo NARRIA.bat introuvable >> "%LOGFILE%" 2>nul
    goto :wait_exit
)

REM ---------- Verifier que le logo .ico existe ----------
if exist "%NARRIA_ICON%" (
    echo [OK] Logo NARR'IA trouve : %NARRIA_ICON%
    echo Logo trouve >> "%LOGFILE%" 2>nul
) else (
    echo [INFO] Logo NARR'IA introuvable - utilisation icone par defaut
    echo Logo INTROUVABLE - fallback icone systeme >> "%LOGFILE%" 2>nul
    set "NARRIA_ICON=%SystemRoot%\System32\imageres.dll,109"
)

echo.

REM ---------- Detecter le Bureau ----------
echo Recherche du Bureau Windows...

set "DESKTOP="

REM Methode 1 : variable USERPROFILE\Desktop
if exist "%USERPROFILE%\Desktop" (
    set "DESKTOP=%USERPROFILE%\Desktop"
)

REM Methode 2 : USERPROFILE\OneDrive\Desktop (priorite si OneDrive existe)
if exist "%USERPROFILE%\OneDrive\Desktop" (
    set "DESKTOP=%USERPROFILE%\OneDrive\Desktop"
)

REM Methode 3 : USERPROFILE\OneDrive\Bureau (configuration francaise)
if exist "%USERPROFILE%\OneDrive\Bureau" (
    set "DESKTOP=%USERPROFILE%\OneDrive\Bureau"
)

REM Methode 4 : variable OneDrive directement
if not "%OneDrive%"=="" (
    if exist "%OneDrive%\Desktop" (
        set "DESKTOP=%OneDrive%\Desktop"
    )
    if exist "%OneDrive%\Bureau" (
        set "DESKTOP=%OneDrive%\Bureau"
    )
)

REM Verifier qu'on a trouve un Bureau
if "%DESKTOP%"=="" (
    echo [ERREUR] Impossible de localiser votre Bureau Windows.
    echo.
    echo Aucun Bureau detecte >> "%LOGFILE%" 2>nul
    goto :wait_exit
)

echo [OK] Bureau detecte : %DESKTOP%
echo Bureau cible : %DESKTOP% >> "%LOGFILE%" 2>nul
echo.

set "SHORTCUT=%DESKTOP%\NARRIA.lnk"

REM ---------- Supprimer les anciens raccourcis ----------
echo Nettoyage des anciens raccourcis...
if exist "%DESKTOP%\NARRIA.lnk" (
    del /q "%DESKTOP%\NARRIA.lnk" >nul 2>&1
    echo Ancien NARRIA.lnk supprime >> "%LOGFILE%" 2>nul
)
if exist "%DESKTOP%\NARRIA.url" (
    del /q "%DESKTOP%\NARRIA.url" >nul 2>&1
    echo Ancien NARRIA.url supprime >> "%LOGFILE%" 2>nul
)
echo.

REM ---------- Methode 1 : VBScript ----------
echo Tentative 1/3 : creation via VBScript...

set "VBS=%TEMP%\narria_shortcut.vbs"

REM Creer le script VBScript ligne par ligne (sans caracteres speciaux)
> "%VBS%" echo Set ws = CreateObject("WScript.Shell")
>> "%VBS%" echo Set s = ws.CreateShortcut("%SHORTCUT%")
>> "%VBS%" echo s.TargetPath = "%NARRIA_BAT%"
>> "%VBS%" echo s.WorkingDirectory = "%SCRIPT_DIR%"
>> "%VBS%" echo s.Description = "NARR'IA - Narratologie computationnelle"
>> "%VBS%" echo s.IconLocation = "%NARRIA_ICON%"
>> "%VBS%" echo s.WindowStyle = 1
>> "%VBS%" echo s.Save

cscript //nologo "%VBS%" >> "%LOGFILE%" 2>&1
del /q "%VBS%" >nul 2>&1

if exist "%SHORTCUT%" (
    echo VBScript : SUCCES >> "%LOGFILE%" 2>nul
    goto :success
)
echo VBScript : ECHEC >> "%LOGFILE%" 2>nul
echo   VBScript a echoue, on passe a la methode suivante...
echo.

REM ---------- Methode 2 : PowerShell ----------
echo Tentative 2/3 : creation via PowerShell...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = '%NARRIA_BAT%'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.Description = 'NARRIA'; $s.IconLocation = '%NARRIA_ICON%'; $s.WindowStyle = 1; $s.Save()" >> "%LOGFILE%" 2>&1

if exist "%SHORTCUT%" (
    echo PowerShell : SUCCES >> "%LOGFILE%" 2>nul
    goto :success
)
echo PowerShell : ECHEC >> "%LOGFILE%" 2>nul
echo   PowerShell a echoue, on passe a la methode suivante...
echo.

REM ---------- Methode 3 : Wrapper .bat ----------
echo Tentative 3/3 : creation d'un wrapper .bat sur le Bureau...

set "WRAPPER=%DESKTOP%\NARRIA.bat"
> "%WRAPPER%" echo @echo off
>> "%WRAPPER%" echo cd /d "%SCRIPT_DIR%"
>> "%WRAPPER%" echo call "%NARRIA_BAT%"

if exist "%WRAPPER%" (
    set "SHORTCUT=%WRAPPER%"
    echo Wrapper .bat : SUCCES >> "%LOGFILE%" 2>nul
    goto :success
)
echo Wrapper .bat : ECHEC >> "%LOGFILE%" 2>nul

REM ---------- Toutes les methodes ont echoue ----------
echo.
echo ============================================================
echo   ECHEC : Impossible de creer le raccourci automatiquement
echo ============================================================
echo.
echo Vous pouvez creer le raccourci manuellement :
echo   1. Ouvrir l'Explorateur de fichiers
echo   2. Aller dans : %SCRIPT_DIR%
echo   3. Clic-droit sur NARRIA.bat
echo   4. Choisir "Envoyer vers" puis "Bureau (creer un raccourci)"
echo.
echo Voir le log de diagnostic : %LOGFILE%
echo.
goto :wait_exit

:success
REM ---------- Verification finale ----------
if not exist "%SHORTCUT%" (
    echo.
    echo [PARADOXE] Une methode a dit OK mais le fichier
    echo a disparu. OneDrive ou un antivirus l'a peut-etre
    echo supprime. Voir le log : %LOGFILE%
    goto :wait_exit
)

REM ---------- Rafraichir le cache d'icones Windows ----------
echo.
echo Rafraichissement du cache d'icones Windows...
ie4uinit.exe -ClearIconCache >nul 2>&1
ie4uinit.exe -show >nul 2>&1
echo Cache d'icones rafraichi >> "%LOGFILE%" 2>nul

echo.
echo ============================================================
echo   RACCOURCI INSTALLE AVEC SUCCES
echo ============================================================
echo.
echo   Emplacement : %SHORTCUT%
echo.
echo   Pour lancer NARR'IA :
echo     Double-cliquez l'icone "NARRIA" sur votre Bureau
echo.
echo ============================================================
echo.
echo Si le logo NARR'IA ne s'affiche pas sur le raccourci :
echo   1. Faites F5 sur le Bureau pour rafraichir
echo   2. Sinon : clic-droit sur le raccourci puis "Proprietes"
echo      puis "Changer d'icone..." puis "Parcourir..." et
echo      selectionnez : narria\static\img\logo.ico
echo   3. En dernier recours : redemarrez Windows
echo.

:wait_exit
echo.
echo ============================================================
echo Appuyez sur une touche pour fermer cette fenetre...
echo ============================================================
pause >nul
endlocal
exit /b 0
