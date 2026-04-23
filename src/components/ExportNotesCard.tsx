import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotes } from '@/hooks/useNotes';
import { buildMarkdownExport, downloadMarkdown } from '@/lib/exportNotes';
import { toast } from 'sonner';
import { Note } from '@/types/notes';

export function ExportNotesCard() {
  const { notes, notebooks, dataLoaded } = useNotes();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  const activeNotes = useMemo(() => notes.filter((n) => !n.deletedAt), [notes]);
  const activeCount = activeNotes.length;

  // Group notes by notebook (preserve notebook order; orphans last)
  const groups = useMemo(() => {
    const filtered = query.trim()
      ? activeNotes.filter((n) =>
          (n.title || '').toLowerCase().includes(query.toLowerCase()),
        )
      : activeNotes;
    const byNb = new Map<string, Note[]>();
    for (const nb of notebooks) byNb.set(nb.id, []);
    const orphans: Note[] = [];
    for (const n of filtered) {
      const list = byNb.get(n.notebookId);
      if (list) list.push(n);
      else orphans.push(n);
    }
    const result: { id: string; label: string; icon: string; notes: Note[] }[] = [];
    for (const nb of notebooks) {
      const list = byNb.get(nb.id) || [];
      if (list.length > 0) result.push({ id: nb.id, label: nb.name, icon: nb.icon || '📓', notes: list });
    }
    if (orphans.length > 0) result.push({ id: '__orphans__', label: 'Overige', icon: '📄', notes: orphans });
    return result;
  }, [activeNotes, notebooks, query]);

  const visibleIds = useMemo(() => groups.flatMap((g) => g.notes.map((n) => n.id)), [groups]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const openDialog = () => {
    // Pre-select everything by default
    setSelected(new Set(activeNotes.map((n) => n.id)));
    setQuery('');
    setOpen(true);
  };

  const toggleNote = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (groupNoteIds: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = groupNoteIds.every((id) => next.has(id));
      if (allOn) groupNoteIds.forEach((id) => next.delete(id));
      else groupNoteIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleExport = () => {
    const chosen = activeNotes.filter((n) => selected.has(n.id));
    if (chosen.length === 0) {
      toast.error('Selecteer minstens één notitie');
      return;
    }
    try {
      const md = buildMarkdownExport(chosen, notebooks);
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = chosen.length === 1
        ? `${(chosen[0].title || 'notitie').replace(/[^\p{L}\p{N}\-_ ]+/gu, '').trim().slice(0, 60) || 'notitie'}.md`
        : `niftynotes-export-${stamp}.md`;
      downloadMarkdown(filename, md);
      toast.success(`${chosen.length} notitie(s) geëxporteerd`);
      setOpen(false);
    } catch {
      toast.error('Exporteren mislukt');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-normal">Notities exporteren</CardTitle>
        <CardDescription>
          Kies welke notities je wilt downloaden als Markdown-bestand.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {dataLoaded
              ? `${activeCount} actieve notitie(s) in ${notebooks.length} notebook(s).`
              : 'Notities laden…'}
          </p>
          <Button onClick={openDialog} disabled={!dataLoaded || activeCount === 0}>
            <Download className="w-4 h-4 mr-2" />
            Notities kiezen…
          </Button>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Notities exporteren</DialogTitle>
            <DialogDescription>
              Selecteer de notities die je als Markdown wilt downloaden.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              placeholder="Zoek op titel…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={toggleAllVisible}
                className="text-primary hover:underline"
              >
                {allVisibleSelected ? 'Alles deselecteren' : 'Alles selecteren'}
              </button>
              <span className="text-muted-foreground">
                {selected.size} van {activeCount} geselecteerd
              </span>
            </div>

            <ScrollArea className="h-[340px] rounded-md border border-border">
              <div className="p-2">
                {groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center">
                    Geen notities gevonden.
                  </p>
                ) : (
                  groups.map((g) => {
                    const groupIds = g.notes.map((n) => n.id);
                    const allOn = groupIds.every((id) => selected.has(id));
                    const someOn = !allOn && groupIds.some((id) => selected.has(id));
                    return (
                      <div key={g.id} className="mb-3 last:mb-0">
                        <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
                          <Checkbox
                            checked={allOn ? true : someOn ? 'indeterminate' : false}
                            onCheckedChange={() => toggleGroup(groupIds)}
                          />
                          <span className="text-sm font-medium">
                            {g.icon} {g.label}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {g.notes.length}
                          </span>
                        </label>
                        <div className="ml-6 mt-1 space-y-0.5">
                          {g.notes.map((n) => (
                            <label
                              key={n.id}
                              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent cursor-pointer"
                            >
                              <Checkbox
                                checked={selected.has(n.id)}
                                onCheckedChange={() => toggleNote(n.id)}
                              />
                              <span className="text-sm truncate">
                                {n.title || '(zonder titel)'}
                              </span>
                              {n.password && (
                                <span className="ml-auto text-xs">🔒</span>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={handleExport} disabled={selected.size === 0}>
              <Download className="w-4 h-4 mr-2" />
              Exporteer {selected.size > 0 ? `(${selected.size})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
