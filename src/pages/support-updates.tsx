import { Link, Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
import { Empty, ErrorBlock, FilterToolbar, LoadingBlock, PageHeader } from "@/components/bits";
import { SupportUpdateDetailDialog } from "@/components/support-update-detail-dialog";
import { SupportUpdateCard, SupportUpdateCardToolbar, type SupportUpdateItem } from "@/components/support-updates-feed";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const IMPORTANCE = ["Normal", "Important", "Critical"] as const;

export function SupportUpdatesPage() {
  const { can, canMutate, readOnly } = useAuth();
  const client = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [importance, setImportance] = useState("");
  const [postedDate, setPostedDate] = useState("");
  const [offset, setOffset] = useState(0);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editItem, setEditItem] = useState<SupportUpdateItem | null>(null);
  const [title, setTitle] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [description, setDescription] = useState("");
  const [formImportance, setFormImportance] = useState<string>("Normal");
  const [requiresAcknowledgement, setRequiresAcknowledgement] = useState(false);
  const [detailItem, setDetailItem] = useState<SupportUpdateItem | null>(null);

  const meta = useQuery({
    queryKey: ["support-updates-meta"],
    queryFn: () => api<{ categories: string[]; importance: string[]; authors: { id: string; name: string }[] }>("/api/support-updates/meta"),
  });

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setQ(searchInput.trim());
      setOffset(0);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const list = useQuery({
    queryKey: ["support-updates", q, category, importance, postedDate, offset],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "30", offset: String(offset) });
      if (q) params.set("q", q);
      if (category) params.set("category", category);
      if (importance) params.set("importance", importance);
      if (postedDate) {
        params.set("from", postedDate);
        params.set("to", postedDate);
      }
      return api<{ items: SupportUpdateItem[]; total: number; limit: number; offset: number }>(`/api/support-updates?${params}`);
    },
  });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        title,
        category: formCategory,
        description,
        importance: formImportance,
        requiresAcknowledgement,
      };
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
    setRequiresAcknowledgement(false);
    setComposeOpen(true);
  }

  function openEdit(item: SupportUpdateItem) {
    setEditItem(item);
    setTitle(item.title);
    setFormCategory(item.category);
    setDescription(item.description || item.descriptionExcerpt);
    setFormImportance(item.importance);
    setRequiresAcknowledgement(Boolean(item.requiresAcknowledgement));
    setComposeOpen(true);
  }

  function resetFilters() {
    setSearchInput("");
    setQ("");
    setCategory("");
    setImportance("");
    setPostedDate("");
    setOffset(0);
  }

  const hasFilters = Boolean(q || category || importance || postedDate);

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <PageHeader
        eyebrow="Team communication"
        title="Support Updates"
        description="Important information and operational updates for the Support team."
        className="mb-5"
      />

      <FilterToolbar
        showClear={hasFilters}
        onClear={resetFilters}
        className="!flex-row !flex-wrap !items-center"
        search={
          <div className="relative min-w-[12rem] flex-[1.4]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 w-full pl-9"
              placeholder="Search updates…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        }
        filters={
          <>
            <Select value={category || "all"} onValueChange={(v) => { setCategory(v === "all" ? "" : v); setOffset(0); }}>
              <SelectTrigger className="h-8 w-[8.75rem]" aria-label="Category"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {(meta.data?.categories || []).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={importance || "all"} onValueChange={(v) => { setImportance(v === "all" ? "" : v); setOffset(0); }}>
              <SelectTrigger className="h-8 w-[11rem]" aria-label="Importance"><SelectValue placeholder="Importance" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All importance</SelectItem>
                {IMPORTANCE.map((i) => (
                  <SelectItem key={i} value={i}>{i}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              className="h-8 w-[8.75rem]"
              aria-label="Posted date"
              title="Posted date"
              value={postedDate}
              onChange={(e) => {
                setPostedDate(e.target.value);
                setOffset(0);
              }}
            />
            {canPost && !readOnly ? (
              <Button type="button" size="sm" className="h-8 gap-1 sm:ml-auto" onClick={openCompose}>
                <Plus className="size-3.5" />
                Post Update
              </Button>
            ) : null}
          </>
        }
      />

      {items.length === 0 ? (
        <Empty
          title="No support updates yet."
          body={canPost ? "Post an update when there is something the Support team needs to know." : ""}
          bodyClassName="max-w-none whitespace-nowrap"
        />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <SupportUpdateCard key={item.id} item={item} ackInToolbar onOpenDetail={() => setDetailItem(item)}>
              <SupportUpdateCardToolbar
                item={item}
                readOnly={readOnly}
                onView={() => setDetailItem(item)}
                onEdit={() => openEdit(item)}
                onPin={() => pin.mutate({ id: item.id, pinned: !item.pinned })}
                onDelete={() => remove.mutate(item.id)}
              />
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
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={requiresAcknowledgement}
                onChange={(e) => setRequiresAcknowledgement(e.target.checked)}
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium text-foreground">Require acknowledgement</span>
                <span className="block text-xs text-muted-foreground">
                  Team members will be asked to confirm they have read this update.
                </span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button disabled={save.isPending || title.length < 3 || !formCategory || description.length < 3} onClick={() => save.mutate()}>
              {editItem ? "Save" : "Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SupportUpdateDetailDialog
        item={detailItem}
        open={Boolean(detailItem)}
        onOpenChange={(open) => {
          if (!open) setDetailItem(null);
        }}
      />

      <Link to="/" className="text-sm text-primary">← Dashboard</Link>
    </div>
  );
}
