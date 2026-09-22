/**
 * `ChatInput` tests: the caller's textarea ref is the one the auto-resize measures, and the icon-only
 * action button is named in the words a visitor uses.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'bun:test';
import { createRef } from 'react';

import { ChatInput } from '../ChatInput';

const props = () => ({
  onChange: vi.fn(),
  onSubmit: vi.fn(),
  modes: [],
  activeMode: 'tell' as const,
  onModeChange: vi.fn(),
  disabled: false,
  taskRunning: false,
  onStop: vi.fn(),
  ref: createRef<HTMLTextAreaElement>(),
});

describe('ChatInput', () => {
  it('resizes through the caller textarea ref', () => {
    const { ref, ...rest } = props();

    render(<ChatInput {...rest} ref={ref} value='Question' />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(ref.current).toBe(textarea);
    expect(ref.current?.style.height).toBe('0px');
    expect(ref.current?.style.overflowY).toBe('hidden');
  });

  it('names the icon-only action button in the words a visitor uses', () => {
    const { rerender } = render(<ChatInput {...props()} value='Question' />);

    expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument();

    rerender(<ChatInput {...props()} value='Question' taskRunning />);

    expect(screen.getByRole('button', { name: 'Stop the assistant' })).toBeInTheDocument();
  });
});
