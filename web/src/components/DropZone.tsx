import { useId, useRef, useState, type DragEvent } from 'react'
import { ACCEPT } from '../lib/validate'
import { ImageIcon, UploadIcon } from './Icons'
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
        {compact ? <ImageIcon size={20} /> : <UploadIcon size={22} />}
      </span>
      <div className={styles.text}>
        <p className={styles.title}>
          {compact ? 'Drop another photo to replace it' : 'Drop a black-and-white photo here'}
        </p>
        <p className={styles.hint} id={hintId}>
          PNG, JPG or JPEG. Processed on this device; the original size is kept.
        </p>
      </div>
      <button
        type="button"
        className={`btn ${compact ? 'btn-secondary' : 'btn-primary'}`}
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
