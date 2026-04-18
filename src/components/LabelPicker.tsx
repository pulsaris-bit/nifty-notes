import { useEffect, useRef } from 'react';
import { Tag, Plus } from 'lucide-react';
import { Label } from '@/types/notes';

interface LabelPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: Label[];
  activeLabelIds: string[];
  onToggleLabel: (labelId: string) => void;
  newLabelName: string;
  setNewLabelName: (v: string) => void;
  onAddNewLabel: () => void;
}

/**
 * Label selector dropdown. Closes when clicking outside; selections are
 * persisted live via onToggleLabel, so closing never loses changes.
 */
export function LabelPicker({
  open, onOpenChange, labels, activeLabelIds, onToggleLabel,
  newLabelName, setNewLabelName, onAddNewLabel,
}: LabelPickerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => onOpenChange(!open)}
        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        title="Labels"
      >
        <Tag size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-lg shadow-lg z-50 py-2">
          <div className="px-3 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Labels</div>
          <div className="max-h-48 overflow-y-auto custom-scrollbar">
            {labels.map((label) => {
              const isActive = activeLabelIds.includes(label.id);
              return (
                <button
                  key={label.id}
                  onClick={() => onToggleLabel(label.id)}
                  className={`w-full px-3 py-1.5 flex items-center gap-2.5 text-sm hover:bg-muted/50 transition-colors ${isActive ? 'bg-muted/30' : ''}`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0 border-2"
                    style={{
                      backgroundColor: isActive ? label.color : 'transparent',
                      borderColor: label.color,
                    }}
                  />
                  <span className="flex-1 text-left truncate">{label.name}</span>
                  {isActive && <span className="text-xs text-muted-foreground">✓</span>}
                </button>
              );
            })}
          </div>
          <div className="border-t border-border mt-1 pt-1 px-2">
            <div className="flex items-center gap-1">
              <input
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onAddNewLabel(); }}
                placeholder="Nieuw label..."
                className="flex-1 text-sm px-2 py-1 bg-transparent outline-none placeholder:text-muted-foreground/50"
              />
              <button onClick={onAddNewLabel} className="p-1 text-muted-foreground hover:text-foreground">
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
