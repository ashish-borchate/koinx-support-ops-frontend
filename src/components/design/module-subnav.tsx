import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

export function ModuleSubnav({ links, className }: { links: { to: string; label: string }[]; className?: string }) {
  return (
    <nav
      className={cn("mb-6 flex flex-wrap gap-1.5 border-b border-border pb-2", className)}
      aria-label="Module sections"
    >
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            cn(
              "rounded-lg border px-3.5 py-2 text-sm font-medium motion-safe:transition-colors motion-safe:duration-200",
              isActive
                ? "border-primary bg-primary/10 text-primary shadow-sm"
                : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/40 hover:text-foreground",
            )
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
