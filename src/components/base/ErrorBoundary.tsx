/**
 * The widget's one React error boundary: a subtree that throws while rendering is contained here
 * instead of tearing down the widget's whole React root. It is a class component because React has no
 * hook equivalent for this.
 *
 * `children` is the wrapped subtree, `label` names it in the logged error, and `fallback` is optional
 * UI to show once caught. `componentDidCatch` logs the error with its stack; `render` then shows the
 * fallback, or nothing. `WidgetRoot` wraps the whole messenger shell with no fallback, so a crash there
 * still leaves the launcher and toasts alive; `ChatView` wraps only the transcript, so one unrenderable
 * message can't take the composer down with it.
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
