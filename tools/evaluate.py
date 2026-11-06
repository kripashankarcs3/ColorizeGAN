"""Evaluate v1 and v2 colorizers with PSNR, SSIM and (optionally) LPIPS.

Usage (repo root):
    python -m tools.evaluate --data-dir dataset --limit 200 \
        --v2-model outputs/v2/CCGAN_v2.h5 --out results.md

Common resolution: every validation colour photo is resized to 256x256 (bicubic)
and used as ground truth. Both models get the *grayscale of that 256x256 image*:
  * v1: grey -> 120x120 (Lanczos, as app/colorize.py) -> model -> RGB, which is
        upscaled to 256x256 (bicubic).
  * v2: L at 256x256 -> model -> ab (256x256), recombined with that same L.
Metrics are computed on 256x256 RGB in [0, 1]. PSNR/SSIM are averaged over images
(SSIM: gaussian 11x11, sigma 1.5, per channel, data_range 1). LPIPS (AlexNet) needs
the optional `lpips` + `torch` packages; it is skipped with a warning if missing.
"""

import argparse
import sys
import warnings
from pathlib import Path

import numpy as np
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parents[1]
EVAL_SIZE = 256
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}


def psnr(a, b, data_range=1.0):
    mse = float(np.mean((np.asarray(a, np.float64) - np.asarray(b, np.float64)) ** 2))
    if mse == 0:
        return float("inf")
    return 10.0 * np.log10(data_range ** 2 / mse)


def ssim(a, b, data_range=1.0, sigma=1.5):
    """Mean SSIM over channels for (H, W, C) or (H, W) arrays."""
    from scipy.ndimage import gaussian_filter

    a = np.asarray(a, np.float64)
    b = np.asarray(b, np.float64)
    if a.ndim == 2:
        a, b = a[..., None], b[..., None]
    c1, c2 = (0.01 * data_range) ** 2, (0.03 * data_range) ** 2

    def blur(x):  # 11x11 gaussian window
        return gaussian_filter(x, sigma, truncate=3.5, mode="reflect")

    scores = []
    for ch in range(a.shape[-1]):
        x, y = a[..., ch], b[..., ch]
        mx, my = blur(x), blur(y)
        sxx = blur(x * x) - mx * mx
        syy = blur(y * y) - my * my
        sxy = blur(x * y) - mx * my
        s = ((2 * mx * my + c1) * (2 * sxy + c2)) / ((mx ** 2 + my ** 2 + c1) * (sxx + syy + c2))
        scores.append(s.mean())
    return float(np.mean(scores))


class LpipsMetric:
    """Lazy LPIPS; `available` is False if lpips/torch are not installed."""

    def __init__(self):
        self.available = False
        try:
            import lpips
            import torch

            self._torch = torch
            self._net = lpips.LPIPS(net="alex", verbose=False)
            self.available = True
        except Exception as exc:  # ImportError or weight download failure
            warnings.warn(f"LPIPS skipped ({type(exc).__name__}: {exc}). "
                          "Install `lpips` and `torch` to enable it.")

    def __call__(self, a, b):
        t = self._torch
        x = t.from_numpy(np.asarray(a, np.float32) * 2 - 1).permute(2, 0, 1)[None]
        y = t.from_numpy(np.asarray(b, np.float32) * 2 - 1).permute(2, 0, 1)[None]
        with t.no_grad():
            return float(self._net(x, y).item())


def list_images(directory):
    return [p for p in sorted(Path(directory).iterdir())
            if p.suffix.lower() in IMAGE_EXTENSIONS]


def find_validation_dir(data_dir):
    data_dir = Path(data_dir)
    for cand in (data_dir / "validation" / "color", data_dir / "color", data_dir):
        if cand.is_dir() and list_images(cand):
            return cand
    raise FileNotFoundError(f"No validation images under {data_dir}")


