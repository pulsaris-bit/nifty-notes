import { useState, useCallback, useEffect } from 'react';
import { Note, Notebook, Label } from '@/types/notes';
import { HAS_API, api } from '@/lib/api';
import { useMockAuth } from '@/hooks/useMockAuth';

const LABEL_COLORS = [
  'hsl(0, 72%, 55%)',
  'hsl(24, 80%, 50%)',
  'hsl(45, 85%, 48%)',
  'hsl(142, 60%, 40%)',
  'hsl(190, 70%, 42%)',
  'hsl(220, 70%, 55%)',
  'hsl(262, 60%, 55%)',
  'hsl(330, 65%, 50%)',
];

const defaultLabels: Label[] = [
  { id: 'lb-1', name: 'Urgent', color: LABEL_COLORS[0] },
  { id: 'lb-2', name: 'Belangrijk', color: LABEL_COLORS[5] },
  { id: 'lb-3', name: 'Idee', color: LABEL_COLORS[3] },
];

const defaultNotebooks: Notebook[] = [
  { id: 'nb-1', name: 'Persoonlijk', icon: '📓', color: 'hsl(24, 70%, 45%)' },
  { id: 'nb-2', name: 'Werk', icon: '💼', color: 'hsl(210, 60%, 45%)' },
  { id: 'nb-3', name: 'Ideeën', icon: '💡', color: 'hsl(45, 70%, 50%)' },
];

const defaultNotes: Note[] = [
  {
    id: 'n-1', title: 'Welkom bij je notities',
    content: 'Dit is je persoonlijke notitie-app. Maak notebooks aan, schrijf notities en houd alles overzichtelijk.\n\nProbeer het uit door een nieuwe notitie aan te maken!',
    notebookId: 'nb-1', labelIds: ['lb-2'], createdAt: new Date(2024, 2, 15), updatedAt: new Date(2024, 2, 15), pinned: true, password: null, archived: false,
  },
  {
    id: 'n-2', title: 'Vergadering maandag',
    content: 'Agenda:\n- Q2 planning bespreken\n- Nieuwe projecten toewijzen\n- Teamuitje organiseren',
    notebookId: 'nb-2', labelIds: ['lb-1', 'lb-2'], createdAt: new Date(2024, 2, 14), updatedAt: new Date(2024, 2, 14), pinned: false, password: null, archived: false,
  },
  {
    id: 'n-3', title: 'App idee: Receptenplanner',
    content: 'Een app waarmee je weekmenu\'s kunt plannen en automatisch boodschappenlijstjes genereert.',
    notebookId: 'nb-3', labelIds: ['lb-3'], createdAt: new Date(2024, 2, 13), updatedAt: new Date(2024, 2, 13), pinned: false, password: null, archived: false,
  },
  {
    id: 'n-4', title: 'Boodschappenlijst',
    content: '- Melk\n- Brood\n- Kaas\n- Appels\n- Pasta\n- Tomatensaus',
    notebookId: 'nb-1', labelIds: [], createdAt: new Date(2024, 2, 12), updatedAt: new Date(2024, 2, 12), pinned: false, password: null, archived: false,
  },
];

// API row → client Note
function mapApiNote(r: any): Note {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    notebookId: r.notebookId,
    labelIds: r.labelIds || [],
    pinned: !!r.pinned,
    archived: !!r.archived,
    password: r.password ?? null,
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
  };
}

