import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { STALE } from "@/lib/query-client";

type HubNotification = {
  key: string;
  title: string;
  detail: string;
  href: string;
  actionLabel: string;
};

export function HubNotificationToasts() {
  const { user } = useAuth();
  const shown = useRef(new Set<string>());
  const query = useQuery({
    queryKey: ["hub-notifications"],
    queryFn: () => api<{ notifications: HubNotification[] }>("/api/hub-notifications"),
    enabled: Boolean(user),
    staleTime: STALE.operational,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!query.data?.notifications.length) return;
    for (const item of query.data.notifications) {
      if (shown.current.has(item.key)) continue;
      shown.current.add(item.key);
      const dismiss = () => {
        void api("/api/hub-notifications/dismiss", { method: "POST", body: JSON.stringify({ key: item.key }) });
      };
      toast(item.title, {
        description: item.detail,
        duration: 20_000,
        closeButton: true,
        onDismiss: dismiss,
        action: {
          label: item.actionLabel,
          onClick: () => {
            dismiss();
            window.location.href = item.href;
          },
        },
      });
    }
  }, [query.data]);

  return null;
}
