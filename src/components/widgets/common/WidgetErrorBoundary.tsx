import React from 'react';
import { AlertTriangle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
        <Alert
          variant="destructive"
          className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg border-destructive/30 p-4 text-center"
        >
          <AlertTriangle className="mb-1 size-6" aria-hidden="true" />
          <AlertTitle className="text-sm">Widget Error</AlertTitle>
          <AlertDescription className="text-xs">
            {this.state.error?.message || "An error occurred while rendering this widget"}
          </AlertDescription>
        </Alert>
      );
    }
    
    return this.props.children;
  }
}

export default WidgetErrorBoundary;
