/**
 * The widget's one React error boundary: a subtree that throws while rendering is contained here rather than
 * tearing down the widget's whole React root. It is a class because React exposes no hook equivalent.
 *
 * `ErrorBoundaryProps` are the wrapped `children`, a `label` naming the subtree in the console line, and an
 * optional `fallback` to show in its place. `getDerivedStateFromError` flips to the caught state,
 * `componentDidCatch` logs the error and the component stack, and `render` returns the fallback (or nothing)
 * once caught.
 *
 * - The widget runs inside arbitrary customer pages, so a crash must degrade to a missing widget and never a
 *   broken host page. Rendering `null` with no fallback is that degradation, not a swallowed exception —
 *   `componentDidCatch` has already surfaced the error with its stack.
 * - `console.error` specifically: terser's `drop_console` strips `log`/`info`/`debug` from the shipped
 *   bundle, so `error` is the only level that reaches a host page's console.
 * - Two call sites, each deliberate: `WidgetRoot` wraps `MessengerShell` with no fallback, so a panel crash
 *   leaves the launcher and toasts alive, while `ChatView` wraps only the transcript with a refresh prompt,
 *   so one unrenderable message cannot take the composer down with it.
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
