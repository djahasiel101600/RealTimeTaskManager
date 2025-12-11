import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ReasonDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  initialValue?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export const ReasonDialog: React.FC<ReasonDialogProps> = ({ open, title = 'Provide a reason', description, initialValue = '', onClose, onConfirm }) => {
  const [reason, setReason] = React.useState(initialValue);

  React.useEffect(() => {
    setReason(initialValue);
  }, [initialValue, open]);

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <div className="text-sm text-slate-500">{description}</div>}
        </DialogHeader>

        <div className="pt-4">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter the reason (required)"
            className="min-h-[100px]"
          />
        </div>

        <DialogFooter>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onConfirm(reason)} disabled={!reason || reason.trim().length === 0}>
              Confirm
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReasonDialog;
