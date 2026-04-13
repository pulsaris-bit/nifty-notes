import { Search, Plus, Pin, Lock } from 'lucide-react';
import { Note, Notebook, Label } from '@/types/notes';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface NoteListProps {
  notes: Note[];
  notebooks: Notebook[];
  labels: Label[];
  activeNoteId: string | null;
  searchQuery: string;
  onSearch: (q: string) => void;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
}

export function NoteList({
  notes, notebooks, labels, activeNoteId, searchQuery, onSearch, onSelectNote, onCreateNote,
}: NoteListProps) {
  const getNotebookName = (id: string) => notebooks.find((nb) => nb.id === id)?.name || '';
  const getLabel = (id: string) => labels.find((l) => l.id === id);

  return (
    <div className="w-72 shrink-0 bg-note-list-bg border-r border-border flex flex-col h-full">
      <div className="p-3 space-y-2">
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={searchQuery} onChange={(e) => onSearch(e.target.value)} placeholder="Zoeken..."
            className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground" />
        </div>
        <button onClick={onCreateNote}
          className="w-full flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-md py-1.5 text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus size={15} />Nieuwe notitie
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {notes.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Geen notities gevonden</div>
        ) : (
          notes.map((note) => (
            <button key={note.id} onClick={() => onSelectNote(note.id)}
              className={`w-full text-left px-4 py-3 border-b border-border/60 transition-colors ${
                activeNoteId === note.id ? 'bg-accent/80' : 'hover:bg-accent/40'
              }`}>
              <div className="flex items-start gap-1.5">
                {note.pinned && <Pin size={12} className="text-primary mt-0.5 shrink-0" />}
                {note.password && <Lock size={12} className="text-muted-foreground mt-0.5 shrink-0" />}
                <h3 className="text-base font-medium truncate flex-1">{note.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                {note.content || 'Lege notitie'}
              </p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[10px] text-muted-foreground">
                  {format(note.updatedAt, 'd MMM yyyy', { locale: nl })}
                </span>
                <span className="text-[10px] text-muted-foreground/60">
                  {getNotebookName(note.notebookId)}
                </span>
                {note.labelIds.map((lid) => {
                  const label = getLabel(lid);
                  if (!label) return null;
                  return (
                    <span key={lid} className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: label.color }}>
                      {label.name}
                    </span>
                  );
                })}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
