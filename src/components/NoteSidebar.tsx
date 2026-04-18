import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { BookOpen, Plus, Trash2, ChevronDown, Tag, Pencil, PanelLeftClose, Archive, LogOut, Shield, User as UserIcon, Share2 } from 'lucide-react';
import { Notebook, Label } from '@/types/notes';
import { motion, AnimatePresence } from 'framer-motion';
import { useMockAuth } from '@/hooks/useMockAuth';
import { getDiceBearAvatar } from '@/lib/avatar';

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
  showArchived: boolean;
  showTrash: boolean;
  trashedCount: number;
  sharedInboxCount?: number;
  onSelectNotebook: (id: string | null) => void;
  onSelectLabel: (id: string | null) => void;
  onToggleArchived: () => void;
  onToggleTrash: () => void;
  onCreateNotebook: (name: string, icon?: string) => void;
  onUpdateNotebook: (id: string, updates: Partial<Pick<Notebook, 'name' | 'icon'>>) => void;
  onDeleteNotebook: (id: string) => void;
  onCreateLabel: (name: string) => void;
  onUpdateLabel: (id: string, updates: Partial<Pick<Label, 'name'>>) => void;
  onDeleteLabel: (id: string) => void;
  noteCountByNotebook: Record<string, number>;
  noteCountByLabel?: Record<string, number>;
  onCollapse: () => void;
}

