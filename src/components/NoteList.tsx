import { useState } from 'react';
import { Search, Plus, Pin, Lock, ArrowUpDown, PanelLeftOpen, Share2 } from 'lucide-react';
import { Note, Notebook, Label, PresenceViewer } from '@/types/notes';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { isEncrypted } from '@/lib/noteCrypto';

type SortOption = 'updatedAt' | 'createdAt' | 'title';

interface NoteListProps {
  notes: Note[];
  notebooks: Notebook[];
  labels: Label[];
  activeNoteId: string | null;
  searchQuery: string;
  onSearch: (q: string) => void;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  showSidebarToggle?: boolean;
  onOpenSidebar?: () => void;
  trashMode?: boolean;
  presence?: Record<string, PresenceViewer[]>;
  currentUserId?: string;
}

export function NoteList({
  notes, notebooks, labels, activeNoteId, searchQuery, onSearch, onSelectNote, onCreateNote,
  showSidebarToggle, onOpenSidebar, trashMode = false, presence = {}, currentUserId,
}: NoteListProps) {
  const [sortBy, setSortBy] = useState<SortOption>('updatedAt');
  const getNotebookName = (id: string) => notebooks.find((nb) => nb.id === id)?.name || '';
  const getLabel = (id: string) => labels.find((l) => l.id === id);

  const sortedNotes = [...notes].sort((a, b) => {
    // Pinned notes always first
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    switch (sortBy) {
      case 'title':
        return a.title.localeCompare(b.title, 'nl');
      case 'createdAt':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'updatedAt':
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });

  const sortLabels: Record<SortOption, string> = {
    updatedAt: 'Laatst bijgewerkt',
    createdAt: 'Aanmaakdatum',
    title: 'Naam',
  };

  return (
    <div className="bg-note-list-bg border-r border-border flex flex-col h-full min-w-0">
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          {showSidebarToggle && onOpenSidebar && (
            <button
              onClick={onOpenSidebar}
              className="shrink-0 p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Notitieboeken tonen"
              aria-label="Notitieboeken tonen"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={searchQuery} onChange={(e) => onSearch(e.target.value)} placeholder="Zoeken..."
              className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground" />
          </div>
        </div>
        {!trashMode && (
          <button onClick={onCreateNote}
            className="w-full flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-md py-1.5 text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus size={15} />Nieuwe notitie
          </button>
        )}
        {!trashMode && (
          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={12} className="text-muted-foreground shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="flex-1 text-xs bg-background border border-border rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-ring text-muted-foreground cursor-pointer"
            >
              {Object.entries(sortLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        )}
        {trashMode && (
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Notities worden na 30 dagen automatisch definitief verwijderd.
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {sortedNotes.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {trashMode ? 'Prullenbak is leeg' : 'Geen notities gevonden'}
          </div>
        ) : (
          sortedNotes.map((note) => {
            const encrypted = isEncrypted(note.content);
            // Strip HTML tags + decode entities + collapse whitespace for the list preview.
            const stripped = (note.content || '')
              .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
              .replace(/<[^>]+>/g, ' ');
            const decoded = typeof window !== 'undefined'
              ? (() => { const el = document.createElement('textarea'); el.innerHTML = stripped; return el.value; })()
              : stripped;
            const plain = decoded.replace(/\s+/g, ' ').trim();
            const previewDisplay = encrypted ? '••••••••' : (plain || 'Lege notitie');
            return (
            <button key={note.id} onClick={() => onSelectNote(note.id)}
              className={`w-full text-left px-4 py-3 border-b border-border/60 transition-colors ${
                activeNoteId === note.id ? 'bg-accent' : 'hover:bg-accent/40'
              }`}>
              <div className="flex items-start gap-1.5">
                {note.pinned && <Pin size={12} className="text-primary mt-0.5 shrink-0" />}
                {note.password && <Lock size={12} className="text-muted-foreground mt-0.5 shrink-0" />}
                {note.sharedBy && <Share2 size={12} className="text-primary mt-0.5 shrink-0" />}
                <h3 className="text-base font-medium truncate flex-1">{note.title}</h3>
                {(presence[note.id] || []).some((v) => v.userId !== currentUserId) && (
                  <span className="w-2 h-2 mt-1.5 rounded-full bg-emerald-500 shrink-0" title="Iemand bekijkt deze notitie nu" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                {previewDisplay}
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
            );
          })
        )}
      </div>
    </div>
  );
}
