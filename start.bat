@echo off
goto main
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem (padding - keeps an older running window from misreading this file)
rem -------------------
:oldexit
goto :eof
:main
title Magora Store - website + API
cd /d "%~dp0"
echo.
echo  ==== Magora Store ====
echo.

where node >nul 2>nul
if not errorlevel 1 goto node_ok
echo  Node.js nahi mila - Node.js LTS install ho raha hai (winget)...
winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
set "PATH=%PATH%;C:\Program Files\nodejs"
where node >nul 2>nul
if errorlevel 1 goto no_node

:node_ok
for /f "delims=" %%v in ('node -v') do echo  Node %%v
echo NODE_OK> start-log.txt

rem --- stop an older copy of the store that may still be running (ports 3000 / 4000) ---
for %%p in (3000 4000) do (
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr /r /c:":%%p .*LISTENING"') do taskkill /f /pid %%a >nul 2>nul
)

rem --- install / update packages when package-lock.json changed ---
set TRY=0
:install
set NEED=0
if not exist node_modules\.bin\tsx.cmd set NEED=1
if not exist node_modules\next\package.json set NEED=1
if not exist node_modules\.mg-lock set NEED=1
if exist node_modules\.mg-lock fc /b package-lock.json node_modules\.mg-lock >nul 2>nul || set NEED=1
if "%NEED%"=="0" goto installed
set /a TRY+=1
if %TRY% GTR 4 goto err
echo  [1/3] Packages install / update ho rahe hain (koshish %TRY%/4)...
call npm install --no-audit --no-fund --fetch-retries=6 --fetch-retry-mintimeout=15000 --fetch-retry-maxtimeout=120000 >> start-log.txt 2>&1
if exist node_modules\next\package.json copy /y package-lock.json node_modules\.mg-lock >nul
goto install

:installed
echo INSTALL_OK>> start-log.txt

if exist apps\api\data\store.db goto setup_ok
echo  [2/3] Database aur demo products ban rahe hain...
call npm run setup >> start-log.txt 2>&1
if not exist apps\api\data\store.db goto err

:setup_ok
echo SETUP_OK>> start-log.txt
rem add new categories / products / phones (never overwrites your own edits)
call npm run db:seed -w @magora/api >> start-log.txt 2>&1
echo  [3/3] Website start ho rahi hai (naye database tables khud ban jayenge)...
echo.
echo   Website:   http://localhost:3000
echo   Admin:     http://localhost:3000/admin
echo   API docs:  http://localhost:4000/docs
echo.
echo   Band karne ke liye yeh window close kar dein.
echo.
echo RUNNING>> start-log.txt
start "" /b cmd /c "timeout /t 15 >nul & start http://localhost:3000"
call npm run dev
goto :eof

:no_node
echo  Node.js install nahi ho saka. https://nodejs.org se LTS install karein, phir start.bat dobara chalayein.
echo NODE_MISSING> start-log.txt
pause
goto :eof

:err
echo.
echo  Kuch masla aa gaya. Details start-log.txt mein hain.
echo FAILED>> start-log.txt
pause
