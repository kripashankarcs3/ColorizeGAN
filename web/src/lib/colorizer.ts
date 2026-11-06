// Page-side client for the colorize worker. It owns the single Worker,
// tracks the model loading state (for the progress UI), and turns worker
// messages into promises.

import { AppError } from './errors'
import { decodeImageFile, pixelsToPng } from './image'
import type { WorkerRequest, WorkerResponse } from './messages'

export type ModelStatus =
  | { state: 'idle' }
  | { state: 'loading'; loaded: number; total: number | null }
  | { state: 'ready' }
  | { state: 'error'; error: AppError }

export interface ColorizeResult {
  /** The colorized PNG, same size as the processed image. */
  png: Blob
  width: number
  height: number
  originalWidth: number
  originalHeight: number
  downscaled: boolean
  inferenceMs: number
  /** Decode + worker + PNG encode, as felt by the user. */
  totalMs: number
}

/** WebAssembly and module workers are hard requirements. */
export function browserSupportError(): AppError | null {
  if (typeof WebAssembly !== 'object' || typeof WebAssembly.instantiate !== 'function') {
    return new AppError(
      'no-wasm',
      'This browser does not support WebAssembly, which is needed to run the model. Please use a recent Chrome, Edge, Firefox, or Safari.',
    )
  }
  if (typeof Worker === 'undefined') {
    return new AppError(
      'no-wasm',
      'This browser does not support Web Workers. Please use a recent Chrome, Edge, Firefox, or Safari.',
    )
  }
  return null
}

type Pending = {
  resolve: (value: Extract<WorkerResponse, { type: 'result' }>) => void
  reject: (error: AppError) => void
}

let worker: Worker | null = null
let status: ModelStatus = { state: 'idle' }
const listeners = new Set<() => void>()
const pending = new Map<number, Pending>()
let nextId = 1
let readyWaiters: { resolve: () => void; reject: (e: AppError) => void }[] = []

function setStatus(next: ModelStatus) {
  status = next
  listeners.forEach((listener) => listener())
}

function handleMessage(message: WorkerResponse) {
  switch (message.type) {
    case 'progress':
      setStatus({ state: 'loading', loaded: message.loaded, total: message.total })
      break
    case 'ready':
      setStatus({ state: 'ready' })
      readyWaiters.forEach((w) => w.resolve())
      readyWaiters = []
      break
    case 'load-error': {
      const error = new AppError(
        'model-load',
        `The model file could not be downloaded or opened (${message.message}). Check your connection and try again.`,
      )
      setStatus({ state: 'error', error })
      readyWaiters.forEach((w) => w.reject(error))
      readyWaiters = []
      break
    }
    case 'result':
      pending.get(message.id)?.resolve(message)
      pending.delete(message.id)
      break
    case 'colorize-error':
      pending.get(message.id)?.reject(new AppError('colorize', message.message))
      pending.delete(message.id)
      break
  }
}

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./colorize.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => handleMessage(event.data)
  worker.onerror = (event) => {
    // The worker script itself crashed (e.g. failed to start). Reset so a retry starts fresh.
    event.preventDefault()
    const error = new AppError('model-load', 'The background worker stopped unexpectedly. Please reload the page.')
    worker?.terminate()
    worker = null
    setStatus({ state: 'error', error })
    readyWaiters.forEach((w) => w.reject(error))
    readyWaiters = []
    pending.forEach((p) => p.reject(error))
    pending.clear()
  }
  return worker
}

function post(request: WorkerRequest, transfer: Transferable[] = []) {
  getWorker().postMessage(request, transfer)
}

/** Starts downloading the model (safe to call many times). Resolves when ready. */
export function loadModel(): Promise<void> {
  const unsupported = browserSupportError()
  if (unsupported) {
    setStatus({ state: 'error', error: unsupported })
    return Promise.reject(unsupported)
  }
  if (status.state === 'ready') return Promise.resolve()
  const promise = new Promise<void>((resolve, reject) => readyWaiters.push({ resolve, reject }))
  if (status.state === 'idle' || status.state === 'error') {
    setStatus({ state: 'loading', loaded: 0, total: null })
    post({ type: 'load' })
  }
  return promise
}

/** Full pipeline for one file: validate, decode, colorize in the worker, encode PNG. */
export async function colorizeFile(file: File): Promise<ColorizeResult> {
  const start = performance.now()
  const image = await decodeImageFile(file)
  await loadModel()

  const id = nextId++
  const response = await new Promise<Extract<WorkerResponse, { type: 'result' }>>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    post(
      { type: 'colorize', id, pixels: image.pixels, width: image.width, height: image.height },
      [image.pixels.buffer],
    )
  })

  const png = await pixelsToPng(response.pixels, response.width, response.height)
  return {
    png,
    width: response.width,
    height: response.height,
    originalWidth: image.originalWidth,
    originalHeight: image.originalHeight,
    downscaled: image.downscaled,
    inferenceMs: response.inferenceMs,
    totalMs: performance.now() - start,
  }
}

// --- tiny store so React can subscribe with useSyncExternalStore ---

export function subscribeModelStatus(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getModelStatus(): ModelStatus {
  return status
}
