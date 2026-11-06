// Messages exchanged between the page (colorizer.ts) and the Web Worker
// (colorize.worker.ts). Pixels travel as transferable ArrayBuffers, so large
// photos are moved, not copied.

export type WorkerRequest =
  | { type: 'load' }
  | { type: 'colorize'; id: number; pixels: Uint8ClampedArray; width: number; height: number }

export type WorkerResponse =
  | { type: 'progress'; loaded: number; total: number | null }
  | { type: 'ready' }
  | { type: 'load-error'; message: string }
  | {
      type: 'result'
      id: number
      pixels: Uint8ClampedArray
      width: number
      height: number
      /** Time spent in the ONNX model only. */
      inferenceMs: number
      /** Preprocess + model + postprocess, measured inside the worker. */
      totalMs: number
    }
  | { type: 'colorize-error'; id: number; message: string }
