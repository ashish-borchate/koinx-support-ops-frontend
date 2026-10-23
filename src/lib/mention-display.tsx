export type DiscussionMention = { userId: string; displayNameSnapshot: string };

export function renderMentionText(message: string, mentions: DiscussionMention[] = []) {
  if (!mentions.length) return message;
  const tokens = [...mentions]
    .sort((a, b) => b.displayNameSnapshot.length - a.displayNameSnapshot.length)
    .map((m) => `@${m.displayNameSnapshot}`);
  const parts: { type: "text" | "mention"; value: string }[] = [{ type: "text", value: message }];
  for (const token of tokens) {
    const next: { type: "text" | "mention"; value: string }[] = [];
    for (const part of parts) {
      if (part.type === "mention") {
        next.push(part);
        continue;
      }
      let rest = part.value;
      while (rest.includes(token)) {
        const idx = rest.indexOf(token);
        if (idx > 0) next.push({ type: "text", value: rest.slice(0, idx) });
        next.push({ type: "mention", value: token });
        rest = rest.slice(idx + token.length);
      }
      if (rest) next.push({ type: "text", value: rest });
    }
    parts.length = 0;
    parts.push(...next);
  }
  return parts.map((part, i) =>
    part.type === "mention" ? (
      <span key={i} className="font-medium text-primary">
        {part.value}
      </span>
    ) : (
      <span key={i}>{part.value}</span>
    ),
  );
}
