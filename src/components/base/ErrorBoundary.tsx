/**
 * The widget's one React error boundary, so a subtree that throws while rendering cannot tear down the
 * widget's whole React root.
 * `componentDidCatch` logs the error under `label`; `render` shows the optional `fallback`, or nothing.
 */
import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  label: string;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, { hasError: boolean }> {
  override state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`${this.props.label} Error Boundary caught error:`, error, errorInfo);
  }

  override render() {
    return this.state.hasError ? (this.props.fallback ?? null) : this.props.children;
  }
}
