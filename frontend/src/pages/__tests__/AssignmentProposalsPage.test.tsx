import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import AssignmentProposalsPage from '../AssignmentProposalsPage';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/services/api', () => ({
  taskService: {
    getAssignments: vi.fn(),
    respondAssignment: vi.fn(),
  }
}));

import { taskService } from '@/services/api';

describe('AssignmentProposalsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders proposals and handles accept', async () => {
    const proposals = [
      { id: 1, task: { id: 10, title: 'Inspect engine' }, user: { id: 2, username: 'alice' }, status: 'pending', created_at: new Date().toISOString() }
    ];
    taskService.getAssignments.mockResolvedValue(proposals);
    taskService.respondAssignment.mockResolvedValue({ status: 'accepted' });

    render(
      <MemoryRouter>
        <AssignmentProposalsPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(taskService.getAssignments).toHaveBeenCalled());

    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText(/Inspect engine/)).toBeInTheDocument();

    const accept = screen.getByRole('button', { name: /Accept/i });
    fireEvent.click(accept);

    await waitFor(() => expect(taskService.respondAssignment).toHaveBeenCalledWith(10, 1, 'accept'));
  });

  it('opens reason dialog when rejecting and sends reason', async () => {
    const proposals = [
      { id: 2, task: { id: 20, title: 'Write report' }, user: { id: 3, username: 'bob' }, status: 'pending', created_at: new Date().toISOString() }
    ];
    taskService.getAssignments.mockResolvedValue(proposals);
    taskService.respondAssignment.mockResolvedValue({ status: 'rejected' });

    render(
      <MemoryRouter>
        <AssignmentProposalsPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(taskService.getAssignments).toHaveBeenCalled());

    const reject = await screen.findByRole('button', { name: /Reject/i });
    fireEvent.click(reject);

    // ReasonDialog opens with Confirm button; query by role
    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Not available' } });

    const confirm = screen.getByRole('button', { name: /Confirm/i });
    fireEvent.click(confirm);

    await waitFor(() => expect(taskService.respondAssignment).toHaveBeenCalledWith(20, 2, 'reject', 'Not available'));
  });
});
