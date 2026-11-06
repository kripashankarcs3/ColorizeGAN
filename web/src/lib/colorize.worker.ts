// Web Worker that does all the heavy lifting, so the page never freezes.
// (Same job as the QThread worker in the desktop app.)

import { getSession, runModel } from './inference'
import type { WorkerRequest, WorkerResponse } from './messages'
import { outputToRgba } from './postprocess'
import { MODEL_SIZE, greyRgbaToTensorData, rgbaToGreyRgba } from './preprocess'
import { resizeRgba } from './resize'

// The project compiles against the DOM types, so describe the two worker
// APIs we use instead of pulling in the conflicting "webworker" lib.
const worker = self as unknown as {
  postMessage(message: WorkerResponse, transfer: Transferable[]): void
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
}

function send(message: WorkerResponse, transfer: Transferable[] = []) {
  worker.postMessage(message, transfer)
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function load() {
  try {
    await getSession((loaded, total) => send({ type: 'progress', loaded, total }))
    send({ type: 'ready' })
  } catch (error) {
    send({ type: 'load-error', message: errorText(error) })
  }
}

async function colorize(id: number, pixels: Uint8ClampedArray, width: number, height: number) {
  try {
    const start = performance.now()

    // 1. Greyscale at full size, then Lanczos down to 120 x 120 (PIL order).
    const grey = rgbaToGreyRgba(pixels)
    const small = await resizeRgba(grey, width, height, MODEL_SIZE, MODEL_SIZE)
    const input = greyRgbaToTensorData(small)

    // 2. Run the generator.
    await getSession()
    const modelStart = performance.now()
    const output = await runModel(input)
    const inferenceMs = performance.now() - modelStart

    // 3. Clip, x255, uint8, then Lanczos back up to the original size.
    const colourSmall = outputToRgba(output)
    const colourFull = await resizeRgba(colourSmall, MODEL_SIZE, MODEL_SIZE, width, height)
    const result = new Uint8ClampedArray(colourFull.buffer, colourFull.byteOffset, colourFull.length)

    send(
      {
        type: 'result',
        id,
        pixels: result,
        width,
        height,
        inferenceMs,
        totalMs: performance.now() - start,
      },
      [result.buffer],
    )
  } catch (error) {
    send({ type: 'colorize-error', id, message: errorText(error) })
  }
}

worker.onmessage = (event) => {
  const request = event.data
  if (request.type === 'load') void load()
  else if (request.type === 'colorize') {
    void colorize(request.id, request.pixels, request.width, request.height)
  }
}
