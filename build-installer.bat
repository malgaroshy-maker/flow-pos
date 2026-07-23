@echo off
title Build FlowPOS Installer

cd /d "%~dp0"

echo ======================================================================
echo                FlowPOS Desktop Installer Builder
echo ======================================================================
echo.

where node >nul 2>&1
if errorlevel 1 goto :no_node
goto :node_ok

:no_node
color 0C
echo [ERROR] Node.js was not found on this system.
echo Please install Node.js before running this script.
echo.
pause
exit /b 1

:node_ok
for /f "tokens=*" %%v in ('node -e "console.log(require('./electron/package.json').version)" 2^>nul') do set VERSION=%%v

echo [*] Target Version : V%VERSION%
echo [*] Project Path   : %~dp0
echo.

echo [*] Cleaning stale build outputs...
node -e "try { require('fs').rmSync('dist-installer', { recursive: true, force: true }); } catch (e) {}"

if not exist "node_modules\" goto :do_install
if not exist "electron\node_modules\" goto :do_install
goto :deps_ok

:do_install
echo [*] Installing dependencies across monorepo workspaces (npm install)...
call npm install
if errorlevel 1 goto :install_failed
goto :deps_ok

:install_failed
color 0C
echo [ERROR] Dependency installation failed (npm install).
echo.
pause
exit /b 1

:deps_ok
echo ----------------------------------------------------------------------
echo  [1/5] Step 1: Typecheck (Server + Web)...
echo ----------------------------------------------------------------------
call npm run typecheck
if errorlevel 1 goto :typecheck_failed

echo.
echo ----------------------------------------------------------------------
echo  [2/5] Step 2: Running Vitest Unit Tests (89 Tests)...
echo ----------------------------------------------------------------------
call npm test
if errorlevel 1 goto :test_failed

echo.
echo ----------------------------------------------------------------------
echo  [3/5] Step 3: Compiling Native Electron Dependencies (ABI 135)...
echo ----------------------------------------------------------------------
call npx node-gyp rebuild --directory=node_modules/better-sqlite3 --runtime=electron --target=36.0.0 --dist-url=https://electronjs.org/headers
if errorlevel 1 goto :rebuild_failed

echo.
echo ----------------------------------------------------------------------
echo  [4/5] Step 4: Packaging Electron Setup Installer V%VERSION%...
echo ----------------------------------------------------------------------
call npm run package
if errorlevel 1 goto :build_failed

echo.
echo ----------------------------------------------------------------------
echo  [5/5] Step 5: Restoring Local Node 24 Native Binary for Dev...
echo ----------------------------------------------------------------------
call npm rebuild better-sqlite3
goto :build_ok

:typecheck_failed
color 0C
echo.
echo [ERROR] Typecheck failed! Build aborted to prevent publishing broken code.
echo.
pause
exit /b 1

:test_failed
color 0C
echo.
echo [ERROR] Unit test suite failed! Build aborted to prevent publishing broken code.
echo.
pause
exit /b 1

:rebuild_failed
color 0C
echo.
echo [ERROR] Native module rebuild failed!
echo.
pause
exit /b 1

:build_failed
color 0C
echo.
echo [ERROR] Packaging failed! Restoring local dev dependencies...
call npm rebuild better-sqlite3
echo.
pause
exit /b 1

:build_ok
color 0A
echo.
echo ======================================================================
echo  [SUCCESS] FlowPOS Setup V%VERSION% Built Successfully!
echo  Installer Directory : %~dp0dist-installer\
if exist "dist-installer\FlowPOS Setup %VERSION%.exe" (
  echo  Installer File      : FlowPOS Setup %VERSION%.exe
)
echo ======================================================================
echo.

start "" "%~dp0dist-installer"

pause
