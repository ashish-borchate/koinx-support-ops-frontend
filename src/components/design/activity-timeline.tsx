import { formatWhen } from "@/lib/format";

export function ActivityTimeline({
  entries,
}: {
  entries: { id: string; summary: string; actorName: string; createdAt: string }[];
}) {
  if (!entries.length) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }
  return (
    <ul className="relative space-y-0 border-l border-border/70 pl-4">
      {entries.map((entry, i) => (
        <li key={entry.id} className="relative pb-4 last:pb-0">
          <span
            className="absolute top-1.5 -left-[calc(1rem+5px)] size-2 rounded-full bg-primary/80 ring-2 ring-card"
            aria-hidden
          />
          <p className="text-sm text-foreground">{entry.summary}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {entry.actorName} · {formatWhen(entry.createdAt)}
          </p>
          {i < entries.length - 1 ? null : null}
        </li>
      ))}
    </ul>
  );
}
