import { useCallback, useEffect, useRef, useState } from 'react';
import { Pin, PinOff, Trash2, FileText, Tag, Plus, X, Lock, LockOpen, ShieldCheck, Archive, ArchiveRestore, ArrowLeft, RotateCcw, Pencil, Eye, Share2, RefreshCw, LogOut, FolderInput } from 'lucide-react';
import { Note, Notebook, Label, NoteShare, UserSearchResult, PresenceViewer } from '@/types/notes';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { QuillEditor } from '@/components/QuillEditor';
import { ShareDialog } from '@/components/ShareDialog';
import { PresenceAvatars } from '@/components/PresenceAvatars';
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
  trashMode?: boolean;
  onRestore?: (id: string) => void;
  onPurge?: (id: string) => void;
  isNewNote?: boolean;
  // Sharing & realtime
  currentUserId?: string;
  viewers?: PresenceViewer[];
  remoteUpdate?: { noteId: string; by: string | null } | null;
  onDismissRemoteUpdate?: (refresh: boolean) => void;
  searchUsers?: (q: string) => Promise<UserSearchResult[]>;
  listShares?: (noteId: string) => Promise<NoteShare[]>;
  shareNote?: (noteId: string, email: string, perm: 'read' | 'write') => Promise<{ error?: string }>;
  updateShare?: (noteId: string, recipientId: string, perm: 'read' | 'write') => Promise<void>;
  removeShare?: (noteId: string, recipientId: string) => Promise<void>;
  onPickSharedNotebook?: (noteId: string) => void;
}

