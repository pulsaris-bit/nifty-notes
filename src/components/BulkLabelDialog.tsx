import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label, Note } from '@/types/notes';

interface BulkLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: Label[];
  notes: Note[];        // selected notes
  onApply: (labelId: string, action: 'add' | 'remove') => void;
}

/**
 * Compact dialog for bulk-toggling labels on multiple notes.
 * For each label the user can choose: add to all selected, remove from all selected,
 * or leave unchanged. Tri-state checkbox shows current coverage.
 */
export function BulkLabelDialog({ open, onOpenChange, labels, notes, onApply }: BulkLabelDialogProps) {
  // pending action per labelId: 'add' | 'remove' | undefined (no change)
  const [pending, setPending] = useState<Record<string, 'add' | 'remove'>>({});

  useEffect(() => {
    if (open) setPending({});
  }, [open]);

  // Coverage: 'all' | 'some' | 'none' for each label across selected notes.
  const coverage = useMemo(() => {
    const map: Record<string, 'all' | 'some' | 'none'> = {};
    if (notes.length === 0) return map;
    for (const lb of labels) {
      let count = 0;
      for (const n of notes) if (n.labelIds.includes(lb.id)) count++;
      map[lb.id] = count === 0 ? 'none' : count === notes.length ? 'all' : 'some';
    }
    return map;
  }, [labels, notes]);

  const cycle = (id: string) => {
    setPending((prev) => {
      const cur = prev[id];
      const next = { ...prev };
      const cov = coverage[id];
      // Cycle: none → add → remove → none ; preferring sensible defaults
      if (!cur) {
        next[id] = cov === 'all' ? 'remove' : 'add';
      } else if (cur === 'add') {
        next[id] = 'remove';
      } else {
        delete next[id];
      }
      return next;
    });
  };

  const apply = () => {
    for (const [labelId, action] of Object.entries(pending)) {
      onApply(labelId, action);
    }
    onOpenChange(false);
  };

  const sorted = [...labels].sort((a, b) => a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' }));
  const changeCount = Object.keys(pending).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Labels bijwerken</DialogTitle>
          <DialogDescription>
            Klik om toe te voegen, nogmaals voor verwijderen, derde keer om geen wijziging te maken.
            {notes.length > 0 && ` ${notes.length} notitie${notes.length === 1 ? '' : 's'} geselecteerd.`}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto -mx-1 px-1 space-y-1">
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nog geen labels.</p>
          )}
          {sorted.map((lb) => {
            const cov = coverage[lb.id] || 'none';
            const action = pending[lb.id];
            const indicator =
              action === 'add' ? '＋'
              : action === 'remove' ? '−'
              : cov === 'all' ? '✓'
              : cov === 'some' ? '–'
              : '';
            const indicatorClass =
              action === 'add' ? 'bg-primary border-primary text-primary-foreground'
              : action === 'remove' ? 'bg-destructive border-destructive text-destructive-foreground'
              : cov === 'all' ? 'bg-muted border-muted-foreground/40 text-foreground'
              : 'border-muted-foreground/40 text-muted-foreground';
            return (
              <button
                key={lb.id}
                onClick={() => cycle(lb.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-accent text-left text-sm transition-colors"
              >
                <span className={`w-5 h-5 rounded border flex items-center justify-center text-xs font-bold shrink-0 ${indicatorClass}`}>
                  {indicator}
                </span>
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: lb.color }}
                />
                <span className="flex-1 truncate">{lb.name}</span>
                {action && (
                  <span className="text-[10px] text-muted-foreground uppercase">
                    {action === 'add' ? 'toevoegen' : 'verwijderen'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="text-sm px-3 py-1.5 rounded-md hover:bg-accent text-muted-foreground"
          >
            Annuleren
          </button>
          <button
            onClick={apply}
            disabled={changeCount === 0}
            className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Toepassen{changeCount > 0 ? ` (${changeCount})` : ''}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
