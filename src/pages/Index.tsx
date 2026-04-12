import { useMemo } from 'react';
import { NoteSidebar } from '@/components/NoteSidebar';
import { NoteList } from '@/components/NoteList';
import { NoteEditor } from '@/components/NoteEditor';
import { useNotes } from '@/hooks/useNotes';

const Index = () => {
  const {
    notebooks,
    notes,
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
  } = useNotes();

  const noteCountByNotebook = useMemo(() => {
    const counts: Record<string, number> = {};
    notes.forEach((n) => {
      counts[n.notebookId] = (counts[n.notebookId] || 0) + 1;
    });
    return counts;
  }, [notes]);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <NoteSidebar
        notebooks={notebooks}
        activeNotebookId={activeNotebookId}
        onSelectNotebook={setActiveNotebookId}
        onCreateNotebook={createNotebook}
        onDeleteNotebook={deleteNotebook}
        noteCountByNotebook={noteCountByNotebook}
      />
      <NoteList
        notes={notes}
        notebooks={notebooks}
        activeNoteId={activeNoteId}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        onSelectNote={setActiveNoteId}
        onCreateNote={createNote}
      />
      <NoteEditor
        note={activeNote}
        notebooks={notebooks}
        onUpdate={updateNote}
        onDelete={deleteNote}
      />
    </div>
  );
};

export default Index;
