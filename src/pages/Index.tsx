import { useEffect, useMemo, useRef, useState } from 'react';
import { NoteSidebar } from '@/components/NoteSidebar';
import { NoteList } from '@/components/NoteList';
import { NoteEditor } from '@/components/NoteEditor';
import { useNotes } from '@/hooks/useNotes';
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
  // Mobile only: which pane is showing (list or editor)
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');

  const {
    notebooks, notes, labels, activeNote, activeNotebookId, activeNoteId, activeLabelId, searchQuery, showArchived,
    setActiveNotebookId, setActiveNoteId, setActiveLabelId, setSearchQuery, setShowArchived,
    createNote, updateNote, deleteNote, archiveNote, createNotebook, updateNotebook, deleteNotebook,
    createLabel, updateLabel, deleteLabel, toggleNoteLabel,
  } = useNotes();

  const noteCountByNotebook = useMemo(() => {
    const counts: Record<string, number> = {};
    notes.forEach((n) => { counts[n.notebookId] = (counts[n.notebookId] || 0) + 1; });
    return counts;
  }, [notes]);

  // When on mobile and a note becomes active via selection, switch to editor pane.
  const handleSelectNote = (id: string) => {
    setActiveNoteId(id);
    if (isMobile) setMobileView('editor');
  };

  const handleCreateNote = () => {
    createNote();
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
      showArchived={showArchived}
      onSelectNotebook={(id) => { setActiveNotebookId(id); if (!isDesktop) setDrawerOpen(false); }}
      onSelectLabel={(id) => { setActiveLabelId(id); if (!isDesktop) setDrawerOpen(false); }}
      onToggleArchived={() => { setShowArchived(!showArchived); setActiveNotebookId(null); setActiveLabelId(null); if (!isDesktop) setDrawerOpen(false); }}
      onCreateNotebook={createNotebook} onUpdateNotebook={updateNotebook} onDeleteNotebook={deleteNotebook}
      onCreateLabel={createLabel} onUpdateLabel={updateLabel} onDeleteLabel={deleteLabel}
      noteCountByNotebook={noteCountByNotebook}
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
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={70} minSize={40}>
            <NoteEditor
              note={activeNote} notebooks={notebooks} labels={labels}
              onUpdate={updateNote} onDelete={deleteNote} onArchive={archiveNote}
              onToggleLabel={toggleNoteLabel} onCreateLabel={createLabel}
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
            />
          </div>
          <div className="flex-1 min-w-0">
            <NoteEditor
              note={activeNote} notebooks={notebooks} labels={labels}
              onUpdate={updateNote} onDelete={deleteNote} onArchive={archiveNote}
              onToggleLabel={toggleNoteLabel} onCreateLabel={createLabel}
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
            />
          ) : (
            <NoteEditor
              note={activeNote} notebooks={notebooks} labels={labels}
              onUpdate={updateNote} onDelete={deleteNote} onArchive={archiveNote}
              onToggleLabel={toggleNoteLabel} onCreateLabel={createLabel}
              onBack={() => setMobileView('list')}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Index;
