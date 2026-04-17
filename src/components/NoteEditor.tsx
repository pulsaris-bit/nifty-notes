import { useCallback, useEffect, useRef, useState } from 'react';
import { Pin, PinOff, Trash2, FileText, Tag, Plus, X, Eye, Pencil, Minus, ChevronDown, Lock, LockOpen, ShieldCheck, Archive, ArchiveRestore, Bold, Italic, Strikethrough, Code, Link, Image, Quote, List, ListOrdered, ListChecks, Table, CodeSquare, ArrowLeft } from 'lucide-react';
import { Note, Notebook, Label } from '@/types/notes';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  isEncrypted, isHashedPassword,
  encryptPayload, decryptPayload,
  hashPassword, verifyPassword,
} from '@/lib/noteCrypto';

interface NoteEditorProps {
  note: Note | null;
  notebooks: Notebook[];
  labels: Label[];
  onUpdate: (id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'pinned' | 'labelIds' | 'password'>>) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onToggleLabel: (noteId: string, labelId: string) => void;
  onCreateLabel: (name: string) => Label;
  onBack?: () => void;
}

const headingOptions = [
  { label: 'Hoofdtekst', prefix: '', replace: true },
  { label: 'H1', prefix: '# ', replace: true },
  { label: 'H2', prefix: '## ', replace: true },
  { label: 'H3', prefix: '### ', replace: true },
  { label: 'H4', prefix: '#### ', replace: true },
  { label: 'H5', prefix: '##### ', replace: true },
];

