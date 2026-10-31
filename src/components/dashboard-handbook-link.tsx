import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";

/** Subtle handbook entry point on the dashboard (all authenticated roles). */
export function DashboardHandbookLink() {
  return (
    <p className="text-sm">
      <Link
        to="/handbook"
        className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-2 hover:text-primary hover:underline motion-safe:transition-colors"
      >
        <GraduationCap className="size-4 opacity-70" aria-hidden />
        Hub Handbook &amp; training
      </Link>
    </p>
  );
}
