"""Inference helpers for the ReMemory AI generator."""

from pathlib import Path
from typing import Optional, Union

import numpy as np
from PIL import Image, UnidentifiedImageError
from tensorflow.keras.models import load_model


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL_PATH = PROJECT_ROOT / "app" / "model" / "CCGAN_Model.h5"
SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg"}
IMAGE_SIZE = (120, 120)


def _validate_input_path(filepath: Union[str, Path]) -> Path:
    path = Path(filepath).expanduser().resolve()
    if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise ValueError("Please select a PNG, JPG, or JPEG image.")
    if not path.is_file():
        raise FileNotFoundError(f"Input image was not found: {path}")
    return path


def colorize(
    filepath: Union[str, Path],
    output_path: Optional[Union[str, Path]] = None,
    model_path: Union[str, Path] = DEFAULT_MODEL_PATH,
) -> Path:
    """Run the saved generator on an image and save a full-size colorized copy."""
    input_path = _validate_input_path(filepath)
    model_file = Path(model_path).expanduser().resolve()
    if not model_file.is_file():
        raise FileNotFoundError(
            f"Generator weights are missing: {model_file}. "
            "Place the trained CCGAN_Model.h5 file at app/model/."
        )

    try:
        with Image.open(input_path) as source:
            original_size = source.size
            grayscale = source.convert("L")
            model_input = np.asarray(
                grayscale.resize(IMAGE_SIZE, Image.Resampling.LANCZOS),
                dtype=np.float32,
            ) / 255.0
    except UnidentifiedImageError as exc:
        raise ValueError("The selected file is not a readable image.") from exc

    generator = load_model(model_file, compile=False)
    prediction = generator.predict(model_input[None, ..., None], verbose=0)
    if prediction.ndim != 4 or prediction.shape[0] != 1 or prediction.shape[-1] != 3:
        raise RuntimeError(
            f"Generator returned an unexpected output shape: {prediction.shape}"
        )

    color_array = np.clip(prediction[0], 0.0, 1.0)
    colorized = Image.fromarray((color_array * 255).astype(np.uint8), mode="RGB")
    colorized = colorized.resize(original_size, Image.Resampling.LANCZOS)
    destination = (
        Path(output_path).expanduser().resolve()
        if output_path
        else input_path.with_name(f"{input_path.stem}_colorized.png")
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    colorized.save(destination, format="PNG")
    return destination
