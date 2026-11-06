import { useId, useRef, useState, type DragEvent } from 'react'
import { ACCEPT } from '../lib/validate'
import styles from './DropZone.module.css'

interface Props {
  onFile: (file: File) => void
  disabled?: boolean
  /** Smaller layout once a photo has been chosen. */
  compact?: boolean
}

/** Drag-and-drop area plus a regular file picker button. */
export function DropZone({ onFile, disabled = false, compact = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const hintId = useId()

  function pick(files: FileList | null) {
    const file = files?.[0]
    if (file) onFile(file)
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    if (!disabled) pick(event.dataTransfer.files)
  }

  return (
    <div
      className={`${styles.zone} ${dragging ? styles.dragging : ''} ${compact ? styles.compact : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <span className={styles.icon} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 16V4M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" />
        </svg>
      </span>
      <div className={styles.text}>
        <p className={styles.title}>{compact ? 'Drop another photo to replace it' : 'Drop a black-and-white photo here'}</p>
        <p className={styles.hint} id={hintId}>
          PNG, JPG or JPEG. Original size is kept. Processed on your device.
        </p>
      </div>
      <button
        type="button"
        className={`btn ${compact ? 'btn-ghost' : 'btn-secondary'}`}
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        aria-describedby={hintId}
      >
        {compact ? 'Choose another' : 'Choose a photo'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          pick(event.target.files)
          event.target.value = '' // allow choosing the same file again
        }}
      />
    </div>
  )
}
