import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Last line of defence: an unexpected crash shows a message, never a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ColorizeGAN crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="page" role="alert">
        <span className="eyebrow">Something went wrong</span>
        <h1 style={{ margin: '12px 0' }}>The page hit an unexpected error.</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>{this.state.error.message}</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Reload the page
        </button>
      </div>
    )
  }
}
