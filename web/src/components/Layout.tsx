import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { COLOR_CRAFT_URL, GITHUB_URL, REMEMORY_URL } from '../links'
import { GitHubIcon, LockIcon, MenuIcon, MoonIcon, SunIcon, XIcon } from './Icons'
import styles from './Layout.module.css'

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/colorize', label: 'Colorize', end: false },
  { to: '/gallery', label: 'Gallery', end: false },
  { to: '/about', label: 'About', end: false },
]

const TITLES: Record<string, string> = {
  '/': 'ColorizeGAN: colorize black-and-white photos in your browser',
  '/colorize': 'Colorize a photo | ColorizeGAN',
  '/gallery': 'Gallery | ColorizeGAN',
  '/about': 'About | ColorizeGAN',
}

const base = import.meta.env.BASE_URL

export function Layout() {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  // New page: scroll to the top, set the tab title, close the mobile menu and
  // move focus to the main content so keyboard and screen-reader users start
  // at the new page.
  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = TITLES[pathname] ?? 'ColorizeGAN'
    setMenuOpen(false)
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.brand} aria-label="ColorizeGAN home">
            <img src={`${base}logo.png`} alt="" width="24" height="24" />
            <span>ColorizeGAN</span>
          </Link>

          <nav aria-label="Main" className={styles.nav} data-open={menuOpen || undefined} id="main-nav">
            <ul className={styles.navList}>
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => (isActive ? `${styles.navLink} ${styles.active}` : styles.navLink)}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.tools}>
            <ThemeToggle />
            <a
              className={styles.iconButton}
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Source on GitHub"
            >
              <GitHubIcon />
            </a>
            <button
              type="button"
              className={`${styles.iconButton} ${styles.menuButton}`}
              aria-expanded={menuOpen}
              aria-controls="main-nav"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <XIcon size={20} /> : <MenuIcon size={20} />}
            </button>
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <img src={`${base}logo.png`} alt="" width="20" height="20" />
            <span>ColorizeGAN</span>
          </div>
          <p className={styles.privacy}>
            <LockIcon size={16} />
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

type Theme = 'light' | 'dark'
const THEME_KEY = 'colorizegan-theme'

function currentTheme(): Theme {
  const set = document.documentElement.dataset.theme
  if (set === 'light' || set === 'dark') return set
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Light/dark switch. Follows the system until the visitor picks one. */
function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setTheme(currentTheme())
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      /* storage blocked: the choice lasts for this visit only */
    }
    setTheme(next)
  }

  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
  return (
    <button type="button" className={styles.iconButton} onClick={toggle} aria-label={label} title={label}>
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
