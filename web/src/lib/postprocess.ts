// Post-processing: the browser copy of the second half of app/colorize.py.
//
//   numpy: np.clip(prediction[0], 0, 1)
//   numpy: (color_array * 255).astype(np.uint8)   <- truncates, never rounds
//   PIL:   .resize(original_size, LANCZOS)        <- done with pica (see resize.ts)
//
// Pure functions only, so they can be unit tested without a browser.

import { MODEL_SIZE } from './preprocess'

/** Same as np.clip(value, 0, 1). NaN becomes 0 so it can never leak into pixels. */
export function clip01(value: number): number {
  if (!(value > 0)) return 0
  return value > 1 ? 1 : value
}

/**
 * Converts one model output value (ideally 0..1) to a 0..255 byte the way
 * numpy does: clip, multiply in float32, then truncate.
 */
export function toByte(value: number): number {
  return Math.floor(Math.fround(clip01(value) * 255))
}

/**
 * Model output [1, 120, 120, 3] (RGB, 0..1) -> RGBA bytes ready for a canvas
 * or for pica. Alpha is always 255.
 */
export function outputToRgba(output: Float32Array, size = MODEL_SIZE): Uint8ClampedArray {
  const pixelCount = size * size
  if (output.length !== pixelCount * 3) {
    throw new Error(
      `Model returned ${output.length} values, expected ${pixelCount * 3} (${size}x${size}x3).`,
    )
  }
  const rgba = new Uint8ClampedArray(pixelCount * 4)
  for (let p = 0; p < pixelCount; p++) {
    rgba[p * 4] = toByte(output[p * 3])
    rgba[p * 4 + 1] = toByte(output[p * 3 + 1])
    rgba[p * 4 + 2] = toByte(output[p * 3 + 2])
    rgba[p * 4 + 3] = 255
  }
  return rgba
}
