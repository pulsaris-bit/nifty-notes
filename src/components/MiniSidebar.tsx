import { BookOpen, Archive, Share2, Trash2, PanelLeftOpen } from 'lucide-react';
import { Notebook, Label } from '@/types/notes';

interface MiniSidebarProps {
  notebooks: Notebook[];
  labels: Label[];
  activeNotebookId: string | null;
  activeLabelId: string | null;
  showArchived: boolean;
  showTrash: boolean;
  trashedCount: number;
  sharedInboxCount?: number;
  onSelectAll: () => void;
  onToggleArchived: () => void;
  onSelectShared: () => void;
  onToggleTrash: () => void;
  onSelectNotebook: (id: string) => void;
  onSelectLabel: (id: string) => void;
  onExpand: () => void;
}

/**
 * Narrow icon-only rail shown when the full sidebar is collapsed.
 * Mirrors the structure of NoteSidebar but renders only the visual hooks
 * (icons / emoji / colored dots) so users keep one-click navigation.
 */
export function MiniSidebar({
  notebooks, labels, activeNotebookId, activeLabelId,
  showArchived, showTrash, trashedCount, sharedInboxCount = 0,
  onSelectAll, onToggleArchived, onSelectShared, onToggleTrash,
  onSelectNotebook, onSelectLabel, onExpand,
}: MiniSidebarProps) {
  const sortedNotebooks = [...notebooks].sort((a, b) =>
    a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' }),
  );
  const sortedLabels = [...labels].sort((a, b) =>
    a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' }),
  );

  const isAllActive = !activeNotebookId && !activeLabelId && !showArchived && !showTrash;

  const baseBtn =
    'relative w-9 h-9 flex items-center justify-center rounded-md transition-colors';
  const inactive =
    'text-sidebar-custom-fg hover:text-sidebar-custom-fg-active hover:bg-sidebar-custom-accent/50';
  const active = 'bg-sidebar-custom-accent text-sidebar-custom-fg-active';

  const Badge = ({ n }: { n: number }) =>
    n > 0 ? (
      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-medium flex items-center justify-center">
        {n > 99 ? '99+' : n}
      </span>
    ) : null;

  return (
    <aside className="w-12 shrink-0 bg-sidebar-custom-bg flex flex-col items-center h-full select-none py-2 gap-1">
      {/* Expand button (top, mirrors brand position) */}
      <button
        onClick={onExpand}
        title="Zijbalk tonen"
        className={`${baseBtn} ${inactive}`}
      >
        <PanelLeftOpen size={18} />
      </button>

      <div className="w-6 h-px bg-sidebar-custom-border my-1" />

      <button
        onClick={onSelectAll}
        title="Alle notities"
        className={`${baseBtn} ${isAllActive ? active : inactive}`}
      >
        <BookOpen size={18} />
      </button>

      <button
        onClick={onToggleArchived}
        title="Archief"
        className={`${baseBtn} ${showArchived ? active : inactive}`}
      >
        <Archive size={18} />
      </button>

      <button
        onClick={onSelectShared}
        title="Gedeeld met mij"
        className={`${baseBtn} ${activeNotebookId === '__shared__' ? active : inactive}`}
      >
        <Share2 size={18} />
        <Badge n={sharedInboxCount} />
      </button>

      <button
        onClick={onToggleTrash}
        title="Prullenbak"
        className={`${baseBtn} ${showTrash ? active : inactive}`}
      >
        <Trash2 size={18} />
        <Badge n={trashedCount} />
      </button>

      {/* Notebooks + labels in a single scrollable column */}
      <div className="flex-1 w-full overflow-y-auto custom-scrollbar flex flex-col items-center gap-1 pt-2">
        {sortedNotebooks.length > 0 && (
          <div className="w-6 h-px bg-sidebar-custom-border mb-1" />
        )}
        {sortedNotebooks.map((nb) => (
          <button
            key={nb.id}
            onClick={() => onSelectNotebook(nb.id)}
            title={nb.name}
            className={`${baseBtn} text-base ${
              activeNotebookId === nb.id ? active : inactive
            }`}
          >
            <span aria-hidden="true">{nb.icon}</span>
          </button>
        ))}

        {sortedLabels.length > 0 && (
          <div className="w-6 h-px bg-sidebar-custom-border my-1" />
        )}
        {sortedLabels.map((label) => (
          <button
            key={label.id}
            onClick={() => onSelectLabel(label.id)}
            title={label.name}
            className={`${baseBtn} ${activeLabelId === label.id ? active : inactive}`}
          >
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0"
              style={{ backgroundColor: label.color }}
            />
          </button>
        ))}
      </div>
    </aside>
  );
}
