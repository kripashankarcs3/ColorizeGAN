from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from app.lab import (lab_to_rgb, model_output_to_rgb, resize_bilinear,
                     rgb_to_lab, rgb_to_model_input)


def _random_rgb(n=2000, seed=0):
    return np.random.default_rng(seed).random((n, 3)).astype(np.float32)


def test_lab_known_values():
    lab = rgb_to_lab(np.array([[1, 1, 1], [0, 0, 0], [1, 0, 0]], np.float32))
    assert lab[0] == pytest.approx([100, 0, 0], abs=0.05)
    assert lab[1] == pytest.approx([0, 0, 0], abs=0.05)
    assert lab[2] == pytest.approx([53.24, 80.09, 67.20], abs=0.05)


def test_lab_round_trip():
    rgb = _random_rgb()
    back = lab_to_rgb(rgb_to_lab(rgb))
    assert np.abs(back - rgb).max() < 2e-3


def test_lab_matches_skimage_if_installed():
    color = pytest.importorskip("skimage.color")
    rgb = _random_rgb(500).reshape(1, -1, 3)
    ours = rgb_to_lab(rgb)
    ref = color.rgb2lab(rgb.astype(np.float64))
    assert np.abs(ours - ref).max() < 2e-2


def test_resize_bilinear_constant_and_shape():
    out = resize_bilinear(np.full((7, 9), 3.0, np.float32), 20, 16)
    assert out.shape == (20, 16)
    assert np.allclose(out, 3.0)


def test_preprocess_postprocess_keeps_full_res_L():
    img = (np.random.default_rng(1).random((50, 70, 3)) * 255).astype(np.uint8)
    L_full, x = rgb_to_model_input(img, 64)
    assert L_full.shape == (50, 70)
    assert x.shape == (1, 64, 64, 1) and -1.0 <= x.min() and x.max() <= 1.0
    # Perfect ab prediction at low res should give back roughly the original.
    lab = rgb_to_lab(img.astype(np.float32) / 255.0)
    ab_low = resize_bilinear(lab[..., 1:], 64, 64) / 128.0
    rgb = model_output_to_rgb(L_full, ab_low)
    assert rgb.shape == (50, 70, 3)
    # grey images: ab = 0 -> output luminance equals input luminance
    grey = rgb_to_model_input(np.full((10, 10), 128, np.uint8), 64)[0]
    out = model_output_to_rgb(grey, np.zeros((1, 64, 64, 2), np.float32))
    assert np.abs(out - 128 / 255).max() < 0.01


def test_v2_model_shapes_and_size():
    from app.archs.v2 import get_discriminator_v2, get_generator_v2

    g = get_generator_v2(256)
    d = get_discriminator_v2(256)
    x = np.zeros((2, 256, 256, 1), np.float32)
    y = g(x, training=False).numpy()
    assert y.shape == (2, 256, 256, 2) and np.abs(y).max() <= 1.0
    out = d(np.zeros((2, 256, 256, 3), np.float32), training=False)
    assert out.shape[0] == 2 and out.shape[-1] == 1
    assert g.count_params() * 4 / 1e6 < 25  # fp32 MB


def test_tf_lab_matches_numpy():
    import tensorflow as tf

    from app.train_v2 import tf_rgb_to_lab

    rgb = _random_rgb(300)
    ours = tf_rgb_to_lab(tf.constant(rgb)).numpy()
    assert np.abs(ours - rgb_to_lab(rgb)).max() < 5e-2


def _make_images(directory: Path, n=4, size=64):
    directory.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(3)
    for i in range(n):
        arr = (rng.random((size, size, 3)) * 255).astype(np.uint8)
        Image.fromarray(arr).save(directory / f"{i:05d}.jpg")


def test_train_v2_smoke(tmp_path):
    from app.train_v2 import main

    _make_images(tmp_path / "data" / "train" / "color")
    out = tmp_path / "out"
    main(["--data-dir", str(tmp_path / "data"), "--epochs", "1", "--batch-size", "2",
          "--image-size", "64", "--out-dir", str(out), "--max-steps", "2"])
    model_path = out / "CCGAN_v2.h5"
    assert model_path.is_file()
    assert (out / "samples" / "final.png").is_file()
    from tensorflow.keras.models import load_model

    m = load_model(model_path, compile=False)
    assert m.output_shape == (None, 64, 64, 2)


def test_generator_exports_to_onnx(tmp_path):
    tf2onnx = pytest.importorskip("tf2onnx")
    import tensorflow as tf

    from app.archs.v2 import get_generator_v2

    g = get_generator_v2(64, base=8)
    spec = (tf.TensorSpec((None, 64, 64, 1), tf.float32, name="L"),)
    path = tmp_path / "g.onnx"
    tf2onnx.convert.from_keras(g, input_signature=spec, opset=13, output_path=str(path))
    assert path.stat().st_size > 0


def test_metrics_identical_images():
    from tools.evaluate import psnr, ssim

    a = np.random.default_rng(4).random((64, 64, 3))
    assert psnr(a, a) == float("inf")
    assert ssim(a, a) == pytest.approx(1.0, abs=1e-9)
    noisy = np.clip(a + 0.2 * np.random.default_rng(5).standard_normal(a.shape), 0, 1)
    assert psnr(a, noisy) < 20 and ssim(a, noisy) < 0.9


def test_evaluate_pipeline_with_fake_predictors(tmp_path):
    from tools.evaluate import evaluate, to_markdown

    _make_images(tmp_path, n=2, size=40)
    files = sorted(tmp_path.glob("*.jpg"))
    from tools.evaluate import load_ground_truth


    def oracle(img):
        return np.asarray(img, np.float32) / 255.0

    res = evaluate({"oracle": oracle,
                    "grey": lambda img: np.repeat(np.asarray(img.convert("L"), np.float32)[..., None] / 255, 3, -1)},
                   files)
    assert res["oracle"]["ssim"] == pytest.approx(1.0, abs=1e-6)
    assert res["grey"]["psnr"] < 60
    assert "| oracle |" in to_markdown(res)


def test_v2_predictor_on_trained_model(tmp_path):
    from app.train_v2 import main
    from tools.evaluate import make_v2_predictor

    _make_images(tmp_path / "data" / "train" / "color")
    out = tmp_path / "out"
    main(["--data-dir", str(tmp_path / "data"), "--epochs", "1", "--batch-size", "2",
          "--image-size", "64", "--out-dir", str(out), "--max-steps", "1"])
    pred = make_v2_predictor(out / "CCGAN_v2.h5")(Image.new("RGB", (256, 256), (90, 120, 200)))
    assert pred.shape == (256, 256, 3) and np.isfinite(pred).all()
