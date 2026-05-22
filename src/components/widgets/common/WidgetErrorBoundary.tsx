import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface WidgetErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (error: Error) => React.ReactNode;
  resetKey?: string;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component to catch errors in widget rendering
 * 
 * Provides a fallback UI when a widget fails to render due to an error
 * 
 * @component
 */
class WidgetErrorBoundary extends React.Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Widget error:', error, errorInfo);
  }

  componentDidUpdate(previousProps: WidgetErrorBoundaryProps): void {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback && this.state.error) {
        return this.props.fallback(this.state.error);
      }

      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-red-50 dark:bg-red-900 dark:bg-opacity-20 text-red-800 dark:text-red-200 rounded-lg">
          <AlertTriangle className="mb-2" size={24} aria-hidden="true" />
          <h3 className="text-sm font-medium mb-1">Widget Error</h3>
          <p className="text-xs text-center">
            {this.state.error?.message || "An error occurred while rendering this widget"}
          </p>
        </div>
      );
    }
    
    return this.props.children;
  }
}

export default WidgetErrorBoundary;
