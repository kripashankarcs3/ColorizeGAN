import { describe, expect, it } from 'vitest'
import { clip01, outputToRgba, toByte } from '../src/lib/postprocess'
import {
  MAX_SIDE,
  MODEL_SIZE,
  fitWithin,
  greyRgbaToTensorData,
  inputShape,
  lumaBT601,
  rgbaToGreyRgba,
} from '../src/lib/preprocess'
import { colorizedFileName, hasSupportedExtension } from '../src/lib/validate'

describe('greyscale (Pillow convert("L"))', () => {
  it('matches 0.299 R + 0.587 G + 0.114 B', () => {
    expect(lumaBT601(255, 0, 0)).toBe(76)
    expect(lumaBT601(0, 255, 0)).toBe(150)
    expect(lumaBT601(0, 0, 255)).toBe(29)
    expect(lumaBT601(255, 255, 255)).toBe(255)
    expect(lumaBT601(0, 0, 0)).toBe(0)
    // Within rounding of the float formula for arbitrary colours
    for (const [r, g, b] of [[12, 200, 77], [250, 3, 128], [90, 90, 90]]) {
      expect(Math.abs(lumaBT601(r, g, b) - (0.299 * r + 0.587 * g + 0.114 * b))).toBeLessThanOrEqual(0.5)
    }
  })

  it('writes grey into R, G, B and makes the pixel opaque', () => {
    const grey = rgbaToGreyRgba(new Uint8ClampedArray([255, 0, 0, 10, 0, 0, 255, 255]))
    expect(Array.from(grey)).toEqual([76, 76, 76, 255, 29, 29, 29, 255])
  })
})

describe('model input tensor', () => {
  it('is NHWC [1, 120, 120, 1] with values in 0..1', () => {
    const rgba = new Uint8Array(MODEL_SIZE * MODEL_SIZE * 4)
    for (let i = 0; i < rgba.length; i++) rgba[i] = (i * 7) % 256
    const data = greyRgbaToTensorData(rgba)
    expect(inputShape()).toEqual([1, 120, 120, 1])
    expect(data).toBeInstanceOf(Float32Array)
    expect(data.length).toBe(14400)
    expect(Math.min(...data)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...data)).toBeLessThanOrEqual(1)
    expect(data[1]).toBeCloseTo(rgba[4] / 255, 6)
  })

  it('rejects the wrong image size', () => {
    expect(() => greyRgbaToTensorData(new Uint8Array(4 * 10))).toThrow()
  })
})

describe('postprocess (np.clip, * 255, astype(uint8))', () => {
  it('clips to 0..1', () => {
    expect(clip01(-0.5)).toBe(0)
    expect(clip01(1.7)).toBe(1)
    expect(clip01(0.25)).toBe(0.25)
    expect(clip01(Number.NaN)).toBe(0)
  })

  it('truncates like numpy instead of rounding', () => {
    expect(toByte(1)).toBe(255)
    expect(toByte(2)).toBe(255)
    expect(toByte(-1)).toBe(0)
    expect(toByte(0.999)).toBe(254) // 254.745 -> 254
    expect(toByte(0.5)).toBe(127) // 127.5 -> 127
  })

  it('turns [1,120,120,3] output into opaque RGBA of the same size', () => {
    const output = new Float32Array(MODEL_SIZE * MODEL_SIZE * 3).fill(0.5)
    output[0] = 1.2
    output[1] = -0.3
    const rgba = outputToRgba(output)
    expect(rgba.length).toBe(MODEL_SIZE * MODEL_SIZE * 4)
    expect(Array.from(rgba.slice(0, 8))).toEqual([255, 0, 127, 255, 127, 127, 127, 255])
    expect(() => outputToRgba(new Float32Array(10))).toThrow()
  })
})

describe('size limits and validation', () => {
  it('keeps small images and scales big ones to 4096 on the long side', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600, scaled: false })
    expect(fitWithin(8000, 4000)).toEqual({ width: MAX_SIDE, height: 2048, scaled: true })
    expect(fitWithin(3000, 9000)).toEqual({ width: 1365, height: MAX_SIDE, scaled: true })
  })

  it('accepts only png/jpg/jpeg', () => {
    expect(hasSupportedExtension('a.PNG')).toBe(true)
    expect(hasSupportedExtension('b.jpeg')).toBe(true)
    expect(hasSupportedExtension('c.gif')).toBe(false)
    expect(hasSupportedExtension('noext')).toBe(false)
    expect(colorizedFileName('building_GL.jpg')).toBe('building_GL_colorized.png')
  })
})
