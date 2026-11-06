import { COLOR_CRAFT_URL, GITHUB_URL } from '../links'
import styles from './About.module.css'

const PIPELINE = [
  {
    step: 'Greyscale',
    detail: 'Your photo is converted to grey with 0.299 R + 0.587 G + 0.114 B, exactly like the desktop app.',
  },
  { step: 'Resize', detail: 'Lanczos resampling shrinks it to the 120 × 120 pixels the generator was trained on.' },
  { step: 'Generate', detail: 'ONNX Runtime runs the generator in WebAssembly, inside a background worker.' },
  {
    step: 'Restore',
    detail: 'The colour output is clipped, converted to bytes and scaled back to the size of your photo.',
  },
]

const CARDS = [
  {
    title: 'Generator',
    body: '120 × 120 × 1 grey input, convolutional encoder, skip connections, transposed convolutions, 120 × 120 × 3 RGB output.',
  },
  {
    title: 'Discriminator',
    body: 'Convolution and pooling blocks classify real versus generated 120 × 120 RGB images with a sigmoid output.',
  },
  {
    title: 'Training',
    body: 'Colour photos are converted to greyscale to make training pairs. MSE guides the generator, binary cross-entropy trains the discriminator, both with Adam.',
  },
  {
    title: 'In the browser',
    body: 'The Keras model is exported to ONNX (about 6 MB). It downloads once, is cached by your browser, and never sends your photo anywhere.',
  },
]

export function About() {
  return (
    <div className="page">
      <header className={styles.head}>
        <h1 className={styles.title}>How ColorizeGAN works</h1>
        <p className={styles.lead}>
          ColorizeGAN predicts a plausible colour version of a greyscale photograph with a compact generative
          adversarial network. The same model powers the desktop app and this website.
        </p>
      </header>

      <section aria-labelledby="pipeline-title" className={styles.section}>
        <h2 id="pipeline-title" className={styles.h2}>
          How a photo is colorized
        </h2>
        <ol className={styles.pipeline}>
          {PIPELINE.map((item, index) => (
            <li key={item.step}>
              <span className={`${styles.stepNo} num`} aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <h3>{item.step}</h3>
                <p>{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="arch-title" className={styles.section}>
        <h2 id="arch-title" className={styles.h2}>
          Architecture
        </h2>
        <dl className={styles.specs}>
          {CARDS.map((card) => (
            <div key={card.title}>
              <dt>{card.title}</dt>
              <dd>{card.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="limits-title" className={`${styles.section} ${styles.limits}`}>
        <h2 id="limits-title" className={styles.h2}>
          Limitations
        </h2>
        <ul>
          <li>
            <strong>Plausible, not historical.</strong> The model guesses colours that look natural. It cannot know the
            real colour of a dress, a car or a wall in an old photo.
          </li>
          <li>
            <strong>Low working resolution.</strong> Colour is predicted at 120 × 120 pixels and then scaled up, so the
            result looks softer than the original and small details may get the wrong colour.
          </li>
          <li>
            <strong>Very large photos</strong> are scaled down to 4096 pixels on the long side first, to keep your
            browser from running out of memory.
          </li>
        </ul>
      </section>

      <section aria-labelledby="credits-title" className={styles.section}>
        <h2 id="credits-title" className={styles.h2}>
          Credits
        </h2>
        <p className={styles.credits}>
          The generator architecture builds on{' '}
          <a href={COLOR_CRAFT_URL} target="_blank" rel="noreferrer">
            Color Craft GAN
          </a>{' '}
          by Asirwad. The source for this website and the desktop app is on{' '}
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          .
        </p>
        <h3 className={styles.h3}>Built with</h3>
        <ul className={styles.stack}>
          {['TensorFlow & Keras', 'ONNX Runtime Web', 'React', 'TypeScript', 'Vite', 'pica'].map((tool) => (
            <li key={tool}>{tool}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
