// React hooks that connect the UI to the colorizer.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { colorizeFile, getModelStatus, loadModel, subscribeModelStatus, type ColorizeResult } from './colorizer'
import { toAppError, type AppError } from './errors'
import { probeImageFile } from './image'

/** Current model loading state, re-rendering when it changes. */
export function useModelStatus() {
  return useSyncExternalStore(subscribeModelStatus, getModelStatus, getModelStatus)
}

/** Starts the model download as soon as a page that needs it is shown. */
export function usePreloadModel() {
  useEffect(() => {
    loadModel().catch(() => {
      /* the error is shown through useModelStatus */
    })
  }, [])
}

function useRevokeOnChange(url: string | null) {
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])
}

export type JobPhase = 'empty' | 'selected' | 'processing' | 'done' | 'error'

export interface ColorizeJob {
  phase: JobPhase
  file: File | null
  originalUrl: string | null
  originalSize: { width: number; height: number } | null
  result: ColorizeResult | null
  resultUrl: string | null
  error: AppError | null
}

const EMPTY: ColorizeJob = {
  phase: 'empty',
  file: null,
  originalUrl: null,
  originalSize: null,
  result: null,
  resultUrl: null,
  error: null,
}

/**
 * State for one photo: pick a file, colorize it, clear it.
 * Object URLs are revoked automatically so memory is not leaked.
 */
export function useColorizeJob() {
  const [job, setJob] = useState<ColorizeJob>(EMPTY)
  // Bumped on every select/clear so results of an abandoned run are ignored.
  const runToken = useRef(0)

  // Free each blob URL once it is replaced or the component unmounts.
  useRevokeOnChange(job.originalUrl)
  useRevokeOnChange(job.resultUrl)

  const select = useCallback(async (file: File): Promise<boolean> => {
    const token = ++runToken.current
    try {
      const size = await probeImageFile(file)
      if (token !== runToken.current) return false
      setJob({ ...EMPTY, phase: 'selected', file, originalUrl: URL.createObjectURL(file), originalSize: size })
      return true
    } catch (error) {
      if (token !== runToken.current) return false
      setJob({ ...EMPTY, phase: 'error', error: toAppError(error, 'unreadable-image') })
      return false
    }
  }, [])

  const colorize = useCallback(async (fileOverride?: File) => {
    const file = fileOverride ?? job.file
    if (!file) return
    const token = runToken.current
    setJob((prev) => ({ ...prev, phase: 'processing', error: null, result: null, resultUrl: null }))
    try {
      const result = await colorizeFile(file)
      if (token !== runToken.current) return
      setJob((prev) => ({ ...prev, phase: 'done', result, resultUrl: URL.createObjectURL(result.png) }))
    } catch (error) {
      if (token !== runToken.current) return
      setJob((prev) => ({ ...prev, phase: 'error', error: toAppError(error, 'colorize') }))
    }
  }, [job.file])

  const clear = useCallback(() => {
    runToken.current++
    setJob(EMPTY)
  }, [])

  /** Shows an error that happened outside the pipeline (e.g. a sample failed to download). */
  const fail = useCallback((error: unknown) => {
    runToken.current++
    setJob({ ...EMPTY, phase: 'error', error: toAppError(error, 'unreadable-image') })
  }, [])

  return { job, select, colorize, clear, fail }
}

/** Formats milliseconds as "0.42 s" or "850 ms". */
export function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`
}
