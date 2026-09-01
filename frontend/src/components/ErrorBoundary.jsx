import { Component } from 'react'

/**
 * Top-level error boundary: renders a recoverable fallback instead of a white
 * screen when any child subtree throws. Class component because error
 * boundaries have no hook-based equivalent.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="container" style={{ padding: 'var(--sp-6) 0', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p className="muted" style={{ margin: 'var(--sp-2) 0' }}>
            An unexpected error occurred. Reloading usually fixes it.
          </p>
          <button type="button" className="btn btn-primary" onClick={this.handleReload}>
            Reload page
          </button>
        </main>
      )
    }
    return this.props.children
  }
}
