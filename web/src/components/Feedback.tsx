// Small shared feedback pieces: spinner, error/notice boxes, model status.

import type { ReactNode } from 'react'
import { loadModel } from '../lib/colorizer'
import type { AppError } from '../lib/errors'
import { useModelStatus } from '../lib/hooks'
import { AlertIcon, InfoIcon } from './Icons'
import styles from './Feedback.module.css'

export function Spinner({ label }: { label?: string }) {
  return (
    <span className={styles.spinner} role={label ? 'status' : undefined}>
      {label && <span className="visually-hidden">{label}</span>}
    </span>
  )
}

export function ErrorNotice({ error, action }: { error: AppError; action?: ReactNode }) {
  return (
    <div className={`${styles.notice} ${styles.error}`} role="alert">
      <AlertIcon className={styles.icon} size={20} />
      <div>
        <p className={styles.title}>{error.title}</p>
        <p className={styles.body}>{error.message}</p>
        {action && <div className={styles.action}>{action}</div>}
      </div>
    </div>
  )
}

export function InfoNotice({ children }: { children: ReactNode }) {
  return (
    <div className={`${styles.notice} ${styles.info}`} role="status">
      <InfoIcon className={styles.icon} size={20} />
      <div className={styles.body}>{children}</div>
    </div>
  )
}

function megabytes(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(1)
}

/**
 * Shows the model download progress on first visit, "ready" afterwards,
 * or a retry button if loading failed.
 */
export function ModelStatus() {
  const status = useModelStatus()

  if (status.state === 'error') {
    return (
      <ErrorNotice
        error={status.error}
        action={
          status.error.kind === 'model-load' && (
            <button type="button" className="btn btn-ghost" onClick={() => loadModel().catch(() => {})}>
              Try again
            </button>
          )
        }
      />
    )
  }

  if (status.state === 'ready') {
    return (
      <p className={`${styles.pill} ${styles.ready}`} role="status">
        <span className={styles.dot} aria-hidden="true" /> Model ready. Runs locally in this browser.
      </p>
    )
  }

  const percent = status.state === 'loading' && status.total ? Math.round((status.loaded / status.total) * 100) : null
  const detail =
    status.state === 'loading' && status.loaded > 0
      ? `${megabytes(status.loaded)}${status.total ? ` / ${megabytes(status.total)}` : ''} MB`
      : 'starting'

  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <div className={styles.loadingRow}>
        <Spinner />
        <span>
          Downloading the model, first visit only <span className={`${styles.muted} num`}>{detail}</span>
        </span>
      </div>
      <div
        className={styles.bar}
        role="progressbar"
        aria-label="Model download"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
      >
        <span
          className={percent === null ? styles.indeterminate : undefined}
          style={{ width: percent === null ? undefined : `${percent}%` }}
        />
      </div>
    </div>
  )
}
