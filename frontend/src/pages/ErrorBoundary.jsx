import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('UI crashed:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
          <h1 style={{ color: '#b91c1c', fontSize: 20, fontWeight: 700 }}>Something crashed</h1>
          <p style={{ margin: '8px 0 16px' }}>
            Copy the text below and send it to whoever is helping you debug.
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#fef2f2', color: '#991b1b', padding: 16, borderRadius: 8, fontSize: 13 }}>
            {String(this.state.error?.stack || this.state.error)}
          </pre>
          <button
            onClick={() => { localStorage.clear(); window.location.href = '/login' }}
            style={{ marginTop: 16, padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8 }}
          >
            Clear session and go to login
          </button>
        </div>
      )
    }
    return this.props.children
  }
}