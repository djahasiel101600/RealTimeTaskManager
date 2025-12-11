import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { taskService } from '@/services/api';
import ReasonDialog from '@/components/ReasonDialog';
import { Loader2 } from 'lucide-react';

interface AssignmentProposal {
  id: number;
  task: {
    id: number;
    title: string;
  };
  user: {
    id: number;
    username: string;
    avatar?: string;
  };
  status: string;
  created_at: string;
}

export default function AssignmentProposalsPage() {
  const [proposals, setProposals] = useState<AssignmentProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ assignmentId: number | null; action: 'accept' | 'reject' | null }>({ assignmentId: null, action: null });
  const [reasonOpen, setReasonOpen] = useState(false);

  const fetchProposals = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await taskService.getAssignments?.() ?? await fetchAssignmentsFallback();
      setProposals(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      console.error('Failed to load assignment proposals', err);
      setError('Failed to load assignment proposals');
    } finally {
      setLoading(false);
    }
  };

  // Fallback for older clients: call the assignments endpoint directly
  const fetchAssignmentsFallback = async () => {
    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/tasks/assignments/`, { credentials: 'include' });
    return res.json();
  };

  useEffect(() => { void fetchProposals(); }, []);

  const handleAccept = async (assignmentId: number, taskId: number) => {
    try {
      await taskService.respondAssignment(taskId, assignmentId, 'accept');
      await fetchProposals();
    } catch (err) {
      console.error('Failed to accept assignment', err);
      alert('Failed to accept assignment');
    }
  };

  const handleReject = (assignmentId: number) => {
    setPending({ assignmentId, action: 'reject' });
    setReasonOpen(true);
  };

  const handleReasonConfirm = async (reason: string) => {
    if (!pending.assignmentId || !pending.action) return;
    try {
      // Need to know taskId for respondAssignment; map from proposals
      const proposal = proposals.find(p => p.id === pending.assignmentId);
      if (!proposal) throw new Error('Proposal not found');
      await taskService.respondAssignment(proposal.task.id, pending.assignmentId, pending.action, reason);
      await fetchProposals();
    } catch (err) {
      console.error('Failed to respond to assignment', err);
      alert('Failed to respond to assignment');
    } finally {
      setPending({ assignmentId: null, action: null });
      setReasonOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3"><Loader2 className="animate-spin" /> Loading proposals...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">{error}</div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-xl font-semibold mb-4">Assignment Proposals</h2>
      {proposals.length === 0 ? (
        <Card className="p-6">
          <CardContent>No assignment proposals at this time.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {proposals.map((p) => (
            <Card key={p.id} className="p-4">
              <CardHeader className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>{p.user.username.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{p.user.username}</div>
                    <div className="text-sm text-slate-500">Proposed for task: {p.task.title}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => handleAccept(p.id, p.task.id)}>Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => handleReject(p.id)}>Reject</Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <ReasonDialog
        open={reasonOpen}
        title={'Reason for rejecting assignment'}
        description={'Provide a short reason for rejecting this assignment.'}
        initialValue={''}
        onClose={() => { setReasonOpen(false); setPending({ assignmentId: null, action: null }); }}
        onConfirm={handleReasonConfirm}
      />
    </div>
  );
}
