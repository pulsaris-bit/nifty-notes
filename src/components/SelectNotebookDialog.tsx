import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Notebook } from '@/types/notes';
import { Plus } from 'lucide-react';

interface SelectNotebookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notebooks: Notebook[];
  onPick: (notebookId: string) => void;
  onCreate: (name: string, icon?: string) => Notebook;
}

const EMOJIS = ['📓', '📒', '📕', '📗', '📘', '📙', '💼', '💡', '📝'];

export function SelectNotebookDialog({ open, onOpenChange, notebooks, onPick, onCreate }: SelectNotebookDialogProps) {
  const [mode, setMode] = useState<'pick' | 'create'>(notebooks.length > 0 ? 'pick' : 'create');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📓');

  const reset = () => { setName(''); setEmoji('📓'); setMode(notebooks.length > 0 ? 'pick' : 'create'); };

  const handleCreate = () => {
    const n = name.trim();
    if (!n) return;
    const nb = onCreate(n, emoji);
    onPick(nb.id);
    reset();
    onOpenChange(false);
  };

  const handlePick = (id: string) => {
    onPick(id);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kies een notitieboek</DialogTitle>
          <DialogDescription>
            Een notitie moet altijd in een notitieboek staan. Kies er een of maak een nieuwe aan.
          </DialogDescription>
        </DialogHeader>

        {mode === 'pick' ? (
          <div className="space-y-3">
            <div className="max-h-64 overflow-y-auto space-y-1 -mx-1 px-1">
              {notebooks.map((nb) => (
                <button
                  key={nb.id}
                  onClick={() => handlePick(nb.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent text-left text-sm transition-colors"
                >
                  <span className="text-lg">{nb.icon}</span>
                  <span className="flex-1 truncate">{nb.name}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setMode('create')}
              className="w-full flex items-center justify-center gap-1.5 text-sm text-primary hover:underline py-1.5"
            >
              <Plus size={14} /> Nieuw notitieboek aanmaken
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Naam</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                placeholder="Notitieboek naam"
                className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Icoon</label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJIS.map((em) => (
                  <button
                    key={em}
                    onClick={() => setEmoji(em)}
                    className={`w-8 h-8 rounded-md flex items-center justify-center text-lg transition-colors ${
                      emoji === em ? 'bg-accent ring-1 ring-primary' : 'hover:bg-accent/60'
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter className="gap-2">
              {notebooks.length > 0 && (
                <button
                  onClick={() => setMode('pick')}
                  className="text-sm px-3 py-1.5 rounded-md hover:bg-accent text-muted-foreground"
                >
                  Terug
                </button>
              )}
              <button
                onClick={handleCreate}
                disabled={!name.trim()}
                className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                Aanmaken & gebruiken
              </button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
