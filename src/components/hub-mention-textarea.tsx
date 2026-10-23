import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { mentionablesUrl, type MentionScope } from "@/lib/mention-api";
import { cn } from "@/lib/utils";

type MentionableUser = { id: string; name: string; roleKey: string; roleName: string };

export type MentionRef = { userId: string; displayName: string };

export type MentionPayload = { message: string; mentions: { userId: string }[] };

export function useMentionDraft() {
  const [value, setValue] = useState("");
  const [mentionRefs, setMentionRefs] = useState<MentionRef[]>([]);

  function reset() {
    setValue("");
    setMentionRefs([]);
  }

  function buildPayload(minLength = 2): MentionPayload | null {
    const message = value.trim();
    if (message.length < minLength) return null;
    const mentions = mentionRefs
      .filter((r) => message.includes(`@${r.displayName}`))
      .map((r) => ({ userId: r.userId }));
    return { message, mentions };
  }

  return { value, setValue, mentionRefs, setMentionRefs, reset, buildPayload };
}

export function HubMentionTextarea({
  scope,
  recordId,
  value,
  onValueChange,
  mentionRefs,
  onMentionRefsChange,
  disabled,
  placeholder,
  className,
}: {
  scope: MentionScope;
  recordId: string;
  value: string;
  onValueChange: (next: string) => void;
  mentionRefs: MentionRef[];
  onMentionRefsChange: (next: MentionRef[]) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [users, setUsers] = useState<MentionableUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const mentionStartRef = useRef<number | null>(null);

  const loadUsers = useCallback(
    async (q: string) => {
      setLoadingUsers(true);
      try {
        const data = await api<{ users: MentionableUser[] }>(mentionablesUrl(scope, recordId, q));
        setUsers(data.users);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load mention suggestions");
        setUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    },
    [scope, recordId],
  );

  useEffect(() => {
    if (!mentionOpen) return;
    const t = window.setTimeout(() => void loadUsers(mentionQuery), 120);
    return () => window.clearTimeout(t);
  }, [mentionOpen, mentionQuery, loadUsers]);

  const filtered = useMemo(() => users, [users]);

  function detectMentionTrigger(next: string, cursor: number) {
    const before = next.slice(0, cursor);
    const at = before.lastIndexOf("@");
    if (at === -1) {
      setMentionOpen(false);
      mentionStartRef.current = null;
      return;
    }
    const fragment = before.slice(at + 1);
    if (fragment.includes(" ") || fragment.includes("\n")) {
      setMentionOpen(false);
      mentionStartRef.current = null;
      return;
    }
    mentionStartRef.current = at;
    setMentionQuery(fragment);
    setMentionOpen(true);
    setMentionIndex(0);
  }

  function insertMention(user: MentionableUser) {
    const el = textareaRef.current;
    const start = mentionStartRef.current;
    if (!el || start == null) return;
    const cursor = el.selectionStart ?? value.length;
    const before = value.slice(0, start);
    const after = value.slice(cursor);
    const token = `@${user.name}`;
    const next = `${before}${token} ${after}`;
    onValueChange(next);
    const map = new Map(mentionRefs.map((r) => [r.userId, r]));
    map.set(user.id, { userId: user.id, displayName: user.name });
    onMentionRefsChange([...map.values()]);
    setMentionOpen(false);
    mentionStartRef.current = null;
    requestAnimationFrame(() => {
      el.focus();
      const pos = before.length + token.length + 1;
      el.setSelectionRange(pos, pos);
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!mentionOpen || !filtered.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" && !e.shiftKey && mentionOpen) {
      e.preventDefault();
      insertMention(filtered[mentionIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMentionOpen(false);
    }
  }

  return (
    <div className="relative min-w-0 flex-1">
      <Textarea
        ref={textareaRef}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value;
          onValueChange(next);
          detectMentionTrigger(next, e.target.selectionStart ?? next.length);
        }}
        onKeyDown={onKeyDown}
        onClick={(e) => detectMentionTrigger(value, e.currentTarget.selectionStart ?? value.length)}
        placeholder={placeholder}
        className={cn("min-h-[2.75rem] text-sm", className)}
      />
      {mentionOpen ? (
        <div
          className="absolute bottom-full left-0 z-50 mb-1 w-full max-w-xs overflow-hidden rounded-md border border-border/60 bg-popover shadow-md"
          role="listbox"
        >
          {loadingUsers ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">No matches</p>
          ) : (
            filtered.map((user, i) => (
              <button
                key={user.id}
                type="button"
                role="option"
                aria-selected={i === mentionIndex}
                className={cn(
                  "flex w-full flex-col items-start px-2.5 py-2 text-left text-sm hover:bg-muted/60",
                  i === mentionIndex && "bg-muted/50",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertMention(user)}
              >
                <span className="font-medium">{user.name}</span>
                <span className="text-xs text-muted-foreground">{user.roleName}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
