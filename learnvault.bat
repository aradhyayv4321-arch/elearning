@echo off
REM ═══════════════════════════════════════════════
REM  LearnVault — Application Launcher
REM  Double-click this file to start the platform
REM ═══════════════════════════════════════════════
title LearnVault - Secure E-Learning Platform
color 0B

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║       LearnVault - E-Learning Platform       ║
echo  ║           Secure. Trusted. Sealed.           ║
echo  ╚══════════════════════════════════════════════╝
echo.

REM ── Check Python ────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo         Please install Python 3.10+ from https://python.org
    pause
    exit /b 1
)
echo [OK] Python found.

REM ── Navigate to backend ─────────────────────────
cd /d "%~dp0backend"
if not exist "main.py" (
    echo [ERROR] Cannot find backend\main.py
    echo         Make sure this script is in the elearning folder.
    pause
    exit /b 1
)
echo [OK] Backend directory found.

REM ── Install / update dependencies ───────────────
echo.
echo [..] Installing dependencies (first run may take a moment)...
pip install fastapi uvicorn sqlalchemy pydantic[email] openpyxl pandas reportlab python-multipart >nul 2>&1
if errorlevel 1 (
    echo [WARN] Some dependencies may not have installed. Trying anyway...
)
echo [OK] Dependencies ready.

REM ── Create required directories ─────────────────
if not exist "uploads" mkdir uploads
if not exist "certificates" mkdir certificates
echo [OK] Directories ready.

REM ── Launch server ───────────────────────────────
echo.
echo ══════════════════════════════════════════════════
echo  Starting LearnVault Server...
echo  Homepage:    http://127.0.0.1:8003
echo  Student:     http://127.0.0.1:8003/pages/student-login.html
echo  Admin:       http://127.0.0.1:8003/pages/admin-login.html
echo ══════════════════════════════════════════════════
echo.
echo  Admin Login:  pro@learningvault.com / Test@vault26
echo.
echo  Press Ctrl+C to stop the server.
echo ══════════════════════════════════════════════════
echo.

REM ── Open browser after 2 seconds ────────────────
start "" /B cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:8003"

REM ── Start the server ────────────────────────────
python -m uvicorn main:app --host 127.0.0.1 --port 8003 --reload

echo.
echo  Server stopped. Goodbye!
pause
