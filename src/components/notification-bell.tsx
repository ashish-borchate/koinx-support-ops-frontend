import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  priority: string;
  status: string;
  readAt: string | null;
  actionRequired: boolean;
  destinationUrl: string;
  createdAt: string;
};

function priorityClass(priority: string) {
  if (priority === "critical") return "text-destructive";
  if (priority === "important") return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

export function NotificationBell() {
  const { can, viewAs } = useAuth();
  const queryClient = useQueryClient();
  const enabled = can("notification_center.view_own") || can("notification_center.view_team");

  const unreadQ = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: () => api<{ count: number }>("/api/notifications/unread-count"),
    enabled,
    refetchInterval: 60_000,
  });

  const recentQ = useQuery({
    queryKey: ["notifications-recent"],
    queryFn: () =>
      api<{ items: NotificationRow[]; unread: number }>("/api/notifications?limit=8&status=open"),
    enabled,
    refetchInterval: 60_000,
  });

  if (!enabled) return null;

  const count = unreadQ.data?.count ?? 0;
  const items = recentQ.data?.items ?? [];
  const readOnly = Boolean(viewAs);

  async function markRead(id: string) {
    if (readOnly) return;
    await api(`/api/notifications/${id}/read`, { method: "POST" });
    await queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    await queryClient.invalidateQueries({ queryKey: ["notifications-recent"] });
    await queryClient.invalidateQueries({ queryKey: ["notifications-list"] });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-4" />
          {count > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px]">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Notifications</span>
          <Link to="/notifications" className="text-xs font-normal text-primary hover:underline">
            View all
          </Link>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">No open notifications.</p>
        ) : (
          items.map((row) => (
            <DropdownMenuItem key={row.id} className="flex flex-col items-start gap-1 py-2" asChild>
              <Link
                to={row.destinationUrl || "/notifications"}
                onClick={() => void markRead(row.id)}
                className="w-full cursor-pointer"
              >
                <span className={cn("text-xs font-medium uppercase", priorityClass(row.priority))}>{row.priority}</span>
                <span className="font-medium leading-snug">{row.title}</span>
                {row.message ? <span className="line-clamp-2 text-xs text-muted-foreground">{row.message}</span> : null}
                <span className="text-[11px] text-muted-foreground">{formatWhen(row.createdAt)}</span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
        {can("notification_center.view_team") ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/performance-center?focus=attention">Needs attention</Link>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
