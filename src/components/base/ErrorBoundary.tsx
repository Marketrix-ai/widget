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
    // Render nothing rather than crash the host page; componentDidCatch already logged it.
    return this.state.hasError ? (this.props.fallback ?? null) : this.props.children;
  }
}
