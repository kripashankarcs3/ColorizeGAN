import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { CompareSlider } from '../components/CompareSlider'
import { LockIcon } from '../components/Icons'
import styles from './Home.module.css'

const base = import.meta.env.BASE_URL
const SOURCE = `${base}samples/Dog_GL.jpg`
const RESULT = `${base}samples/Dog_GL_colorized.png`

export function Home() {
  return (
    <>
      <section className={`${styles.hero} ${styles.wrap}`} aria-labelledby="hero-title">
        <div className={styles.copy}>
          <h1 id="hero-title" className={styles.title}>
            Colour for old <span className={styles.nowrap}>black-and-white</span> photos
          </h1>
          <p className={styles.lead}>
            A compact GAN predicts plausible colours for a greyscale photo and scales them back to its full size. It
            runs on your device, so nothing is uploaded.
          </p>
          <div className={styles.actions}>
            <Link to="/colorize" className="btn btn-primary btn-lg">
              Colorize a photo
            </Link>
            <Link to="/gallery" className="btn btn-secondary btn-lg">
              Try a sample
            </Link>
          </div>
          <dl className={styles.specs}>
            <div>
              <dt>Model</dt>
              <dd className="num">5.6 MB, downloaded once</dd>
            </div>
            <div>
              <dt>Works at</dt>
              <dd className="num">120 × 120 px</dd>
            </div>
            <div>
              <dt>Output</dt>
              <dd>PNG at original size</dd>
            </div>
          </dl>
        </div>

        <figure className={styles.showcase}>
          <CompareSlider
            className={styles.heroSlider}
            beforeSrc={SOURCE}
            afterSrc={RESULT}
            beforeAlt="Black-and-white photo of a puppy"
            afterAlt="The same puppy photo colorized by ColorizeGAN"
            beforeLabel="Original"
            afterLabel="Colorized"
            initial={50}
          />
          <figcaption className={styles.caption}>
            Unretouched model output. Drag the handle, or focus it and use the arrow keys.
          </figcaption>
        </figure>
      </section>

      <section className={styles.band} aria-labelledby="how-title">
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <h2 id="how-title" className={styles.h2}>
              What happens to your photo
            </h2>
            <p className={styles.sectionLead}>
              The same four steps as the desktop app, run in a background worker in your browser.
            </p>
          </div>
          <Pipeline />
        </div>
      </section>

      <section className={`${styles.wrap} ${styles.privacy}`} aria-labelledby="privacy-title">
        <div>
          <span className={styles.privacyIcon} aria-hidden="true">
            <LockIcon size={20} />
          </span>
          <h2 id="privacy-title" className={styles.h2}>
            Your photo stays on this device
          </h2>
          <p className={styles.sectionLead}>
            There is no account and no upload. The page downloads the model once, then does all the work locally.
          </p>
        </div>
        <dl className={styles.ledger}>
          <div>
            <dt>The model</dt>
            <dd>Downloaded from this site on your first visit, then cached by your browser.</dd>
          </div>
          <div>
            <dt>Your photo</dt>
            <dd>Read, colorized and saved inside this tab with ONNX Runtime and WebAssembly.</dd>
          </div>
          <div>
            <dt>Servers</dt>
            <dd>None involved. The site is static files; there is nowhere to send a photo to.</dd>
          </div>
        </dl>
      </section>

      <section className={`${styles.wrap} ${styles.expect}`} aria-labelledby="expect-title">
        <h2 id="expect-title" className={styles.h2}>
          What to expect
        </h2>
        <div className={styles.expectGrid}>
          <p>
            <strong>Plausible, not historical.</strong> The model guesses colours that look natural. It cannot know the
            real colour of a coat or a car in an old photo.
          </p>
          <p>
            <strong>Soft colour detail.</strong> Colour is predicted at 120 × 120 px and scaled up, so fine details can
            pick up the wrong tone. <Link to="/about">How it works</Link>
          </p>
        </div>
        <div className={styles.closing}>
          <p>Have a black-and-white photo to hand?</p>
          <Link to="/colorize" className="btn btn-primary">
            Colorize a photo
          </Link>
        </div>
      </section>
    </>
  )
}

const STEPS = [
  { title: 'Greyscale', body: 'Converted to one channel with 0.299 R + 0.587 G + 0.114 B.' },
  {
    title: 'Shrink to 120 px',
    body: 'Resized to the 120 × 120 input the generator was trained on. Shown at actual size.',
  },
  { title: 'Predict colour', body: 'The generator outputs a 120 × 120 RGB image. Also shown at actual size.' },
  { title: 'Scale back up', body: 'The colour is resized to your photo’s dimensions and saved as a PNG.' },
]

/** The real pipeline, illustrated with the sample photo at each stage. */
function Pipeline() {
  return (
    <ol className={styles.pipeline}>
      {STEPS.map((step, index) => (
        <li key={step.title} className={styles.step}>
          <div className={styles.stepMedia}>
            {index === 0 && <img src={SOURCE} alt="" className={styles.grey} loading="lazy" />}
            {index === 1 && <Tiny src={SOURCE} grey />}
            {index === 2 && <Tiny src={RESULT} />}
            {index === 3 && <img src={RESULT} alt="" loading="lazy" />}
          </div>
          <div className={styles.stepText}>
            <span className={`${styles.stepNo} num`} aria-hidden="true">
              {index + 1}
            </span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Draws an image into a 120 x 120 canvas, the size the model works at. */
function Tiny({ src, grey = false }: { src: string; grey?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const image = new Image()
    image.onload = () => {
      const ctx = ref.current?.getContext('2d')
      if (!ctx) return
      if (grey) ctx.filter = 'grayscale(1)'
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(image, 0, 0, 120, 120)
    }
    image.src = src
  }, [src, grey])

  return <canvas ref={ref} width={120} height={120} className={styles.tiny} aria-hidden="true" />
}
