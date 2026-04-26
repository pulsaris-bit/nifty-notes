import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useNotes } from '@/hooks/useNotes';
import { buildMarkdownBackup, downloadBlob, backupFilename } from '@/lib/backupNotes';
import { toast } from 'sonner';

export function BackupCard() {
  const { notes, notebooks, labels } = useNotes();
  const [busy, setBusy] = useState(false);

  const exportable = notes.filter((n) => !n.deletedAt);

  const handleDownload = async () => {
    if (exportable.length === 0) {
      toast.error('Er zijn geen notities om te exporteren');
      return;
    }
    setBusy(true);
    try {
      const blob = await buildMarkdownBackup({ notes, notebooks, labels });
      downloadBlob(blob, backupFilename());
      toast.success(`Backup gemaakt (${exportable.length} notities incl. bijlagen)`);
    } catch (err) {
      console.error(err);
      toast.error('Backup maken mislukt');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-normal">Backup</CardTitle>
        <CardDescription>
          Download al je notities (eigen én met jou gedeeld) als markdown-bestanden in een ZIP,
          geordend per notebook. Bijlagen komen mee in een aparte map en blijven gelinkt vanuit
          de markdown. Vergrendelde notities worden in versleutelde vorm meegenomen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            {exportable.length} {exportable.length === 1 ? 'notitie' : 'notities'} klaar voor export
          </div>
          <Button onClick={handleDownload} disabled={busy || exportable.length === 0}>
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Bezig…
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" /> Download backup
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
