# ColorizeGAN: working notes

Start every session by reading `PLAN.md`. Find the first phase whose
**Done when** items are not all met and continue from there.

## Project

- Grey photo to colour photo with a small Keras generator
  (`app/model/CCGAN_Model.h5`, `120x120x1` in, `120x120x3` out, values 0 to 1).
- Inference lives in `app/colorize.py`. It is the reference pipeline the
  website must match.
- Goal: a website on Vercel with the model running in the browser through
  ONNX. See `PLAN.md`.

## Rules

- Work on a feature branch per phase (`feat/`, `fix/`, `chore/`, `test/`,
  `docs/`). Never commit straight to `main`. Push to `origin`
  (`kripashankarcs3/ColorizeGAN`).
- Commits and PRs carry only the owner's identity: no AI co-author lines and
  no "Generated with" footers.
- Keep the README credit to ReMemory AI and Color Craft GAN.
- Run the tests before every push: `.venv\Scripts\python.exe -m pytest -q`,
  plus the web tests once `web/` exists.
- The owner is a beginner/intermediate developer. End each phase with a short
  Hinglish summary of what changed and how it was verified.
- `C:\Users\kripa\Downloads\CLAUDE.md` belongs to a different project (Stonic
  AI / REA). Ignore it here.

## Environment (Windows)

- Python 3.11.16 from uv (`%APPDATA%\uv\python\cpython-3.11.16-windows-x86_64-none`).
  `py -3.11` is not installed. The `.venv` is gitignored; recreate it with
  `<uv python> -m venv .venv` and `pip install -r requirements.txt`.
- Node 24 and npm 11 are available for `web/`.
- `gh` CLI is not logged in, so open PRs through the GitHub link that
  `git push` prints.
- Desktop app: `run.bat`. CLI: `.venv\Scripts\python.exe -m app.main_CLI_v1 <image>`.
