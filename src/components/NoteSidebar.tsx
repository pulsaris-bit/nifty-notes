import { useState } from 'react';
import { BookOpen, Plus, Trash2, ChevronDown, Tag } from 'lucide-react';
import { Notebook, Label } from '@/types/notes';
import { motion, AnimatePresence } from 'framer-motion';

interface NoteSidebarProps {
  notebooks: Notebook[];
  labels: Label[];
  activeNotebookId: string | null;
  activeLabelId: string | null;
  onSelectNotebook: (id: string | null) => void;
  onSelectLabel: (id: string | null) => void;
  onCreateNotebook: (name: string) => void;
  onDeleteNotebook: (id: string) => void;
  onCreateLabel: (name: string) => void;
  onDeleteLabel: (id: string) => void;
  noteCountByNotebook: Record<string, number>;
}

export function NoteSidebar({
  notebooks, labels, activeNotebookId, activeLabelId,
  onSelectNotebook, onSelectLabel,
  onCreateNotebook, onDeleteNotebook,
  onCreateLabel, onDeleteLabel,
  noteCountByNotebook,
}: NoteSidebarProps) {
  const [isCreatingNb, setIsCreatingNb] = useState(false);
  const [newNbName, setNewNbName] = useState('');
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [nbExpanded, setNbExpanded] = useState(true);
  const [labelsExpanded, setLabelsExpanded] = useState(true);

  const handleCreateNb = () => {
    if (newNbName.trim()) { onCreateNotebook(newNbName.trim()); setNewNbName(''); setIsCreatingNb(false); }
  };
  const handleCreateLabel = () => {
    if (newLabelName.trim()) { onCreateLabel(newLabelName.trim()); setNewLabelName(''); setIsCreatingLabel(false); }
  };

  const totalNotes = Object.values(noteCountByNotebook).reduce((a, b) => a + b, 0);

  const handleSelectAll = () => { onSelectNotebook(null); onSelectLabel(null); };

  return (
    <aside className="w-56 shrink-0 bg-sidebar-custom-bg flex flex-col h-full select-none">
      <div className="px-4 pt-5 pb-3">
        <h1 className="font-display text-xl text-sidebar-custom-fg-active tracking-wide">Notities</h1>
      </div>

      <button onClick={handleSelectAll}
        className={`mx-2 px-3 py-2 rounded-md text-sm flex items-center gap-2.5 transition-colors ${
          !activeNotebookId && !activeLabelId ? 'bg-sidebar-custom-accent text-sidebar-custom-fg-active' : 'text-sidebar-custom-fg hover:text-sidebar-custom-fg-active hover:bg-sidebar-custom-accent/50'
        }`}>
        <BookOpen size={16} /><span className="flex-1 text-left">Alle notities</span><span className="text-xs opacity-60">{totalNotes}</span>
      </button>

      <div className="mt-4 flex-1 overflow-y-auto custom-scrollbar space-y-3">
        {/* Notebooks */}
        <div>
          <button onClick={() => setNbExpanded(!nbExpanded)}
            className="w-full px-4 py-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-sidebar-custom-fg/60 hover:text-sidebar-custom-fg transition-colors">
            <ChevronDown size={12} className={`transition-transform ${nbExpanded ? '' : '-rotate-90'}`} />Notebooks
          </button>
          <AnimatePresence>
            {nbExpanded && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                {notebooks.map((nb) => (
                  <div key={nb.id} className={`group mx-2 px-3 py-1.5 rounded-md text-sm flex items-center gap-2.5 cursor-pointer transition-colors ${
                    activeNotebookId === nb.id ? 'bg-sidebar-custom-accent text-sidebar-custom-fg-active' : 'text-sidebar-custom-fg hover:text-sidebar-custom-fg-active hover:bg-sidebar-custom-accent/50'
                  }`} onClick={() => { onSelectNotebook(nb.id); onSelectLabel(null); }}>
                    <span>{nb.icon}</span><span className="flex-1 truncate">{nb.name}</span>
                    <span className="text-xs opacity-60">{noteCountByNotebook[nb.id] || 0}</span>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteNotebook(nb.id); }} className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"><Trash2 size={12} /></button>
                  </div>
                ))}
                {isCreatingNb ? (
                  <div className="mx-2 mt-1">
                    <input autoFocus value={newNbName} onChange={(e) => setNewNbName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCreateNb(); if (e.key === 'Escape') setIsCreatingNb(false); }}
                      onBlur={() => { handleCreateNb(); setIsCreatingNb(false); }}
                      placeholder="Naam..." className="w-full bg-sidebar-custom-accent text-sidebar-custom-fg-active text-sm px-3 py-1.5 rounded-md outline-none placeholder:text-sidebar-custom-fg/40" />
                  </div>
                ) : (
                  <button onClick={() => setIsCreatingNb(true)} className="mx-2 mt-1 px-3 py-1.5 rounded-md text-sm flex items-center gap-2 text-sidebar-custom-fg/50 hover:text-sidebar-custom-fg-active hover:bg-sidebar-custom-accent/50 transition-colors">
                    <Plus size={14} /><span>Nieuw notebook</span>
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Labels */}
        <div>
          <button onClick={() => setLabelsExpanded(!labelsExpanded)}
            className="w-full px-4 py-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-sidebar-custom-fg/60 hover:text-sidebar-custom-fg transition-colors">
            <ChevronDown size={12} className={`transition-transform ${labelsExpanded ? '' : '-rotate-90'}`} />Labels
          </button>
          <AnimatePresence>
            {labelsExpanded && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                {labels.map((label) => (
                  <div key={label.id} className={`group mx-2 mb-1 flex items-center gap-2 cursor-pointer transition-colors`}
                    onClick={() => { onSelectLabel(label.id); onSelectNotebook(null); }}>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-shadow text-white ${
                      activeLabelId === label.id ? 'ring-2 ring-sidebar-custom-fg-active/50' : ''
                    }`} style={{ backgroundColor: label.color }}>
                      {label.name}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteLabel(label.id); }} className="opacity-0 group-hover:opacity-100 text-sidebar-custom-fg/50 hover:text-destructive transition-opacity"><Trash2 size={12} /></button>
                  </div>
                ))}
                {isCreatingLabel ? (
                  <div className="mx-2 mt-1">
                    <input autoFocus value={newLabelName} onChange={(e) => setNewLabelName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCreateLabel(); if (e.key === 'Escape') setIsCreatingLabel(false); }}
                      onBlur={() => { handleCreateLabel(); setIsCreatingLabel(false); }}
                      placeholder="Label naam..." className="w-full bg-sidebar-custom-accent text-sidebar-custom-fg-active text-sm px-3 py-1.5 rounded-md outline-none placeholder:text-sidebar-custom-fg/40" />
                  </div>
                ) : (
                  <button onClick={() => setIsCreatingLabel(true)} className="mx-2 mt-1 px-3 py-1.5 rounded-md text-sm flex items-center gap-2 text-sidebar-custom-fg/50 hover:text-sidebar-custom-fg-active hover:bg-sidebar-custom-accent/50 transition-colors">
                    <Plus size={14} /><span>Nieuw label</span>
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Version */}
      <div className="px-4 py-3 text-[10px] text-sidebar-custom-fg/40">
        v1.0.0
      </div>
    </aside>
  );
}
