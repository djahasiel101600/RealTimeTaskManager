import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { userService, taskService } from '@/services/api';
import type { User } from '@/types';

interface Props {
  open: boolean;
  taskId: number;
  onClose: () => void;
  onProposed?: (createdIds: number[]) => void;
}

export default function ProposeAssignmentDialog({ open, taskId, onClose, onProposed }: Props) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSearching(true);
    // Load a small list of users initially
    userService.getUsers({ page_size: 20 }).then((res) => {
      if (Array.isArray(res)) {
        setUsers(res);
      } else if (res && Array.isArray((res as any).results)) {
        setUsers((res as any).results);
      } else {
        setUsers([]);
      }
    }).catch(() => {
      setError('Failed to load users');
    }).finally(() => setSearching(false));
  }, [open]);

  const toggle = (id: number) => {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const doSearch = async () => {
    setSearching(true);
    try {
      const res = await userService.getUsers({ search: query, page_size: 50 });
      setUsers(Array.isArray(res) ? res : ((res as any)?.results || []));
    } catch (e) {
      setError('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handlePropose = async () => {
    const ids = Object.keys(selected).filter(k => selected[parseInt(k, 10)]).map(k => parseInt(k, 10));
    if (ids.length === 0) {
      setError('Select at least one user');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await taskService.proposeAssignment(taskId, ids);
      onProposed?.(res?.created_assignment_ids || []);
      onClose();
    } catch (e) {
      console.error(e);
      setError('Failed to propose assignment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Propose Assignment</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Input placeholder="Search users by name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={doSearch} disabled={searching}>{searching ? 'Searching...' : 'Search'}</Button>
              <Button size="sm" variant="outline" onClick={() => { setQuery(''); setSelected({}); }}>
                Clear
              </Button>
            </div>
          </div>

          <div className="max-h-60 overflow-auto border rounded-md p-2">
            {error && <div className="text-sm text-rose-600 mb-2">{error}</div>}
            {users.length === 0 ? (
              <div className="text-sm text-slate-500">No users found.</div>
            ) : (
              users.map(u => (
                <label key={u.id} className="flex items-center gap-3 py-1">
                  <Checkbox checked={!!selected[u.id]} onCheckedChange={() => toggle(u.id)} />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{u.username}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button onClick={handlePropose} disabled={loading}>{loading ? 'Proposing...' : 'Propose'}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
