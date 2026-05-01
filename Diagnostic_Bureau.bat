@echo off
REM =================================================================
REM  DIAGNOSTIC NARR'IA - Detection des Bureaux Windows
REM =================================================================
REM  Ce script ne CREE rien. Il regarde juste votre systeme.
REM  Le rapport est sauvegarde dans Diagnostic.txt
REM =================================================================

chcp 65001 >nul 2>&1
title Diagnostic NARR'IA

cd /d "%~dp0"

set "RAPPORT=%~dp0Diagnostic.txt"

REM Effacer ancien rapport
if exist "%RAPPORT%" del /q "%RAPPORT%" 2>nul

REM ---- En-tete ----
echo =================================================================  > "%RAPPORT%"
echo                  RAPPORT DE DIAGNOSTIC NARR'IA                     >> "%RAPPORT%"
echo =================================================================  >> "%RAPPORT%"
echo. >> "%RAPPORT%"
echo Date : %date% %time%                                                >> "%RAPPORT%"
echo. >> "%RAPPORT%"

REM ---- Variables d'environnement ----
echo --- Variables d'environnement ---                                  >> "%RAPPORT%"
echo USERNAME    = %USERNAME%                                            >> "%RAPPORT%"
echo USERPROFILE = %USERPROFILE%                                         >> "%RAPPORT%"
echo OneDrive    = %OneDrive%                                            >> "%RAPPORT%"
echo OneDriveCommercial = %OneDriveCommercial%                           >> "%RAPPORT%"
echo OneDriveConsumer = %OneDriveConsumer%                               >> "%RAPPORT%"
echo Dossier actuel = %~dp0                                              >> "%RAPPORT%"
echo. >> "%RAPPORT%"

REM ---- Detection des Bureaux possibles ----
echo --- Bureaux detectes ---                                            >> "%RAPPORT%"

set "FOUND=0"

if exist "%USERPROFILE%\Desktop" (
    echo PRESENT : %%USERPROFILE%%\Desktop                               >> "%RAPPORT%"
    echo           Chemin : %USERPROFILE%\Desktop                        >> "%RAPPORT%"
    set /a FOUND+=1
)

if exist "%USERPROFILE%\Bureau" (
    echo PRESENT : %%USERPROFILE%%\Bureau                                >> "%RAPPORT%"
    echo           Chemin : %USERPROFILE%\Bureau                         >> "%RAPPORT%"
    set /a FOUND+=1
)

if exist "%USERPROFILE%\OneDrive\Desktop" (
    echo PRESENT : %%USERPROFILE%%\OneDrive\Desktop                      >> "%RAPPORT%"
    echo           Chemin : %USERPROFILE%\OneDrive\Desktop               >> "%RAPPORT%"
    set /a FOUND+=1
)

if exist "%USERPROFILE%\OneDrive\Bureau" (
    echo PRESENT : %%USERPROFILE%%\OneDrive\Bureau                       >> "%RAPPORT%"
    echo           Chemin : %USERPROFILE%\OneDrive\Bureau                >> "%RAPPORT%"
    set /a FOUND+=1
)

if not "%OneDrive%"=="" (
    if exist "%OneDrive%\Desktop" (
        echo PRESENT : %%OneDrive%%\Desktop                              >> "%RAPPORT%"
        echo           Chemin : %OneDrive%\Desktop                       >> "%RAPPORT%"
        set /a FOUND+=1
    )
    if exist "%OneDrive%\Bureau" (
        echo PRESENT : %%OneDrive%%\Bureau                               >> "%RAPPORT%"
        echo           Chemin : %OneDrive%\Bureau                        >> "%RAPPORT%"
        set /a FOUND+=1
    )
)

if exist "C:\Users\Public\Desktop" (
    echo PRESENT : Public\Desktop                                        >> "%RAPPORT%"
    echo           Chemin : C:\Users\Public\Desktop                      >> "%RAPPORT%"
    set /a FOUND+=1
)

echo. >> "%RAPPORT%"
echo Total Bureaux detectes : %FOUND%                                    >> "%RAPPORT%"
echo. >> "%RAPPORT%"

REM ---- Test d'ecriture sur chaque Bureau ----
echo --- Test d'ecriture (depose un fichier TEST_NARRIA.txt) ---         >> "%RAPPORT%"
echo. >> "%RAPPORT%"

