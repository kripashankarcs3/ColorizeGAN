import { useState, type ReactNode } from 'react'
import { CompareSlider } from '../components/CompareSlider'
import { DropZone } from '../components/DropZone'
import { ErrorNotice, InfoNotice, ModelStatus, Spinner } from '../components/Feedback'
import { DownloadIcon } from '../components/Icons'
import { formatDuration, useColorizeJob, usePreloadModel } from '../lib/hooks'
import { MAX_SIDE } from '../lib/preprocess'
import { colorizedFileName } from '../lib/validate'
import styles from './Colorize.module.css'

type View = 'compare' | 'split'

export function Colorize() {
  usePreloadModel()
  const { job, select, colorize, clear } = useColorizeJob()
  const { phase, file, originalUrl, originalSize, result, resultUrl, error } = job
  const [view, setView] = useState<View>('compare')
  const busy = phase === 'processing'
  const done = phase === 'done' && result !== null && resultUrl !== null
  const tooBig = originalSize !== null && Math.max(originalSize.width, originalSize.height) > MAX_SIDE
  const name = file?.name ?? 'your photo'

  return (
    <div className="page">
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Colorize a photo</h1>
          <p className={styles.subtitle}>
            Choose a black-and-white photo. It is colorized here in your browser and never uploaded.
          </p>
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
            This photo is{' '}
            <span className="num">
              {originalSize.width} × {originalSize.height} px
            </span>
            . To keep your browser from running out of memory it will be scaled down to at most {MAX_SIDE} px on the
            long side before colorizing, so the download will be smaller than the original.
          </InfoNotice>
        )}

        <section className={styles.workspace} aria-label="Workspace" data-empty={file === null || undefined}>
          <div className={styles.toolbar}>
            <div className={styles.toolbarActions}>
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
                  'Colorize image'
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
            </div>

            {done && (
              <div className={styles.segmented} role="group" aria-label="View">
                <button type="button" aria-pressed={view === 'compare'} onClick={() => setView('compare')}>
                  Compare
                </button>
                <button type="button" aria-pressed={view === 'split'} onClick={() => setView('split')}>
                  Side by side
                </button>
              </div>
            )}
          </div>

          {busy && <div className={styles.progress} aria-hidden="true" />}

          {file && (
            <>
              <div className={styles.viewer}>
                {done && view === 'compare' && originalUrl ? (
                  <CompareSlider
                    className={styles.compareSlider}
                    beforeSrc={originalUrl}
                    afterSrc={resultUrl}
                    beforeAlt={`Greyscale version of ${name}`}
                    afterAlt={`Colorized version of ${name}`}
                    beforeLabel="Greyscale"
                    afterLabel="Colorized"
                  />
                ) : (
                  <div className={styles.split}>
                    <Pane title="Original">
                      {originalUrl && <img src={originalUrl} alt={`Your uploaded photo ${file.name}`} />}
                    </Pane>
                    <Pane title="Colorized result">
                      {resultUrl ? (
                        <img src={resultUrl} alt={`Colorized version of ${name}`} />
                      ) : busy ? (
                        <div className={styles.placeholder}>
                          <Spinner />
                          <span>Running the generator…</span>
                        </div>
                      ) : (
                        <div className={styles.placeholder}>
                          <span>Press Colorize image to see the result here.</span>
                        </div>
                      )}
                    </Pane>
                  </div>
                )}
              </div>

              <div className={styles.meta}>
                <dl className={styles.metaList}>
                  <div>
                    <dt>File</dt>
                    <dd className={styles.fileName} title={file.name}>
                      {file.name}
                    </dd>
                  </div>
                  {originalSize && (
                    <div>
                      <dt>Size</dt>
                      <dd className="num">
                        {originalSize.width} × {originalSize.height} px
                      </dd>
                    </div>
                  )}
                  {result && (
                    <div>
                      <dt>Output</dt>
                      <dd className="num">
                        {result.width} × {result.height} px PNG
                      </dd>
                    </div>
                  )}
                </dl>
                <p className={`${styles.timing} num`} role="status" aria-live="polite">
                  {result
                    ? `Done in ${formatDuration(result.totalMs)} (model ${formatDuration(result.inferenceMs)})`
                    : busy
                      ? 'Working on your photo…'
                      : ''}
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

function Pane({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.pane} aria-label={title}>
      <h2 className={styles.paneTitle}>{title}</h2>
      <div className={styles.imageBox}>{children}</div>
    </section>
  )
}
