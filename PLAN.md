# ColorizeGAN Roadmap

Goal: turn ColorizeGAN into a **website on Vercel** where anyone can upload a
black-and-white photo and get a colorized version, with everything working
end to end. The model runs **inside the visitor's browser** (no server), so
hosting stays free and photos never leave the user's device.

Work through the phases in order. Each phase is one branch and one PR, and is
only "done" when every item under **Done when** has been checked.

---

## Where things stand (2026-11-07)

| Item | State |
|---|---|
| Repo | `github.com/kripashankarcs3/ColorizeGAN`, only `main`, every PR merged |
| Phases 0-3 | Done: MIT license, ONNX export with parity check, web app, unit + e2e tests, CI |
| Phase 4 | Config ready (`vercel.json`). **Waiting on the owner** to import the repo on vercel.com |
| Phase 5 | Code ready (`app/archs/v2.py`, `app/train_v2.py`, Colab notebook). **Waiting on a GPU training run** |
| Phase 6 | `tools/evaluate.py` ready, runs after v2 is trained |
| Tests | `pytest`: 19 passed, 1 skipped. Web: 24 unit + 3 e2e |
| Model | v1 `app/model/CCGAN_Model.h5`, `120x120x1` grey to `120x120x3` RGB, served as `web/public/models/colorize.onnx` |

### Local environment notes

- Python comes from uv: CPython 3.11.16, installed under `%APPDATA%\uv\python\`.
  `py -3.11` is not installed; `setup.bat` falls back to `uv python find 3.11`.
- Node 24 and npm 11 are installed, which the web app needs.
- Run tests: `.venv\Scripts\python.exe -m pytest -q`

---

## Target architecture

```
                          Vercel (static hosting, free)
 ┌───────────────────────────────────────────────────────────────┐
 │ web/ (Vite + React + TypeScript)                              │
 │                                                               │
 │  Upload / drag-drop ─► preprocess.ts ─► onnxruntime-web ─►    │
 │  (PNG/JPG/JPEG)        grey (BT.601)    colorize.onnx         │
 │                        resize 120x120   (WASM, in browser)    │
 │                        scale to 0..1          │               │
 │                                               ▼               │
 │  Before/after slider ◄── postprocess.ts: clip, x255,          │
 │  + Download PNG          resize back to the original size     │
 └───────────────────────────────────────────────────────────────┘

 Python (local / Colab): train  ─►  .h5  ─►  export_onnx.py  ─►  web/public/models/colorize.onnx
