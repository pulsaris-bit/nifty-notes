import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { NoteShare, UserSearchResult } from '@/types/notes';
import { Search, X, UserPlus, Share2 } from 'lucide-react';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  noteTitle: string;
  searchUsers: (q: string) => Promise<UserSearchResult[]>;
  listShares: (noteId: string) => Promise<NoteShare[]>;
  shareNote: (noteId: string, email: string, perm: 'read' | 'write') => Promise<{ error?: string }>;
  updateShare: (noteId: string, recipientId: string, perm: 'read' | 'write') => Promise<void>;
  removeShare: (noteId: string, recipientId: string) => Promise<void>;
}

export function ShareDialog({
  open, onOpenChange, noteId, noteTitle,
  searchUsers, listShares, shareNote, updateShare, removeShare,
}: ShareDialogProps) {
  const [shares, setShares] = useState<NoteShare[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [permission, setPermission] = useState<'read' | 'write'>('read');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Load existing shares + initial user list when dialog opens
  useEffect(() => {
    if (!open) return;
    setError(''); setQuery('');
    listShares(noteId).then(setShares).catch(() => setShares([]));
    searchUsers('').then(setResults).catch(() => setResults([]));
  }, [open, noteId, listShares, searchUsers]);

  // Debounced user search (incl. empty query → all users)
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(async () => {
      const res = await searchUsers(query.trim());
      setResults(res);
    }, query.trim() ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [query, open, searchUsers]);

  const sharedIds = new Set(shares.map((s) => s.recipientId));
  const visibleResults = results.filter((u) => !sharedIds.has(u.id));

  const handleAdd = async (email: string) => {
    setLoading(true); setError('');
    const r = await shareNote(noteId, email, permission);
    setLoading(false);
    if (r.error) { setError(r.error); return; }
    setQuery('');
    const fresh = await listShares(noteId);
    setShares(fresh);
    // Refresh user list so the just-shared user disappears
    const users = await searchUsers('');
    setResults(users);
  };

  const handlePermissionChange = async (recipientId: string, perm: 'read' | 'write') => {
    setShares((prev) => prev.map((s) => (s.recipientId === recipientId ? { ...s, permission: perm } : s)));
    try { await updateShare(noteId, recipientId, perm); } catch { /* ignore */ }
  };

  const handleRemove = async (recipientId: string) => {
    setShares((prev) => prev.filter((s) => s.recipientId !== recipientId));
    try { await removeShare(noteId, recipientId); } catch { /* ignore */ }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 size={18} /> Notitie delen
          </DialogTitle>
          <DialogDescription className="truncate">"{noteTitle || 'Naamloos'}"</DialogDescription>
        </DialogHeader>

        {/* Add new share */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Voeg iemand toe</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Zoek op naam of e-mail..."
                style={{ fontSize: '16px' }}
                className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <select
              value={permission}
              onChange={(e) => setPermission(e.target.value as 'read' | 'write')}
              className="bg-background border border-border rounded-md px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="read">Alleen lezen</option>
              <option value="write">Bewerken</option>
            </select>
          </div>

          <div className="border border-border rounded-md max-h-48 overflow-y-auto custom-scrollbar">
            {visibleResults.length > 0 ? (
              visibleResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleAdd(u.email)}
                  disabled={loading}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left transition-colors border-b border-border/60 last:border-b-0"
                >
                  <UserPlus size={14} className="text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{u.displayName}</div>
                    <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                  </div>
                </button>
              ))
            ) : (
              <p className="px-3 py-3 text-xs text-muted-foreground">
                {query.trim()
                  ? 'Geen gebruikers gevonden.'
                  : results.length === 0
                    ? 'Nog geen andere gebruikers.'
                    : 'Alle gebruikers hebben al toegang.'}
              </p>
            )}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        {/* Existing shares */}
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Gedeeld met</div>
          {shares.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nog niemand</p>
          ) : (
            <ul className="space-y-1">
              {shares.map((s) => (
                <li key={s.recipientId} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{s.displayName}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.email}</div>
                  </div>
                  <select
                    value={s.permission}
                    onChange={(e) => handlePermissionChange(s.recipientId, e.target.value as 'read' | 'write')}
                    className="bg-background border border-border rounded-md px-1.5 py-1 text-xs outline-none"
                  >
                    <option value="read">Lezen</option>
                    <option value="write">Bewerken</option>
                  </select>
                  <button
                    onClick={() => handleRemove(s.recipientId)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    title="Intrekken"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
