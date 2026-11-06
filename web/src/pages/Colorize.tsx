import type { ReactNode } from 'react'
import { CompareSlider } from '../components/CompareSlider'
import { DropZone } from '../components/DropZone'
import { ErrorNotice, InfoNotice, ModelStatus, Spinner } from '../components/Feedback'
import { formatDuration, useColorizeJob, usePreloadModel, type JobPhase } from '../lib/hooks'
import { MAX_SIDE } from '../lib/preprocess'
import { colorizedFileName } from '../lib/validate'
import styles from './Colorize.module.css'

const STATE_LABEL: Record<JobPhase, string> = {
  empty: 'Waiting',
  selected: 'Ready',
  processing: 'Processing',
  done: 'Complete',
  error: 'Error',
}

export function Colorize() {
  usePreloadModel()
  const { job, select, colorize, clear } = useColorizeJob()
  const { phase, file, originalUrl, originalSize, result, resultUrl, error } = job
  const busy = phase === 'processing'
  const tooBig = originalSize !== null && Math.max(originalSize.width, originalSize.height) > MAX_SIDE

  return (
    <div className="page">
      <header className={styles.head}>
        <div>
          <span className="eyebrow">Colorize</span>
          <h1 className={styles.title}>Restore your memories</h1>
          <p className={styles.subtitle}>Upload an old photograph and let the GAN bring it back to colour.</p>
        </div>
        <div className={styles.status}>
          <ModelStatus />
        </div>
      </header>

      <div className={styles.stack}>
        <DropZone onFile={select} disabled={busy} compact={file !== null} />

        {error && <ErrorNotice error={error} />}

        {tooBig && originalSize && (
          <InfoNotice>
            This photo is {originalSize.width} x {originalSize.height} px. To keep your browser from running out of
            memory it will be scaled down to at most {MAX_SIDE} px on the long side before colorizing, so the
            download will be smaller than the original.
          </InfoNotice>
        )}

        <div className={styles.previews}>
          <PreviewCard
            title="Original"
            state={file ? 'Loaded' : 'Waiting'}
            meta={originalSize ? `${originalSize.width} x ${originalSize.height} px  ·  ${file?.name}` : 'No image selected'}
          >
            {originalUrl ? (
              <img src={originalUrl} alt={`Your uploaded photo ${file?.name ?? ''}`} />
            ) : (
              <Placeholder text="Your photo will appear here" />
            )}
          </PreviewCard>

          <PreviewCard
            title="AI colorized result"
            state={file ? STATE_LABEL[phase] : 'Waiting'}
            tone={phase === 'done' ? 'success' : phase === 'error' ? 'danger' : phase === 'processing' ? 'busy' : undefined}
            meta={
              result
                ? `${result.width} x ${result.height} px  ·  RGB PNG`
                : busy
                  ? 'Running the generator…'
                  : 'Waiting for generator inference'
            }
          >
            {resultUrl ? (
              <img src={resultUrl} alt={`Colorized version of ${file?.name ?? 'your photo'}`} />
            ) : busy ? (
              <Placeholder text="Colorizing…" busy />
            ) : (
              <Placeholder text="The colorized result will appear here" />
            )}
          </PreviewCard>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => colorize()}
            disabled={!file || busy}
            aria-busy={busy}
          >
            {busy ? (
              <>
                <Spinner /> Colorizing…
              </>
            ) : (
              <>
                Colorize image <span className="btn-arrow" aria-hidden="true">&rarr;</span>
              </>
            )}
          </button>
          {resultUrl && file ? (
            <a className="btn btn-secondary" href={resultUrl} download={colorizedFileName(file.name)}>
              <DownloadIcon /> Download PNG
            </a>
          ) : (
            <button type="button" className="btn btn-secondary" disabled>
              <DownloadIcon /> Download PNG
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={clear} disabled={!file && !error}>
            Clear
          </button>

          <p className={styles.timing} role="status" aria-live="polite">
            {result
              ? `Done in ${formatDuration(result.totalMs)} (model ${formatDuration(result.inferenceMs)})`
              : busy
                ? 'Working on your photo…'
                : ''}
          </p>
        </div>

        {result && resultUrl && originalUrl && (
          <section className={styles.compare} aria-labelledby="compare-title">
            <div className={styles.compareHead}>
              <h2 id="compare-title">Before and after</h2>
              <p>The left side shows the greyscale input the model actually sees.</p>
            </div>
            <CompareSlider
              className={styles.compareSlider}
              beforeSrc={originalUrl}
              afterSrc={resultUrl}
              beforeAlt={`Greyscale version of ${file?.name ?? 'your photo'}`}
              afterAlt={`Colorized version of ${file?.name ?? 'your photo'}`}
              beforeLabel="Greyscale"
              afterLabel="Colorized"
            />
          </section>
        )}
      </div>
    </div>
  )
}

function PreviewCard({
  title,
  state,
  tone,
  meta,
  children,
}: {
  title: string
  state: string
  tone?: 'success' | 'danger' | 'busy'
  meta: string
  children: ReactNode
}) {
  return (
    <section className={styles.card} aria-label={title}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>{title}</h2>
        <span className={`${styles.badge} ${tone ? styles[tone] : ''}`}>{state}</span>
      </div>
      <div className={styles.imageBox}>{children}</div>
      <p className={styles.meta}>{meta}</p>
    </section>
  )
}

function Placeholder({ text, busy = false }: { text: string; busy?: boolean }) {
  return (
    <div className={`${styles.placeholder} ${busy ? styles.shimmer : ''}`}>
      {busy && <Spinner />}
      <span>{text}</span>
    </div>
  )
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
