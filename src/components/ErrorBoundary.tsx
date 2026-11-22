import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  sectionName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: "",
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || "Unexpected rendering error.",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Studio ErrorBoundary caught:", error, info.componentStack);
  }

  handleRecover = () => {
    this.setState({ hasError: false, errorMessage: "" });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-surface border border-edge rounded-2xl p-6 text-center space-y-3">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-ink">
              {this.props.sectionName
                ? `${this.props.sectionName} encountered an issue`
                : "Something went wrong in this studio panel"}
            </h2>
            <p className="text-xs text-ink-muted max-w-md mx-auto">
              {this.state.errorMessage}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleRecover}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-accent-fg bg-accent rounded-lg hover:bg-accent-hover cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reload Panel
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
