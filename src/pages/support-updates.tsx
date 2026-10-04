import { Link, Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { SupportUpdateCard, type SupportUpdateItem } from "@/components/support-updates-feed";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const IMPORTANCE = ["Normal", "Important", "Critical"] as const;

export function SupportUpdatesPage() {
  const { can, canMutate, readOnly } = useAuth();
  const client = useQueryClient();
  const [q, setQ] = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [category, setCategory] = useState("");
  const [importance, setImportance] = useState("");
  const [postedBy, setPostedBy] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editItem, setEditItem] = useState<SupportUpdateItem | null>(null);
  const [title, setTitle] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [description, setDescription] = useState("");
  const [formImportance, setFormImportance] = useState<string>("Normal");

  const meta = useQuery({
    queryKey: ["support-updates-meta"],
    queryFn: () => api<{ categories: string[]; importance: string[]; authors: { id: string; name: string }[] }>("/api/support-updates/meta"),
  });

  const list = useQuery({
    queryKey: ["support-updates", q, category, importance, postedBy, from, to, offset],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "30", offset: String(offset) });
      if (q) params.set("q", q);
      if (category) params.set("category", category);
      if (importance) params.set("importance", importance);
      if (postedBy) params.set("postedBy", postedBy);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      return api<{ items: SupportUpdateItem[]; total: number; limit: number; offset: number }>(`/api/support-updates?${params}`);
    },
  });

  const save = useMutation({
    mutationFn: () => {
      const body = { title, category: formCategory, description, importance: formImportance };
      if (editItem) {
        return api<{ item: SupportUpdateItem }>(`/api/support-updates/${editItem.id}`, { method: "PUT", body: JSON.stringify(body) });
      }
      return api<{ item: SupportUpdateItem }>("/api/support-updates", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      toast.success(editItem ? "Update saved" : "Update posted");
      setComposeOpen(false);
      setEditItem(null);
      void client.invalidateQueries({ queryKey: ["support-updates"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/support-updates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Update deleted");
      void list.refetch();
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const pin = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      api(`/api/support-updates/${id}/pin`, { method: "POST", body: JSON.stringify({ pinned }) }),
    onSuccess: () => {
      void list.refetch();
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (!can("support_updates.view")) return <Navigate to="/" replace />;
  if (list.isLoading || meta.isLoading) return <LoadingBlock />;
  if (list.isError) return <ErrorBlock message={list.error.message} />;

  const canPost = canMutate("support_updates.create");
  const items = list.data?.items || [];
  const total = list.data?.total || 0;

  function openCompose() {
    setEditItem(null);
    setTitle("");
    setFormCategory(meta.data?.categories[0] || "");
    setDescription("");
    setFormImportance("Normal");
    setComposeOpen(true);
  }

  function openEdit(item: SupportUpdateItem) {
    setEditItem(item);
    setTitle(item.title);
    setFormCategory(item.category);
    setDescription(item.description || item.descriptionExcerpt);
    setFormImportance(item.importance);
    setComposeOpen(true);
  }

  function resetFilters() {
    setDraftQ("");
    setQ("");
    setCategory("");
    setImportance("");
    setPostedBy("");
    setFrom("");
    setTo("");
    setOffset(0);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <PageHeader eyebrow="Team communication" title="Support Updates" />
          <p className="mt-2 text-sm text-slate-600">Important information and operational updates for the Support team.</p>
        </div>
        {canPost && !readOnly ? (
          <Button onClick={openCompose}>
            <Plus className="mr-1 h-4 w-4" />
            Post Update
          </Button>
        ) : null}
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search updates…"
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setQ(draftQ.trim());
                setOffset(0);
              }
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={category || "all"} onValueChange={(v) => { setCategory(v === "all" ? "" : v); setOffset(0); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(meta.data?.categories || []).map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={importance || "all"} onValueChange={(v) => { setImportance(v === "all" ? "" : v); setOffset(0); }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Importance" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All importance</SelectItem>
              {IMPORTANCE.map((i) => (
                <SelectItem key={i} value={i}>{i}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={postedBy || "all"} onValueChange={(v) => { setPostedBy(v === "all" ? "" : v); setOffset(0); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Posted by" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Anyone</SelectItem>
              {(meta.data?.authors || []).map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" className="w-36" value={from} onChange={(e) => { setFrom(e.target.value); setOffset(0); }} />
          <Input type="date" className="w-36" value={to} onChange={(e) => { setTo(e.target.value); setOffset(0); }} />
          <Button variant="secondary" size="sm" onClick={() => { setQ(draftQ.trim()); setOffset(0); }}>Search</Button>
          <Button variant="ghost" size="sm" onClick={resetFilters}>Reset</Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="space-y-3">
          <Empty title="No support updates yet." body={canPost ? "Post an update when there is something the Support team needs to know." : ""} />
          {canPost && !readOnly ? <Button onClick={openCompose}>Post Update</Button> : null}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <SupportUpdateCard key={item.id} item={item}>
              {!readOnly && (item.actions?.edit || item.actions?.delete || item.actions?.pin) ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.actions?.edit ? (
                    <Button size="sm" variant="outline" onClick={() => openEdit(item)}>Edit</Button>
                  ) : null}
                  {item.actions?.pin ? (
                    <Button size="sm" variant="outline" onClick={() => pin.mutate({ id: item.id, pinned: !item.pinned })}>
                      {item.pinned ? "Unpin" : "Pin"}
                    </Button>
                  ) : null}
                  {item.actions?.delete ? (
                    <Button size="sm" variant="destructive" onClick={() => remove.mutate(item.id)}>Delete</Button>
                  ) : null}
                </div>
              ) : null}
            </SupportUpdateCard>
          ))}
          {offset + items.length < total ? (
            <Button variant="secondary" className="w-full" onClick={() => setOffset(offset + 30)}>Load more</Button>
          ) : null}
        </div>
      )}

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit update" : "Post update"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(meta.data?.categories || []).map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Importance</Label>
                <Select value={formImportance} onValueChange={setFormImportance}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IMPORTANCE.map((i) => (
                      <SelectItem key={i} value={i}>{i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea rows={6} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={save.isPending || title.length < 3 || !formCategory || description.length < 3} onClick={() => save.mutate()}>
              {editItem ? "Save" : "Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Link to="/" className="text-sm text-blue-700">← Dashboard</Link>
    </div>
  );
}
