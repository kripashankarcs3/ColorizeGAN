"""Train the v2 Lab colorizer (U-Net + PatchGAN, L1 + adversarial).

Usage (from the repo root):
    python -m app.train_v2 --data-dir dataset --epochs 20 --batch-size 16 \
        --out-dir outputs/v2

The data dir is the one made by download_dataset.py:
    <data-dir>/train/color/*.jpg      (and optionally <data-dir>/validation/color)
Only the colour images are used; L and ab are computed from them on the fly.

Saved model format: Keras HDF5 (``CCGAN_v2.h5``), generator only. HDF5 is what
v1 uses, loads with ``load_model(..., compile=False)`` and exports with
tf2onnx / tools/export_onnx.py. (Keras 2.15 -> h5 is fine; do not use
TF 2.16+/Keras 3 to load it.)
"""

import argparse
import os
from pathlib import Path

import numpy as np
import tensorflow as tf
from PIL import Image

from app.archs.v2 import get_discriminator_v2, get_generator_v2

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}

# ---- TensorFlow Lab (same maths as app/lab.py, see tests) ------------------
_WHITE = tf.constant([0.95047, 1.0, 1.08883], tf.float32)
_RGB2XYZ = tf.constant(
    [[0.412453, 0.357580, 0.180423],
     [0.212671, 0.715160, 0.072169],
     [0.019334, 0.119193, 0.950227]], tf.float32)


def tf_rgb_to_lab(rgb):
    """rgb float [0,1] (...,3) -> Lab (...,3) (L 0..100, ab about +-128)."""
    rgb = tf.clip_by_value(rgb, 0.0, 1.0)
    lin = tf.where(rgb > 0.04045, tf.pow((rgb + 0.055) / 1.055, 2.4), rgb / 12.92)
    xyz = tf.linalg.matmul(lin, _RGB2XYZ, transpose_b=True)
    t = xyz / _WHITE
    f = tf.where(t > 0.008856, tf.pow(tf.maximum(t, 1e-8), 1.0 / 3.0),
                 7.787 * t + 16.0 / 116.0)
    L = 116.0 * f[..., 1] - 16.0
    a = 500.0 * (f[..., 0] - f[..., 1])
    b = 200.0 * (f[..., 1] - f[..., 2])
    return tf.stack([L, a, b], axis=-1)


def list_images(directory):
    directory = Path(directory)
    return [str(p) for p in sorted(directory.iterdir())
            if p.suffix.lower() in IMAGE_EXTENSIONS]


def make_dataset(files, img_size, batch_size, training):
    """tf.data pipeline yielding (L in [-1,1], ab in [-1,1])."""

    def load(path):
        img = tf.io.decode_image(tf.io.read_file(path), channels=3,
                                 expand_animations=False)
        img = tf.image.resize(img, (img_size, img_size), method="bilinear",
                              antialias=True)
        img = tf.clip_by_value(img / 255.0, 0.0, 1.0)
        if training:
            img = tf.image.random_flip_left_right(img)
        lab = tf_rgb_to_lab(img)
        L = lab[..., :1] / 50.0 - 1.0
        ab = tf.clip_by_value(lab[..., 1:] / 128.0, -1.0, 1.0)
        L.set_shape((img_size, img_size, 1))
        ab.set_shape((img_size, img_size, 2))
        return L, ab

    ds = tf.data.Dataset.from_tensor_slices(files)
    if training:
        ds = ds.shuffle(min(len(files), 2048), reshuffle_each_iteration=True)
    ds = ds.map(load, num_parallel_calls=tf.data.AUTOTUNE)
    ds = ds.batch(batch_size, drop_remainder=training)
    return ds.prefetch(tf.data.AUTOTUNE)


def save_samples(generator, L, ab, path):
    """Save a grid: grey | prediction | ground truth (RGB)."""
    from app.lab import lab_to_rgb

    pred = generator(L, training=False).numpy()
    rows = []
    for i in range(L.shape[0]):
        l = (L[i, ..., 0].numpy() + 1.0) * 50.0
        def rgb(ab_arr):
            lab = np.concatenate([l[..., None], ab_arr * 128.0], axis=-1)
            return (lab_to_rgb(lab) * 255).astype(np.uint8)
        grey = np.repeat((np.clip(l / 100.0, 0, 1)[..., None] * 255).astype(np.uint8), 3, -1)
        rows.append(np.concatenate([grey, rgb(pred[i]), rgb(ab[i].numpy())], axis=1))
    Image.fromarray(np.concatenate(rows, axis=0)).save(path)


