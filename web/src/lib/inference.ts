// ONNX Runtime Web: loads colorize.onnx once and runs it.
// This is the browser twin of _load_generator() + generator.predict() in
// app/colorize.py. It runs inside the Web Worker (see colorize.worker.ts).

import * as ort from 'onnxruntime-web/wasm'
import { MODEL_SIZE, inputShape } from './preprocess'

const BASE = import.meta.env.BASE_URL
export const MODEL_URL = `${BASE}models/colorize.onnx`

// Serve the WASM binary from our own public/ort/ folder instead of a CDN.
// Workers resolve relative URLs against the worker script, so make it absolute.
ort.env.wasm.wasmPaths = {
  wasm: new URL(`${BASE}ort/ort-wasm-simd-threaded.wasm`, self.location.origin).href,
}
// Multi-threading needs cross-origin isolation headers; one thread is plenty
// for a 120 x 120 model and works on every host.
ort.env.wasm.numThreads = 1

export type ProgressCallback = (loaded: number, total: number | null) => void

/** Downloads the model, reporting progress. The browser HTTP cache keeps it for next time. */
async function downloadModel(onProgress?: ProgressCallback): Promise<Uint8Array> {
  const response = await fetch(MODEL_URL)
  if (!response.ok) {
    throw new Error(`Model download failed (HTTP ${response.status}).`)
  }
  const header = response.headers.get('content-length')
  const total = header ? Number(header) : null

  // No streaming support: read it in one go.
  if (!response.body) {
    const buffer = new Uint8Array(await response.arrayBuffer())
    onProgress?.(buffer.length, buffer.length)
    return buffer
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.length
    onProgress?.(loaded, total)
  }
  const model = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    model.set(chunk, offset)
    offset += chunk.length
  }
  return model
}

// Created once and reused, like the @lru_cache on _load_generator().
let sessionPromise: Promise<ort.InferenceSession> | null = null

export function getSession(onProgress?: ProgressCallback): Promise<ort.InferenceSession> {
  sessionPromise ??= downloadModel(onProgress)
    .then((model) => ort.InferenceSession.create(model, { executionProviders: ['wasm'] }))
    .catch((error: unknown) => {
      sessionPromise = null // allow a retry after a failure
      throw error
    })
  return sessionPromise
}

/**
 * Runs the generator on one preprocessed image.
 * @param input Float32Array of 120 * 120 grey values in 0..1
 * @returns Float32Array of 120 * 120 * 3 RGB values (not yet clipped)
 */
export async function runModel(input: Float32Array): Promise<Float32Array> {
  const session = await getSession()
  const tensor = new ort.Tensor('float32', input, inputShape())
  const results = await session.run({ [session.inputNames[0]]: tensor })
  const output = results[session.outputNames[0]]

  const dims = output.dims
  if (dims.length !== 4 || dims[0] !== 1 || dims[1] !== MODEL_SIZE || dims[2] !== MODEL_SIZE || dims[3] !== 3) {
    throw new Error(`Generator returned an unexpected output shape: [${dims.join(', ')}]`)
  }
  return output.data as Float32Array
}
