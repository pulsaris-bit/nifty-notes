import { useState, useCallback, useEffect, useRef } from 'react';
import { Note, Notebook, Label, TRASH_RETENTION_DAYS, NoteShare, UserSearchResult, PresenceViewer } from '@/types/notes';
import { HAS_API, api, eventStreamUrl, getDeviceId } from '@/lib/api';
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
    notebookId: 'nb-1', labelIds: ['lb-2'], createdAt: new Date(2024, 2, 15), updatedAt: new Date(2024, 2, 15), pinned: true, password: null, archived: false, deletedAt: null,
  },
];

/** Sentinel notebook id used to display shared-with-me notes that haven't been
 *  assigned to one of the recipient's own notebooks yet. */
export const SHARED_INBOX_ID = '__shared__';

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
    deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
    permission: r.permission ?? 'owner',
    sharedBy: r.sharedBy ?? null,
  };
}

const RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

function purgeMockTrash(notes: Note[]): Note[] {
  const cutoff = Date.now() - RETENTION_MS;
  return notes.filter((n) => !n.deletedAt || n.deletedAt.getTime() >= cutoff);
}

export interface RemoteUpdateBanner {
  noteId: string;
  by: string | null;
}

export function useNotes() {
  const { user } = useMockAuth();

  const [notebooks, setNotebooks] = useState<Notebook[]>(HAS_API ? [] : defaultNotebooks);
  const [notes, setNotes] = useState<Note[]>(HAS_API ? [] : purgeMockTrash(defaultNotes));
  const [labels, setLabels] = useState<Label[]>(HAS_API ? [] : defaultLabels);
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(HAS_API ? null : 'n-1');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLabelId, setActiveLabelId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showTrash, setShowTrash] = useState(false);

  // Realtime: presence per note + remote-update banner for active note
  const [presence, setPresence] = useState<Record<string, PresenceViewer[]>>({});
  const [remoteUpdate, setRemoteUpdate] = useState<RemoteUpdateBanner | null>(null);

  const activeNoteIdRef = useRef<string | null>(null);
  useEffect(() => { activeNoteIdRef.current = activeNoteId; }, [activeNoteId]);

  // Track per-note pending-write flag so we know to show the banner instead of stomping content.
  const dirtyNotesRef = useRef<Set<string>>(new Set());
  const markDirty = (id: string) => { dirtyNotesRef.current.add(id); };
  const markClean = (id: string) => { dirtyNotesRef.current.delete(id); };

  // ---------- Initial load ----------
  const loadAll = useCallback(async () => {
    const [nbs, lbs, ns, trashed] = await Promise.all([
      api<any[]>('/notebooks'),
      api<any[]>('/labels'),
      api<any[]>('/notes'),
      api<any[]>('/notes/trash'),
    ]);
    setNotebooks(nbs.map((n) => ({ id: n.id, name: n.name, icon: n.icon, color: n.color })));
    setLabels(lbs.map((l) => ({ id: l.id, name: l.name, color: l.color })));
    setNotes([...ns.map(mapApiNote), ...trashed.map(mapApiNote)]);
  }, []);

  useEffect(() => {
    if (!HAS_API || !user) return;
    let cancelled = false;
    (async () => {
      try {
        api('/notes/trash/purge', { method: 'POST' }).catch(() => undefined);

        const [nbs, lbs, ns, trashed] = await Promise.all([
          api<any[]>('/notebooks'),
          api<any[]>('/labels'),
          api<any[]>('/notes'),
          api<any[]>('/notes/trash'),
        ]);
        if (cancelled) return;

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
        setNotes([...ns.map(mapApiNote), ...trashed.map(mapApiNote)]);
      } catch (e) {
        console.error('Failed to load data from API', e);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Mock-mode purge on mount
  useEffect(() => {
    if (HAS_API) return;
    setNotes((prev) => {
      const purged = purgeMockTrash(prev);
      return purged.length === prev.length ? prev : purged;
    });
  }, []);

  // ---------- SSE realtime ----------
  useEffect(() => {
    if (!HAS_API || !user) return;
    const url = eventStreamUrl();
    if (!url) return;
    const myDeviceId = getDeviceId();
    const es = new EventSource(url);

    const refetchNote = async (noteId: string) => {
      try {
        const fresh = await api<any[]>('/notes');
        const found = fresh.find((n) => n.id === noteId);
        setNotes((prev) => {
          if (!found) return prev.filter((n) => n.id !== noteId);
          const mapped = mapApiNote(found);
          const exists = prev.some((n) => n.id === noteId);
          if (exists) return prev.map((n) => (n.id === noteId ? { ...n, ...mapped } : n));
          return [mapped, ...prev];
        });
      } catch { /* ignore */ }
    };

    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'presence.changed') {
          setPresence((prev) => ({ ...prev, [msg.noteId]: msg.viewers || [] }));
          return;
        }
        // Ignore echoes from this device
        if (msg.originDeviceId && msg.originDeviceId === myDeviceId) return;

        if (msg.type === 'note.updated' && msg.noteId) {
          // If the user is actively editing this note, don't stomp it: show banner instead.
          const isActive = activeNoteIdRef.current === msg.noteId;
          const isDirty = dirtyNotesRef.current.has(msg.noteId);
          if (isActive && isDirty) {
            const viewers = presence[msg.noteId] || [];
            setRemoteUpdate({
              noteId: msg.noteId,
              by: viewers.find((v) => v.userId)?.displayName || null,
            });
          } else {
            void refetchNote(msg.noteId);
          }
        } else if (msg.type === 'note.created' && msg.noteId) {
          void refetchNote(msg.noteId);
        } else if (msg.type === 'note.deleted' && msg.noteId) {
          setNotes((prev) => prev.filter((n) => n.id !== msg.noteId));
          if (activeNoteIdRef.current === msg.noteId) setActiveNoteId(null);
        } else if (msg.type === 'share.changed') {
          // Share lists changed; reload all notes to reflect new sharedBy/permission.
          void loadAll().catch(() => undefined);
        }
      } catch { /* ignore */ }
    };

    es.onerror = () => { /* EventSource auto-reconnects */ };

    return () => es.close();
  }, [user, loadAll, presence]);

  // ---------- Presence: announce active note + heartbeat ----------
  useEffect(() => {
    if (!HAS_API || !user) return;
    const deviceId = getDeviceId();
    api('/events/presence', { method: 'POST', body: { noteId: activeNoteId, deviceId } })
      .catch(() => undefined);
    if (!activeNoteId) return;

    const heartbeat = window.setInterval(() => {
      api('/events/presence/ping', { method: 'POST', body: { noteId: activeNoteId, deviceId } })
        .catch(() => undefined);
    }, 20_000);
    return () => window.clearInterval(heartbeat);
  }, [activeNoteId, user]);

  // Notify on tab close (best-effort).
  useEffect(() => {
    if (!HAS_API) return;
    const onUnload = () => {
      try {
        const url = `${(import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')}/events/presence`;
        const token = localStorage.getItem('api_auth_token');
        if (!url || !token) return;
        const blob = new Blob([JSON.stringify({ noteId: null, deviceId: getDeviceId() })], { type: 'application/json' });
        navigator.sendBeacon?.(url + `?token=${encodeURIComponent(token)}`, blob);
      } catch { /* ignore */ }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  // ---------- Selectors ----------
  const activeNotes = notes.filter((n) => !n.deletedAt);
  const trashedNotes = notes.filter((n) => !!n.deletedAt && n.permission === 'owner');

  const filteredNotes = (showTrash ? trashedNotes : activeNotes).filter((note) => {
    if (showTrash) {
      if (!searchQuery) return true;
      return (
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
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
    if (showTrash) {
      return (b.deletedAt?.getTime() ?? 0) - (a.deletedAt?.getTime() ?? 0);
    }
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const activeNote = notes.find((n) => n.id === activeNoteId) || null;

  // Count of notes that are shared with me but have no chosen notebook yet.
  const sharedInboxCount = activeNotes.filter((n) => n.permission !== 'owner' && n.notebookId === SHARED_INBOX_ID).length;

  // Robust counters computed from the FULL (unfiltered) active notes list,
  // so they don't drop to 0 when the user selects a notebook/label or searches.
  // Excludes archived and trashed notes — only "live" notes count.
  const countableNotes = activeNotes.filter((n) => !n.archived);
  const noteCountByNotebook: Record<string, number> = {};
  const noteCountByLabel: Record<string, number> = {};
  for (const n of countableNotes) {
    noteCountByNotebook[n.notebookId] = (noteCountByNotebook[n.notebookId] || 0) + 1;
    for (const lid of n.labelIds) {
      noteCountByLabel[lid] = (noteCountByLabel[lid] || 0) + 1;
    }
  }

  const createNote = useCallback((notebookId?: string) => {
    const targetNotebookId = notebookId || activeNotebookId;
    if (!targetNotebookId || targetNotebookId === SHARED_INBOX_ID) {
      return null;
    }
    // Only create in own notebooks
    const ownNotebook = notebooks.find((nb) => nb.id === targetNotebookId);
    if (!ownNotebook) return null;
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
      deletedAt: null,
      permission: 'owner',
      sharedBy: null,
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
  }, [activeNotebookId, activeLabelId, notebooks]);

  const updateNote = useCallback((id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'pinned' | 'labelIds' | 'password'>>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates, updatedAt: new Date() } : n))
    );
    markDirty(id);
    if (HAS_API) {
      api(`/notes/${id}`, { method: 'PATCH', body: updates })
        .then(() => markClean(id))
        .catch((e) => { markClean(id); console.error('updateNote failed', e); });
    } else {
      markClean(id);
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
    const note = notes.find((n) => n.id === id);
    // Recipients can't trash; they "leave" the share.
    if (note && note.permission && note.permission !== 'owner') {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (activeNoteId === id) setActiveNoteId(null);
      if (HAS_API) {
        api(`/notes/shared-with-me/${id}`, { method: 'DELETE' })
          .catch((e) => console.error('leaveSharedNote failed', e));
      }
      return;
    }
    const now = new Date();
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, deletedAt: now } : n)));
    if (activeNoteId === id) setActiveNoteId(null);
    if (HAS_API) {
      api(`/notes/${id}`, { method: 'DELETE' }).catch((e) => console.error('deleteNote failed', e));
    }
  }, [activeNoteId, notes]);

  const restoreNote = useCallback((id: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, deletedAt: null } : n)));
    if (HAS_API) {
      api(`/notes/${id}/restore`, { method: 'POST' }).catch((e) => console.error('restoreNote failed', e));
    }
  }, []);

  const purgeNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeNoteId === id) setActiveNoteId(null);
    if (HAS_API) {
      api(`/notes/${id}/permanent`, { method: 'DELETE' }).catch((e) => console.error('purgeNote failed', e));
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

  // ---------- Sharing ----------
  const searchUsers = useCallback(async (q: string): Promise<UserSearchResult[]> => {
    if (!HAS_API) return [];
    try { return await api<UserSearchResult[]>(`/users/search?q=${encodeURIComponent(q.trim())}`); }
    catch { return []; }
  }, []);

  const listShares = useCallback(async (noteId: string): Promise<NoteShare[]> => {
    if (!HAS_API) return [];
    try { return await api<NoteShare[]>(`/notes/${noteId}/shares`); }
    catch { return []; }
  }, []);

  const shareNote = useCallback(async (noteId: string, recipientEmail: string, permission: 'read' | 'write') => {
    if (!HAS_API) return { error: 'Server vereist' };
    try {
      await api(`/notes/${noteId}/shares`, { method: 'POST', body: { recipientEmail, permission } });
      return {};
    } catch (e: any) { return { error: e?.message || 'Delen mislukt' }; }
  }, []);

  const updateShare = useCallback(async (noteId: string, recipientId: string, permission: 'read' | 'write') => {
    if (!HAS_API) return;
    await api(`/notes/${noteId}/shares/${recipientId}`, { method: 'PATCH', body: { permission } });
  }, []);

  const removeShare = useCallback(async (noteId: string, recipientId: string) => {
    if (!HAS_API) return;
    await api(`/notes/${noteId}/shares/${recipientId}`, { method: 'DELETE' });
  }, []);

  const setSharedNoteNotebook = useCallback(async (noteId: string, targetNotebookId: string | null) => {
    if (!HAS_API) return;
    setNotes((prev) => prev.map((n) =>
      n.id === noteId ? { ...n, notebookId: targetNotebookId || SHARED_INBOX_ID } : n,
    ));
    try {
      await api(`/notes/shared-with-me/${noteId}`, { method: 'PATCH', body: { targetNotebookId } });
    } catch (e) { console.error('setSharedNoteNotebook failed', e); }
  }, []);

  const dismissRemoteUpdate = useCallback(async (refresh: boolean) => {
    const noteId = remoteUpdate?.noteId;
    setRemoteUpdate(null);
    if (refresh && noteId) {
      try {
        const fresh = await api<any[]>('/notes');
        const found = fresh.find((n) => n.id === noteId);
        if (found) {
          const mapped = mapApiNote(found);
          setNotes((prev) => prev.map((n) => (n.id === noteId ? mapped : n)));
          markClean(noteId);
        }
      } catch { /* ignore */ }
    }
  }, [remoteUpdate]);

  return {
    notebooks, notes: sortedNotes, labels, activeNote, activeNotebookId, activeNoteId, activeLabelId,
    searchQuery, showArchived, showTrash,
    trashedCount: trashedNotes.length,
    sharedInboxCount,
    noteCountByNotebook,
    noteCountByLabel,
    presence,
    remoteUpdate,
    dismissRemoteUpdate,
    setActiveNotebookId, setActiveNoteId, setActiveLabelId, setSearchQuery, setShowArchived, setShowTrash,
    createNote, updateNote, deleteNote, restoreNote, purgeNote, archiveNote,
    createNotebook, updateNotebook, deleteNotebook,
    createLabel, updateLabel, deleteLabel, toggleNoteLabel,
    // sharing
    searchUsers, listShares, shareNote, updateShare, removeShare, setSharedNoteNotebook,
  };
}
