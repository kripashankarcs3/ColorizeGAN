import { describe, expect, it } from 'vitest'
import { outputToRgba, toByte } from '../src/lib/postprocess'
import {
  MODEL_SIZE,
  fitWithin,
  greyRgbaToTensorData,
  lumaBT601,
  rgbaToGreyRgba,
} from '../src/lib/preprocess'

describe('greyscale vs Pillow convert("L")', () => {
  // Expected values computed once with Pillow: Image.new("RGB",(1,1),rgb).convert("L")
  const pillow: Array<[[number, number, number], number]> = [
    [[12, 200, 77], 130],
    [[250, 3, 128], 91],
    [[90, 90, 90], 90],
    [[1, 2, 3], 2],
    [[200, 100, 50], 124],
    [[37, 181, 222], 143],
  ]
  it.each(pillow)('rgb %j -> %i', ([r, g, b], expected) => {
    expect(lumaBT601(r, g, b)).toBe(expected)
  })

  it('maps every pixel of an RGBA buffer and ignores alpha', () => {
    const rgba = new Uint8Array([12, 200, 77, 0, 37, 181, 222, 128])
    expect(Array.from(rgbaToGreyRgba(rgba))).toEqual([130, 130, 130, 255, 143, 143, 143, 255])
  })
})

describe('tensor data', () => {
  it('scales grey bytes into 0..1 (byte / 255)', () => {
    const rgba = new Uint8Array(MODEL_SIZE * MODEL_SIZE * 4)
    rgba[0] = 0
    rgba[4] = 255
    rgba[8] = 51
    const data = greyRgbaToTensorData(rgba)
    expect(data[0]).toBe(0)
    expect(data[1]).toBe(1)
    expect(data[2]).toBeCloseTo(0.2, 6)
    expect(data.length).toBe(MODEL_SIZE * MODEL_SIZE)
  })
})

describe('postprocess edge cases', () => {
  it('truncates like numpy astype(uint8)', () => {
    expect(toByte(1 / 255)).toBe(1)
    expect(toByte(0.999999)).toBe(254)
    expect(toByte(Number.POSITIVE_INFINITY)).toBe(255)
    expect(toByte(Number.NEGATIVE_INFINITY)).toBe(0)
    expect(toByte(Number.NaN)).toBe(0)
  })

  it('output pixel count equals the model grid and alpha is always 255', () => {
    const out = new Float32Array(MODEL_SIZE * MODEL_SIZE * 3).fill(2)
    const rgba = outputToRgba(out)
    expect(rgba.length / 4).toBe(MODEL_SIZE * MODEL_SIZE)
    for (let i = 3; i < rgba.length; i += 4) expect(rgba[i]).toBe(255)
    expect(rgba[0]).toBe(255)
  })
})

describe('fitWithin', () => {
  it('leaves images exactly at the limit unchanged', () => {
    expect(fitWithin(4096, 100)).toEqual({ width: 4096, height: 100, scaled: false })
  })
  it('never returns a zero side and keeps the long side at the limit', () => {
    expect(fitWithin(100000, 10)).toEqual({ width: 4096, height: 1, scaled: true })
  })
  it('honours a custom limit and keeps the aspect ratio', () => {
    expect(fitWithin(300, 200, 150)).toEqual({ width: 150, height: 100, scaled: true })
  })
  it('output size equals input size for images that already fit', () => {
    for (const [w, h] of [[1, 1], [150, 150], [4096, 4096], [640, 480]]) {
      const r = fitWithin(w, h)
      expect([r.width, r.height]).toEqual([w, h])
    }
  })
})
