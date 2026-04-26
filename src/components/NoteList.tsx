import { useEffect, useState } from 'react';
import { Search, Plus, Pin, Lock, ArrowUpDown, PanelLeftOpen, Share2, CheckSquare, X, FolderInput, Tag, Trash2 } from 'lucide-react';
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
  onBulkMove?: (ids: string[]) => void;
  onBulkLabels?: (ids: string[]) => void;
  onBulkDelete?: (ids: string[]) => void;
}

export function NoteList({
  notes, notebooks, labels, activeNoteId, searchQuery, onSearch, onSelectNote, onCreateNote,
  showSidebarToggle, onOpenSidebar, trashMode = false, presence = {}, currentUserId,
  onBulkMove, onBulkLabels, onBulkDelete,
}: NoteListProps) {
  const [sortBy, setSortBy] = useState<SortOption>('updatedAt');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  // Exit selection mode when leaving trash/normal context or when notes vanish.
  useEffect(() => {
    if (trashMode && selectMode) {
      setSelectMode(false);
      setSelected(new Set());
    }
  }, [trashMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep selection in sync with available notes (drop ids that no longer exist).
  useEffect(() => {
    if (selected.size === 0) return;
    const ids = new Set(sortedNotes.map((n) => n.id));
    let changed = false;
    const next = new Set<string>();
    for (const id of selected) {
      if (ids.has(id)) next.add(id);
      else changed = true;
    }
    if (changed) setSelected(next);
  }, [sortedNotes, selected]);

  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Selection should only target owned, non-trashed notes for bulk move/labels/delete.
  const selectableIds = sortedNotes
    .filter((n) => (n.permission ?? 'owner') === 'owner')
    .map((n) => n.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(selectableIds));
  };

  const ownedSelectedIds = Array.from(selected).filter((id) => {
    const n = notes.find((x) => x.id === id);
    return n && (n.permission ?? 'owner') === 'owner';
  });
  const hasSelection = ownedSelectedIds.length > 0;

  return (
    <div className="bg-note-list-bg border-r border-border flex flex-col h-full min-w-0">
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          {showSidebarToggle && onOpenSidebar && !selectMode && (
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
          {!trashMode && !selectMode && sortedNotes.length > 0 && (
            <button
              onClick={() => setSelectMode(true)}
              className="shrink-0 p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Selecteren"
              aria-label="Selecteren"
            >
              <CheckSquare className="w-4 h-4" />
            </button>
          )}
          {selectMode && (
            <button
              onClick={exitSelect}
              className="shrink-0 p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Selectie sluiten"
              aria-label="Selectie sluiten"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {!trashMode && !selectMode && (
          <button onClick={onCreateNote}
            className="w-full flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-md py-1.5 text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus size={15} />Nieuwe notitie
          </button>
        )}
        {!trashMode && !selectMode && (
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
        {selectMode && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <button
                onClick={toggleAll}
                className="text-primary hover:underline font-medium"
              >
                {allSelected ? 'Deselecteer alles' : 'Selecteer alles'}
              </button>
              <span className="text-muted-foreground">
                {ownedSelectedIds.length} geselecteerd
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <button
                disabled={!hasSelection}
                onClick={() => onBulkMove?.(ownedSelectedIds)}
                className="flex items-center justify-center gap-1 text-xs bg-secondary text-secondary-foreground rounded-md py-1.5 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                title="Verplaatsen"
              >
                <FolderInput size={13} /> Verplaats
              </button>
              <button
                disabled={!hasSelection}
                onClick={() => onBulkLabels?.(ownedSelectedIds)}
                className="flex items-center justify-center gap-1 text-xs bg-secondary text-secondary-foreground rounded-md py-1.5 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                title="Labels"
              >
                <Tag size={13} /> Labels
              </button>
              <button
                disabled={!hasSelection}
                onClick={() => onBulkDelete?.(ownedSelectedIds)}
                className="flex items-center justify-center gap-1 text-xs bg-destructive text-destructive-foreground rounded-md py-1.5 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                title="Verwijderen"
              >
                <Trash2 size={13} /> Verwijder
              </button>
            </div>
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
            const isOwned = (note.permission ?? 'owner') === 'owner';
            const isChecked = selected.has(note.id);
            const handleClick = () => {
              if (selectMode) {
                if (isOwned) toggleOne(note.id);
                return;
              }
              onSelectNote(note.id);
            };
            return (
            <button key={note.id} onClick={handleClick}
              className={`w-full text-left px-4 py-3 border-b border-border/60 transition-colors flex items-start gap-2 ${
                selectMode
                  ? isChecked ? 'bg-accent' : 'hover:bg-accent/40'
                  : activeNoteId === note.id ? 'bg-accent' : 'hover:bg-accent/40'
              } ${selectMode && !isOwned ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {selectMode && (
                <span
                  className={`mt-1 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    isChecked ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40'
                  }`}
                  aria-hidden
                >
                  {isChecked && <span className="text-[10px] leading-none">✓</span>}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-1.5">
                  {note.pinned && <Pin size={12} className="text-primary mt-0.5 shrink-0" />}
                  {note.password && <Lock size={12} className="text-muted-foreground mt-0.5 shrink-0" />}
                  {note.sharedBy && <Share2 size={12} className="text-primary mt-0.5 shrink-0" />}
                  <h3 className="text-base font-medium truncate flex-1">{note.title}</h3>
                  {(presence[note.id] || []).some((v) => v.userId !== currentUserId) && (
                    <span className="w-2 h-2 mt-1.5 rounded-full bg-presence shrink-0" title="Iemand bekijkt deze notitie nu" />
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
              </div>
            </button>
            );
          })
        )}
      </div>
    </div>
  );
}
