import { useCallback, useEffect, useRef } from 'react';
import { Pin, PinOff, Trash2, FileText } from 'lucide-react';
import { Note, Notebook } from '@/types/notes';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { motion } from 'framer-motion';

interface NoteEditorProps {
  note: Note | null;
  notebooks: Notebook[];
  onUpdate: (id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'pinned'>>) => void;
  onDelete: (id: string) => void;
}

export function NoteEditor({ note, notebooks, onUpdate, onDelete }: NoteEditorProps) {
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.style.height = 'auto';
      contentRef.current.style.height = contentRef.current.scrollHeight + 'px';
    }
  }, [note?.content]);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!note) return;
      onUpdate(note.id, { content: e.target.value });
      e.target.style.height = 'auto';
      e.target.style.height = e.target.scrollHeight + 'px';
    },
    [note, onUpdate]
  );

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

  return (
    <motion.div
      key={note.id}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="flex-1 flex flex-col bg-background h-full overflow-hidden"
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {notebook && (
            <span className="flex items-center gap-1">
              {notebook.icon} {notebook.name}
            </span>
          )}
          <span>·</span>
          <span>Bewerkt {format(note.updatedAt, "d MMM yyyy 'om' HH:mm", { locale: nl })}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onUpdate(note.id, { pinned: !note.pinned })}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title={note.pinned ? 'Losmaken' : 'Vastpinnen'}
          >
            {note.pinned ? <PinOff size={16} /> : <Pin size={16} />}
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
            title="Verwijderen"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6 max-w-3xl mx-auto w-full">
        <input
          value={note.title}
          onChange={(e) => onUpdate(note.id, { title: e.target.value })}
          className="w-full font-display text-3xl font-normal bg-transparent outline-none placeholder:text-muted-foreground/40 mb-4"
          placeholder="Titel..."
        />
        <textarea
          ref={contentRef}
          value={note.content}
          onChange={handleContentChange}
          className="w-full bg-transparent outline-none resize-none text-[15px] leading-relaxed placeholder:text-muted-foreground/40 min-h-[60vh]"
          placeholder="Begin met schrijven..."
        />
      </div>
    </motion.div>
  );
}