```

Why this design:
- The model is small (5.7 MB, 120 px input), so browser inference takes well
  under a second on a normal laptop.
- No backend means no server cost, no cold starts and no TensorFlow size limits
  on Vercel.
- Python stays the source of truth for training. The website only consumes the
  exported ONNX file, so a better model (Phase 5) ships by replacing a single file.

### Repo layout after Phase 3

```
ColorizeGAN/
├── app/            # Python: model architecture, training, inference, desktop UI
├── tools/
│   └── export_onnx.py      # .h5 to .onnx, plus an output check against Keras
├── tests/          # pytest (Python side)
├── web/            # the website
│   ├── public/models/colorize.onnx
│   ├── public/samples/     # bundled sample photos
│   ├── src/lib/            # preprocess, inference, postprocess
│   ├── src/components/     # Upload, CompareSlider, Gallery, ...
│   ├── src/pages/          # Home, Colorize, Gallery, About
│   └── tests/              # Vitest unit tests + Playwright e2e
├── vercel.json
├── PLAN.md
└── CLAUDE.md
```

---

## Phase 0: Repo housekeeping
Branch: `chore/repo-housekeeping`

1. Merge the three open PRs into `main` in order.
2. **License decision.** Settled: the owner released the project under the MIT
   License (`LICENSE`). The website credits Color Craft GAN (Asirwad) for the
   generator architecture.
3. Make `setup.bat` fall back to `uv python find 3.11` when `py -3.11` is not
   available.
4. Add GitHub Actions CI that runs `pytest` on push and PR. It gets extended
   with the web tests in Phase 3.

**Done when:** `main` contains all earlier work, a fresh clone plus `setup.bat`
works on this laptop, the CI badge is green, and the license question has an
answer recorded in the README.

---

## Phase 1: Export the model to ONNX
Branch: `feat/onnx-export`

1. Add `tf2onnx` and `onnxruntime` to `requirements-train.txt`. Pin versions
   that support TF 2.15.
2. Write `tools/export_onnx.py`, which:
   - loads `app/model/CCGAN_Model.h5`;
   - exports with a dynamic batch dimension and opset 13 or newer;
   - writes the result to `web/public/models/colorize.onnx`;
   - runs the same 5 inputs through Keras and through ONNX Runtime (the 2
     sample photos plus random arrays) and fails if any pixel differs by more
     than `1e-4`.
3. Add a pytest test that runs the parity check.
4. Optional: add `--fp16` to produce a roughly 2.9 MB model, but only if the
   parity check still passes with a looser tolerance.

**Done when:** `colorize.onnx` exists, the parity test passes, and a Python
script that runs the ONNX file on `building_GL.jpg` produces an image that
matches the desktop app's output visually.

---

## Phase 2: Web app MVP
Branch: `feat/web-app`

Stack: **Vite + React + TypeScript**, `onnxruntime-web` (WASM backend),
plain CSS modules or Tailwind. The visual style follows the desktop app: dark
navy background, blue `#3B82F6` accent, and the gradient "C" logo.

### 2a. Inference core (`web/src/lib/`)
Copy the Python pipeline (`app/colorize.py`) step for step, otherwise the
results will differ:

| Step | Python today | Browser version |
|---|---|---|
| Validate | extension .png/.jpg/.jpeg | Same check, plus try to decode the image and show a friendly error if that fails |
| Greyscale | PIL `convert("L")` = `0.299R + 0.587G + 0.114B` | Apply the same formula to the canvas pixel data |
| Resize to 120 | PIL LANCZOS | Use the `pica` library (Lanczos). Plain canvas resizing is bilinear and gives slightly different results |
| Normalise | `/255`, float32, shape `[1,120,120,1]` (NHWC) | Same layout, `Float32Array` of length 14400 |
| Infer | Keras `predict` | `ort.InferenceSession`, created once and cached (same idea as `_load_generator`) |
| Postprocess | clip 0..1, ×255, uint8 | Same |
| Restore size | PIL LANCZOS to the original size | `pica` resize back to the original size |
| Output | PNG | `canvas.toBlob("image/png")` for download |

- Run inference in a **Web Worker** so the page never freezes. This plays the
  same role as `QThread` in the desktop app.
- Serve the onnxruntime WASM files from `public/`. Do not load them from a
  CDN, so the site still works if the CDN is blocked.
- Very large uploads (for example 8000 px): resize to at most 4096 px on the
  long side before processing to avoid running out of memory, and tell the user.

### 2b. Pages, matching the desktop app
1. **Home**: hero text, "Start Colorizing" and "Explore Gallery" buttons, and
   3 feature cards.
2. **Colorize**: drag-and-drop or file picker, side-by-side preview, a
   **before/after slider**, a "Colorize" button with a spinner and timing,
   "Download PNG", and "Clear".
3. **Gallery**: the 2 bundled samples (`Dog_GL.jpg`, `building_GL.jpg`), each
   with a "Colorize sample" button that runs the real pipeline.
4. **About**: architecture summary, limitations (plausible colours, not
   historical truth), and credits.
5. Footer: privacy line ("Your photos never leave your device"), GitHub link
   and credits.

### 2c. Quality
- Responsive down to 360 px phone width.
- Keyboard accessible, with alt text and visible focus.
- Loading state while the model downloads the first time (~6 MB), cached
  afterwards.
- Errors: unsupported file, unreadable image, model failed to load, WebAssembly
  unsupported. Each one shows a clear message, never a blank screen.

