import { cn } from "@/lib/utils";

const DOC_TONES: Record<string, string> = {
  Published: "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  Updating: "bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100",
  "Verification Required": "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  "Ready to Publish": "bg-violet-50 text-violet-900 dark:bg-violet-950 dark:text-violet-100",
  Draft: "bg-muted text-foreground/90",
  "Pending Review": "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  "Changes Required": "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100",
  "Pending Mintlify": "bg-violet-50 text-violet-900 dark:bg-violet-950 dark:text-violet-100",
};

const FRONT_TONES: Record<string, string> = {
  "Not Required": "bg-muted text-foreground/80",
  "Not required": "bg-muted text-foreground/80",
  Updated: "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  Implemented: "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  Pending: "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  Assigned: "bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100",
  "In Progress": "bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100",
  "Needs Clarification": "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
};

export function DocumentationStatusBadge({ label, className }: { label: string; className?: string }) {
  const tone = DOC_TONES[label] || "bg-muted text-foreground/90";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", tone, className)}>{label}</span>
  );
}

export function FrontendStatusBadge({ label, className }: { label: string; className?: string }) {
  const tone = FRONT_TONES[label] || "bg-muted text-foreground/80";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", tone, className)}>{label}</span>
  );
}
