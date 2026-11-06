// Runs the exported ONNX model in Node (onnxruntime-node) and compares it with
// the Keras output saved by tools/export_onnx.py.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as ort from 'onnxruntime-node'
import { describe, expect, it } from 'vitest'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))

function readF32(path: string): Float32Array {
  const buf = readFileSync(path)
  return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
}

describe('ONNX parity with Keras', () => {
  it('matches the saved Keras output within tolerance', async () => {
    const meta = JSON.parse(readFileSync(here('./fixtures/parity.json'), 'utf8'))
    const input = readF32(here('./fixtures/parity_input.f32'))
    const expected = readF32(here('./fixtures/parity_output.f32'))
    expect(input.length).toBe(120 * 120)
    expect(expected.length).toBe(120 * 120 * 3)

    const session = await ort.InferenceSession.create(here('../public/models/colorize.onnx'))
    expect(session.inputNames[0]).toBe('input')
    const result = await session.run({ input: new ort.Tensor('float32', input, meta.input_shape) })
    const out = result[session.outputNames[0]]
    expect(Array.from(out.dims)).toEqual(meta.output_shape)

    const actual = out.data as Float32Array
    let maxDiff = 0
    for (let i = 0; i < expected.length; i++) maxDiff = Math.max(maxDiff, Math.abs(actual[i] - expected[i]))
    expect(maxDiff).toBeLessThanOrEqual(meta.tolerance)
  }, 60_000)
})