**Done when:** `npm run dev` works locally, both gallery samples colorize, a
random phone photo colorizes, download gives a PNG at the original size, and
the browser output for `building_GL.jpg` is visually the same as the desktop
app output (a small pixel difference from resizing is acceptable).

---

## Phase 3: Tests for the website
Branch: `test/web`

1. **Vitest unit tests**: greyscale formula, tensor shape and range, clipping,
   and output size equal to input size.
2. **Parity test**: a fixed 120×120 input tensor goes through ONNX in Node
   (`onnxruntime-node`) and is compared with a reference output saved by
   `tools/export_onnx.py`, tolerance `1e-4`.
3. **Playwright end-to-end tests**: open the site, upload `building_GL.jpg`,
   wait for the result, and check that the output is coloured (mean channel
   difference above a threshold, so not grey) and that the download works. One
   more test checks that a `.gif` upload shows an error.
4. Extend CI to run `npm ci && npm test && npx playwright test` in `web/`.

**Done when:** all tests pass locally and in CI.

---

## Phase 4: Deploy on Vercel
Branch: `chore/vercel-deploy`

1. `vercel.json` at the repo root:
   - build: `cd web && npm ci && npm run build`
   - output: `web/dist`
   - headers: long cache for `/models/*` and the WASM files; correct
     `application/wasm` MIME type.
2. Import the repo in the Vercel dashboard. Every push to `main` deploys to
   production, and every PR gets a preview URL.
3. SEO and sharing: title, description, Open Graph image (before/after
   collage), favicon from the new icon.
4. Optional: custom domain, and Vercel Analytics (privacy-friendly, no cookies).
5. Update the README with the live link and a screenshot.

**Done when:** the production URL works on Chrome, Edge, Firefox and a phone,
Lighthouse scores are at least 90 for performance and accessibility, and a PR
preview URL is generated automatically.

---

## Phase 5: Better model (Google Colab)
Branch: `feat/model-v2`

1. Colab notebook `notebooks/train_colab.ipynb` with GPU, which downloads the
   dataset, trains, and saves the model to Drive.
2. Move to **Lab colour space**: the model predicts only the a and b channels.
   The website then keeps the full-resolution L channel from the original
   photo, which makes results much sharper.
3. Generator loss = L1 + λ·adversarial, so the discriminator actually affects
   the generator.
4. Raise the resolution to 256×256.
5. Re-export with `tools/export_onnx.py`. The browser pre- and post-processing
   switch to the Lab pipeline, and both models are kept behind a version flag
   until v2 is proven.
6. Keep the browser model under about 25 MB, using fp16 or quantisation if
   needed.

**Done when:** v2 scores better than v1 on the Phase 6 metrics and the website
runs v2 smoothly.

---

## Phase 6: Metrics
Branch: `feat/evaluation`

- `tools/evaluate.py` computes PSNR, SSIM and LPIPS on the validation split for
  v1 and v2.
- A results table goes in the README and on the About page.

---

## Later / optional

- Batch mode: colorize several photos and download them as a ZIP.
- Saturation and warmth sliders on the result.
- Installable site (PWA) that works offline after the first visit.
- Restoration step before colorizing (denoise and scratch removal).
- Desktop app: either keep it as is (it shares `app/colorize.py`), or retire
  the PyQt UI once the website covers everything. Decide after Phase 4.

---

## Risks to watch

| Risk | Mitigation |
|---|---|
| `tf2onnx` does not support some layer | All layers are standard Conv2D / Conv2DTranspose / LeakyReLU / Concatenate, which are well supported. If export fails, try a SavedModel export first, then convert |
| Browser output differs from Python | Lanczos via `pica`, the same BT.601 greyscale formula, and the parity tests in Phase 3 |
| WebAssembly slow on old phones | Show the spinner and timing; 120 px inference is light. Add the WebGPU backend later if needed |
| License of the inherited code | Settle it in Phase 0, before the site goes public |
