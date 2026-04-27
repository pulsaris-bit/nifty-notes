import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { History, RotateCcw, Loader2, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { isEncrypted } from '@/lib/noteCrypto';

export interface NoteVersion {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string | null;
  /** Whether the note is currently password-protected (affects content preview). */
  isLocked: boolean;
  listVersions: (noteId: string) => Promise<NoteVersion[]>;
  restoreVersion: (noteId: string, versionId: string) => Promise<void>;
}

/** Strip HTML to a short plaintext excerpt for the preview list. */
function htmlToExcerpt(html: string, max = 160): string {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const text = (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max) + '…' : text;
}

export function VersionHistoryDialog({
  open, onOpenChange, noteId, isLocked, listVersions, restoreVersion,
}: Props) {
  const [versions, setVersions] = useState<NoteVersion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !noteId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setVersions(null);
    listVersions(noteId)
      .then((rows) => { if (!cancelled) setVersions(rows); })
      .catch((e) => { if (!cancelled) setError(e?.message || 'Laden mislukt'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, noteId, listVersions]);

  const handleRestore = async (versionId: string) => {
    if (!noteId) return;
    if (!confirm('Deze versie herstellen? De huidige inhoud wordt als nieuwe versie bewaard.')) return;
    setRestoringId(versionId);
    try {
      await restoreVersion(noteId, versionId);
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || 'Herstellen mislukt');
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History size={18} /> Versiegeschiedenis
          </DialogTitle>
          <DialogDescription>
            De laatste 5 versies worden bewaard. Bij een nieuwe wijziging vervalt de oudste.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="py-8 flex items-center justify-center text-muted-foreground text-sm">
            <Loader2 size={16} className="animate-spin mr-2" /> Versies laden…
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-destructive py-4">{error}</p>
        )}

        {!loading && !error && versions && versions.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">
            Nog geen vorige versies — zodra je deze notitie wijzigt, wordt de huidige versie bewaard.
          </p>
        )}

        {!loading && versions && versions.length > 0 && (
          <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
            {versions.map((v, idx) => {
              const encrypted = isLocked || isEncrypted(v.content);
              const excerpt = encrypted ? null : htmlToExcerpt(v.content);
              return (
                <li
                  key={v.id}
                  className="border border-border rounded-md p-3 bg-card hover:bg-accent/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground mb-0.5">
                        {idx === 0 ? 'Meest recent' : `Versie ${versions.length - idx}`}
                        {' · '}
                        {format(new Date(v.createdAt), "d MMM yyyy 'om' HH:mm", { locale: nl })}
                      </div>
                      <div className="font-medium truncate text-sm">
                        {v.title || <span className="text-muted-foreground italic">Zonder titel</span>}
                      </div>
                      {encrypted ? (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Lock size={11} /> Versleutelde inhoud — alleen herstelbaar met het juiste wachtwoord
                        </div>
                      ) : excerpt ? (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{excerpt}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground italic mt-1">(Lege inhoud)</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => handleRestore(v.id)}
                      disabled={restoringId !== null}
                    >
                      {restoringId === v.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <RotateCcw size={12} />}
                      <span className="ml-1.5">Herstel</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
