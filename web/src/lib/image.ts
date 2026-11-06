// Main-thread image helpers: validate + decode an upload, and encode the
// colorized pixels as a PNG. The heavy maths happens in the worker.

import { AppError } from './errors'
import { fitWithin, MAX_SIDE } from './preprocess'
import { hasSupportedExtension } from './validate'

export interface DecodedImage {
  /** RGBA pixels, possibly scaled down to MAX_SIDE. */
  pixels: Uint8ClampedArray
  width: number
  height: number
  /** Size of the file as uploaded. */
  originalWidth: number
  originalHeight: number
  /** True when the photo was larger than MAX_SIDE and got scaled down. */
  downscaled: boolean
}

const unsupportedFile = (name: string) =>
  new AppError('unsupported-file', `"${name}" is not supported. Please choose a PNG, JPG, or JPEG image.`)

const unreadableImage = (name: string) =>
  new AppError('unreadable-image', `"${name}" looks damaged or is not really an image. Try another file.`)

function createCanvas(width: number, height: number) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function context2d(canvas: OffscreenCanvas | HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null
  if (!ctx) throw new AppError('unreadable-image', 'This browser could not create a drawing canvas.')
  return ctx
}

/**
 * Checks the file type, decodes it, and returns its pixels.
 * Throws an AppError with a friendly message when anything is wrong.
 */
export async function decodeImageFile(file: File): Promise<DecodedImage> {
  if (!hasSupportedExtension(file.name)) {
    throw unsupportedFile(file.name)
  }

  // Decoding is the real check: a renamed or corrupt file fails here.
  // colorSpaceConversion "none" keeps the raw pixel values, like Pillow.
  const decodeOptions: ImageBitmapOptions = { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, decodeOptions)
  } catch {
    throw unreadableImage(file.name)
  }

  const originalWidth = bitmap.width
  const originalHeight = bitmap.height
  const target = fitWithin(originalWidth, originalHeight, MAX_SIDE)

  // Very large photos are scaled down by the browser first to save memory.
  if (target.scaled) {
    bitmap.close()
    bitmap = await createImageBitmap(file, {
      ...decodeOptions,
      resizeWidth: target.width,
      resizeHeight: target.height,
      resizeQuality: 'high',
    })
  }

  try {
    const canvas = createCanvas(target.width, target.height)
    const ctx = context2d(canvas)
    ctx.drawImage(bitmap, 0, 0)
    const { data } = ctx.getImageData(0, 0, target.width, target.height)
    return {
      pixels: data,
      width: target.width,
      height: target.height,
      originalWidth,
      originalHeight,
      downscaled: target.scaled,
    }
  } finally {
    bitmap.close()
  }
}

/**
 * Quick check right after the user picks a file: right extension, and the
 * browser can actually decode it. Returns the image size for display.
 */
export async function probeImageFile(file: File): Promise<{ width: number; height: number }> {
  if (!hasSupportedExtension(file.name)) {
    throw unsupportedFile(file.name)
  }
  try {
    const bitmap = await createImageBitmap(file)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  } catch {
    throw unreadableImage(file.name)
  }
}

/** Encodes RGBA pixels as a PNG blob (the "Download PNG" file). */
export async function pixelsToPng(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<Blob> {
  const canvas = createCanvas(width, height)
  const ctx = context2d(canvas)
  ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0)
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type: 'image/png' })
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed.'))),
      'image/png',
    )
  })
}

/** Fetches a bundled sample photo and wraps it as a File. */
export async function fetchSample(url: string, name: string): Promise<File> {
  const response = await fetch(url)
  if (!response.ok) throw new AppError('unreadable-image', `Could not load the sample "${name}".`)
  const blob = await response.blob()
  return new File([blob], name, { type: blob.type || 'image/jpeg' })
}
