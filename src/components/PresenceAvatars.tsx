import { PresenceViewer } from '@/types/notes';

/** Stable color per userId for the avatar bubble. */
function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 55%, 45%)`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

interface PresenceAvatarsProps {
  viewers: PresenceViewer[];
  currentUserId: string | undefined;
  max?: number;
}

export function PresenceAvatars({ viewers, currentUserId, max = 3 }: PresenceAvatarsProps) {
  const others = viewers.filter((v) => v.userId !== currentUserId);
  if (others.length === 0) return null;

  const visible = others.slice(0, max);
  const overflow = others.length - visible.length;

  const tooltip = (() => {
    const names = others.map((v) => v.displayName);
    if (names.length === 1) return `${names[0]} bekijkt deze notitie`;
    if (names.length === 2) return `${names[0]} en ${names[1]} bekijken deze notitie`;
    return `${names.slice(0, -1).join(', ')} en ${names.length - 2 > 0 ? `${names.length - 1} anderen` : names.at(-1)} bekijken deze notitie`;
  })();

  return (
    <div className="flex items-center -space-x-1.5" title={tooltip} aria-label={tooltip}>
      {visible.map((v) => (
        <div
          key={v.userId}
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white border-2 border-background shrink-0"
          style={{ backgroundColor: colorFor(v.userId) }}
        >
          {initials(v.displayName)}
        </div>
      ))}
      {overflow > 0 && (
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold bg-muted text-muted-foreground border-2 border-background shrink-0">
          +{overflow}
        </div>
      )}
    </div>
  );
}
