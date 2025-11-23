import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details to console (in production, send to error tracking service)
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // TODO: Send to error tracking service (e.g., Sentry, LogRocket)
    // logErrorToService(error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
          <div className="bg-brand-card p-8 rounded-lg border border-brand-border max-w-2xl w-full">
            <div className="flex items-center mb-4">
              <div className="bg-red-500 p-3 rounded-full mr-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Beklenmeyen Bir Hata Oluştu</h1>
                <p className="text-brand-light mt-1">Üzgünüz, bir şeyler ters gitti.</p>
              </div>
            </div>

            <div className="bg-brand-dark p-4 rounded-md mb-6 border border-brand-border">
              <p className="text-sm text-brand-light mb-2">Hata Detayları:</p>
              <pre className="text-xs text-red-400 overflow-auto max-h-40">
                {this.state.error?.toString()}
              </pre>
              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <details className="mt-4">
                  <summary className="text-xs text-brand-light cursor-pointer hover:text-white">
                    Stack Trace (Geliştirici Modu)
                  </summary>
                  <pre className="text-xs text-gray-500 mt-2 overflow-auto max-h-60">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={this.handleReload}
                className="flex-1 bg-brand-primary hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-md transition-colors"
              >
                Sayfayı Yenile
              </button>
              <button
                onClick={() => window.history.back()}
                className="flex-1 bg-brand-dark hover:bg-opacity-80 text-white font-bold py-3 px-4 rounded-md transition-colors border border-brand-border"
              >
                Geri Dön
              </button>
            </div>

            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-md">
              <p className="text-sm text-blue-400">
                <strong>💡 İpucu:</strong> Eğer bu hata tekrar ediyorsa, lütfen IT destek ekibine bildirin.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