export function NoteEditor({
  note, notebooks, labels, onUpdate, onDelete, onArchive, onToggleLabel, onCreateLabel,
  onBack, trashMode = false, onRestore, onPurge, isNewNote = false,
  currentUserId, viewers = [], remoteUpdate, onDismissRemoteUpdate,
  searchUsers, listShares, shareNote, updateShare, removeShare, onPickSharedNotebook,
}: NoteEditorProps) {
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [lockPassword, setLockPassword] = useState('');
  const [lockConfirm, setLockConfirm] = useState('');
  const [lockError, setLockError] = useState('');
  const [unlockInput, setUnlockInput] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [mode, setMode] = useState<'edit' | 'view'>(isNewNote ? 'edit' : 'view');
  const [unlocked, setUnlocked] = useState<Map<string, { password: string; content: string }>>(new Map());

  // Permissions derived from the note
  const isShared = !!note?.sharedBy;
  const isReadOnly = trashMode || (isShared && note?.permission === 'read');
  const isOwner = !isShared;

  useEffect(() => {
    setShowLabelPicker(false);
    setShowLockDialog(false);
    setShowShareDialog(false);
    setLockPassword('');
    setLockConfirm('');
    setLockError('');
    setUnlockInput('');
    setUnlockError('');
    // New note → edit mode; existing note → view mode (no toolbar).
    setMode(isNewNote ? 'edit' : 'view');
    // Re-lock any previously unlocked notes when switching notes:
    // leaving a note must require the password again on return.
    setUnlocked((prev) => (prev.size === 0 ? prev : new Map()));
  }, [note?.id, isNewNote]);

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
    (html: string) => {
      if (!note) return;
      // Quill emits "<p><br></p>" for empty content — normalise to empty string.
      const value = html === '<p><br></p>' ? '' : html;
      if (isLocked && unlockedEntry) {
        void updateEncryptedContent(value);
      } else {
        onUpdate(note.id, { content: value });
      }
    },
    [note, onUpdate, isLocked, unlockedEntry, updateEncryptedContent],
  );

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
      const needsHashUpgrade = !isHashedPassword(note.password);
      const needsEncryptUpgrade = !isEncrypted(note.content);
      const titleWasEncrypted = isEncrypted(note.title);
      if (needsHashUpgrade || needsEncryptUpgrade || titleWasEncrypted) {
        const blob = await encryptPayload({ content: plainContent }, unlockInput);
        const verifier = needsHashUpgrade ? await hashPassword(unlockInput) : (note.password as string);
        const updates: Parameters<typeof onUpdate>[1] = { content: blob, password: verifier };
        if (titleWasEncrypted) updates.title = 'Beveiligde notitie';
        onUpdate(note.id, updates);
      }

      setUnlockInput('');
      setUnlockError('');
      // Blur the input and reset any iOS Safari scroll/zoom that may have
      // occurred while focusing the password field.
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      const resetScroll = () => {
        window.scrollTo(0, 0);
        if (document.body.scrollTop !== 0) document.body.scrollTop = 0;
      };
      requestAnimationFrame(resetScroll);
      setTimeout(resetScroll, 100);
      setTimeout(resetScroll, 300);
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

  const daysInTrash = note.deletedAt
    ? Math.max(0, Math.floor((Date.now() - note.deletedAt.getTime()) / (24 * 60 * 60 * 1000)))
    : 0;
  const daysLeft = Math.max(0, 30 - daysInTrash);

  return (
    <motion.div key={note.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}
      className="flex-1 flex flex-col bg-background h-full overflow-hidden min-w-0">
      {trashMode && (
        <div className="px-3 sm:px-6 py-2 bg-destructive/10 border-b border-destructive/30 text-xs text-destructive flex items-center justify-between gap-3 flex-wrap">
          <span className="flex items-center gap-1.5">
            <Trash2 size={13} />
            In de prullenbak — wordt over {daysLeft} {daysLeft === 1 ? 'dag' : 'dagen'} definitief verwijderd
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onRestore?.(note.id)}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-background hover:bg-accent text-foreground transition-colors"
              title="Terugzetten"
            >
              <RotateCcw size={12} /> Terugzetten
            </button>
            <button
              onClick={() => {
                if (confirm('Weet je zeker dat je deze notitie definitief wilt verwijderen? Deze actie kan niet ongedaan gemaakt worden.')) {
                  onPurge?.(note.id);
                }
              }}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity"
              title="Definitief verwijderen"
            >
              <Trash2 size={12} /> Definitief verwijderen
            </button>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-start lg:items-center justify-between gap-2 px-3 sm:px-6 py-3 border-b border-border">
        <div className="flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-3 text-xs text-muted-foreground min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            {onBack && (
              <button onClick={onBack} className="shrink-0 p-1 -ml-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Terug naar lijst" aria-label="Terug naar lijst">
                <ArrowLeft size={18} />
              </button>
            )}
            {notebook && <span className="flex items-center gap-1 truncate text-foreground/80 font-medium">{notebook.icon} {notebook.name}</span>}
            {isShared && note.sharedBy && (
              <span className="flex items-center gap-1 truncate text-primary font-medium" title={`Gedeeld door ${note.sharedBy.displayName}`}>
                <Share2 size={11} /> {note.sharedBy.displayName}
                <span className="text-muted-foreground font-normal">· {note.permission === 'write' ? 'kan bewerken' : 'alleen lezen'}</span>
              </span>
            )}
            <span className="hidden lg:inline">·</span>
          </div>
          <span className="pl-7 lg:pl-0 whitespace-nowrap">
            <span className="lg:hidden">Bewerkt {format(note.updatedAt, "d MMM yyyy, HH:mm", { locale: nl })}</span>
            <span className="hidden lg:inline">Bewerkt {format(note.updatedAt, "d MMM yyyy 'om' HH:mm", { locale: nl })}</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Presence avatars */}
          <PresenceAvatars viewers={viewers} currentUserId={currentUserId} />
          {!trashMode && !showLockedView && (
            <button
              onClick={() => setMode((m) => (m === 'edit' ? 'view' : 'edit'))}
              className={`p-1.5 rounded-md transition-colors ${mode === 'edit' ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              title={mode === 'edit' ? 'Naar weergavemodus' : 'Naar bewerkmodus'}
              aria-label={mode === 'edit' ? 'Naar weergavemodus' : 'Naar bewerkmodus'}
            >
              {mode === 'edit' ? <Eye size={16} /> : <Pencil size={16} />}
            </button>
          )}
          {/* Share — owner only, hidden when locked (per requirements) */}
          {isOwner && !trashMode && !isLocked && shareNote && (
            <button
              onClick={() => setShowShareDialog(true)}
              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Delen"
            >
              <Share2 size={16} />
            </button>
          )}
          {/* Pick recipient notebook — only for shared notes that are still in the inbox */}
          {isShared && note.notebookId === '__shared__' && onPickSharedNotebook && (
            <button
              onClick={() => onPickSharedNotebook(note.id)}
              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="In een notebook plaatsen"
            >
              <FolderInput size={16} />
            </button>
          )}
          {/* Labels — owner only */}
          {isOwner && (
          <LabelPicker
            open={showLabelPicker}
            onOpenChange={setShowLabelPicker}
            labels={labels}
            activeLabelIds={note.labelIds}
            onToggleLabel={(lid) => onToggleLabel(note.id, lid)}
            newLabelName={newLabelName}
            setNewLabelName={setNewLabelName}
            onAddNewLabel={handleAddNewLabel}
          />
          )}
          {/* Lock button — owner only */}
          {isOwner && (
          <div className="relative">
            <button onClick={() => {
              if (isLocked && isUnlocked && note) {
                setUnlocked((prev) => {
                  const next = new Map(prev);
                  next.delete(note.id);
                  return next;
                });
              } else if (!isLocked) {
                setShowLockDialog(true);
              }
            }}
              className={`p-1.5 rounded-md transition-colors ${isLocked ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              title={isLocked ? (isUnlocked ? 'Vergrendelen' : 'Beveiligd') : 'Beveiligen met wachtwoord'}>
              {isLocked ? <Lock size={16} /> : <LockOpen size={16} />}
            </button>
            {showLockDialog && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowLockDialog(false)} />
                <div
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="absolute right-0 top-full mt-1 w-64 bg-card border border-border rounded-lg shadow-lg z-50 p-4">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5"><Lock size={14} /> Notitie beveiligen</h4>
                  <div className="space-y-2">
                    <input type="password" value={lockPassword} onChange={(e) => { setLockPassword(e.target.value); setLockError(''); }}
                      placeholder="Wachtwoord"
                      style={{ fontSize: '16px' }}
                      className="w-full px-3 py-1.5 border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-ring" />
                    <input type="password" value={lockConfirm} onChange={(e) => { setLockConfirm(e.target.value); setLockError(''); }}
                      placeholder="Bevestig wachtwoord"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSetPassword(); }}
                      style={{ fontSize: '16px' }}
                      className="w-full px-3 py-1.5 border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-ring" />
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
          )}
          {isOwner && isLocked && isUnlocked && (
            <button onClick={handleRemovePassword}
              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Wachtwoord verwijderen">
              <LockOpen size={16} />
            </button>
          )}
          {/* Pin — owner only */}
          {isOwner && (
          <button onClick={() => onUpdate(note.id, { pinned: !note.pinned })}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title={note.pinned ? 'Losmaken' : 'Vastpinnen'}>
            {note.pinned ? <PinOff size={16} /> : <Pin size={16} />}
          </button>
          )}
          {/* Archive — owner only */}
          {isOwner && !trashMode && (
            <button onClick={() => onArchive(note.id)}
              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title={note.archived ? 'Dearchiveren' : 'Archiveren'}>
              {note.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
            </button>
          )}
          {/* Trash (owner) / Leave (recipient) */}
          {!trashMode && isOwner && (
            <button onClick={() => onDelete(note.id)}
              className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive" title="Naar prullenbak">
              <Trash2 size={16} />
            </button>
          )}
          {!trashMode && !isOwner && (
            <button
              onClick={() => { if (confirm('Wil je deze gedeelde notitie verlaten? Hij verdwijnt uit jouw lijst maar blijft bestaan voor de eigenaar.')) onDelete(note.id); }}
              className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive" title="Gedeelde notitie verlaten">
              <LogOut size={16} />
            </button>
          )}
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
                style={{ fontSize: '16px' }}
                className="w-full px-3 py-2 border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-ring text-center" />
              {unlockError && <p className="text-xs text-destructive">Onjuist wachtwoord</p>}
              <button onClick={handleUnlock}
                className="w-full text-sm font-medium bg-primary text-primary-foreground rounded-md py-2 hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
                <ShieldCheck size={14} /> Ontgrendelen
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Title */}
          <div className="pt-6 pb-2 w-full" style={{ paddingLeft: 'max(24px, 4vw)', paddingRight: 'max(24px, 4vw)' }}>
            <textarea
              value={note.title}
              onChange={(e) => onUpdate(note.id, { title: e.target.value })}
              onFocus={(e) => { if (e.target.value === 'Nieuwe notitie') { onUpdate(note.id, { title: '' }); } }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); } }}
              ref={(el) => {
                if (!el) return;
                el.style.height = 'auto';
                el.style.height = `${el.scrollHeight}px`;
              }}
              rows={1}
              className="w-full font-display text-3xl font-normal bg-transparent outline-none placeholder:text-muted-foreground/40 resize-none overflow-hidden break-words leading-tight"
              placeholder="Titel..."
              readOnly={isReadOnly || mode === 'view'}
            />
          </div>
          {/* Remote-update banner (active note edited elsewhere) */}
          {remoteUpdate && remoteUpdate.noteId === note.id && (
            <div className="mx-3 sm:mx-6 mb-2 p-2 rounded-md bg-primary/10 border border-primary/30 text-xs flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-1.5"><RefreshCw size={12} /> Deze notitie is elders bijgewerkt{remoteUpdate.by ? ` door ${remoteUpdate.by}` : ''}.</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => onDismissRemoteUpdate?.(false)} className="text-xs px-2 py-0.5 rounded hover:bg-background">Negeren</button>
                <button onClick={() => onDismissRemoteUpdate?.(true)} className="text-xs px-2 py-0.5 rounded bg-primary text-primary-foreground hover:opacity-90">Vernieuwen</button>
              </div>
            </div>
          )}
          {/* Quill editor */}
          <QuillEditor
            value={displayContent}
            onChange={handleContentChange}
            readOnly={isReadOnly || mode === 'view'}
            hideToolbar={mode === 'view' || isReadOnly}
            placeholder="Begin met schrijven..."
          />
        </>
      )}
      {/* Share dialog */}
      {note && shareNote && listShares && updateShare && removeShare && searchUsers && (
        <ShareDialog
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
          noteId={note.id}
          noteTitle={note.title}
          searchUsers={searchUsers}
          listShares={listShares}
          shareNote={shareNote}
          updateShare={updateShare}
          removeShare={removeShare}
        />
      )}
    </motion.div>
  );
}