export function NoteSidebar({
  notebooks, labels, activeNotebookId, activeLabelId, showArchived, showTrash, trashedCount, sharedInboxCount = 0,
  onSelectNotebook, onSelectLabel, onToggleArchived, onToggleTrash,
  onCreateNotebook, onUpdateNotebook, onDeleteNotebook,
  onCreateLabel, onUpdateLabel, onDeleteLabel,
  noteCountByNotebook, noteCountByLabel = {}, onCollapse,
}: NoteSidebarProps) {
  const [isCreatingNb, setIsCreatingNb] = useState(false);
  const [newNbName, setNewNbName] = useState('');
  const [newNbEmoji, setNewNbEmoji] = useState('📓');
  const [showNewEmojiPicker, setShowNewEmojiPicker] = useState(false);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [nbExpanded, setNbExpanded] = useState(true);
  const [labelsExpanded, setLabelsExpanded] = useState(true);
  
  const [editingNbId, setEditingNbId] = useState<string | null>(null);
  const [editNbName, setEditNbName] = useState('');
  const [editNbEmoji, setEditNbEmoji] = useState('');
  const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editLabelName, setEditLabelName] = useState('');

  const newEmojiBtnRef = useRef<HTMLButtonElement>(null);
  const editEmojiBtnRef = useRef<HTMLButtonElement>(null);

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
  const labelCount = (id: string) => noteCountByLabel[id] || 0;
  const handleSelectAll = () => { onSelectNotebook(null); onSelectLabel(null); if (showArchived) onToggleArchived(); };

  // Emoji picker rendered via a portal in fixed positioning so it can break out
  // of the sidebar's `overflow-hidden`/`overflow-y-auto` ancestors and float
  // above other sections (labels, user block, etc.).
  const EmojiPicker = ({
    anchorRef,
    selected,
    onSelect,
    onClose,
  }: {
    anchorRef: React.RefObject<HTMLElement>;
    selected: string;
    onSelect: (e: string) => void;
    onClose: () => void;
  }) => {
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

    useLayoutEffect(() => {
      const update = () => {
        const el = anchorRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const PICKER_W = 192; // w-48
        const PICKER_H = 200; // approx 5 rows
        const margin = 8;
        let left = r.left;
        let top = r.bottom + 4;
        // Flip up if not enough room below
        if (top + PICKER_H > window.innerHeight - margin) {
          top = Math.max(margin, r.top - PICKER_H - 4);
        }
        // Clamp horizontally
        if (left + PICKER_W > window.innerWidth - margin) {
          left = window.innerWidth - PICKER_W - margin;
        }
        if (left < margin) left = margin;
        setPos({ top, left });
      };
      update();
      window.addEventListener('resize', update);
      window.addEventListener('scroll', update, true);
      return () => {
        window.removeEventListener('resize', update);
        window.removeEventListener('scroll', update, true);
      };
    }, [anchorRef]);

    if (!pos) return null;
    return createPortal(
      <>
        <div className="fixed inset-0 z-[60]" onClick={onClose} />
        <div
          className="fixed z-[61] grid grid-cols-6 gap-1 p-2 bg-card border border-border rounded-lg shadow-xl w-48"
          style={{ top: pos.top, left: pos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={(e) => { e.stopPropagation(); onSelect(emoji); }}
              className={`w-7 h-7 flex items-center justify-center rounded text-base hover:bg-accent transition-colors ${selected === emoji ? 'bg-accent ring-1 ring-primary' : ''}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </>,
      document.body,
    );
  };

  return (
    <aside className="w-56 shrink-0 bg-sidebar-custom-bg flex flex-col h-full select-none">
      <div className="px-4 pt-5 pb-3">
        <h1 className="font-display text-xl text-sidebar-custom-fg-active tracking-wide">NiftyNotes</h1>
      </div>

      <button onClick={handleSelectAll}
        className={`mx-2 px-3 py-2 rounded-md text-sm flex items-center gap-2.5 transition-colors ${
          !activeNotebookId && !activeLabelId && !showArchived ? 'bg-sidebar-custom-accent text-sidebar-custom-fg-active' : 'text-sidebar-custom-fg hover:text-sidebar-custom-fg-active hover:bg-sidebar-custom-accent/50'
        }`}>
        <BookOpen size={16} /><span className="flex-1 text-left">Alle notities</span><span className="text-xs opacity-60">{totalNotes}</span>
      </button>

      <button onClick={onToggleArchived}
        className={`mx-2 px-3 py-2 rounded-md text-sm flex items-center gap-2.5 transition-colors ${
          showArchived ? 'bg-sidebar-custom-accent text-sidebar-custom-fg-active' : 'text-sidebar-custom-fg hover:text-sidebar-custom-fg-active hover:bg-sidebar-custom-accent/50'
        }`}>
        <Archive size={16} /><span className="flex-1 text-left">Archief</span>
      </button>

      <button onClick={() => onSelectNotebook('__shared__')}
        className={`mx-2 px-3 py-2 rounded-md text-sm flex items-center gap-2.5 transition-colors ${
          activeNotebookId === '__shared__' ? 'bg-sidebar-custom-accent text-sidebar-custom-fg-active' : 'text-sidebar-custom-fg hover:text-sidebar-custom-fg-active hover:bg-sidebar-custom-accent/50'
        }`}>
        <Share2 size={16} /><span className="flex-1 text-left">Gedeeld met mij</span>
        {sharedInboxCount > 0 && <span className="text-xs opacity-60">{sharedInboxCount}</span>}
      </button>

      <button onClick={onToggleTrash}
        className={`mx-2 px-3 py-2 rounded-md text-sm flex items-center gap-2.5 transition-colors ${
          showTrash ? 'bg-sidebar-custom-accent text-sidebar-custom-fg-active' : 'text-sidebar-custom-fg hover:text-sidebar-custom-fg-active hover:bg-sidebar-custom-accent/50'
        }`}>
        <Trash2 size={16} /><span className="flex-1 text-left">Prullenbak</span>
        {trashedCount > 0 && <span className="text-xs opacity-60">{trashedCount}</span>}
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
                          <button ref={editEmojiBtnRef} onClick={() => setShowEditEmojiPicker(!showEditEmojiPicker)}
                            className="w-8 h-8 flex items-center justify-center rounded bg-sidebar-custom-bg hover:bg-sidebar-custom-accent/80 text-base transition-colors">
                            {editNbEmoji}
                          </button>
                          {showEditEmojiPicker && (
                            <EmojiPicker
                              anchorRef={editEmojiBtnRef}
                              selected={editNbEmoji}
                              onSelect={(e) => { setEditNbEmoji(e); setShowEditEmojiPicker(false); }}
                              onClose={() => setShowEditEmojiPicker(false)}
                            />
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
                        <button ref={newEmojiBtnRef} onClick={() => setShowNewEmojiPicker(!showNewEmojiPicker)}
                          className="w-8 h-8 flex items-center justify-center rounded bg-sidebar-custom-bg hover:bg-sidebar-custom-accent/80 text-base transition-colors">
                          {newNbEmoji}
                        </button>
                        {showNewEmojiPicker && (
                          <EmojiPicker
                            anchorRef={newEmojiBtnRef}
                            selected={newNbEmoji}
                            onSelect={(e) => { setNewNbEmoji(e); setShowNewEmojiPicker(false); }}
                            onClose={() => setShowNewEmojiPicker(false)}
                          />
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
                    <div key={label.id} className={`group mx-2 px-3 py-1.5 rounded-md text-sm flex items-center gap-2.5 cursor-pointer transition-colors ${
                      activeLabelId === label.id ? 'bg-sidebar-custom-accent text-sidebar-custom-fg-active' : 'text-sidebar-custom-fg hover:text-sidebar-custom-fg-active hover:bg-sidebar-custom-accent/50'
                    }`} onClick={() => { onSelectLabel(label.id); onSelectNotebook(null); }}>
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                      <span className="flex-1 truncate">{label.name}</span>
                      <span className="text-xs opacity-60">{labelCount(label.id)}</span>
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

      {/* User block */}
      <UserBlock />

      <div className="px-3 pb-3 pt-2 flex justify-end">
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

function UserBlock() {
  const { user, logout } = useMockAuth();
  if (!user) return null;
  const avatarSrc = user.avatarUrl || getDiceBearAvatar(user.email || user.displayName);

  return (
    <div className="px-2 pt-2 pb-1 border-t border-sidebar-custom-border/40 mt-2">
      <div className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-sidebar-custom-accent/40 transition-colors group">
        <Link to="/profile" className="flex items-center gap-2 flex-1 min-w-0" title="Profiel">
          <div className="w-7 h-7 rounded-full bg-sidebar-custom-accent overflow-hidden shrink-0">
            <img src={avatarSrc} alt={user.displayName} className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-sidebar-custom-fg-active truncate flex items-center gap-1">
              {user.displayName}
              {user.role === 'admin' && (
                <Shield className="w-3 h-3 text-primary shrink-0" aria-label="Admin" />
              )}
            </div>
            <div className="text-[10px] text-sidebar-custom-fg/60 truncate">
              {user.role === 'admin' ? 'Admin' : 'Gebruiker'}
            </div>
          </div>
        </Link>
        <button
          onClick={logout}
          className="p-1.5 rounded-md text-sidebar-custom-fg/70 hover:text-sidebar-custom-fg-active hover:bg-sidebar-custom-bg transition-colors shrink-0"
          title="Uitloggen"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
