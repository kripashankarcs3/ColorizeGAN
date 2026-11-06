import { Link } from 'react-router'
import { CompareSlider } from '../components/CompareSlider'
import styles from './Home.module.css'

const base = import.meta.env.BASE_URL

const FEATURES = [
  {
    number: '01',
    title: 'GAN-powered colour',
    body: 'A trained generator paints a plausible colour version of your greyscale photo, learned from thousands of real images.',
  },
  {
    number: '02',
    title: 'Private by design',
    body: 'The model runs in your browser with WebAssembly. Your photo is never uploaded to any server.',
  },
  {
    number: '03',
    title: 'Full-size download',
    body: 'Compare with the before/after slider, then save a PNG at the same size as the photo you started with.',
  },
]

export function Home() {
  return (
    <div className="page">
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.copy}>
          <span className="eyebrow">Generative adversarial network, in your browser</span>
          <h1 id="hero-title" className={styles.title}>
            Bring your memories <em>back to life.</em>
          </h1>
          <p className={styles.lead}>
            ColorizeGAN turns black-and-white photographs into colour in a few seconds, right on your
            device. No sign-up, no uploads, no waiting in a queue.
          </p>
          <div className={styles.actions}>
            <Link to="/colorize" className="btn btn-primary">
              Start Colorizing <span className="btn-arrow" aria-hidden="true">&rarr;</span>
            </Link>
            <Link to="/gallery" className="btn btn-secondary">
              Explore Gallery
            </Link>
          </div>
          <ul className={styles.facts} aria-label="Quick facts">
            <li>
              <strong>~6 MB</strong> model
            </li>
            <li>
              <strong>0</strong> uploads
            </li>
            <li>
              <strong>PNG</strong> at full size
            </li>
          </ul>
        </div>

        <figure className={styles.showcase}>
          <div className={styles.frame}>
            <CompareSlider
              beforeSrc={`${base}samples/Dog_GL.jpg`}
              afterSrc={`${base}samples/Dog_GL_colorized.png`}
              beforeAlt="Black-and-white photo of a puppy"
              afterAlt="The same puppy photo colorized by ColorizeGAN"
              initial={46}
            />
          </div>
          <figcaption className={styles.caption}>
            Real model output. Drag the handle, or focus it and use the arrow keys.
          </figcaption>
        </figure>
      </section>

      <section aria-labelledby="features-title" className={styles.features}>
        <h2 id="features-title" className="visually-hidden">
          Features
        </h2>
        {FEATURES.map((feature) => (
          <article key={feature.number} className={styles.card}>
            <span className={styles.number} aria-hidden="true">
              {feature.number}
            </span>
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </article>
        ))}
      </section>
    </div>
  )
}