export function NoteEditor({ note, notebooks, labels, onUpdate, onDelete, onArchive, onToggleLabel, onCreateLabel, onBack }: NoteEditorProps) {
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [lockPassword, setLockPassword] = useState('');
  const [lockConfirm, setLockConfirm] = useState('');
  const [lockError, setLockError] = useState('');
  const [unlockInput, setUnlockInput] = useState('');
  const [unlockError, setUnlockError] = useState('');
  // noteId -> derived plain content (only kept in memory for this session)
  const [unlocked, setUnlocked] = useState<Map<string, { password: string; content: string }>>(new Map());

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.style.height = 'auto';
      contentRef.current.style.height = contentRef.current.scrollHeight + 'px';
    }
  }, [note?.content]);

  useEffect(() => {
    setShowLabelPicker(false);
    setShowLockDialog(false);
    setLockPassword('');
    setLockConfirm('');
    setLockError('');
    setUnlockInput('');
    setUnlockError('');
    // Open new (empty) notes in edit mode, existing notes in preview
    setMode(note && note.content === '' ? 'edit' : 'preview');
  }, [note?.id]);

  const isLocked = !!note?.password;
  const unlockedEntry = note ? unlocked.get(note.id) : undefined;
  const isUnlocked = !!unlockedEntry;
  // Locked view appears whenever the content is encrypted and not yet unlocked this session.
  const showLockedView = !!note && isLocked && !isUnlocked && isEncrypted(note.content);

  // Display value: when content is encrypted+unlocked, show plaintext from session map.
  const displayContent = unlockedEntry ? unlockedEntry.content : note?.content ?? '';

  const updateEncryptedContent = useCallback(
    async (value: string) => {
      if (!note || !unlockedEntry) return;
      const next = { ...unlockedEntry, content: value };
      setUnlocked((prev) => new Map(prev).set(note.id, next));
      const blob = await encryptPayload({ content: next.content }, next.password);
      onUpdate(note.id, { content: blob });
    },
    [note, unlockedEntry, onUpdate],
  );

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!note) return;
      const value = e.target.value;
      e.target.style.height = 'auto';
      e.target.style.height = e.target.scrollHeight + 'px';
      if (isLocked && unlockedEntry) {
        void updateEncryptedContent(value);
      } else {
        onUpdate(note.id, { content: value });
      }
    },
    [note, onUpdate, isLocked, unlockedEntry, updateEncryptedContent],
  );

  const insertAtCursor = useCallback((insertion: string) => {
    const ta = contentRef.current;
    if (!ta || !note) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = note.content;
    const newText = text.substring(0, start) + insertion + text.substring(end);
    onUpdate(note.id, { content: newText });
    setTimeout(() => {
      ta.focus();
      const pos = start + insertion.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  }, [note, onUpdate]);

  const wrapSelection = useCallback((before: string, after: string, placeholder = '') => {
    const ta = contentRef.current;
    if (!ta || !note) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = note.content;
    const selected = text.substring(start, end) || placeholder;
    const newText = text.substring(0, start) + before + selected + after + text.substring(end);
    onUpdate(note.id, { content: newText });
    setTimeout(() => {
      ta.focus();
      const selStart = start + before.length;
      const selEnd = selStart + selected.length;
      ta.setSelectionRange(selStart, selEnd);
    }, 0);
  }, [note, onUpdate]);

  const insertAtLineStart = useCallback((prefix: string) => {
    const ta = contentRef.current;
    if (!ta || !note) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = note.content;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lastLineStart = text.lastIndexOf('\n', end - 1) + 1;
    // Get all lines in selection
    const beforeLines = text.substring(0, lineStart);
    const lineEnd = text.indexOf('\n', end);
    const actualEnd = lineEnd === -1 ? text.length : lineEnd;
    const selectedLines = text.substring(lineStart, actualEnd);
    const newLines = selectedLines.split('\n').map((line) => prefix + line).join('\n');
    const newText = beforeLines + newLines + text.substring(actualEnd);
    onUpdate(note.id, { content: newText });
    setTimeout(() => { ta.focus(); }, 0);
  }, [note, onUpdate]);

  const applyHeading = useCallback((prefix: string) => {
    const ta = contentRef.current;
    if (!ta || !note) return;
    const start = ta.selectionStart;
    const text = note.content;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = text.indexOf('\n', start);
    const actualEnd = lineEnd === -1 ? text.length : lineEnd;
    let line = text.substring(lineStart, actualEnd);
    line = line.replace(/^#{1,6}\s*/, '');
    const newLine = prefix + line;
    const newText = text.substring(0, lineStart) + newLine + text.substring(actualEnd);
    onUpdate(note.id, { content: newText });
    setShowHeadingMenu(false);
    setTimeout(() => { ta.focus(); }, 0);
  }, [note, onUpdate]);

  const insertHorizontalRule = useCallback(() => {
    const ta = contentRef.current;
    if (!ta || !note) return;
    const start = ta.selectionStart;
    const text = note.content;
    const before = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
    const after = start < text.length && text[start] !== '\n' ? '\n' : '';
    insertAtCursor(before + '\n---\n' + after);
  }, [note, insertAtCursor]);

  const insertTable = useCallback(() => {
    const table = '\n| Kolom 1 | Kolom 2 | Kolom 3 |\n| --- | --- | --- |\n| cel | cel | cel |\n';
    insertAtCursor(table);
  }, [insertAtCursor]);

  const insertCodeBlock = useCallback(() => {
    wrapSelection('\n```\n', '\n```\n', 'code');
  }, [wrapSelection]);

  const handleAddNewLabel = () => {
    if (!note || !newLabelName.trim()) return;
    const label = onCreateLabel(newLabelName.trim());
    onToggleLabel(note.id, label.id);
    setNewLabelName('');
  };

  const handleSetPassword = async () => {
    if (!note) return;
    if (lockPassword.length < 4) { setLockError('Minimaal 4 tekens'); return; }
    if (lockPassword !== lockConfirm) { setLockError('Wachtwoorden komen niet overeen'); return; }
    try {
      // Encrypt only the content under the new password; title stays plaintext.
      const blob = await encryptPayload({ content: note.content }, lockPassword);
      const verifier = await hashPassword(lockPassword);
      // Remember plaintext content in session so the user can keep editing immediately
      setUnlocked((prev) => new Map(prev).set(note.id, {
        password: lockPassword,
        content: note.content,
      }));
      onUpdate(note.id, { content: blob, password: verifier });
      setShowLockDialog(false);
      setLockPassword('');
      setLockConfirm('');
      setLockError('');
    } catch (e) {
      console.error('Encryption failed', e);
      setLockError('Versleutelen mislukt');
    }
  };

  const handleRemovePassword = () => {
    if (!note) return;
    const entry = unlocked.get(note.id);
    // Restore plaintext content (we have it in the session map)
    if (entry) {
      onUpdate(note.id, { content: entry.content, password: null });
    } else {
      onUpdate(note.id, { password: null });
    }
    setUnlocked((prev) => { const next = new Map(prev); next.delete(note.id); return next; });
  };

  const handleUnlock = async () => {
    if (!note) return;
    const ok = await verifyPassword(unlockInput, note.password);
    if (!ok) { setUnlockError('Onjuist wachtwoord'); return; }
    try {
      let plainContent = note.content;
      if (isEncrypted(note.content)) {
        const payload = await decryptPayload(note.content, unlockInput);
        plainContent = payload.content;
      }
      setUnlocked((prev) => new Map(prev).set(note.id, {
        password: unlockInput, content: plainContent,
      }));

      // --- Lazy migration ---
      // Legacy notes had plaintext password + plaintext content (and possibly an encrypted
      // title-blob from a previous version). Upgrade to hashed password + encrypted content.
      const needsHashUpgrade = !isHashedPassword(note.password);
      const needsEncryptUpgrade = !isEncrypted(note.content);
      const titleWasEncrypted = isEncrypted(note.title);
      if (needsHashUpgrade || needsEncryptUpgrade || titleWasEncrypted) {
        const blob = await encryptPayload({ content: plainContent }, unlockInput);
        const verifier = needsHashUpgrade ? await hashPassword(unlockInput) : (note.password as string);
        const updates: Parameters<typeof onUpdate>[1] = { content: blob, password: verifier };
        // If a previous version had encrypted the title, restore a placeholder title.
        if (titleWasEncrypted) updates.title = 'Beveiligde notitie';
        onUpdate(note.id, updates);
      }

      setUnlockInput('');
      setUnlockError('');
    } catch (e) {
      console.error('Decrypt failed', e);
      setUnlockError('Ontsleutelen mislukt');
    }
  };

  if (!note) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background h-full">
        {onBack && (
          <button onClick={onBack} className="absolute top-3 left-3 p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Terug">
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="text-center text-muted-foreground">
          <FileText size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Selecteer een notitie om te bewerken</p>
        </div>
      </div>
    );
  }

  const notebook = notebooks.find((nb) => nb.id === note.notebookId);
  const noteLabels = labels.filter((l) => note.labelIds.includes(l.id));

  return (
    <motion.div key={note.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}
      className="flex-1 flex flex-col bg-background h-full overflow-hidden min-w-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-6 py-3 border-b border-border">
        <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground min-w-0">
          {onBack && (
            <button onClick={onBack} className="shrink-0 p-1 -ml-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Terug naar lijst" aria-label="Terug naar lijst">
              <ArrowLeft size={18} />
            </button>
          )}
          {notebook && <span className="flex items-center gap-1 truncate">{notebook.icon} {notebook.name}</span>}
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline truncate">Bewerkt {format(note.updatedAt, "d MMM yyyy 'om' HH:mm", { locale: nl })}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Mode toggle */}
          <div className="flex items-center border border-border rounded-md mr-1">
            <button onClick={() => setMode('edit')}
              className={`p-1.5 rounded-l-md transition-colors ${mode === 'edit' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Bewerken">
              <Pencil size={14} />
            </button>
            <button onClick={() => setMode('preview')}
              className={`p-1.5 rounded-r-md transition-colors ${mode === 'preview' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Voorbeeld">
              <Eye size={14} />
            </button>
          </div>

          <div className="relative">
            <button onClick={() => setShowLabelPicker(!showLabelPicker)}
              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Labels">
              <Tag size={16} />
            </button>
            {showLabelPicker && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-lg shadow-lg z-50 py-2">
                <div className="px-3 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Labels</div>
                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                  {labels.map((label) => {
                    const isActive = note.labelIds.includes(label.id);
                    return (
                      <button key={label.id} onClick={() => onToggleLabel(note.id, label.id)}
                        className={`w-full px-3 py-1.5 flex items-center gap-2.5 text-sm hover:bg-muted/50 transition-colors ${isActive ? 'bg-muted/30' : ''}`}>
                        <span className="w-3 h-3 rounded-full shrink-0 border-2" style={{
                          backgroundColor: isActive ? label.color : 'transparent',
                          borderColor: label.color,
                        }} />
                        <span className="flex-1 text-left truncate">{label.name}</span>
                        {isActive && <span className="text-xs text-muted-foreground">✓</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-border mt-1 pt-1 px-2">
                  <div className="flex items-center gap-1">
                    <input value={newLabelName} onChange={(e) => setNewLabelName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddNewLabel(); }}
                      placeholder="Nieuw label..."
                      className="flex-1 text-sm px-2 py-1 bg-transparent outline-none placeholder:text-muted-foreground/50" />
                    <button onClick={handleAddNewLabel} className="p-1 text-muted-foreground hover:text-foreground"><Plus size={14} /></button>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Lock button */}
          <div className="relative">
            <button onClick={() => {
              if (isLocked && isUnlocked) {
                handleRemovePassword();
              } else if (!isLocked) {
                setShowLockDialog(true);
              }
            }}
              className={`p-1.5 rounded-md transition-colors ${isLocked ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              title={isLocked ? 'Beveiliging verwijderen' : 'Beveiligen met wachtwoord'}>
              {isLocked ? <Lock size={16} /> : <LockOpen size={16} />}
            </button>
            {showLockDialog && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowLockDialog(false)} />
                <div className="absolute right-0 top-full mt-1 w-64 bg-card border border-border rounded-lg shadow-lg z-50 p-4">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5"><Lock size={14} /> Notitie beveiligen</h4>
                  <div className="space-y-2">
                    <input type="password" value={lockPassword} onChange={(e) => { setLockPassword(e.target.value); setLockError(''); }}
                      placeholder="Wachtwoord" className="w-full text-sm px-3 py-1.5 border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-ring" />
                    <input type="password" value={lockConfirm} onChange={(e) => { setLockConfirm(e.target.value); setLockError(''); }}
                      placeholder="Bevestig wachtwoord"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSetPassword(); }}
                      className="w-full text-sm px-3 py-1.5 border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-ring" />
                    {lockError && <p className="text-xs text-destructive">{lockError}</p>}
                    <button onClick={handleSetPassword}
                      className="w-full text-sm font-medium bg-primary text-primary-foreground rounded-md py-1.5 hover:opacity-90 transition-opacity">
                      Beveiligen
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          <button onClick={() => onUpdate(note.id, { pinned: !note.pinned })}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title={note.pinned ? 'Losmaken' : 'Vastpinnen'}>
            {note.pinned ? <PinOff size={16} /> : <Pin size={16} />}
          </button>
          <button onClick={() => onArchive(note.id)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title={note.archived ? 'Dearchiveren' : 'Archiveren'}>
            {note.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
          </button>
          <button onClick={() => onDelete(note.id)}
            className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive" title="Verwijderen">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Labels bar */}
      {noteLabels.length > 0 && (
        <div className="flex items-center gap-1.5 px-6 py-2 border-b border-border/50 flex-wrap">
          {noteLabels.map((label) => (
            <span key={label.id} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold text-white"
              style={{ backgroundColor: label.color }}>
              {label.name}
              <button onClick={() => onToggleLabel(note.id, label.id)} className="hover:opacity-70 text-white/80"><X size={12} /></button>
            </span>
          ))}
        </div>
      )}

      {showLockedView ? (
        /* Locked view */
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-xs">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Lock size={28} className="text-muted-foreground" />
            </div>
            <h3 className="font-display text-xl mb-1">{note.title}</h3>
            <p className="text-sm text-muted-foreground mb-4">Deze notitie is beveiligd met een wachtwoord</p>
            <div className="space-y-2">
              <input type="password" value={unlockInput} onChange={(e) => { setUnlockInput(e.target.value); setUnlockError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleUnlock(); }}
                placeholder="Voer wachtwoord in..."
                className="w-full text-sm px-3 py-2 border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-ring text-center" />
              {unlockError && <p className="text-xs text-destructive">{unlockError}</p>}
              <button onClick={handleUnlock}
                className="w-full text-sm font-medium bg-primary text-primary-foreground rounded-md py-2 hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
                <ShieldCheck size={14} /> Ontgrendelen
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Formatting toolbar (edit mode only) */}
          {mode === 'edit' && (
            <div className="flex items-center gap-0.5 px-6 py-1.5 border-b border-border/50 flex-wrap">
              {/* Heading dropdown */}
              <div className="relative">
                <button onClick={() => setShowHeadingMenu(!showHeadingMenu)}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  title="Koppen">
                  <span className="font-medium">Heading</span>
                  <ChevronDown size={12} />
                </button>
                {showHeadingMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowHeadingMenu(false)} />
                    <div className="absolute left-0 top-full mt-1 w-44 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
                      {headingOptions.map((opt) => (
                        <button key={opt.label} onClick={() => applyHeading(opt.prefix)}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2">
                          <span className="font-medium"
                            style={{ fontSize: opt.label === 'H1' ? '16px' : opt.label === 'H2' ? '14px' : opt.label === 'H3' ? '13px' : opt.label === 'H4' ? '12px' : opt.label === 'H5' ? '11px' : '13px' }}>
                            {opt.label === 'Hoofdtekst' ? 'Hoofdtekst' : opt.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="w-px h-4 bg-border mx-1" />

              {/* Inline formatting */}
              <button onClick={() => wrapSelection('**', '**', 'vetgedrukt')}
                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Vetgedrukt (Ctrl+B)">
                <Bold size={14} />
              </button>
              <button onClick={() => wrapSelection('*', '*', 'cursief')}
                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Cursief (Ctrl+I)">
                <Italic size={14} />
              </button>
              <button onClick={() => wrapSelection('~~', '~~', 'doorgestreept')}
                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Doorhalen">
                <Strikethrough size={14} />
              </button>
              <button onClick={() => wrapSelection('`', '`', 'code')}
                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Inline code">
                <Code size={14} />
              </button>

              <div className="w-px h-4 bg-border mx-1" />

              {/* Block formatting */}
              <button onClick={() => insertAtLineStart('> ')}
                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Citaat">
                <Quote size={14} />
              </button>
              <button onClick={() => insertAtLineStart('- ')}
                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Ongenummerde lijst">
                <List size={14} />
              </button>
              <button onClick={() => insertAtLineStart('1. ')}
                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Genummerde lijst">
                <ListOrdered size={14} />
              </button>
              <button onClick={() => insertAtLineStart('- [ ] ')}
                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Takenlijst">
                <ListChecks size={14} />
              </button>

              <div className="w-px h-4 bg-border mx-1" />

              {/* Insert elements */}
              <button onClick={() => wrapSelection('[', '](url)', 'linktekst')}
                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Link invoegen">
                <Link size={14} />
              </button>
              <button onClick={() => insertAtCursor('![alt tekst](afbeelding-url)')}
                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Afbeelding invoegen">
                <Image size={14} />
              </button>
              <button onClick={insertCodeBlock}
                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Codeblok">
                <CodeSquare size={14} />
              </button>
              <button onClick={insertTable}
                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Tabel invoegen">
                <Table size={14} />
              </button>
              <button onClick={insertHorizontalRule}
                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Horizontale lijn">
                <Minus size={14} />
              </button>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6 max-w-3xl mx-auto w-full">
            <input
              value={note.title}
              onChange={(e) => onUpdate(note.id, { title: e.target.value })}
              onFocus={(e) => { if (e.target.value === 'Nieuwe notitie') { onUpdate(note.id, { title: '' }); } }}
              className="w-full font-display text-3xl font-normal bg-transparent outline-none placeholder:text-muted-foreground/40 mb-4"
              placeholder="Titel..."
              readOnly={mode === 'preview'}
            />
            {mode === 'edit' ? (
              <textarea ref={contentRef} value={displayContent} onChange={handleContentChange}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); wrapSelection('**', '**', 'vetgedrukt'); return; }
                  if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); wrapSelection('*', '*', 'cursief'); return; }
                  if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); wrapSelection('[', '](url)', 'linktekst'); return; }
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const ta = e.currentTarget;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const text = displayContent;
                    const newText = text.substring(0, start) + '\n\n' + text.substring(end);
                    if (isLocked && unlockedEntry) {
                      void updateEncryptedContent(newText);
                    } else {
                      onUpdate(note!.id, { content: newText });
                    }
                    setTimeout(() => {
                      ta.focus();
                      const pos = start + 2;
                      ta.setSelectionRange(pos, pos);
                    }, 0);
                  }
                }}
                className="w-full bg-transparent outline-none resize-none text-[15px] leading-relaxed placeholder:text-muted-foreground/40 min-h-[60vh] font-mono"
                placeholder="Schrijf in markdown..." />
            ) : (
              <div className="prose prose-sm max-w-none text-foreground prose-headings:font-display prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-a:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-blockquote:border-primary/40 prose-blockquote:text-muted-foreground prose-li:text-foreground prose-th:text-foreground prose-td:text-foreground prose-hr:border-foreground/30 prose-hr:border-t-2">
                {displayContent ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
                ) : (
                  <p className="text-muted-foreground/50 italic">Geen inhoud</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}
