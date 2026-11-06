import { useState, type CSSProperties } from 'react'
import styles from './CompareSlider.module.css'

interface Props {
  beforeSrc: string
  afterSrc: string
  beforeAlt: string
  afterAlt: string
  /** Show the "before" image in greyscale (what the model actually sees). */
  greyBefore?: boolean
  beforeLabel?: string
  afterLabel?: string
  initial?: number
  className?: string
}

/**
 * Before/after slider. The handle is a real <input type="range"> stretched
 * over the image, so it works with mouse, touch and keyboard (arrow keys,
 * Home/End, Page Up/Down) and is announced by screen readers.
 */
export function CompareSlider({
  beforeSrc,
  afterSrc,
  beforeAlt,
  afterAlt,
  greyBefore = true,
  beforeLabel = 'Before',
  afterLabel = 'After',
  initial = 50,
  className,
}: Props) {
  const [position, setPosition] = useState(initial)

  return (
    <div className={`${styles.root} ${className ?? ''}`} style={{ '--pos': `${position}%` } as CSSProperties}>
      <img className={styles.after} src={afterSrc} alt={afterAlt} draggable={false} />
      <img
        className={`${styles.before} ${greyBefore ? styles.grey : ''}`}
        src={beforeSrc}
        alt={beforeAlt}
        draggable={false}
      />

      <span className={`${styles.tag} ${styles.tagBefore}`} aria-hidden="true">
        {beforeLabel}
      </span>
      <span className={`${styles.tag} ${styles.tagAfter}`} aria-hidden="true">
        {afterLabel}
      </span>

      <div className={styles.divider} aria-hidden="true">
        <span className={styles.handle}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M9.5 7.5 5 12l4.5 4.5M14.5 7.5 19 12l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>

      <input
        className={styles.range}
        type="range"
        min={0}
        max={100}
        step={1}
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
        aria-label={`Compare ${beforeLabel.toLowerCase()} and ${afterLabel.toLowerCase()}`}
        aria-valuetext={`${position}% ${beforeLabel.toLowerCase()}`}
      />
    </div>
  )
}
