import { formatWhen } from "@/lib/format";

/** Publication / ISO timestamps — never shows Invalid Date. */
export function formatOptionalWhen(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatWhen(iso);
}
