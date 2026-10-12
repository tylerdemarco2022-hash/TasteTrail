import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="rounded-2xl px-6 py-5 shadow-lg bg-white text-gray-700 max-w-md text-center">
            <h1 className="text-lg font-semibold">Something went wrong.</h1>
            <p className="mt-2 text-sm text-gray-500">TasteTrails hit an unexpected error. Your account is still on this device.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;