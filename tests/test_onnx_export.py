from pathlib import Path

import numpy as np
import pytest

ort = pytest.importorskip("onnxruntime")

from app.colorize import DEFAULT_MODEL_PATH, PROJECT_ROOT, _load_generator
from tools.export_onnx import preprocess

ONNX_PATH = PROJECT_ROOT / "web" / "public" / "models" / "colorize.onnx"
FIXTURES = PROJECT_ROOT / "web" / "tests" / "fixtures"
SAMPLES = [
    PROJECT_ROOT / "app" / "test" / "Dog_GL.jpg",
    PROJECT_ROOT / "app" / "test" / "building_GL.jpg",
]

pytestmark = pytest.mark.skipif(
    not ONNX_PATH.is_file(), reason="run python -m tools.export_onnx first"
)


@pytest.fixture(scope="module")
def session():
    return ort.InferenceSession(str(ONNX_PATH), providers=["CPUExecutionProvider"])


def _run(session, batch):
    return session.run(["output"], {"input": batch})[0]


def _inputs():
    rng = np.random.default_rng(1)
    return [preprocess(path) for path in SAMPLES] + [
        rng.random((120, 120, 1), dtype=np.float32)
    ]


def test_onnx_matches_keras(session):
    generator = _load_generator(DEFAULT_MODEL_PATH)
    for sample in _inputs():
        batch = sample[None]
        expected = generator.predict(batch, verbose=0)
        actual = _run(session, batch)
        assert actual.shape == (1, 120, 120, 3)
        assert np.max(np.abs(expected - actual)) <= 1e-4


def test_fixtures_reproduce(session):
    source = np.fromfile(FIXTURES / "parity_input.f32", dtype="<f4")
    expected = np.fromfile(FIXTURES / "parity_output.f32", dtype="<f4")
    assert source.size == 120 * 120
    assert expected.size == 120 * 120 * 3
    actual = _run(session, source.reshape(1, 120, 120, 1))
    assert np.max(np.abs(actual.reshape(-1) - expected)) <= 1e-4
