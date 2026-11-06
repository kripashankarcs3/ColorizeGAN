"""Export the Keras generator to ONNX and check it against Keras."""

import argparse
import json
import sys
from pathlib import Path
from typing import List

import numpy as np
import onnxruntime as ort
import tensorflow as tf
from PIL import Image

from app.colorize import DEFAULT_MODEL_PATH, IMAGE_SIZE, PROJECT_ROOT, _load_generator


MODEL_DIR = PROJECT_ROOT / "web" / "public" / "models"
FIXTURE_DIR = PROJECT_ROOT / "web" / "tests" / "fixtures"
SAMPLE_PHOTOS = [
    PROJECT_ROOT / "app" / "test" / "Dog_GL.jpg",
    PROJECT_ROOT / "app" / "test" / "building_GL.jpg",
]
PARITY_PHOTO = SAMPLE_PHOTOS[1]
OPSET = 17
TOLERANCE = 1e-4
FP16_TOLERANCE = 1e-2


def preprocess(path: Path) -> np.ndarray:
    """Same preprocessing as app.colorize.colorize, returns [120, 120, 1]."""
    with Image.open(path) as source:
        grayscale = source.convert("L")
        resized = grayscale.resize(IMAGE_SIZE, Image.Resampling.LANCZOS)
    return (np.asarray(resized, dtype=np.float32) / 255.0)[..., None]


def build_inputs() -> List[np.ndarray]:
    inputs = [preprocess(path) for path in SAMPLE_PHOTOS]
    rng = np.random.default_rng(0)
    for _ in range(3):
        inputs.append(rng.random((*IMAGE_SIZE, 1), dtype=np.float32))
    return inputs


def export(model_path: Path, output_path: Path, fp16: bool) -> None:
    import tf2onnx

    model = _load_generator(model_path)
    signature = (tf.TensorSpec([None, *IMAGE_SIZE, 1], tf.float32, name="input"),)
    onnx_model, _ = tf2onnx.convert.from_keras(
        model, input_signature=signature, opset=OPSET
    )
    _rename_output(onnx_model, "output")
    if fp16:
        from onnxconverter_common import float16

        onnx_model = float16.convert_float_to_float16(
            onnx_model, keep_io_types=True
        )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(onnx_model.SerializeToString())


def _rename_output(onnx_model, name: str) -> None:
    old = onnx_model.graph.output[0].name
    if old == name:
        return
    for node in onnx_model.graph.node:
        node.input[:] = [name if i == old else i for i in node.input]
        node.output[:] = [name if o == old else o for o in node.output]
    onnx_model.graph.output[0].name = name


def run_onnx(session: ort.InferenceSession, batch: np.ndarray) -> np.ndarray:
    return session.run(["output"], {"input": batch})[0]


def check_parity(model_path: Path, onnx_path: Path, tolerance: float) -> bool:
    generator = _load_generator(model_path)
    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    ok = True
    for index, sample in enumerate(build_inputs()):
        batch = sample[None]
        expected = generator.predict(batch, verbose=0)
        actual = run_onnx(session, batch)
        diff = float(np.max(np.abs(expected - actual)))
        print(f"input {index}: max abs diff = {diff:.3e}")
        ok = ok and diff <= tolerance
    return ok


def write_fixtures(onnx_path: Path, tolerance: float) -> None:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    sample = preprocess(PARITY_PHOTO)[None]
    output = run_onnx(session, sample)
    sample.astype("<f4").tofile(FIXTURE_DIR / "parity_input.f32")
    output.astype("<f4").tofile(FIXTURE_DIR / "parity_output.f32")
    meta = {
        "source": PARITY_PHOTO.name,
        "input_shape": list(sample.shape),
        "output_shape": list(output.shape),
        "dtype": "float32 little-endian",
        "tolerance": tolerance,
    }
    (FIXTURE_DIR / "parity.json").write_text(json.dumps(meta, indent=2) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL_PATH)
    parser.add_argument("--fp16", action="store_true",
                        help="also write colorize.fp16.onnx (needs onnxconverter-common)")
    args = parser.parse_args()
    model_path = args.model.expanduser().resolve()

    onnx_path = MODEL_DIR / "colorize.onnx"
    export(model_path, onnx_path, fp16=False)
    print(f"wrote {onnx_path} ({onnx_path.stat().st_size / 1e6:.2f} MB)")
    ok = check_parity(model_path, onnx_path, TOLERANCE)
    if not ok:
        print(f"FAILED: difference above {TOLERANCE}")
        return 1
    write_fixtures(onnx_path, TOLERANCE)
    print(f"wrote fixtures to {FIXTURE_DIR}")

    if args.fp16:
        fp16_path = MODEL_DIR / "colorize.fp16.onnx"
        export(model_path, fp16_path, fp16=True)
        print(f"wrote {fp16_path} ({fp16_path.stat().st_size / 1e6:.2f} MB)")
        if not check_parity(model_path, fp16_path, FP16_TOLERANCE):
            print(f"FAILED: fp16 difference above {FP16_TOLERANCE}")
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
