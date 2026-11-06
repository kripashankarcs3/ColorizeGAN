import { HashRouter, Link, Route, Routes } from 'react-router'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/Layout'
import { About } from './pages/About'
import { Colorize } from './pages/Colorize'
import { Gallery } from './pages/Gallery'
import { Home } from './pages/Home'

// Hash routing (/#/colorize) works on any static host, including Vercel,
// without server rewrite rules.
export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="colorize" element={<Colorize />} />
            <Route path="gallery" element={<Gallery />} />
            <Route path="about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  )
}

function NotFound() {
  return (
    <div className="page">
      <span className="kicker">404</span>
      <h1 style={{ margin: '8px 0 24px', fontSize: 'var(--text-3xl)' }}>This page does not exist.</h1>
      <Link to="/" className="btn btn-primary">
        Back to home
      </Link>
    </div>
  )
}
