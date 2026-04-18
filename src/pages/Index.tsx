import { useEffect, useRef, useState } from 'react';
import { NoteSidebar } from '@/components/NoteSidebar';
import { NoteList } from '@/components/NoteList';
import { NoteEditor } from '@/components/NoteEditor';
import { SelectNotebookDialog } from '@/components/SelectNotebookDialog';
import { useNotes, SHARED_INBOX_ID } from '@/hooks/useNotes';
import { useMockAuth } from '@/hooks/useMockAuth';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { PanelLeftOpen, ArrowLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const Index = () => {
  const bp = useBreakpoint();
  const isDesktop = bp === 'desktop';
  const isTablet = bp === 'tablet';
  const isMobile = bp === 'mobile';

  // Desktop: persistent sidebar visibility. Tablet/Mobile: overlay drawer.
  const [desktopSidebarVisible, setDesktopSidebarVisible] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lastCreatedNoteId, setLastCreatedNoteId] = useState<string | null>(null);
  // Picker for placing a shared note into one of MY notebooks
  const [sharedPickerNoteId, setSharedPickerNoteId] = useState<string | null>(null);
  const { user } = useMockAuth();

  const {
    notebooks, notes, labels, activeNote, activeNotebookId, activeNoteId, activeLabelId,
    searchQuery, showArchived, showTrash, trashedCount, sharedInboxCount,
    noteCountByNotebook, noteCountByLabel,
    presence, remoteUpdate, dismissRemoteUpdate,
    setActiveNotebookId, setActiveNoteId, setActiveLabelId, setSearchQuery, setShowArchived, setShowTrash,
    createNote, updateNote, deleteNote, restoreNote, purgeNote, archiveNote,
    createNotebook, updateNotebook, deleteNotebook,
    createLabel, updateLabel, deleteLabel, toggleNoteLabel,
    flushPendingPatch, refetchNote,
    searchUsers, listShares, shareNote, updateShare, removeShare, setSharedNoteNotebook,
  } = useNotes();

  // When on mobile and a note becomes active via selection, switch to editor pane.
  const handleSelectNote = (id: string) => {
    setActiveNoteId(id);
    if (isMobile) setMobileView('editor');
  };

  const handleCreateNote = () => {
    if (!activeNotebookId) {
      setPickerOpen(true);
      return;
    }
    const id = createNote();
    if (id) setLastCreatedNoteId(id);
    if (isMobile) setMobileView('editor');
  };

  const handlePickNotebookForNewNote = (notebookId: string) => {
    setActiveNotebookId(notebookId);
    const id = createNote(notebookId);
    if (id) setLastCreatedNoteId(id);
    if (isMobile) setMobileView('editor');
  };

  // Close drawer when breakpoint changes to desktop
  useEffect(() => {
    if (isDesktop) setDrawerOpen(false);
  }, [isDesktop]);

  // --- Swipe gestures (mobile) ---
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile || touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return; // not a horizontal swipe
    if (dx > 0) {
      // swipe right
      if (mobileView === 'editor') {
        setMobileView('list');
      } else if (!drawerOpen) {
        setDrawerOpen(true);
      }
    } else if (dx < 0 && drawerOpen) {
      setDrawerOpen(false);
    }
  };

  const sidebar = (
    <NoteSidebar
      notebooks={notebooks} labels={labels}
      activeNotebookId={activeNotebookId} activeLabelId={activeLabelId}
      showArchived={showArchived} showTrash={showTrash} trashedCount={trashedCount} sharedInboxCount={sharedInboxCount}
      onSelectNotebook={(id) => { setActiveNotebookId(id); setShowTrash(false); if (!isDesktop) setDrawerOpen(false); }}
      onSelectLabel={(id) => { setActiveLabelId(id); setShowTrash(false); if (!isDesktop) setDrawerOpen(false); }}
      onToggleArchived={() => { setShowArchived(!showArchived); setShowTrash(false); setActiveNotebookId(null); setActiveLabelId(null); if (!isDesktop) setDrawerOpen(false); }}
      onToggleTrash={() => { setShowTrash(!showTrash); setShowArchived(false); setActiveNotebookId(null); setActiveLabelId(null); setActiveNoteId(null); if (!isDesktop) setDrawerOpen(false); }}
      onCreateNotebook={createNotebook} onUpdateNotebook={updateNotebook} onDeleteNotebook={deleteNotebook}
      onCreateLabel={createLabel} onUpdateLabel={updateLabel} onDeleteLabel={deleteLabel}
      noteCountByNotebook={noteCountByNotebook}
      noteCountByLabel={noteCountByLabel}
      onCollapse={() => {
        if (isDesktop) setDesktopSidebarVisible(false);
        else setDrawerOpen(false);
      }}
    />
  );

  const showSidebarToggleInList = !isDesktop || !desktopSidebarVisible;

  return (
    <div
      className="flex h-[100dvh] w-full overflow-hidden relative"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* DESKTOP: persistent sidebar */}
      {isDesktop && desktopSidebarVisible && sidebar}
      {isDesktop && !desktopSidebarVisible && (
        <div className="shrink-0 flex flex-col justify-end pb-3 pl-2 h-full">
          <button
            onClick={() => setDesktopSidebarVisible(true)}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Zijbalk tonen"
          >
            <PanelLeftOpen className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* TABLET / MOBILE: overlay drawer */}
      {!isDesktop && (
        <AnimatePresence>
          {drawerOpen && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 bg-black/40 z-40"
                onClick={() => setDrawerOpen(false)}
              />
              <motion.div
                key="drawer"
                initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                transition={{ type: 'tween', duration: 0.22 }}
                className="fixed left-0 top-0 bottom-0 z-50 shadow-2xl"
              >
                {sidebar}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}

      {/* Main area */}
      {isDesktop ? (
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
            <NoteList
              notes={notes} notebooks={notebooks} labels={labels}
              activeNoteId={activeNoteId} searchQuery={searchQuery}
              onSearch={setSearchQuery} onSelectNote={handleSelectNote} onCreateNote={handleCreateNote}
              showSidebarToggle={showSidebarToggleInList}
              onOpenSidebar={() => setDesktopSidebarVisible(true)}
              trashMode={showTrash}
              presence={presence}
              currentUserId={user?.id}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={70} minSize={40}>
            <NoteEditor
              note={activeNote} notebooks={notebooks} labels={labels}
              onUpdate={updateNote} onDelete={deleteNote} onArchive={archiveNote}
              onToggleLabel={toggleNoteLabel} onCreateLabel={createLabel}
              trashMode={showTrash} onRestore={restoreNote} onPurge={purgeNote}
              isNewNote={!!activeNote && activeNote.id === lastCreatedNoteId}
              currentUserId={user?.id}
              viewers={activeNote ? presence[activeNote.id] || [] : []}
              remoteUpdate={remoteUpdate} onDismissRemoteUpdate={dismissRemoteUpdate}
              searchUsers={searchUsers} listShares={listShares}
              shareNote={shareNote} updateShare={updateShare} removeShare={removeShare}
              onPickSharedNotebook={(id) => setSharedPickerNoteId(id)}
              onFlush={flushPendingPatch} onRefetch={refetchNote}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : isTablet ? (
        // TABLET: list + editor side-by-side, no sidebar (drawer)
        <div className="flex flex-1 min-w-0">
          <div className="w-[300px] shrink-0 border-r border-border">
            <NoteList
              notes={notes} notebooks={notebooks} labels={labels}
              activeNoteId={activeNoteId} searchQuery={searchQuery}
              onSearch={setSearchQuery} onSelectNote={handleSelectNote} onCreateNote={handleCreateNote}
              showSidebarToggle
              onOpenSidebar={() => setDrawerOpen(true)}
              trashMode={showTrash}
              presence={presence}
              currentUserId={user?.id}
            />
          </div>
          <div className="flex-1 min-w-0">
            <NoteEditor
              note={activeNote} notebooks={notebooks} labels={labels}
              onUpdate={updateNote} onDelete={deleteNote} onArchive={archiveNote}
              onToggleLabel={toggleNoteLabel} onCreateLabel={createLabel}
              trashMode={showTrash} onRestore={restoreNote} onPurge={purgeNote}
              isNewNote={!!activeNote && activeNote.id === lastCreatedNoteId}
              currentUserId={user?.id}
              viewers={activeNote ? presence[activeNote.id] || [] : []}
              remoteUpdate={remoteUpdate} onDismissRemoteUpdate={dismissRemoteUpdate}
              searchUsers={searchUsers} listShares={listShares}
              shareNote={shareNote} updateShare={updateShare} removeShare={removeShare}
              onPickSharedNotebook={(id) => setSharedPickerNoteId(id)}
              onFlush={flushPendingPatch} onRefetch={refetchNote}
            />
          </div>
        </div>
      ) : (
        // MOBILE: single pane
        <div className="flex-1 min-w-0 relative">
          {mobileView === 'list' ? (
            <NoteList
              notes={notes} notebooks={notebooks} labels={labels}
              activeNoteId={activeNoteId} searchQuery={searchQuery}
              onSearch={setSearchQuery} onSelectNote={handleSelectNote} onCreateNote={handleCreateNote}
              showSidebarToggle
              onOpenSidebar={() => setDrawerOpen(true)}
              trashMode={showTrash}
              presence={presence}
              currentUserId={user?.id}
            />
          ) : (
            <NoteEditor
              note={activeNote} notebooks={notebooks} labels={labels}
              onUpdate={updateNote} onDelete={deleteNote} onArchive={archiveNote}
              onToggleLabel={toggleNoteLabel} onCreateLabel={createLabel}
              onBack={() => setMobileView('list')}
              trashMode={showTrash} onRestore={restoreNote} onPurge={purgeNote}
              isNewNote={!!activeNote && activeNote.id === lastCreatedNoteId}
              currentUserId={user?.id}
              viewers={activeNote ? presence[activeNote.id] || [] : []}
              remoteUpdate={remoteUpdate} onDismissRemoteUpdate={dismissRemoteUpdate}
              searchUsers={searchUsers} listShares={listShares}
              shareNote={shareNote} updateShare={updateShare} removeShare={removeShare}
              onPickSharedNotebook={(id) => setSharedPickerNoteId(id)}
              onFlush={flushPendingPatch} onRefetch={refetchNote}
            />
          )}
        </div>
      )}

      <SelectNotebookDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        notebooks={notebooks}
        onPick={handlePickNotebookForNewNote}
        onCreate={createNotebook}
      />
      {/* Picker for placing a shared note into one of MY notebooks */}
      <SelectNotebookDialog
        open={!!sharedPickerNoteId}
        onOpenChange={(o) => { if (!o) setSharedPickerNoteId(null); }}
        notebooks={notebooks}
        onPick={(nbId) => { if (sharedPickerNoteId) setSharedNoteNotebook(sharedPickerNoteId, nbId); setSharedPickerNoteId(null); }}
        onCreate={createNotebook}
      />
    </div>
  );
};

export default Index;
