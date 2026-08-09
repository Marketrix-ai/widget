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
});
