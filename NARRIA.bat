@echo off
REM =================================================================
REM  NARR'IA - Script de lancement (Windows)
REM =================================================================
REM  Double-cliquez sur ce fichier pour lancer NARR'IA.
REM  Ce fichier est en ASCII pur avec des fins de ligne CRLF.
REM =================================================================

REM CRITIQUE : ces deux lignes garantissent que la fenetre reste ouverte
REM meme si une commande echoue de maniere inattendue
chcp 65001 >nul 2>&1
title NARR'IA - Lancement

cd /d "%~dp0"
if errorlevel 1 (
    echo [ERREUR] Impossible d'acceder au dossier de NARR'IA.
    echo Dossier attendu : %~dp0
    goto :end_with_pause
)

echo.
echo ===================================================================
echo                  NARR'IA - Lancement de l'application
echo ===================================================================
echo.

REM ---- Verification de Python ----
echo [1/4] Verification de Python...
where python >nul 2>nul
if errorlevel 1 (
    echo.
    echo [ERREUR] Python n'est pas installe ou pas dans le PATH.
    echo.
    echo Pour installer Python :
    echo   1. Aller sur https://www.python.org/downloads/
    echo   2. Telecharger Python 3.10 ou superieur
    echo   3. IMPORTANT : pendant l'installation, cocher la case
    echo      "Add Python to PATH" sur le premier ecran
    echo   4. Une fois Python installe, relancer ce script
    echo.
    goto :end_with_pause
)

for /f "tokens=2" %%i in ('python --version 2^>^&1') do set "PY_VERSION=%%i"
echo       OK Python %PY_VERSION% detecte
echo.

REM ---- Environnement virtuel ----
echo [2/4] Verification de l'environnement virtuel...
set "VENV_DIR=%~dp0.venv"

if not exist "%VENV_DIR%\Scripts\activate.bat" (
    echo       Creation de l'environnement virtuel...
    echo       (cela prend environ 30 secondes au premier lancement)
    python -m venv "%VENV_DIR%"
    if errorlevel 1 (
        echo.
        echo [ERREUR] Impossible de creer l'environnement virtuel.
        echo Verifiez que vous avez les droits d'ecriture dans :
        echo   %~dp0
        goto :end_with_pause
    )
    echo       OK Environnement virtuel cree
) else (
    echo       OK Environnement virtuel deja present
)
echo.

REM ---- Activer l'environnement virtuel ----
call "%VENV_DIR%\Scripts\activate.bat"
if errorlevel 1 (
    echo [ERREUR] Impossible d'activer l'environnement virtuel.
    goto :end_with_pause
)

REM ---- Verification des dependances ----
echo [3/4] Verification des dependances Python...

set "NEEDS_INSTALL=0"
python -c "import flask" 2>nul
if errorlevel 1 set "NEEDS_INSTALL=1"
python -c "import anthropic" 2>nul
if errorlevel 1 set "NEEDS_INSTALL=1"
python -c "import docx" 2>nul
if errorlevel 1 set "NEEDS_INSTALL=1"
python -c "import pypdf" 2>nul
if errorlevel 1 set "NEEDS_INSTALL=1"
python -c "import odf" 2>nul
if errorlevel 1 set "NEEDS_INSTALL=1"
python -c "import ebooklib" 2>nul
if errorlevel 1 set "NEEDS_INSTALL=1"
python -c "import bs4" 2>nul
if errorlevel 1 set "NEEDS_INSTALL=1"
python -c "import xhtml2pdf" 2>nul
if errorlevel 1 set "NEEDS_INSTALL=1"

if "%NEEDS_INSTALL%"=="1" (
    echo       Installation des dependances en cours...
    echo       (cela peut prendre 1 a 3 minutes au premier lancement)
    echo.
    python -m pip install --quiet --upgrade pip
    python -m pip install --quiet -r requirements.txt
    if errorlevel 1 (
        echo.
        echo [ERREUR] L'installation des dependances a echoue.
        echo Verifiez votre connexion Internet et reessayez.
        goto :end_with_pause
    )
    echo       OK Dependances installees
) else (
    echo       OK Toutes les dependances sont presentes
)
echo.

REM ---- Lancement de l'application ----
echo [4/4] Lancement du serveur NARR'IA...
echo.
echo ===================================================================
echo  Le navigateur va s'ouvrir automatiquement dans quelques secondes.
echo  Pour arreter NARR'IA : fermer cette fenetre OU appuyer Ctrl+C.
echo ===================================================================
echo.

python -m narria.app

REM Si on arrive ici, le serveur s'est arrete
echo.
echo NARR'IA s'est arrete.

:end_with_pause
echo.
echo ===================================================================
echo Appuyez sur une touche pour fermer cette fenetre...
echo ===================================================================
pause >nul
exit /b