def build_train_step(generator, discriminator, g_opt, d_opt, lambda_l1, mixed):
    bce = tf.keras.losses.BinaryCrossentropy(from_logits=True)

    @tf.function
    def train_step(L, ab):
        with tf.GradientTape() as g_tape, tf.GradientTape() as d_tape:
            fake_ab = generator(L, training=True)
            real_out = discriminator(tf.concat([L, ab], -1), training=True)
            fake_out = discriminator(tf.concat([L, fake_ab], -1), training=True)

            l1 = tf.reduce_mean(tf.abs(ab - tf.cast(fake_ab, ab.dtype)))
            adv = bce(tf.ones_like(fake_out), fake_out)
            g_loss = adv + lambda_l1 * l1
            d_loss = 0.5 * (bce(tf.ones_like(real_out), real_out)
                            + bce(tf.zeros_like(fake_out), fake_out))
            g_scaled = g_opt.get_scaled_loss(g_loss) if mixed else g_loss
            d_scaled = d_opt.get_scaled_loss(d_loss) if mixed else d_loss

        g_grads = g_tape.gradient(g_scaled, generator.trainable_variables)
        d_grads = d_tape.gradient(d_scaled, discriminator.trainable_variables)
        if mixed:
            g_grads = g_opt.get_unscaled_gradients(g_grads)
            d_grads = d_opt.get_unscaled_gradients(d_grads)
        g_opt.apply_gradients(zip(g_grads, generator.trainable_variables))
        d_opt.apply_gradients(zip(d_grads, discriminator.trainable_variables))
        return g_loss, d_loss, l1

    return train_step


def train(data_dir, epochs=20, batch_size=16, img_size=256, out_dir="outputs/v2",
          max_steps=None, lambda_l1=100.0, lr=2e-4, mixed_precision=False,
          sample_every=500, checkpoint_every_epochs=1):
    data_dir = Path(data_dir)
    train_dir = data_dir / "train" / "color"
    if not train_dir.is_dir():
        train_dir = data_dir  # allow pointing straight at a folder of images
    files = list_images(train_dir)
    if not files:
        raise FileNotFoundError(f"No images found in {train_dir}. "
                                "Run `python download_dataset.py` first.")
    val_dir = data_dir / "validation" / "color"
    val_files = list_images(val_dir)[:8] if val_dir.is_dir() else []
    out_dir = Path(out_dir)
    (out_dir / "samples").mkdir(parents=True, exist_ok=True)
    (out_dir / "checkpoints").mkdir(parents=True, exist_ok=True)

    if mixed_precision:
        tf.keras.mixed_precision.set_global_policy("mixed_float16")
    try:
        generator = get_generator_v2(img_size)
        discriminator = get_discriminator_v2(img_size)
        g_opt = tf.keras.optimizers.Adam(lr, beta_1=0.5)
        d_opt = tf.keras.optimizers.Adam(lr, beta_1=0.5)
        if mixed_precision:
            g_opt = tf.keras.mixed_precision.LossScaleOptimizer(g_opt)
            d_opt = tf.keras.mixed_precision.LossScaleOptimizer(d_opt)
        train_step = build_train_step(generator, discriminator, g_opt, d_opt,
                                      lambda_l1, mixed_precision)

        ds = make_dataset(files, img_size, batch_size, training=True)
        fixed = None
        if val_files:
            fixed = next(iter(make_dataset(val_files, img_size, len(val_files), False)))
        elif files:
            fixed = next(iter(make_dataset(files[:4], img_size, 4, False)))

        step = 0
        done = False
        for epoch in range(epochs):
            for L, ab in ds:
                g_loss, d_loss, l1 = train_step(L, ab)
                step += 1
                if step % 50 == 0 or step == 1:
                    print(f"epoch {epoch + 1} step {step} G={float(g_loss):.3f} "
                          f"D={float(d_loss):.3f} L1={float(l1):.4f}", flush=True)
                if fixed is not None and step % sample_every == 0:
                    save_samples(generator, fixed[0], fixed[1],
                                 out_dir / "samples" / f"step_{step:06d}.png")
                if max_steps and step >= max_steps:
                    done = True
                    break
            if (epoch + 1) % checkpoint_every_epochs == 0 or done:
                generator.save_weights(str(out_dir / "checkpoints" / "generator_latest.h5"))
                discriminator.save_weights(str(out_dir / "checkpoints" / "discriminator_latest.h5"))
            if done:
                break

        if fixed is not None:
            save_samples(generator, fixed[0], fixed[1], out_dir / "samples" / "final.png")
        model_path = out_dir / "CCGAN_v2.h5"
        generator.save(model_path)
        print(f"Saved {model_path}")
        return model_path
    finally:
        if mixed_precision:
            tf.keras.mixed_precision.set_global_policy("float32")


def parse_args(argv=None):
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--data-dir", default="dataset")
    p.add_argument("--epochs", type=int, default=20)
    p.add_argument("--batch-size", type=int, default=16)
    p.add_argument("--image-size", type=int, default=256)
    p.add_argument("--out-dir", default="outputs/v2")
    p.add_argument("--max-steps", type=int, default=None,
                   help="stop after N steps (smoke tests)")
    p.add_argument("--lambda-l1", type=float, default=100.0)
    p.add_argument("--lr", type=float, default=2e-4)
    p.add_argument("--mixed-precision", action="store_true")
    p.add_argument("--sample-every", type=int, default=500)
    return p.parse_args(argv)


def main(argv=None):
    a = parse_args(argv)
    print("GPUs:", tf.config.list_physical_devices("GPU"))
    train(a.data_dir, a.epochs, a.batch_size, a.image_size, a.out_dir,
          a.max_steps, a.lambda_l1, a.lr, a.mixed_precision, a.sample_every)


if __name__ == "__main__":
    main()
