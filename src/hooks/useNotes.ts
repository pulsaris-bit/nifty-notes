import { useState, useCallback } from 'react';
import { Note, Notebook } from '@/types/notes';

const defaultNotebooks: Notebook[] = [
  { id: 'nb-1', name: 'Persoonlijk', icon: '📓', color: 'hsl(24, 70%, 45%)' },
  { id: 'nb-2', name: 'Werk', icon: '💼', color: 'hsl(210, 60%, 45%)' },
  { id: 'nb-3', name: 'Ideeën', icon: '💡', color: 'hsl(45, 70%, 50%)' },
];

const defaultNotes: Note[] = [
  {
    id: 'n-1',
    title: 'Welkom bij je notities',
    content: 'Dit is je persoonlijke notitie-app. Maak notebooks aan, schrijf notities en houd alles overzichtelijk.\n\nProbeer het uit door een nieuwe notitie aan te maken!',
    notebookId: 'nb-1',
    createdAt: new Date(2024, 2, 15),
    updatedAt: new Date(2024, 2, 15),
    pinned: true,
  },
  {
    id: 'n-2',
    title: 'Vergadering maandag',
    content: 'Agenda:\n- Q2 planning bespreken\n- Nieuwe projecten toewijzen\n- Teamuitje organiseren',
    notebookId: 'nb-2',
    createdAt: new Date(2024, 2, 14),
    updatedAt: new Date(2024, 2, 14),
    pinned: false,
  },
  {
    id: 'n-3',
    title: 'App idee: Receptenplanner',
    content: 'Een app waarmee je weekmenu\'s kunt plannen en automatisch boodschappenlijstjes genereert.\n\nFeatures:\n- Receptendatabase\n- Weekplanner met drag & drop\n- Automatische boodschappenlijst\n- Delen met huisgenoten',
    notebookId: 'nb-3',
    createdAt: new Date(2024, 2, 13),
    updatedAt: new Date(2024, 2, 13),
    pinned: false,
  },
  {
    id: 'n-4',
    title: 'Boodschappenlijst',
    content: '- Melk\n- Brood\n- Kaas\n- Appels\n- Pasta\n- Tomatensaus',
    notebookId: 'nb-1',
    createdAt: new Date(2024, 2, 12),
    updatedAt: new Date(2024, 2, 12),
    pinned: false,
  },
];

export function useNotes() {
  const [notebooks, setNotebooks] = useState<Notebook[]>(defaultNotebooks);
  const [notes, setNotes] = useState<Note[]>(defaultNotes);
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>('n-1');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNotes = notes.filter((note) => {
    const matchesNotebook = !activeNotebookId || note.notebookId === activeNotebookId;
    const matchesSearch =
      !searchQuery ||
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesNotebook && matchesSearch;
  });

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const activeNote = notes.find((n) => n.id === activeNoteId) || null;

  const createNote = useCallback(() => {
    const newNote: Note = {
      id: `n-${Date.now()}`,
      title: 'Nieuwe notitie',
      content: '',
      notebookId: activeNotebookId || notebooks[0]?.id || 'nb-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      pinned: false,
    };
    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
  }, [activeNotebookId, notebooks]);

  const updateNote = useCallback((id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'pinned'>>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates, updatedAt: new Date() } : n))
    );
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeNoteId === id) setActiveNoteId(null);
  }, [activeNoteId]);

  const createNotebook = useCallback((name: string) => {
    const icons = ['📒', '📕', '📗', '📘', '📙'];
    const newNb: Notebook = {
      id: `nb-${Date.now()}`,
      name,
      icon: icons[Math.floor(Math.random() * icons.length)],
      color: `hsl(${Math.floor(Math.random() * 360)}, 60%, 45%)`,
    };
    setNotebooks((prev) => [...prev, newNb]);
  }, []);

  const deleteNotebook = useCallback((id: string) => {
    setNotebooks((prev) => prev.filter((nb) => nb.id !== id));
    setNotes((prev) => prev.filter((n) => n.notebookId !== id));
    if (activeNotebookId === id) setActiveNotebookId(null);
  }, [activeNotebookId]);

  return {
    notebooks,
    notes: sortedNotes,
    activeNote,
    activeNotebookId,
    activeNoteId,
    searchQuery,
    setActiveNotebookId,
    setActiveNoteId,
    setSearchQuery,
    createNote,
    updateNote,
    deleteNote,
    createNotebook,
    deleteNotebook,
  };
}
