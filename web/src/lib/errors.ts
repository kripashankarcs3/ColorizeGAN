// Friendly, user-facing errors. Every failure in the app ends up as one of
// these, so the UI can always show a clear message instead of a blank screen.

export type ErrorKind = 'unsupported-file' | 'unreadable-image' | 'model-load' | 'no-wasm' | 'colorize'

const TITLES: Record<ErrorKind, string> = {
  'unsupported-file': 'Unsupported file type',
  'unreadable-image': 'That image could not be read',
  'model-load': 'The colorization model failed to load',
  'no-wasm': 'Your browser cannot run the model',
  colorize: 'Colorization failed',
}

export class AppError extends Error {
  readonly kind: ErrorKind
  readonly title: string

  constructor(kind: ErrorKind, message: string) {
    super(message)
    this.name = 'AppError'
    this.kind = kind
    this.title = TITLES[kind]
  }
}

/** Wraps anything thrown into an AppError of the given kind. */
export function toAppError(error: unknown, fallbackKind: ErrorKind): AppError {
  if (error instanceof AppError) return error
  const detail = error instanceof Error ? error.message : String(error)
  return new AppError(fallbackKind, detail)
}
