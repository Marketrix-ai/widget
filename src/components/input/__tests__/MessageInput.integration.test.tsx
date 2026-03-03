import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { WidgetProvider } from '../../../context/WidgetContext';
import { getMockWidgetConfig } from '../../../test/fixtures';
import { MessageInput } from '../MessageInput';

function renderWithProvider(ui: React.ReactElement) {
  return render(<WidgetProvider previewMode>{ui}</WidgetProvider>);
}

const defaultProps = {
  value: '',
  onChange: () => {},
  onKeyPress: () => {},
  onSend: () => {},
  isLoading: false,
};

describe('MessageInput integration', () => {
  it('calls onSend when send button is clicked with non-empty value', () => {
    const onSend = vi.fn();
    renderWithProvider(<MessageInput {...defaultProps} value='Hello' onSend={onSend} config={getMockWidgetConfig()} />);
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('does not call onSend when value is empty', () => {
    const onSend = vi.fn();
    renderWithProvider(<MessageInput {...defaultProps} value='' onSend={onSend} config={getMockWidgetConfig()} />);
    const btn = screen.getByRole('button', { name: /send message/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('calls onStop when stop button is clicked and task is running', () => {
    const onStop = vi.fn();
    renderWithProvider(
      <MessageInput {...defaultProps} value='test' isTaskRunning onStop={onStop} config={getMockWidgetConfig()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /stop task/i }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('calls onChange when typing in textarea', () => {
    const onChange = vi.fn();
    renderWithProvider(<MessageInput {...defaultProps} value='' onChange={onChange} config={getMockWidgetConfig()} />);
    const input = screen.getByPlaceholderText('Ask anything');
    fireEvent.change(input, { target: { value: 'Hi' } });
    expect(onChange).toHaveBeenCalledWith('Hi');
  });
});
