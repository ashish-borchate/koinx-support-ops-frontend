import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

export function ModuleSubnav({ links }: { links: { to: string; label: string }[] }) {
  return (
    <nav className="mb-6 flex flex-wrap gap-1 border-b border-border/60 pb-px" aria-label="Module sections">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            cn(
              "relative -mb-px rounded-t-lg px-3.5 py-2 text-sm font-medium motion-safe:transition-colors motion-safe:duration-200",
              isActive
                ? "text-primary after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
                : "text-muted-foreground hover:text-foreground",
            )
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
