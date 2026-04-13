import { useMemo } from 'react';
import { NoteSidebar } from '@/components/NoteSidebar';
import { NoteList } from '@/components/NoteList';
import { NoteEditor } from '@/components/NoteEditor';
import { useNotes } from '@/hooks/useNotes';

const Index = () => {
  const {
    notebooks, notes, labels, activeNote, activeNotebookId, activeNoteId, activeLabelId, searchQuery,
    setActiveNotebookId, setActiveNoteId, setActiveLabelId, setSearchQuery,
    createNote, updateNote, deleteNote, createNotebook, updateNotebook, deleteNotebook,
    createLabel, deleteLabel, toggleNoteLabel,
  } = useNotes();

  const noteCountByNotebook = useMemo(() => {
    const counts: Record<string, number> = {};
    notes.forEach((n) => { counts[n.notebookId] = (counts[n.notebookId] || 0) + 1; });
    return counts;
  }, [notes]);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <NoteSidebar
        notebooks={notebooks} labels={labels}
        activeNotebookId={activeNotebookId} activeLabelId={activeLabelId}
        onSelectNotebook={setActiveNotebookId} onSelectLabel={setActiveLabelId}
        onCreateNotebook={createNotebook} onUpdateNotebook={updateNotebook} onDeleteNotebook={deleteNotebook}
        onCreateLabel={createLabel} onDeleteLabel={deleteLabel}
        noteCountByNotebook={noteCountByNotebook}
      />
      <NoteList
        notes={notes} notebooks={notebooks} labels={labels}
        activeNoteId={activeNoteId} searchQuery={searchQuery}
        onSearch={setSearchQuery} onSelectNote={setActiveNoteId} onCreateNote={createNote}
      />
      <NoteEditor
        note={activeNote} notebooks={notebooks} labels={labels}
        onUpdate={updateNote} onDelete={deleteNote}
        onToggleLabel={toggleNoteLabel} onCreateLabel={createLabel}
      />
    </div>
  );
};

export default Index;
