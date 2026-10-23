import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="text-center">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold text-foreground">{value}</CardContent>
    </Card>
  );
}

/** Click to apply a list filter; click again when active to clear (toggle). */
export function FilterStat({
  label,
  value,
  onClick,
  active,
  disabled,
}: {
  label: string;
  value: number;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-xl text-center transition-shadow disabled:cursor-not-allowed disabled:opacity-60 ${
        active ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background" : "hover:ring-1 hover:ring-border"
      }`}
    >
      <StatCard label={label} value={value} />
    </button>
  );
}

/** Toggle a string filter key (pass `null` / clear value to reset). */
export function toggleStringFilter(current: string, next: string, clear = "all") {
  return current === next ? clear : next;
}
