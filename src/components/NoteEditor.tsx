import { useCallback, useEffect, useRef, useState } from 'react';
import { Pin, PinOff, Trash2, FileText, Tag, Plus, X } from 'lucide-react';
import { Note, Notebook, Label } from '@/types/notes';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { motion } from 'framer-motion';

interface NoteEditorProps {
  note: Note | null;
  notebooks: Notebook[];
  labels: Label[];
  onUpdate: (id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'pinned' | 'labelIds'>>) => void;
  onDelete: (id: string) => void;
  onToggleLabel: (noteId: string, labelId: string) => void;
  onCreateLabel: (name: string) => Label;
}

export function NoteEditor({ note, notebooks, labels, onUpdate, onDelete, onToggleLabel, onCreateLabel }: NoteEditorProps) {
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.style.height = 'auto';
      contentRef.current.style.height = contentRef.current.scrollHeight + 'px';
    }
  }, [note?.content]);

  useEffect(() => {
    setShowLabelPicker(false);
  }, [note?.id]);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!note) return;
      onUpdate(note.id, { content: e.target.value });
      e.target.style.height = 'auto';
      e.target.style.height = e.target.scrollHeight + 'px';
    },
    [note, onUpdate]
  );

  const handleAddNewLabel = () => {
    if (!note || !newLabelName.trim()) return;
    const label = onCreateLabel(newLabelName.trim());
    onToggleLabel(note.id, label.id);
    setNewLabelName('');
  };

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <FileText size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Selecteer een notitie om te bewerken</p>
        </div>
      </div>
    );
  }

  const notebook = notebooks.find((nb) => nb.id === note.notebookId);
  const noteLabels = labels.filter((l) => note.labelIds.includes(l.id));

  return (
    <motion.div key={note.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}
      className="flex-1 flex flex-col bg-background h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {notebook && <span className="flex items-center gap-1">{notebook.icon} {notebook.name}</span>}
          <span>·</span>
          <span>Bewerkt {format(note.updatedAt, "d MMM yyyy 'om' HH:mm", { locale: nl })}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button onClick={() => setShowLabelPicker(!showLabelPicker)}
              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Labels">
              <Tag size={16} />
            </button>
            {showLabelPicker && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-lg shadow-lg z-50 py-2">
                <div className="px-3 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Labels</div>
                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                  {labels.map((label) => {
                    const isActive = note.labelIds.includes(label.id);
                    return (
                      <button key={label.id} onClick={() => onToggleLabel(note.id, label.id)}
                        className={`w-full px-3 py-1.5 flex items-center gap-2.5 text-sm hover:bg-muted/50 transition-colors ${isActive ? 'bg-muted/30' : ''}`}>
                        <span className="w-3 h-3 rounded-full shrink-0 border-2" style={{
                          backgroundColor: isActive ? label.color : 'transparent',
                          borderColor: label.color,
                        }} />
                        <span className="flex-1 text-left truncate">{label.name}</span>
                        {isActive && <span className="text-xs text-muted-foreground">✓</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-border mt-1 pt-1 px-2">
                  <div className="flex items-center gap-1">
                    <input value={newLabelName} onChange={(e) => setNewLabelName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddNewLabel(); }}
                      placeholder="Nieuw label..."
                      className="flex-1 text-sm px-2 py-1 bg-transparent outline-none placeholder:text-muted-foreground/50" />
                    <button onClick={handleAddNewLabel} className="p-1 text-muted-foreground hover:text-foreground"><Plus size={14} /></button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <button onClick={() => onUpdate(note.id, { pinned: !note.pinned })}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title={note.pinned ? 'Losmaken' : 'Vastpinnen'}>
            {note.pinned ? <PinOff size={16} /> : <Pin size={16} />}
          </button>
          <button onClick={() => onDelete(note.id)}
            className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive" title="Verwijderen">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Labels bar */}
      {noteLabels.length > 0 && (
        <div className="flex items-center gap-1.5 px-6 py-2 border-b border-border/50 flex-wrap">
          {noteLabels.map((label) => (
            <span key={label.id} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ backgroundColor: label.color + '1A', color: label.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: label.color }} />
              {label.name}
              <button onClick={() => onToggleLabel(note.id, label.id)} className="hover:opacity-70"><X size={12} /></button>
            </span>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6 max-w-3xl mx-auto w-full">
        <input value={note.title} onChange={(e) => onUpdate(note.id, { title: e.target.value })}
          className="w-full font-display text-3xl font-normal bg-transparent outline-none placeholder:text-muted-foreground/40 mb-4"
          placeholder="Titel..." />
        <textarea ref={contentRef} value={note.content} onChange={handleContentChange}
          className="w-full bg-transparent outline-none resize-none text-[15px] leading-relaxed placeholder:text-muted-foreground/40 min-h-[60vh]"
          placeholder="Begin met schrijven..." />
      </div>
    </motion.div>
  );
}
