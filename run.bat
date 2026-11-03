@echo off
if not exist ".venv\Scripts\python.exe" (
  echo Run setup.bat first.
  exit /b 1
)
call ".venv\Scripts\activate.bat"
python -m app.ui.main_ui
