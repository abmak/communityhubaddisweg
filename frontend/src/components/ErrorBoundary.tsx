import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertOctagon } from "lucide-react";

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Addis Gebeta render error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center">
          <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10">
            <AlertOctagon className="h-8 w-8" />
          </span>
          <h1 className="font-display text-2xl font-semibold text-ink">Something came apart.</h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted">
            An unexpected error interrupted this page. Your data is safe — reload to get back to the
            conversation.
          </p>
          <div className="mt-6 flex gap-2">
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
              Reload page
            </button>
            <a href="/home" className="btn-secondary">
              Back home
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
