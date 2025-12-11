/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TaskCard } from '../TaskCard';
import { useTaskStore } from '@/stores/task.store';
import { useAuthStore } from '@/stores/auth.store';
import { vi, beforeEach, afterEach, it, expect, describe } from 'vitest';

// Mock Radix DropdownMenu primitives to simplify DOM during tests
vi.mock('@radix-ui/react-dropdown-menu', () => {
  const React = require('react');
  return {
    Root: ({ children }: any) => React.createElement('div', { 'data-radix-root': true }, children),
    Trigger: ({ children, ...props }: any) => React.createElement('button', props, children),
    Portal: ({ children }: any) => React.createElement('div', null, children),
    Content: ({ children, ...props }: any) => React.createElement('div', { ...props }, children),
    Item: ({ children, ...props }: any) => React.createElement('div', { 'data-slot': 'dropdown-menu-item', role: 'menuitem', ...props }, children),
    Separator: () => React.createElement('div', { 'data-slot': 'dropdown-menu-separator' }),
    Group: ({ children }: any) => React.createElement('div', null, children),
    Label: ({ children }: any) => React.createElement('div', null, children),
  };
});

// Setup noop store state and spies
beforeEach(() => {
  useAuthStore.setState({ user: { id: 1, username: 'admin', role: 'supervisor' }, isAuthenticated: true } as any);

  useTaskStore.setState({
    updateTaskStatus: vi.fn(async (_id: number, _status: any, _reason?: string) => {
      return;
    }) as any,
  } as any);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Task status flows', () => {
  it('calls updateTaskStatus for non-critical transitions', async () => {
    const task = {
      id: 42,
      title: 'Test Task',
      description: '',
      assigned_to: [{ id: 1 }],
      priority: 'normal',
      status: 'todo',
      due_date: null,
      attachments: [],
      updated_at: new Date().toISOString(),
    } as any;

    render(<MemoryRouter><TaskCard task={task} /></MemoryRouter>);

    // Open the dropdown: find the menu trigger button that contains the ellipsis svg
    const allButtons = screen.getAllByRole('button', { hidden: true });
    const trigger = allButtons.find((b) => b.querySelector('svg.lucide-ellipsis-vertical')) as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    fireEvent.pointerDown(trigger);

    // Click the 'In Progress' option
    const option = await screen.findByText('Mark as In Progress');
    fireEvent.click(option);

    await waitFor(() => {
      expect(useTaskStore.getState().updateTaskStatus).toHaveBeenCalledWith(42, 'in_progress', undefined);
    });
  });
});
