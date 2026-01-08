import React from "react";

interface State {
  hasError: boolean;
  error?: Error | null;
}

export default class ErrorBoundary extends React.Component<{}, State> {
  constructor(props: {}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    // Log to console for now
    console.error("ErrorBoundary caught an error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="max-w-xl p-6 bg-card border border-border/50 rounded-lg">
            <h2 className="text-lg font-bold mb-2">Ocorreu um erro</h2>
            <p className="text-sm text-muted-foreground mb-4">A aplicação encontrou um erro ao renderizar. Veja o console para detalhes.</p>
            <pre className="text-xs font-mono max-h-40 overflow-auto break-all bg-muted p-2 rounded">{String(this.state.error)}</pre>
            <div className="mt-4 flex gap-2">
              <button className="px-3 py-2 bg-primary text-primary-foreground rounded" onClick={() => location.reload()}>Recarregar</button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children as React.ReactElement;
  }
}
