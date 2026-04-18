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

  // Load existing shares when dialog opens
  useEffect(() => {
    if (!open) return;
    setError(''); setQuery(''); setResults([]);
    listShares(noteId).then(setShares).catch(() => setShares([]));
  }, [open, noteId, listShares]);

  // Debounced user search
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    const t = window.setTimeout(async () => {
      const res = await searchUsers(q);
      // Filter out users that are already shared with
      const existing = new Set(shares.map((s) => s.email.toLowerCase()));
      setResults(res.filter((u) => !existing.has(u.email.toLowerCase())));
    }, 250);
    return () => window.clearTimeout(t);
  }, [query, open, searchUsers, shares]);

  const handleAdd = async (email: string) => {
    setLoading(true); setError('');
    const r = await shareNote(noteId, email, permission);
    setLoading(false);
    if (r.error) { setError(r.error); return; }
    setQuery(''); setResults([]);
    const fresh = await listShares(noteId);
    setShares(fresh);
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
          <label className="text-xs text-muted-foreground">Voeg iemand toe op e-mail</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="naam@voorbeeld.nl"
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

          {results.length > 0 && (
            <div className="border border-border rounded-md max-h-40 overflow-y-auto">
              {results.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleAdd(u.email)}
                  disabled={loading}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left transition-colors"
                >
                  <UserPlus size={14} className="text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{u.displayName}</div>
                    <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          {query.trim().length >= 2 && results.length === 0 && (
            <p className="text-xs text-muted-foreground">Geen gebruikers gevonden.</p>
          )}
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
