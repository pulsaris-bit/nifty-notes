import { useMemo } from 'react';
import { NoteSidebar } from '@/components/NoteSidebar';
import { NoteList } from '@/components/NoteList';
import { NoteEditor } from '@/components/NoteEditor';
import { useNotes } from '@/hooks/useNotes';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';

const Index = () => {
  const {
    notebooks, notes, labels, activeNote, activeNotebookId, activeNoteId, activeLabelId, searchQuery,
    setActiveNotebookId, setActiveNoteId, setActiveLabelId, setSearchQuery,
    createNote, updateNote, deleteNote, createNotebook, updateNotebook, deleteNotebook,
    createLabel, updateLabel, deleteLabel, toggleNoteLabel,
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
        onCreateLabel={createLabel} onUpdateLabel={updateLabel} onDeleteLabel={deleteLabel}
        noteCountByNotebook={noteCountByNotebook}
      />
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
          <NoteList
            notes={notes} notebooks={notebooks} labels={labels}
            activeNoteId={activeNoteId} searchQuery={searchQuery}
            onSearch={setSearchQuery} onSelectNote={setActiveNoteId} onCreateNote={createNote}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={70} minSize={40}>
          <NoteEditor
            note={activeNote} notebooks={notebooks} labels={labels}
            onUpdate={updateNote} onDelete={deleteNote}
            onToggleLabel={toggleNoteLabel} onCreateLabel={createLabel}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default Index;
