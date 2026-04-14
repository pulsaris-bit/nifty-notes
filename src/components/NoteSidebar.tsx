import { useState } from 'react';
import { BookOpen, Plus, Trash2, ChevronDown, Tag, Pencil, PanelLeftClose } from 'lucide-react';
import { Notebook, Label } from '@/types/notes';
import { motion, AnimatePresence } from 'framer-motion';

const EMOJI_OPTIONS = [
  '📓', '📕', '📗', '📘', '📙', '📒', '💼', '💡', '🎯', '🏠',
  '🎨', '🎵', '📚', '✈️', '🍽️', '💪', '🧠', '❤️', '⭐', '🔬',
  '📝', '🗂️', '📋', '🛒', '💰', '🎮', '📷', '🌍', '🔧', '🎓',
];

interface NoteSidebarProps {
  notebooks: Notebook[];
  labels: Label[];
  activeNotebookId: string | null;
  activeLabelId: string | null;
  onSelectNotebook: (id: string | null) => void;
  onSelectLabel: (id: string | null) => void;
  onCreateNotebook: (name: string, icon?: string) => void;
  onUpdateNotebook: (id: string, updates: Partial<Pick<Notebook, 'name' | 'icon'>>) => void;
  onDeleteNotebook: (id: string) => void;
  onCreateLabel: (name: string) => void;
  onUpdateLabel: (id: string, updates: Partial<Pick<Label, 'name'>>) => void;
  onDeleteLabel: (id: string) => void;
  noteCountByNotebook: Record<string, number>;
  onCollapse: () => void;
}

