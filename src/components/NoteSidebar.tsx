import { useState } from 'react';
import { BookOpen, Plus, Trash2, ChevronDown } from 'lucide-react';
import { Notebook } from '@/types/notes';
import { motion, AnimatePresence } from 'framer-motion';

interface NoteSidebarProps {
  notebooks: Notebook[];
  activeNotebookId: string | null;
  onSelectNotebook: (id: string | null) => void;
  onCreateNotebook: (name: string) => void;
  onDeleteNotebook: (id: string) => void;
  noteCountByNotebook: Record<string, number>;
}

export function NoteSidebar({
  notebooks,
  activeNotebookId,
  onSelectNotebook,
  onCreateNotebook,
  onDeleteNotebook,
  noteCountByNotebook,
}: NoteSidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [expanded, setExpanded] = useState(true);

  const handleCreate = () => {
    if (newName.trim()) {
      onCreateNotebook(newName.trim());
      setNewName('');
      setIsCreating(false);
    }
  };

  const totalNotes = Object.values(noteCountByNotebook).reduce((a, b) => a + b, 0);

  return (
    <aside className="w-56 shrink-0 bg-sidebar-custom-bg flex flex-col h-full select-none">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <h1 className="font-display text-xl text-sidebar-custom-fg-active tracking-wide">
          Notities
        </h1>
      </div>

      {/* All notes */}
      <button
        onClick={() => onSelectNotebook(null)}
        className={`mx-2 px-3 py-2 rounded-md text-sm flex items-center gap-2.5 transition-colors ${
          activeNotebookId === null
            ? 'bg-sidebar-custom-accent text-sidebar-custom-fg-active'
            : 'text-sidebar-custom-fg hover:text-sidebar-custom-fg-active hover:bg-sidebar-custom-accent/50'
        }`}
      >
        <BookOpen size={16} />
        <span className="flex-1 text-left">Alle notities</span>
        <span className="text-xs opacity-60">{totalNotes}</span>
      </button>

      {/* Notebooks section */}
      <div className="mt-4 flex-1 overflow-y-auto custom-scrollbar">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-sidebar-custom-fg/60 hover:text-sidebar-custom-fg transition-colors"
        >
          <ChevronDown size={12} className={`transition-transform ${expanded ? '' : '-rotate-90'}`} />
          Notebooks
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {notebooks.map((nb) => (
                <div
                  key={nb.id}
                  className={`group mx-2 px-3 py-1.5 rounded-md text-sm flex items-center gap-2.5 cursor-pointer transition-colors ${
                    activeNotebookId === nb.id
                      ? 'bg-sidebar-custom-accent text-sidebar-custom-fg-active'
                      : 'text-sidebar-custom-fg hover:text-sidebar-custom-fg-active hover:bg-sidebar-custom-accent/50'
                  }`}
                  onClick={() => onSelectNotebook(nb.id)}
                >
                  <span>{nb.icon}</span>
                  <span className="flex-1 truncate">{nb.name}</span>
                  <span className="text-xs opacity-60">{noteCountByNotebook[nb.id] || 0}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNotebook(nb.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}

              {isCreating ? (
                <div className="mx-2 mt-1">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreate();
                      if (e.key === 'Escape') setIsCreating(false);
                    }}
                    onBlur={() => { handleCreate(); setIsCreating(false); }}
                    placeholder="Naam..."
                    className="w-full bg-sidebar-custom-accent text-sidebar-custom-fg-active text-sm px-3 py-1.5 rounded-md outline-none placeholder:text-sidebar-custom-fg/40"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setIsCreating(true)}
                  className="mx-2 mt-1 px-3 py-1.5 rounded-md text-sm flex items-center gap-2 text-sidebar-custom-fg/50 hover:text-sidebar-custom-fg-active hover:bg-sidebar-custom-accent/50 transition-colors"
                >
                  <Plus size={14} />
                  <span>Nieuw notebook</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
