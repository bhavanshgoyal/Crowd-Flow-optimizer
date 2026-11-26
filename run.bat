@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"
set "VENV_PY=%BACKEND%\.venv\Scripts\python.exe"

REM ---- Backend: create a virtual environment the first time ----
if not exist "%VENV_PY%" (
    echo Creating backend virtual environment - this only happens once...
    python -m venv "%BACKEND%\.venv"
    if errorlevel 1 (
        echo.
        echo Could not create a virtual environment. Is Python 3.10+ installed and on PATH?
        pause
        exit /b 1
    )
)

echo.
echo Checking backend dependencies...
echo (first run installs PyTorch + Transformers for the person-detection layer -
echo  this can take several minutes; every run after this is fast)
"%VENV_PY%" -m pip install --quiet --disable-pip-version-check -r "%BACKEND%\requirements.txt"
if errorlevel 1 (
    echo.
    echo Backend dependency install failed. See the errors above.
    pause
    exit /b 1
)

REM ---- Frontend: npm install the first time ----
if not exist "%FRONTEND%\node_modules" (
    echo Installing frontend dependencies - this only happens once...
    call npm install --prefix "%FRONTEND%"
    if errorlevel 1 (
        echo.
        echo npm install failed. See the errors above.
        pause
        exit /b 1
    )
)

echo.
echo Starting the backend (FastAPI, http://localhost:8000) in its own window...
start "Crowd Flow Optimiser - Backend" cmd /k "cd /d "%BACKEND%" && "%VENV_PY%" -m uvicorn app:app --reload --port 8000"

echo Giving it a few seconds to come up...
timeout /t 4 /nobreak >nul

echo.
echo Starting the frontend (Vite, http://localhost:5173)...
echo A browser tab will open automatically once it's ready.
echo Close this window, or press Ctrl+C, to stop the frontend.
echo The backend runs in its own window - close that separately when you're done.
echo.

pushd "%FRONTEND%"
call npm run dev -- --open
popd

endlocal
