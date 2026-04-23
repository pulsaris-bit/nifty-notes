import { Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNotes } from '@/hooks/useNotes';
import { buildMarkdownExport, downloadMarkdown } from '@/lib/exportNotes';
import { toast } from 'sonner';

export function ExportNotesCard() {
  const { notes, notebooks, dataLoaded } = useNotes();

  const activeCount = notes.filter((n) => !n.deletedAt).length;

  const handleExport = () => {
    if (activeCount === 0) {
      toast.error('Er zijn geen notities om te exporteren');
      return;
    }
    try {
      const md = buildMarkdownExport(notes, notebooks);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadMarkdown(`niftynotes-export-${stamp}.md`, md);
      toast.success(`${activeCount} notitie(s) geëxporteerd`);
    } catch (e) {
      toast.error('Exporteren mislukt');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-normal">Notities exporteren</CardTitle>
        <CardDescription>
          Download al je notities als één Markdown-bestand, gegroepeerd per notebook.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {dataLoaded
              ? `${activeCount} actieve notitie(s) in ${notebooks.length} notebook(s).`
              : 'Notities laden…'}
          </p>
          <Button onClick={handleExport} disabled={!dataLoaded || activeCount === 0}>
            <Download className="w-4 h-4 mr-2" />
            Exporteren als Markdown
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
