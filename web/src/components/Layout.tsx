import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { GITHUB_URL, REMEMORY_URL, COLOR_CRAFT_URL } from '../links'
import styles from './Layout.module.css'

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/colorize', label: 'Colorize', end: false },
  { to: '/gallery', label: 'Gallery', end: false },
  { to: '/about', label: 'About', end: false },
]

const TITLES: Record<string, string> = {
  '/': 'ColorizeGAN: bring old photos back to colour',
  '/colorize': 'Colorize a photo | ColorizeGAN',
  '/gallery': 'Gallery | ColorizeGAN',
  '/about': 'About | ColorizeGAN',
}

export function Layout() {
  const { pathname } = useLocation()

  // New page: scroll to the top, set the tab title, and move focus to the
  // main content so keyboard and screen-reader users start at the new page.
  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = TITLES[pathname] ?? 'ColorizeGAN'
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.brand} aria-label="ColorizeGAN home">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" width="36" height="36" />
            <span className={styles.brandText}>
              Colorize<span className={styles.brandGan}>GAN</span>
            </span>
          </Link>
          <nav aria-label="Main" className={styles.nav}>
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? `${styles.navLink} ${styles.active}` : styles.navLink)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p className={styles.privacy}>
            <LockIcon />
            Your photos never leave your device. Everything runs in your browser.
          </p>
          <p className={styles.credits}>
            Built on{' '}
            <a href={REMEMORY_URL} target="_blank" rel="noreferrer">
              ReMemory AI
            </a>{' '}
            and{' '}
            <a href={COLOR_CRAFT_URL} target="_blank" rel="noreferrer">
              Color Craft GAN
            </a>
            .{' '}
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              Source on GitHub
            </a>
          </p>
        </div>
      </footer>
    </>
  )
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="10" width="16" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  )
}