export function NoteSidebar({
  notebooks, labels, activeNotebookId, activeLabelId,
  onSelectNotebook, onSelectLabel,
  onCreateNotebook, onUpdateNotebook, onDeleteNotebook,
  onCreateLabel, onUpdateLabel, onDeleteLabel,
  noteCountByNotebook, onCollapse,
}: NoteSidebarProps) {
  const [isCreatingNb, setIsCreatingNb] = useState(false);
  const [newNbName, setNewNbName] = useState('');
  const [newNbEmoji, setNewNbEmoji] = useState('📓');
  const [showNewEmojiPicker, setShowNewEmojiPicker] = useState(false);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [nbExpanded, setNbExpanded] = useState(true);
  const [labelsExpanded, setLabelsExpanded] = useState(true);
  const [showVersion, setShowVersion] = useState(false);
  const [editingNbId, setEditingNbId] = useState<string | null>(null);
  const [editNbName, setEditNbName] = useState('');
  const [editNbEmoji, setEditNbEmoji] = useState('');
  const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editLabelName, setEditLabelName] = useState('');

  const handleCreateNb = () => {
    if (newNbName.trim()) { onCreateNotebook(newNbName.trim(), newNbEmoji); setNewNbName(''); setNewNbEmoji('📓'); setIsCreatingNb(false); }
  };
  const handleCreateLabel = () => {
    if (newLabelName.trim()) { onCreateLabel(newLabelName.trim()); setNewLabelName(''); setIsCreatingLabel(false); }
  };
  const startEditNb = (nb: Notebook) => {
    setEditingNbId(nb.id); setEditNbName(nb.name); setEditNbEmoji(nb.icon); setShowEditEmojiPicker(false);
  };
  const saveEditNb = () => {
    if (editingNbId && editNbName.trim()) {
      onUpdateNotebook(editingNbId, { name: editNbName.trim(), icon: editNbEmoji });
    }
    setEditingNbId(null); setShowEditEmojiPicker(false);
  };

  const totalNotes = Object.values(noteCountByNotebook).reduce((a, b) => a + b, 0);
  const handleSelectAll = () => { onSelectNotebook(null); onSelectLabel(null); };

  const EmojiGrid = ({ selected, onSelect }: { selected: string; onSelect: (e: string) => void }) => (
    <div className="grid grid-cols-6 gap-1 p-2 bg-card border border-border rounded-lg shadow-xl w-48">
      {EMOJI_OPTIONS.map((emoji) => (
        <button key={emoji} onClick={(e) => { e.stopPropagation(); onSelect(emoji); }}
          className={`w-7 h-7 flex items-center justify-center rounded text-base hover:bg-accent transition-colors ${selected === emoji ? 'bg-accent ring-1 ring-primary' : ''}`}>
          {emoji}
        </button>
      ))}
    </div>
  );

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
                  editingNbId === nb.id ? (
                    <div key={nb.id} className="mx-2 mb-1 p-2 bg-sidebar-custom-accent rounded-md space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <button onClick={() => setShowEditEmojiPicker(!showEditEmojiPicker)}
                            className="w-8 h-8 flex items-center justify-center rounded bg-sidebar-custom-bg hover:bg-sidebar-custom-accent/80 text-base transition-colors">
                            {editNbEmoji}
                          </button>
                          {showEditEmojiPicker && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setShowEditEmojiPicker(false)} />
                              <div className="absolute left-0 top-9 z-50">
                                <EmojiGrid selected={editNbEmoji} onSelect={(e) => { setEditNbEmoji(e); setShowEditEmojiPicker(false); }} />
                              </div>
                            </>
                          )}
                        </div>
                        <input autoFocus value={editNbName} onChange={(e) => setEditNbName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditNb(); if (e.key === 'Escape') setEditingNbId(null); }}
                          className="flex-1 bg-sidebar-custom-bg text-sidebar-custom-fg-active text-sm px-2 py-1 rounded outline-none" />
                      </div>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditingNbId(null)} className="text-xs text-sidebar-custom-fg/60 px-2 py-0.5 rounded hover:bg-sidebar-custom-bg transition-colors">Annuleer</button>
                        <button onClick={saveEditNb} className="text-xs text-sidebar-custom-fg-active bg-primary/20 px-2 py-0.5 rounded hover:bg-primary/30 transition-colors">Opslaan</button>
                      </div>
                    </div>
                  ) : (
                    <div key={nb.id} className={`group mx-2 px-3 py-1.5 rounded-md text-sm flex items-center gap-2.5 cursor-pointer transition-colors ${
                      activeNotebookId === nb.id ? 'bg-sidebar-custom-accent text-sidebar-custom-fg-active' : 'text-sidebar-custom-fg hover:text-sidebar-custom-fg-active hover:bg-sidebar-custom-accent/50'
                    }`} onClick={() => { onSelectNotebook(nb.id); onSelectLabel(null); }}>
                      <span>{nb.icon}</span><span className="flex-1 truncate">{nb.name}</span>
                      <span className="text-xs opacity-60">{noteCountByNotebook[nb.id] || 0}</span>
                      <button onClick={(e) => { e.stopPropagation(); startEditNb(nb); }} className="opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity"><Pencil size={12} /></button>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteNotebook(nb.id); }} className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"><Trash2 size={12} /></button>
                    </div>
                  )
                ))}
                {isCreatingNb ? (
                  <div className="mx-2 mt-1 p-2 bg-sidebar-custom-accent rounded-md space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <button onClick={() => setShowNewEmojiPicker(!showNewEmojiPicker)}
                          className="w-8 h-8 flex items-center justify-center rounded bg-sidebar-custom-bg hover:bg-sidebar-custom-accent/80 text-base transition-colors">
                          {newNbEmoji}
                        </button>
                        {showNewEmojiPicker && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowNewEmojiPicker(false)} />
                            <div className="absolute left-0 top-9 z-50">
                              <EmojiGrid selected={newNbEmoji} onSelect={(e) => { setNewNbEmoji(e); setShowNewEmojiPicker(false); }} />
                            </div>
                          </>
                        )}
                      </div>
                      <input autoFocus value={newNbName} onChange={(e) => setNewNbName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateNb(); if (e.key === 'Escape') { setIsCreatingNb(false); setShowNewEmojiPicker(false); } }}
                        placeholder="Naam..." className="flex-1 bg-sidebar-custom-bg text-sidebar-custom-fg-active text-sm px-2 py-1 rounded outline-none placeholder:text-sidebar-custom-fg/40" />
                    </div>
                    <div className="flex justify-end gap-1">
                      <button onClick={() => { setIsCreatingNb(false); setShowNewEmojiPicker(false); }} className="text-xs text-sidebar-custom-fg/60 px-2 py-0.5 rounded hover:bg-sidebar-custom-bg transition-colors">Annuleer</button>
                      <button onClick={handleCreateNb} className="text-xs text-sidebar-custom-fg-active bg-primary/20 px-2 py-0.5 rounded hover:bg-primary/30 transition-colors">Aanmaken</button>
                    </div>
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
                  editingLabelId === label.id ? (
                    <div key={label.id} className="mx-2 mb-1 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                      <input autoFocus value={editLabelName} onChange={(e) => setEditLabelName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && editLabelName.trim()) { onUpdateLabel(label.id, { name: editLabelName.trim() }); setEditingLabelId(null); }
                          if (e.key === 'Escape') setEditingLabelId(null);
                        }}
                        onBlur={() => { if (editLabelName.trim()) onUpdateLabel(label.id, { name: editLabelName.trim() }); setEditingLabelId(null); }}
                        className="flex-1 bg-sidebar-custom-accent text-sidebar-custom-fg-active text-xs px-2 py-1 rounded outline-none" />
                    </div>
                  ) : (
                    <div key={label.id} className={`group mx-2 mb-1 flex items-center gap-2 cursor-pointer transition-colors`}
                      onClick={() => { onSelectLabel(label.id); onSelectNotebook(null); }}>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-shadow text-white ${
                        activeLabelId === label.id ? 'ring-2 ring-sidebar-custom-fg-active/50' : ''
                      }`} style={{ backgroundColor: label.color }}>
                        {label.name}
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); setEditingLabelId(label.id); setEditLabelName(label.name); }} className="opacity-0 group-hover:opacity-100 text-sidebar-custom-fg/50 hover:text-primary transition-opacity"><Pencil size={12} /></button>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteLabel(label.id); }} className="opacity-0 group-hover:opacity-100 text-sidebar-custom-fg/50 hover:text-destructive transition-opacity"><Trash2 size={12} /></button>
                    </div>
                  )
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
      <div className="relative px-4 py-3">
        <button onClick={() => setShowVersion(!showVersion)}
          className="text-[10px] text-sidebar-custom-fg/40 hover:text-sidebar-custom-fg/70 transition-colors cursor-pointer">
          v1.0.1
        </button>
        {showVersion && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowVersion(false)} />
            <div className="absolute left-3 bottom-10 z-50 w-56 bg-card border border-border rounded-lg shadow-xl p-4 text-foreground">
              <h3 className="font-display text-base font-normal mb-2">Notities App</h3>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p><span className="font-medium text-foreground">Versie:</span> 1.0.1</p>
                <p><span className="font-medium text-foreground">Datum:</span> 14 april 2026</p>
                <p><span className="font-medium text-foreground">Auteur:</span> Lovable</p>
              </div>
              <div className="mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground leading-relaxed">
                Notities beheren met notebooks, labels en zoekfunctie.
              </div>
            </div>
          </>
        )}
      </div>
      <div className="px-3 pb-3 pt-1 flex justify-end">
        <button
          onClick={onCollapse}
          className="p-1.5 rounded-md hover:bg-sidebar-custom-bg-hover text-sidebar-custom-fg hover:text-sidebar-custom-fg-active transition-colors"
          title="Zijbalk verbergen"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
