from pathlib import Path

import numpy as np
import pytest
from PIL import Image

import app.colorize as colorize_module
from app.colorize import DEFAULT_MODEL_PATH, _validate_input_path, colorize


def test_validate_input_path_accepts_supported_image(tmp_path: Path):
    image = tmp_path / "photo.JPG"
    image.write_bytes(b"image")
    assert _validate_input_path(image) == image.resolve()


def test_validate_input_path_rejects_unsupported_extension(tmp_path: Path):
    document = tmp_path / "photo.gif"
    document.write_bytes(b"image")
    with pytest.raises(ValueError, match="PNG, JPG, or JPEG"):
        _validate_input_path(document)


SAMPLE = Path(__file__).resolve().parents[1] / "app" / "test" / "Dog_GL.jpg"
needs_model = pytest.mark.skipif(
    not DEFAULT_MODEL_PATH.is_file(), reason="bundled model is missing"
)


def _make_image(path: Path, size=(40, 30)) -> Path:
    Image.new("L", size, 128).save(path)
    return path


def test_colorize_missing_model_raises(tmp_path: Path):
    image = _make_image(tmp_path / "in.png")
    with pytest.raises(FileNotFoundError, match="Generator weights are missing"):
        colorize(image, tmp_path / "out.png", model_path=tmp_path / "nope.h5")


def test_colorize_invalid_image_raises_value_error(tmp_path: Path):
    bad = tmp_path / "bad.png"
    bad.write_bytes(b"not an image")
    model = tmp_path / "dummy.h5"
    model.write_bytes(b"x")
    with pytest.raises(ValueError, match="not a readable image"):
        colorize(bad, tmp_path / "out.png", model_path=model)


@needs_model
def test_colorize_end_to_end(tmp_path: Path):
    source = SAMPLE if SAMPLE.is_file() else _make_image(tmp_path / "in.png")
    output = colorize(source, tmp_path / "out.png")
    assert output.is_file()
    with Image.open(source) as src, Image.open(output) as result:
        assert result.mode == "RGB"
        assert result.size == src.size


def test_generator_is_cached(tmp_path: Path, monkeypatch):
    calls = []

    class FakeGenerator:
        def predict(self, data, verbose=0):
            return np.zeros((1, 120, 120, 3), dtype="float32")

    def fake_load_model(path, compile=False):
        calls.append(path)
        return FakeGenerator()

    monkeypatch.setattr(colorize_module, "load_model", fake_load_model)
    colorize_module._load_generator.cache_clear()
    model = tmp_path / "dummy.h5"
    model.write_bytes(b"x")
    image = _make_image(tmp_path / "in.png")
    colorize(image, tmp_path / "a.png", model_path=model)
    colorize(image, tmp_path / "b.png", model_path=model)
    assert len(calls) == 1
    colorize_module._load_generator.cache_clear()
