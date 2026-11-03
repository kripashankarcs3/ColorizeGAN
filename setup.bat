@echo off
setlocal
set "PYTHON="
py -3.11 -c "import sys" >nul 2>&1 && set "PYTHON=py -3.11"
if not defined PYTHON py -3.10 -c "import sys" >nul 2>&1 && set "PYTHON=py -3.10"
if not defined PYTHON (
  echo Python 3.10 or 3.11 is required for TensorFlow 2.15.1.
  exit /b 1
)
if not exist ".venv\Scripts\python.exe" %PYTHON% -m venv .venv
call ".venv\Scripts\activate.bat"
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
echo.
echo ReMemory AI is ready. Run run.bat to start the desktop app.