def load_ground_truth(path, size=EVAL_SIZE):
    img = Image.open(path).convert("RGB").resize((size, size), Image.Resampling.BICUBIC)
    return img, np.asarray(img, np.float32) / 255.0


def make_v1_predictor(model_path):
    from tensorflow.keras.models import load_model

    model = load_model(model_path, compile=False)

    def predict(rgb_img):
        grey = rgb_img.convert("L").resize((120, 120), Image.Resampling.LANCZOS)
        x = np.asarray(grey, np.float32)[None, ..., None] / 255.0
        out = np.clip(model.predict(x, verbose=0)[0], 0, 1)
        up = Image.fromarray((out * 255).astype(np.uint8)).resize(
            (EVAL_SIZE, EVAL_SIZE), Image.Resampling.BICUBIC)
        return np.asarray(up, np.float32) / 255.0

    return predict


def make_v2_predictor(model_path):
    from tensorflow.keras.models import load_model

    from app.lab import model_output_to_rgb, rgb_to_model_input

    model = load_model(model_path, compile=False)
    size = int(model.input_shape[1])

    def predict(rgb_img):
        # Grey photo -> replicate grey into RGB so only L carries information.
        grey = np.asarray(rgb_img.convert("L"))
        L_full, x = rgb_to_model_input(grey, size)
        ab = model.predict(x, verbose=0)
        return model_output_to_rgb(L_full, ab)

    return predict


def evaluate(predictors, files, lpips_metric=None):
    """Return {name: {"psnr", "ssim", "lpips"|None, "n"}}."""
    acc = {n: {"psnr": [], "ssim": [], "lpips": []} for n in predictors}
    for path in files:
        img, gt = load_ground_truth(path)
        for name, fn in predictors.items():
            pred = np.clip(fn(img), 0, 1)
            acc[name]["psnr"].append(psnr(pred, gt))
            acc[name]["ssim"].append(ssim(pred, gt))
            if lpips_metric is not None and lpips_metric.available:
                acc[name]["lpips"].append(lpips_metric(pred, gt))
    out = {}
    for name, m in acc.items():
        finite = [v for v in m["psnr"] if np.isfinite(v)]
        out[name] = {
            "psnr": float(np.mean(finite)) if finite else float("inf"),
            "ssim": float(np.mean(m["ssim"])),
            "lpips": float(np.mean(m["lpips"])) if m["lpips"] else None,
            "n": len(m["psnr"]),
        }
    return out


def to_markdown(results):
    lines = ["| Model | Images | PSNR (dB) ↑ | SSIM ↑ | LPIPS ↓ |",
             "|---|---|---|---|---|"]
    for name, r in results.items():
        lp = "n/a" if r["lpips"] is None else f"{r['lpips']:.4f}"
        lines.append(f"| {name} | {r['n']} | {r['psnr']:.2f} | {r['ssim']:.4f} | {lp} |")
    return "\n".join(lines)


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--data-dir", default=str(PROJECT_ROOT / "dataset"))
    p.add_argument("--v1-model", default=str(PROJECT_ROOT / "app" / "model" / "CCGAN_Model.h5"))
    p.add_argument("--v2-model", default=None)
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--out", default=None, help="also write the table to this file")
    p.add_argument("--no-lpips", action="store_true")
    a = p.parse_args(argv)

    files = list_images(find_validation_dir(a.data_dir))
    if a.limit:
        files = files[:a.limit]
    predictors = {}
    if a.v1_model and Path(a.v1_model).is_file():
        predictors["v1 (120px RGB)"] = make_v1_predictor(a.v1_model)
    else:
        print(f"v1 model not found ({a.v1_model}); skipping v1", file=sys.stderr)
    if a.v2_model:
        predictors["v2 (256px Lab)"] = make_v2_predictor(a.v2_model)
    if not predictors:
        p.error("no models to evaluate")

    lp = None if a.no_lpips else LpipsMetric()
    table = to_markdown(evaluate(predictors, files, lp))
    print(table)
    if a.out:
        Path(a.out).write_text(table + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
