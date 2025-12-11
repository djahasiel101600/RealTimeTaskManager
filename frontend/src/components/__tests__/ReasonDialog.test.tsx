/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ReasonDialog from '../ReasonDialog';
import { vi, describe, it, expect } from 'vitest';

// Mock Radix dialog primitives to avoid portal/timing issues
vi.mock('@radix-ui/react-dialog', () => {
  const React = require('react');
  return {
    Root: ({ children }: any) => React.createElement(React.Fragment, null, children),
    Trigger: ({ children }: any) => React.createElement('button', null, children),
    Portal: ({ children }: any) => React.createElement(React.Fragment, null, children),
    Content: ({ children, ...props }: any) => React.createElement('div', { ...props }, children),
    Close: ({ children, ...props }: any) => React.createElement('button', props, children),
    Overlay: ({ children }: any) => React.createElement('div', null, children),
    Title: ({ children }: any) => React.createElement('div', null, children),
    Description: ({ children }: any) => React.createElement('div', null, children),
  };
});

describe('ReasonDialog', () => {
  it('enables Confirm only when reason is provided and calls onConfirm', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(<ReasonDialog open={true} onClose={onClose} onConfirm={onConfirm} />);

    const confirm = screen.getByText('Confirm') as HTMLButtonElement;
    const textarea = screen.getByPlaceholderText('Enter the reason (required)') as HTMLTextAreaElement;

    // Check disabled state via property to avoid jest-dom matcher dependency
    expect(confirm.disabled).toBe(true);

    fireEvent.change(textarea, { target: { value: 'Completed successfully' } });
    expect(confirm.disabled).toBe(false);

    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith('Completed successfully');
  });
});
