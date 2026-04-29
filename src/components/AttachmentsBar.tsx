import { useEffect, useRef, useState } from 'react';
import { Paperclip, X, FileText, FileSpreadsheet, FileArchive, File as FileIcon, Download, Loader2 } from 'lucide-react';
import type { NoteAttachment } from '@/types/notes';
import { attachmentDownloadUrl, HAS_API } from '@/lib/api';
import { toast } from 'sonner';

interface AttachmentsBarProps {
  noteId: string;
  canEdit: boolean;            // upload allowed
  canDelete: boolean;          // owner only
  listAttachments: (noteId: string) => Promise<NoteAttachment[]>;
  addAttachment: (noteId: string, file: File) => Promise<NoteAttachment>;
  removeAttachment: (noteId: string, attId: string) => Promise<void>;
}

const MAX_BYTES = 25 * 1024 * 1024;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function iconFor(filename: string, mime: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf') || mime === 'application/pdf') return <FileText size={14} className="text-red-500" />;
  if (/\.(docx?|odt|rtf)$/.test(lower)) return <FileText size={14} className="text-blue-500" />;
  if (/\.(xlsx?|csv|ods)$/.test(lower)) return <FileSpreadsheet size={14} className="text-green-600" />;
  if (/\.(zip|7z|rar|tar|gz)$/.test(lower)) return <FileArchive size={14} className="text-amber-600" />;
  return <FileIcon size={14} className="text-muted-foreground" />;
}

export function AttachmentsBar({
  noteId, canEdit, canDelete,
  listAttachments, addAttachment, removeAttachment,
}: AttachmentsBarProps) {
  const [items, setItems] = useState<NoteAttachment[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    listAttachments(noteId)
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, [noteId, listAttachments]);

  const handlePick = () => fileInputRef.current?.click();

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name} is groter dan 25 MB`);
          continue;
        }
        try {
          const row = await addAttachment(noteId, file);
          setItems((prev) => [row, ...(prev || [])]);
        } catch (e: any) {
          toast.error(e?.message || `Upload van ${file.name} mislukt`);
        }
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async (att: NoteAttachment) => {
    if (!confirm(`Bijlage "${att.filename}" verwijderen?`)) return;
    try {
      await removeAttachment(noteId, att.id);
      setItems((prev) => (prev || []).filter((a) => a.id !== att.id));
    } catch (e: any) {
      toast.error(e?.message || 'Verwijderen mislukt');
    }
  };

  // Hide entirely if no attachments and the user can't add any.
  const hasItems = items && items.length > 0;
  if (!canEdit && !hasItems) return null;

  return (
    <div className="px-3 sm:px-6 py-2 border-b border-border/50 flex items-center gap-2 flex-wrap">
      {hasItems && items!.map((att) => {
        const url = attachmentDownloadUrl(noteId, att.id);
        return (
          <span
            key={att.id}
            className="group inline-flex items-center gap-1.5 text-xs pl-2 pr-1 py-1 rounded-full bg-muted hover:bg-accent transition-colors"
            title={`${att.filename} · ${formatBytes(att.size)}`}
          >
            {iconFor(att.filename, att.mimeType)}
            {url ? (
              <a
                href={url}
                download={att.filename}
                className="max-w-[14rem] truncate text-foreground hover:underline"
              >
                {att.filename}
              </a>
            ) : (
              <span className="max-w-[14rem] truncate text-muted-foreground">{att.filename}</span>
            )}
            <span className="text-[10px] text-muted-foreground">{formatBytes(att.size)}</span>
            {url && (
              <a
                href={url}
                download={att.filename}
                className="p-1 rounded-full hover:bg-background text-muted-foreground hover:text-foreground"
                aria-label="Downloaden"
                title="Downloaden"
              >
                <Download size={12} />
              </a>
            )}
            {canDelete && (
              <button
                onClick={() => handleRemove(att)}
                className="p-1 rounded-full hover:bg-destructive/15 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Verwijderen"
                title="Verwijderen"
              >
                <X size={12} />
              </button>
            )}
          </span>
        );
      })}

      {canEdit && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            onClick={() => {
              if (!HAS_API) {
                toast.error('Bijlagen werken alleen in de zelf-gehoste versie (backend niet bereikbaar in preview).');
                return;
              }
              handlePick();
            }}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors disabled:opacity-50"
            title={HAS_API ? 'Bijlage toevoegen (PDF, Word, Excel, …)' : 'Bijlagen vereisen de zelf-gehoste backend'}
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
            Bijlage
          </button>
        </>
      )}
    </div>
  );
}
