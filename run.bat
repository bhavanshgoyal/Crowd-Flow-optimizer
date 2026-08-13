@echo off
setlocal

cd /d "%~dp0frontend"

if not exist node_modules (
    echo Installing frontend dependencies - this only happens once...
    call npm install
    if errorlevel 1 (
        echo.
        echo npm install failed. See the errors above.
        pause
        exit /b 1
    )
)

echo.
echo Starting Crowd Flow Optimiser frontend...
echo There is no backend yet, so the live control room section will show "Connecting..." until one exists.
echo A browser tab will open automatically once the server is ready.
echo Close this window, or press Ctrl+C, to stop the server.
echo.

call npm run dev -- --open

endlocal
