// Pre-processing: the browser copy of the first half of app/colorize.py.
//
//   PIL: image.convert("L")  ->  greyscale (BT.601 luma)
//   PIL: .resize((120, 120), LANCZOS)
//   numpy: / 255.0, float32, shape [1, 120, 120, 1]  (NHWC)
//
// Every function here is pure (no DOM), so it runs in the Web Worker and in
// the Vitest unit tests alike.

/** The generator takes and returns 120 x 120 images. */
export const MODEL_SIZE = 120

/** Uploads larger than this on their long side are scaled down first. */
export const MAX_SIDE = 4096

/**
 * Greyscale exactly like Pillow's convert("L"):
 *   L = 0.299 R + 0.587 G + 0.114 B
 * Pillow uses 16-bit fixed point with rounding, so we do the same to get
 * identical 0..255 values (19595 / 65536 = 0.299, and so on).
 */
export function lumaBT601(r: number, g: number, b: number): number {
  return (r * 19595 + g * 38470 + b * 7471 + 0x8000) >> 16
}

/**
 * Converts RGBA pixels (as found in canvas ImageData) to greyscale, written
 * back as RGBA with R = G = B = L and A = 255. Keeping the RGBA layout lets
 * pica resize the result directly. Alpha is ignored, like Pillow does.
 */
export function rgbaToGreyRgba(rgba: Uint8Array | Uint8ClampedArray): Uint8Array {
  const out = new Uint8Array(rgba.length)
  for (let i = 0; i < rgba.length; i += 4) {
    const luma = lumaBT601(rgba[i], rgba[i + 1], rgba[i + 2])
    out[i] = luma
    out[i + 1] = luma
    out[i + 2] = luma
    out[i + 3] = 255
  }
  return out
}

/**
 * Turns a 120 x 120 grey RGBA image into the model input:
 * Float32Array of length 120 * 120, values 0..1, laid out as [1, 120, 120, 1].
 */
export function greyRgbaToTensorData(
  greyRgba: Uint8Array | Uint8ClampedArray,
  size = MODEL_SIZE,
): Float32Array {
  const pixelCount = size * size
  if (greyRgba.length !== pixelCount * 4) {
    throw new Error(`Expected ${size}x${size} RGBA pixels, got ${greyRgba.length / 4} pixels.`)
  }
  const data = new Float32Array(pixelCount)
  for (let p = 0; p < pixelCount; p++) {
    data[p] = greyRgba[p * 4] / 255
  }
  return data
}

/** NHWC shape of the model input for a single image. */
export function inputShape(size = MODEL_SIZE): [number, number, number, number] {
  return [1, size, size, 1]
}

/**
 * Size that fits inside maxSide x maxSide while keeping the aspect ratio.
 * Images that already fit are returned unchanged.
 */
export function fitWithin(
  width: number,
  height: number,
  maxSide = MAX_SIDE,
): { width: number; height: number; scaled: boolean } {
  const longSide = Math.max(width, height)
  if (longSide <= maxSide) return { width, height, scaled: false }
  const scale = maxSide / longSide
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scaled: true,
  }
}
