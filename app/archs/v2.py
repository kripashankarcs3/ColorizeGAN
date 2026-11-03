"""v2 colorization architecture: U-Net generator + PatchGAN discriminator.

Colour space: the generator sees only the Lab L channel and predicts a and b.
  input : L / 50 - 1   -> [-1, 1], shape (N, S, S, 1)
  output: ab / 128     -> [-1, 1] (tanh), shape (N, S, S, 2)
Only ONNX-friendly layers are used (Conv2D, Conv2DTranspose, BatchNorm,
LeakyReLU, ReLU, Concatenate, Dropout, tanh).
"""

import tensorflow as tf
from tensorflow.keras import layers

DEFAULT_SIZE = 256


def _init():
    return tf.keras.initializers.RandomNormal(0.0, 0.02)


def _down(x, filters, norm=True):
    x = layers.Conv2D(filters, 4, strides=2, padding="same",
                      kernel_initializer=_init(), use_bias=not norm)(x)
    if norm:
        x = layers.BatchNormalization()(x)
    return layers.LeakyReLU(0.2)(x)


def _up(x, skip, filters, dropout=False):
    x = layers.Conv2DTranspose(filters, 4, strides=2, padding="same",
                               kernel_initializer=_init(), use_bias=False)(x)
    x = layers.BatchNormalization()(x)
    if dropout:
        x = layers.Dropout(0.5)(x)
    x = layers.ReLU()(x)
    return layers.Concatenate()([x, skip])


def get_generator_v2(img_size=DEFAULT_SIZE, base=32):
    """U-Net: 6 stride-2 downs, 5 ups with skips, final tanh ab head."""
    if img_size % 64:
        raise ValueError("img_size must be divisible by 64")
    inp = layers.Input(shape=(img_size, img_size, 1), name="L")
    f = [base, base * 2, base * 4, base * 6, base * 6, base * 8]
    skips = []
    x = inp
    for i, ch in enumerate(f):
        x = _down(x, ch, norm=i > 0)
        skips.append(x)
    x = skips[-1]
    for i, ch in enumerate(reversed(f[:-1])):
        x = _up(x, skips[-2 - i], ch, dropout=i < 2)
    x = layers.Conv2DTranspose(2, 4, strides=2, padding="same",
                               kernel_initializer=_init(), activation="tanh",
                               dtype="float32", name="ab")(x)
    return tf.keras.Model(inp, x, name="generator_v2")


def get_discriminator_v2(img_size=DEFAULT_SIZE):
    """PatchGAN on concat(L, ab) -> patch logits (no sigmoid)."""
    inp = layers.Input(shape=(img_size, img_size, 3), name="L_ab")
    x = _down(inp, 64, norm=False)
    x = _down(x, 128)
    x = _down(x, 256)
    x = layers.ZeroPadding2D()(x)
    x = layers.Conv2D(512, 4, strides=1, kernel_initializer=_init(), use_bias=False)(x)
    x = layers.BatchNormalization()(x)
    x = layers.LeakyReLU(0.2)(x)
    x = layers.ZeroPadding2D()(x)
    x = layers.Conv2D(1, 4, strides=1, kernel_initializer=_init(), dtype="float32")(x)
    return tf.keras.Model(inp, x, name="discriminator_v2")
