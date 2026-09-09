/**
 * `ChatInput` tests: the auto-resize ref merges with a caller textarea ref, and the icon-only action
 * button is named in the words a visitor uses.
 */
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ChatInput } from '../ChatInput';

describe('ChatInput', () => {
  it('merges its resizing ref with the caller textarea ref', () => {
    const ref = createRef<HTMLTextAreaElement>();

    render(<ChatInput ref={ref} value='Question' onChange={vi.fn()} onSubmit={vi.fn()} />);

    const textarea = screen.getByRole('textbox');
    expect(ref.current).toBe(textarea);
    expect(ref.current?.style.height).toBe('0px');
    expect(ref.current?.style.overflowY).toBe('hidden');
  });

  it('names the icon-only action button in the words a visitor uses', () => {
    const { rerender } = render(<ChatInput value='Question' onChange={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument();

    rerender(<ChatInput value='Question' onChange={vi.fn()} onSubmit={vi.fn()} taskRunning onStop={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Stop the assistant' })).toBeInTheDocument();
  });
});
