import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Empty, ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatWhen } from "@/lib/format";

type Meta = { categories: string[]; priorities: string[]; statuses: string[] };
type Item = {
  id: string;
  title: string;
  category: string;
  description: string;
  priority: string;
  status: string;
  creatorName: string;
  ownerName: string;
  relatedLink: string;
  suggestedAction: string;
  followUpDate: string;
  resolution: string;
  createdAt: string;
  updatedAt: string;
};

type Comment = { id: string; body: string; authorName: string; createdAt: string };

function StatusPill({ status }: { status: string }) {
  const open = !["Resolved", "Closed — No Action"].includes(status);
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${open ? "bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-700"}`}>
      {status}
    </span>
  );
}

function PriorityPill({ priority }: { priority: string }) {
  const tone =
    priority === "Critical"
      ? "bg-rose-100 text-rose-900"
      : priority === "High"
        ? "bg-orange-50 text-orange-900"
        : priority === "Low"
          ? "bg-slate-100 text-slate-600"
          : "bg-blue-50 text-blue-800";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>{priority}</span>;
}

export function SupportActionsListPage() {
  const { can, readOnly } = useAuth();
  const [scope, setScope] = useState("assigned");
  const [status, setStatus] = useState("open");
  const query = useQuery({
    queryKey: ["support-actions", scope, status],
    queryFn: () => {
      const params = new URLSearchParams({ scope });
      if (status) params.set("status", status);
      return api<{ items: Item[] }>(`/api/support-actions?${params.toString()}`);
    },
  });

  if (!can("support_actions.view")) return <ErrorBlock message="You do not have access to Support Actions." />;
  if (query.isLoading) return <LoadingBlock />;
  if (query.isError) return <ErrorBlock message={query.error.message} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader eyebrow="Operations" title="Support Actions" />
        {can("support_actions.create") && !readOnly ? (
          <Button asChild>
            <Link to="/support-actions/new">New action</Link>
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="assigned">Assigned to me</SelectItem>
            <SelectItem value="created">Created by me</SelectItem>
            {can("support_actions.manage") ? <SelectItem value="all">All actions</SelectItem> : null}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Resolved / closed</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {query.data!.items.length === 0 ? (
        <Empty title="No support actions" body="Nothing matches this filter." />
      ) : (
        <div className="divide-y rounded-2xl border border-slate-200 bg-white">
          {query.data!.items.map((item) => (
            <Link key={item.id} to={`/support-actions/${item.id}`} className="block px-4 py-4 hover:bg-slate-50">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                <PriorityPill priority={item.priority} />
                <StatusPill status={item.status} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {item.category} · Owner {item.ownerName} · Creator {item.creatorName}
              </p>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.description}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function SupportActionCreatePage() {
  const { readOnly } = useAuth();
  const client = useQueryClient();
  const meta = useQuery({ queryKey: ["support-actions-meta"], queryFn: () => api<Meta>("/api/support-actions/meta") });
  const recipients = useQuery({
    queryKey: ["support-actions-recipients"],
    queryFn: () => api<{ users: { id: string; name: string; roleKey: string }[] }>("/api/support-actions/recipients"),
  });
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [ownerId, setOwnerId] = useState("");
  const [relatedLink, setRelatedLink] = useState("");
  const [suggestedAction, setSuggestedAction] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api<{ item: Item }>("/api/support-actions", {
        method: "POST",
        body: JSON.stringify({ title, category, description, priority, ownerId, relatedLink, suggestedAction, followUpDate }),
      }),
    onSuccess: (data) => {
      toast.success("Support Action created");
      void client.invalidateQueries({ queryKey: ["support-actions"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      window.location.href = `/support-actions/${data.item.id}`;
    },
    onError: (e) => toast.error(e.message),
  });

  if (readOnly) return <ErrorBlock message="View As is read-only." />;
  if (meta.isLoading || recipients.isLoading) return <LoadingBlock />;

  const categories = meta.data?.categories || [];
  const users = recipients.data?.users || [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader eyebrow="Support Actions" title="New request" />
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary" />
          </div>
          <div className="space-y-2">
            <Label>Recipient</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose owner" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(meta.data?.priorities || []).map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
          </div>
          <div className="space-y-2">
            <Label>Related link (optional)</Label>
            <Input value={relatedLink} onChange={(e) => setRelatedLink(e.target.value)} placeholder="Ticket, conversation, or Hub record" />
          </div>
          <div className="space-y-2">
            <Label>Suggested action (optional)</Label>
            <Textarea value={suggestedAction} onChange={(e) => setSuggestedAction(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Follow-up date (optional)</Label>
            <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
          </div>
          <Button
            disabled={create.isPending || !title || !category || !description || !ownerId}
            onClick={() => create.mutate()}
          >
            Submit
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function SupportActionDetailPage({ id }: { id: string }) {
  const { readOnly, can } = useAuth();
  const client = useQueryClient();
  const meta = useQuery({ queryKey: ["support-actions-meta"], queryFn: () => api<Meta>("/api/support-actions/meta") });
  const detail = useQuery({
    queryKey: ["support-actions", id],
    queryFn: () => api<{ item: Item; comments: Comment[] }>(`/api/support-actions/${id}`),
  });
  const [comment, setComment] = useState("");
  const [resolution, setResolution] = useState("");

  const patch = useMutation({
    mutationFn: (body: Record<string, string>) =>
      api<{ item: Item }>(`/api/support-actions/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Updated");
      void detail.refetch();
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const postComment = useMutation({
    mutationFn: () => api(`/api/support-actions/${id}/comments`, { method: "POST", body: JSON.stringify({ body: comment }) }),
    onSuccess: () => {
      setComment("");
      void detail.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  if (detail.isLoading) return <LoadingBlock />;
  if (detail.isError || !detail.data) return <ErrorBlock message={detail.error?.message || "Not found"} />;

  const item = detail.data.item;
  const statuses = meta.data?.statuses || [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Support Actions" title={item.title} />
      <div className="flex flex-wrap gap-2">
        <PriorityPill priority={item.priority} />
        <StatusPill status={item.status} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>{item.description}</p>
          <p className="text-xs text-slate-500">
            {item.category} · Creator {item.creatorName} · Owner {item.ownerName} · Updated {formatWhen(item.updatedAt)}
          </p>
          {item.relatedLink ? (
            <p>
              Related:{" "}
              <a href={item.relatedLink} className="text-blue-700" target="_blank" rel="noreferrer">
                {item.relatedLink}
              </a>
            </p>
          ) : null}
          {item.suggestedAction ? <p className="rounded-lg bg-slate-50 p-3">Suggested: {item.suggestedAction}</p> : null}
          {item.followUpDate ? <p className="text-xs text-slate-500">Follow-up date: {item.followUpDate}</p> : null}
          {item.resolution ? <p className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">Resolution: {item.resolution}</p> : null}
        </CardContent>
      </Card>

      {!readOnly ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Update</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={item.status} onValueChange={(v) => patch.mutate({ status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Resolution notes</Label>
              <Textarea value={resolution || item.resolution} onChange={(e) => setResolution(e.target.value)} rows={3} />
              <Button variant="secondary" size="sm" onClick={() => patch.mutate({ resolution: resolution || item.resolution })}>
                Save resolution
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {detail.data.comments.length === 0 ? <p className="text-sm text-slate-500">No comments yet.</p> : null}
          {detail.data.comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
              <p className="text-xs font-medium text-slate-600">
                {c.authorName} · {formatWhen(c.createdAt)}
              </p>
              <p className="mt-1 text-sm text-slate-800">{c.body}</p>
            </div>
          ))}
          {!readOnly && can("support_actions.view") ? (
            <div className="space-y-2">
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add context or a question" rows={3} />
              <Button disabled={!comment.trim() || postComment.isPending} onClick={() => postComment.mutate()}>
                Post comment
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Link to="/support-actions" className="text-sm text-blue-700">
        ← Back to list
      </Link>
    </div>
  );
}