export function useNotes() {
  const { user } = useMockAuth();

  const [notebooks, setNotebooks] = useState<Notebook[]>(HAS_API ? [] : defaultNotebooks);
  const [notes, setNotes] = useState<Note[]>(HAS_API ? [] : defaultNotes);
  const [labels, setLabels] = useState<Label[]>(HAS_API ? [] : defaultLabels);
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(HAS_API ? null : 'n-1');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLabelId, setActiveLabelId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // ---------- Initial load from API ----------
  useEffect(() => {
    if (!HAS_API || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const [nbs, lbs, ns] = await Promise.all([
          api<any[]>('/notebooks'),
          api<any[]>('/labels'),
          api<any[]>('/notes'),
        ]);
        if (cancelled) return;

        // First-time bootstrap: seed defaults so the app isn't empty.
        if (nbs.length === 0) {
          for (const nb of defaultNotebooks) {
            await api('/notebooks', { method: 'POST', body: nb });
          }
          setNotebooks(defaultNotebooks);
        } else {
          setNotebooks(nbs.map((n) => ({ id: n.id, name: n.name, icon: n.icon, color: n.color })));
        }
        if (lbs.length === 0) {
          for (const lb of defaultLabels) {
            await api('/labels', { method: 'POST', body: lb });
          }
          setLabels(defaultLabels);
        } else {
          setLabels(lbs.map((l) => ({ id: l.id, name: l.name, color: l.color })));
        }
        setNotes(ns.map(mapApiNote));
      } catch (e) {
        console.error('Failed to load data from API', e);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const filteredNotes = notes.filter((note) => {
    if (showArchived) return note.archived;
    if (note.archived) return false;
    const matchesNotebook = !activeNotebookId || note.notebookId === activeNotebookId;
    const matchesLabel = !activeLabelId || note.labelIds.includes(activeLabelId);
    const matchesSearch =
      !searchQuery ||
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesNotebook && matchesLabel && matchesSearch;
  });

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const activeNote = notes.find((n) => n.id === activeNoteId) || null;

  const createNote = useCallback((notebookId?: string) => {
    const targetNotebookId = notebookId || activeNotebookId;
    if (!targetNotebookId) {
      // No notebook context — caller must pick one via the dialog.
      return null;
    }
    const newNote: Note = {
      id: `n-${Date.now()}`,
      title: 'Nieuwe notitie',
      content: '',
      notebookId: targetNotebookId,
      labelIds: activeLabelId ? [activeLabelId] : [],
      createdAt: new Date(),
      updatedAt: new Date(),
      pinned: false,
      password: null,
      archived: false,
    };
    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    if (HAS_API) {
      api('/notes', { method: 'POST', body: {
        id: newNote.id, notebookId: newNote.notebookId, title: newNote.title, content: newNote.content,
        pinned: newNote.pinned, archived: newNote.archived, password: newNote.password, labelIds: newNote.labelIds,
      }}).catch((e) => console.error('createNote failed', e));
    }
    return newNote.id;
  }, [activeNotebookId, activeLabelId]);

  const updateNote = useCallback((id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'pinned' | 'labelIds' | 'password'>>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates, updatedAt: new Date() } : n))
    );
    if (HAS_API) {
      api(`/notes/${id}`, { method: 'PATCH', body: updates }).catch((e) => console.error('updateNote failed', e));
    }
  }, []);

  const archiveNote = useCallback((id: string) => {
    let nextArchived = false;
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        nextArchived = !n.archived;
        return { ...n, archived: nextArchived, updatedAt: new Date() };
      })
    );
    if (HAS_API) {
      api(`/notes/${id}`, { method: 'PATCH', body: { archived: nextArchived } }).catch((e) => console.error('archiveNote failed', e));
    }
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeNoteId === id) setActiveNoteId(null);
    if (HAS_API) {
      api(`/notes/${id}`, { method: 'DELETE' }).catch((e) => console.error('deleteNote failed', e));
    }
  }, [activeNoteId]);

  const createNotebook = useCallback((name: string, icon?: string) => {
    const icons = ['📒', '📕', '📗', '📘', '📙'];
    const newNb: Notebook = {
      id: `nb-${Date.now()}`, name,
      icon: icon || icons[Math.floor(Math.random() * icons.length)],
      color: `hsl(${Math.floor(Math.random() * 360)}, 60%, 45%)`,
    };
    setNotebooks((prev) => [...prev, newNb]);
    if (HAS_API) {
      api('/notebooks', { method: 'POST', body: newNb }).catch((e) => console.error('createNotebook failed', e));
    }
    return newNb;
  }, []);

  const updateNotebook = useCallback((id: string, updates: Partial<Pick<Notebook, 'name' | 'icon'>>) => {
    setNotebooks((prev) => prev.map((nb) => (nb.id === id ? { ...nb, ...updates } : nb)));
    if (HAS_API) {
      api(`/notebooks/${id}`, { method: 'PATCH', body: updates }).catch((e) => console.error('updateNotebook failed', e));
    }
  }, []);

  const deleteNotebook = useCallback((id: string) => {
    setNotebooks((prev) => prev.filter((nb) => nb.id !== id));
    setNotes((prev) => prev.filter((n) => n.notebookId !== id));
    if (activeNotebookId === id) setActiveNotebookId(null);
    if (HAS_API) {
      api(`/notebooks/${id}`, { method: 'DELETE' }).catch((e) => console.error('deleteNotebook failed', e));
    }
  }, [activeNotebookId]);

  const createLabel = useCallback((name: string) => {
    const usedColors = labels.map((l) => l.color);
    const available = LABEL_COLORS.filter((c) => !usedColors.includes(c));
    const color = available.length > 0 ? available[0] : LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)];
    const newLabel: Label = { id: `lb-${Date.now()}`, name, color };
    setLabels((prev) => [...prev, newLabel]);
    if (HAS_API) {
      api('/labels', { method: 'POST', body: newLabel }).catch((e) => console.error('createLabel failed', e));
    }
    return newLabel;
  }, [labels]);

  const updateLabel = useCallback((id: string, updates: Partial<Pick<Label, 'name'>>) => {
    setLabels((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
    if (HAS_API) {
      api(`/labels/${id}`, { method: 'PATCH', body: updates }).catch((e) => console.error('updateLabel failed', e));
    }
  }, []);

  const deleteLabel = useCallback((id: string) => {
    setLabels((prev) => prev.filter((l) => l.id !== id));
    setNotes((prev) => prev.map((n) => ({ ...n, labelIds: n.labelIds.filter((lid) => lid !== id) })));
    if (activeLabelId === id) setActiveLabelId(null);
    if (HAS_API) {
      api(`/labels/${id}`, { method: 'DELETE' }).catch((e) => console.error('deleteLabel failed', e));
    }
  }, [activeLabelId]);

  const toggleNoteLabel = useCallback((noteId: string, labelId: string) => {
    let nextLabelIds: string[] = [];
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== noteId) return n;
        const has = n.labelIds.includes(labelId);
        nextLabelIds = has ? n.labelIds.filter((l) => l !== labelId) : [...n.labelIds, labelId];
        return { ...n, labelIds: nextLabelIds, updatedAt: new Date() };
      })
    );
    if (HAS_API) {
      api(`/notes/${noteId}`, { method: 'PATCH', body: { labelIds: nextLabelIds } }).catch((e) => console.error('toggleNoteLabel failed', e));
    }
  }, []);

  return {
    notebooks, notes: sortedNotes, labels, activeNote, activeNotebookId, activeNoteId, activeLabelId, searchQuery, showArchived,
    setActiveNotebookId, setActiveNoteId, setActiveLabelId, setSearchQuery, setShowArchived,
    createNote, updateNote, deleteNote, archiveNote, createNotebook, updateNotebook, deleteNotebook,
    createLabel, updateLabel, deleteLabel, toggleNoteLabel,
  };
}
