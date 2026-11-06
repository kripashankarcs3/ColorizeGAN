"""Pure-numpy sRGB <-> CIE Lab (D65) plus the v2 model pre/post-processing.

Everything here is deliberately simple so it can be re-implemented 1:1 in
TypeScript for the website.

Conventions
-----------
* RGB: float in [0, 1] (sRGB, gamma encoded), shape (..., 3).
* Lab: L in [0, 100], a and b roughly in [-128, 127].
* v2 model input : L scaled to [-1, 1] via ``L / 50 - 1``, shape (1, S, S, 1).
* v2 model output: ab scaled to [-1, 1] via ``ab / 128`` (tanh), shape (1, S, S, 2).

Pipeline (website must do the same)
-----------------------------------
1. Convert the photo to Lab at full resolution -> ``L_full``.
2. Bilinearly resize ``L_full`` to SxS (half-pixel centres), scale to [-1, 1].
3. Run the model -> ab_small (SxSx2).
4. Bilinearly resize ab_small * 128 to the full resolution.
5. Stack ``L_full`` + ab_full, Lab -> sRGB, clip to [0, 1].
The full-resolution L is what keeps the result sharp.
"""

import numpy as np

# D65 reference white (matches skimage.color default, 2 degree observer).
WHITE = np.array([0.95047, 1.0, 1.08883], dtype=np.float64)

_RGB2XYZ = np.array(
    [
        [0.412453, 0.357580, 0.180423],
        [0.212671, 0.715160, 0.072169],
        [0.019334, 0.119193, 0.950227],
    ],
    dtype=np.float64,
)
_XYZ2RGB = np.linalg.inv(_RGB2XYZ)

_EPS = 0.008856  # (6/29)^3
_KAPPA_LIN = 7.787  # slope of the linear part of f()
_OFFSET = 16.0 / 116.0


def _srgb_to_linear(c):
    return np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)


def _linear_to_srgb(c):
    c = np.clip(c, 0.0, None)
    return np.where(c > 0.0031308, 1.055 * np.power(c, 1 / 2.4) - 0.055, 12.92 * c)


def rgb_to_lab(rgb):
    """sRGB float [0,1] (...,3) -> Lab (...,3) float32."""
    rgb = np.clip(np.asarray(rgb, dtype=np.float64), 0.0, 1.0)
    xyz = _srgb_to_linear(rgb) @ _RGB2XYZ.T
    t = xyz / WHITE
    f = np.where(t > _EPS, np.cbrt(t), _KAPPA_LIN * t + _OFFSET)
    L = 116.0 * f[..., 1] - 16.0
    a = 500.0 * (f[..., 0] - f[..., 1])
    b = 200.0 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], axis=-1).astype(np.float32)


def lab_to_rgb(lab):
    """Lab (...,3) -> sRGB float [0,1] (...,3) float32 (clipped)."""
    lab = np.asarray(lab, dtype=np.float64)
    fy = (lab[..., 0] + 16.0) / 116.0
    fx = fy + lab[..., 1] / 500.0
    fz = fy - lab[..., 2] / 200.0
    f = np.stack([fx, fy, fz], axis=-1)
    t = np.where(f ** 3 > _EPS, f ** 3, (f - _OFFSET) / _KAPPA_LIN)
    xyz = t * WHITE
    rgb = _linear_to_srgb(xyz @ _XYZ2RGB.T)
    return np.clip(rgb, 0.0, 1.0).astype(np.float32)


def resize_bilinear(arr, out_h, out_w):
    """Bilinear resize of (H, W) or (H, W, C) with half-pixel centres."""
    arr = np.asarray(arr, dtype=np.float32)
    squeeze = arr.ndim == 2
    if squeeze:
        arr = arr[..., None]
    h, w = arr.shape[:2]

    def coords(n_out, n_in):
        c = (np.arange(n_out, dtype=np.float64) + 0.5) * n_in / n_out - 0.5
        c = np.clip(c, 0, n_in - 1)
        i0 = np.floor(c).astype(int)
        i1 = np.minimum(i0 + 1, n_in - 1)
        return i0, i1, (c - i0).astype(np.float32)

    y0, y1, wy = coords(out_h, h)
    x0, x1, wx = coords(out_w, w)
    wy = wy[:, None, None]
    wx = wx[None, :, None]
    top = arr[y0][:, x0] * (1 - wx) + arr[y0][:, x1] * wx
    bot = arr[y1][:, x0] * (1 - wx) + arr[y1][:, x1] * wx
    out = top * (1 - wy) + bot * wy
    return out[..., 0] if squeeze else out


def rgb_to_model_input(image, size=256):
    """Prepare a photo for the v2 model.

    ``image``: PIL image or uint8/float array (H, W, 3 or 1).
    Returns ``(L_full, model_input)``: L_full (H, W) in [0, 100] at the original
    resolution, model_input (1, size, size, 1) in [-1, 1].
    """
    arr = np.asarray(image)
    integer = np.issubdtype(arr.dtype, np.integer)
    if arr.ndim == 2:
        arr = arr[..., None]
    if arr.shape[-1] == 1:
        arr = np.repeat(arr, 3, axis=-1)
    arr = arr[..., :3].astype(np.float32)
    if integer:
        arr = arr / 255.0
    L_full = rgb_to_lab(arr)[..., 0]
    small = resize_bilinear(L_full, size, size)
    return L_full, (small / 50.0 - 1.0)[None, ..., None].astype(np.float32)


def model_output_to_rgb(L_full, ab_low):
    """Recombine full-resolution L with a low-resolution ab prediction.

    ``L_full``: (H, W) in [0, 100]. ``ab_low``: (h, w, 2) or (1, h, w, 2) in [-1, 1].
    Returns float32 RGB (H, W, 3) in [0, 1].
    """
    ab_low = np.asarray(ab_low, dtype=np.float32)
    if ab_low.ndim == 4:
        ab_low = ab_low[0]
    h, w = L_full.shape
    ab = resize_bilinear(ab_low * 128.0, h, w)
    lab = np.concatenate([np.asarray(L_full, dtype=np.float32)[..., None], ab], axis=-1)
    return lab_to_rgb(lab)