REM Test sur USERPROFILE\Desktop
if exist "%USERPROFILE%\Desktop" (
    echo Test ecriture sur %USERPROFILE%\Desktop                         >> "%RAPPORT%"
    echo Test NARR'IA > "%USERPROFILE%\Desktop\TEST_NARRIA.txt" 2>>"%RAPPORT%"
    if exist "%USERPROFILE%\Desktop\TEST_NARRIA.txt" (
        echo   --^> SUCCES : fichier TEST_NARRIA.txt cree                 >> "%RAPPORT%"
    ) else (
        echo   --^> ECHEC : impossible d'ecrire ici                       >> "%RAPPORT%"
    )
    echo. >> "%RAPPORT%"
)

REM Test sur USERPROFILE\OneDrive\Bureau
if exist "%USERPROFILE%\OneDrive\Bureau" (
    echo Test ecriture sur %USERPROFILE%\OneDrive\Bureau                 >> "%RAPPORT%"
    echo Test NARR'IA > "%USERPROFILE%\OneDrive\Bureau\TEST_NARRIA.txt" 2>>"%RAPPORT%"
    if exist "%USERPROFILE%\OneDrive\Bureau\TEST_NARRIA.txt" (
        echo   --^> SUCCES : fichier TEST_NARRIA.txt cree                 >> "%RAPPORT%"
    ) else (
        echo   --^> ECHEC : impossible d'ecrire ici                       >> "%RAPPORT%"
    )
    echo. >> "%RAPPORT%"
)

REM Test sur USERPROFILE\OneDrive\Desktop
if exist "%USERPROFILE%\OneDrive\Desktop" (
    echo Test ecriture sur %USERPROFILE%\OneDrive\Desktop                >> "%RAPPORT%"
    echo Test NARR'IA > "%USERPROFILE%\OneDrive\Desktop\TEST_NARRIA.txt" 2>>"%RAPPORT%"
    if exist "%USERPROFILE%\OneDrive\Desktop\TEST_NARRIA.txt" (
        echo   --^> SUCCES : fichier TEST_NARRIA.txt cree                 >> "%RAPPORT%"
    ) else (
        echo   --^> ECHEC : impossible d'ecrire ici                       >> "%RAPPORT%"
    )
    echo. >> "%RAPPORT%"
)

REM ---- Capacites du systeme ----
echo --- Capacites du systeme ---                                        >> "%RAPPORT%"

REM Test cscript
where cscript >nul 2>nul
if errorlevel 1 (
    echo cscript    : NON DISPONIBLE                                     >> "%RAPPORT%"
) else (
    echo cscript    : disponible                                         >> "%RAPPORT%"
)

REM Test PowerShell
where powershell >nul 2>nul
if errorlevel 1 (
    echo PowerShell : NON DISPONIBLE                                     >> "%RAPPORT%"
) else (
    echo PowerShell : disponible                                         >> "%RAPPORT%"
    REM Test ExecutionPolicy
    powershell -NoProfile -Command "Get-ExecutionPolicy" > "%TEMP%\ps_policy.txt" 2>nul
    set /p PS_POLICY=<"%TEMP%\ps_policy.txt"
    echo PowerShell ExecutionPolicy : !PS_POLICY!                        >> "%RAPPORT%"
    del "%TEMP%\ps_policy.txt" 2>nul
)

REM Verifier l'icone
echo. >> "%RAPPORT%"
echo --- Fichiers NARR'IA ---                                            >> "%RAPPORT%"
if exist "%~dp0NARRIA.bat" (
    echo NARRIA.bat : PRESENT                                            >> "%RAPPORT%"
) else (
    echo NARRIA.bat : ABSENT                                             >> "%RAPPORT%"
)

if exist "%~dp0narria\static\img\logo.ico" (
    echo logo.ico   : PRESENT                                            >> "%RAPPORT%"
) else (
    echo logo.ico   : ABSENT                                             >> "%RAPPORT%"
)

echo. >> "%RAPPORT%"
echo =================================================================  >> "%RAPPORT%"
echo                       FIN DU RAPPORT                                >> "%RAPPORT%"
echo =================================================================  >> "%RAPPORT%"

REM ---- Affichage du rapport a l'ecran ----
echo.
echo ===================================================================
echo   DIAGNOSTIC NARR'IA TERMINE
echo ===================================================================
echo.
echo Le rapport complet est dans :
echo   %RAPPORT%
echo.
echo --- Contenu du rapport ---
echo.
type "%RAPPORT%"
echo.
echo ===================================================================
echo IMPORTANT : Verifiez sur votre Bureau si vous voyez des fichiers
echo nommes TEST_NARRIA.txt apparus sur le bureau, et a quel endroit.
echo Cela nous dira exactement quel Bureau Windows utilise.
echo ===================================================================
echo.
echo Appuyez sur une touche pour fermer...
pause >nul
exit /b 0
