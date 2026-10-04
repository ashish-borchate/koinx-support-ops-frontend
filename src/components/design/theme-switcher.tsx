import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
];

export function ThemeSwitcher({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Theme</p>
      <div
        role="radiogroup"
        aria-label="Color theme"
        className="flex rounded-lg border border-border/60 bg-muted/30 p-0.5"
      >
        {options.map(({ value, label, icon: Icon }) => {
          const active = preference === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              title={label}
              onClick={() => setPreference(value)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium motion-safe:transition-[background-color,color,box-shadow] motion-safe:duration-150",
                active
                  ? "bg-card text-foreground shadow-[var(--shadow-card)]"
                  : "text-muted-foreground hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              )}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <span className="hidden min-[280px]:inline">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
