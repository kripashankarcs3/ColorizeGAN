from pathlib import Path

import pytest

from app.colorize import _validate_input_path


def test_validate_input_path_accepts_supported_image(tmp_path: Path):
    image = tmp_path / "photo.JPG"
    image.write_bytes(b"image")
    assert _validate_input_path(image) == image.resolve()


def test_validate_input_path_rejects_unsupported_extension(tmp_path: Path):
    document = tmp_path / "photo.gif"
    document.write_bytes(b"image")
    with pytest.raises(ValueError, match="PNG, JPG, or JPEG"):
        _validate_input_path(document)
