import { Link } from 'react-router'
import { CompareSlider } from '../components/CompareSlider'
import { ErrorNotice, ModelStatus, Spinner } from '../components/Feedback'
import { fetchSample } from '../lib/image'
import { formatDuration, useColorizeJob, usePreloadModel } from '../lib/hooks'
import { colorizedFileName } from '../lib/validate'
import { SAMPLES } from '../links'
import styles from './Gallery.module.css'

export function Gallery() {
  usePreloadModel()
  return (
    <div className="page">
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Try it on a sample</h1>
          <p className={styles.subtitle}>
            Each sample runs the real pipeline in your browser: greyscale, the generator at 120 px, then a full-size
            PNG.
          </p>
        </div>
        <div className={styles.status}>
          <ModelStatus />
        </div>
      </header>

      <div className={styles.grid}>
        {SAMPLES.map((sample) => (
          <SampleCard key={sample.id} sample={sample} />
        ))}
      </div>

      <div className={styles.more}>
        <p>Have your own photo?</p>
        <Link to="/colorize" className="btn btn-secondary">
          Colorize your own photo
        </Link>
      </div>
    </div>
  )
}

function SampleCard({ sample }: { sample: (typeof SAMPLES)[number] }) {
  const { job, select, colorize, fail } = useColorizeJob()
  const busy = job.phase === 'processing'
  const done = job.phase === 'done' && job.resultUrl && job.result

  async function run() {
    let file: File
    try {
      file = await fetchSample(sample.url, sample.file)
    } catch (error) {
      fail(error)
      return
    }
    if (await select(file)) await colorize(file)
  }

  return (
    <article className={styles.card} aria-labelledby={`${sample.id}-title`}>
      <div className={styles.media}>
        {done ? (
          <CompareSlider
            beforeSrc={sample.url}
            afterSrc={job.resultUrl!}
            beforeAlt={`${sample.title}, greyscale`}
            afterAlt={`${sample.title}, colorized by ColorizeGAN`}
            beforeLabel="Greyscale"
            afterLabel="Colorized"
          />
        ) : (
          <div className={styles.stillWrap}>
            <img className={styles.still} src={sample.url} alt={`${sample.title}, shown in greyscale`} />
            {busy && (
              <div className={styles.overlay}>
                <Spinner label="Colorizing" />
                <span>Colorizing…</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.titleRow}>
          <h2 id={`${sample.id}-title`} className={styles.cardTitle}>
            {sample.title}
          </h2>
          <span className={`${styles.size} num`}>{sample.size.replace(' x ', ' × ')}</span>
        </div>
        <p className={styles.description}>{sample.description}</p>

        {job.error && <ErrorNotice error={job.error} />}

        <div className={styles.actions}>
          <button type="button" className="btn btn-primary" onClick={run} disabled={busy}>
            {busy ? (
              <>
                <Spinner /> Colorizing…
              </>
            ) : done ? (
              'Run again'
            ) : (
              'Colorize sample'
            )}
          </button>
          {done && (
            <a className="btn btn-secondary" href={job.resultUrl!} download={colorizedFileName(sample.file)}>
              Download PNG
            </a>
          )}
        </div>
        <p className={`${styles.timing} num`} role="status" aria-live="polite">
          {done
            ? `Done in ${formatDuration(job.result!.totalMs)} (model ${formatDuration(job.result!.inferenceMs)})`
            : ''}
        </p>
      </div>
    </article>
  )
}
