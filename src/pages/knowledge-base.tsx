import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { KnowledgeBaseEditor } from "@/components/knowledge-base-editor";
import { KnowledgeBaseContent } from "@/lib/knowledge-base-html";
import { ReportIssueButton } from "@/components/report-issue-dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatWhen } from "@/lib/format";

export type KbArticle = {
  id: string;
  title: string;
  category: string;
  contentHtml: string;
  contentPreview: string;
  status: string;
  relatedLinks: { id: string; label: string; url: string }[];
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  updatedByName: string;
  actions: { edit: boolean; manageStatus: boolean };
  sourceType: "knowledge_base";
  sourceId: string;
};

const STATUSES = ["Active", "Needs Update", "Archived"] as const;

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Active"
      ? "bg-emerald-50 text-emerald-800"
      : status === "Needs Update"
        ? "bg-amber-50 text-amber-900"
        : "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>{status}</span>;
}

export function KnowledgeBaseRoutes() {
  return (
    <Routes>
      <Route index element={<KnowledgeBaseLibraryPage />} />
      <Route path="new" element={<KnowledgeBaseFormPage />} />
      <Route path=":id/edit" element={<KnowledgeBaseFormPage />} />
      <Route path=":id" element={<KnowledgeBaseDetailPage />} />
    </Routes>
  );
}

export function KnowledgeBaseLibraryPage() {
  const { can, canMutate, readOnly } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const status = searchParams.get("status") || "";
  const [draftQ, setDraftQ] = useState(q);

  const meta = useQuery({
    queryKey: ["kb-meta"],
    queryFn: () => api<{ categories: string[]; statuses: string[] }>("/api/knowledge-base/meta"),
  });

  const query = useQuery({
    queryKey: ["knowledge-base", q, category, status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (category) params.set("category", category);
      if (status) params.set("status", status);
      const qs = params.toString();
      return api<{ items: KbArticle[] }>(`/api/knowledge-base${qs ? `?${qs}` : ""}`);
    },
  });

  const items = query.data?.items || [];
  const grouped = useMemo(() => {
    const map = new Map<string, KbArticle[]>();
    for (const item of items) {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  if (!can("knowledge_base.view")) return <Navigate to="/" replace />;
  if (query.isLoading || meta.isLoading) return <LoadingBlock />;
  if (query.isError) return <ErrorBlock message={query.error.message} />;

  const canCreate = canMutate("knowledge_base.create");
  const canManage = can("knowledge_base.manage");

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <PageHeader eyebrow="Internal reference" title="Knowledge Base" />
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Internal learning and reference material for the Support team.
          </p>
        </div>
        {canCreate && !readOnly ? (
          <Button asChild>
            <Link to="/knowledge-base/new">
              <Plus className="mr-1 h-4 w-4" />
              Add Article
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search Knowledge Base…"
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const next = new URLSearchParams(searchParams);
                if (draftQ.trim()) next.set("q", draftQ.trim());
                else next.delete("q");
                setSearchParams(next);
              }
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={category || "all"}
            onValueChange={(v) => {
              const next = new URLSearchParams(searchParams);
              if (v === "all") next.delete("category");
              else next.set("category", v);
              setSearchParams(next);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(meta.data?.categories || []).map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canManage ? (
            <Select
              value={status || "all"}
              onValueChange={(v) => {
                const next = new URLSearchParams(searchParams);
                if (v === "all") next.delete("status");
                else next.set("status", v);
                setSearchParams(next);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              if (draftQ.trim()) next.set("q", draftQ.trim());
              else next.delete("q");
              setSearchParams(next);
            }}
          >
            Search
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="space-y-4">
          {canCreate ? (
            <>
              <Empty
                title="No Knowledge Base articles have been added yet."
                body="Add internal onboarding and reference material your team can use during live support."
              />
              {!readOnly ? (
                <Button asChild>
                  <Link to="/knowledge-base/new">Add First Article</Link>
                </Button>
              ) : null}
            </>
          ) : (
            <Empty title="Knowledge Base articles will appear here once they have been added." body="" />
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {grouped.map(([cat, articles]) => (
            <section key={cat}>
              <h2 className="mb-3 text-lg font-semibold text-foreground">{cat}</h2>
              <ul className="space-y-2">
                {articles.map((article) => (
                  <li key={article.id}>
                    <Link
                      to={`/knowledge-base/${article.id}`}
                      className="flex items-start gap-3 rounded-xl border border-border bg-card shadow-[var(--shadow-card)] px-4 py-3 hover:border-primary/30 hover:bg-primary/5"
                    >
                      <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">{article.title}</p>
                          {canManage ? <StatusBadge status={article.status} /> : null}
                        </div>
                        {article.contentPreview ? (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{article.contentPreview}</p>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function KnowledgeBaseDetailPage() {
  const { id } = useParams();
  const { canMutate, readOnly, can } = useAuth();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["knowledge-base", id],
    queryFn: () => api<{ item: KbArticle }>(`/api/knowledge-base/${id}`),
    enabled: Boolean(id),
  });

  const statusChange = useMutation({
    mutationFn: (status: string) =>
      api<{ item: KbArticle }>(`/api/knowledge-base/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      toast.success("Status updated");
      void query.refetch();
      void client.invalidateQueries({ queryKey: ["knowledge-base"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (!id) return <Navigate to="/knowledge-base" replace />;
  if (query.isLoading) return <LoadingBlock />;
  if (query.isError) return <ErrorBlock message={query.error.message} />;
  const item = query.data!.item;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <Link to="/knowledge-base" className="text-sm text-primary">
        ← Knowledge Base
      </Link>
      <header className="space-y-2 border-b border-border pb-6">
        <p className="text-sm font-medium text-primary">{item.category}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{item.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {can("knowledge_base.manage") ? <StatusBadge status={item.status} /> : null}
          <span>Updated {formatWhen(item.updatedAt)}</span>
          {item.updatedByName ? <span>· {item.updatedByName}</span> : null}
        </div>
        {item.actions.edit && canMutate("knowledge_base.edit") && !readOnly ? (
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link to={`/knowledge-base/${item.id}/edit`}>Edit</Link>
          </Button>
        ) : null}
        <div className="mt-2">
          <ReportIssueButton
            source={{
              sourceType: "knowledge_base",
              sourceId: item.id,
              sourceTypeLabel: "Knowledge Base",
              sourceLabel: item.title,
            }}
          />
        </div>
      </header>

      {item.actions.manageStatus && canMutate("knowledge_base.manage") && !readOnly ? (
        <div className="flex flex-wrap gap-2">
          {item.status !== "Needs Update" ? (
            <Button size="sm" variant="secondary" onClick={() => statusChange.mutate("Needs Update")}>
              Mark needs update
            </Button>
          ) : null}
          {item.status !== "Archived" ? (
            <Button size="sm" variant="secondary" onClick={() => statusChange.mutate("Archived")}>
              Archive
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => statusChange.mutate("Active")}>
              Restore to Active
            </Button>
          )}
        </div>
      ) : null}

      <KnowledgeBaseContent html={item.contentHtml} />

      {item.relatedLinks.length > 0 ? (
        <section className="rounded-xl border border-border bg-muted/40/50 p-4">
          <h2 className="text-sm font-semibold text-foreground">Related links</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {item.relatedLinks.map((link) => (
              <li key={link.id || link.url}>
                <a href={link.url} target="_blank" rel="noreferrer" className="text-primary underline">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function KnowledgeBaseFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canMutate, readOnly } = useAuth();
  const client = useQueryClient();
  const isEdit = Boolean(id);

  const meta = useQuery({ queryKey: ["kb-meta"], queryFn: () => api<{ categories: string[] }>("/api/knowledge-base/meta") });
  const existing = useQuery({
    queryKey: ["knowledge-base", id],
    queryFn: () => api<{ item: KbArticle }>(`/api/knowledge-base/${id}`),
    enabled: isEdit,
  });

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [links, setLinks] = useState<{ label: string; url: string }[]>([{ label: "", url: "" }]);
  const [status, setStatus] = useState<string>("Active");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isEdit || !existing.data || loaded) return;
    const item = existing.data.item;
    setTitle(item.title);
    setCategory(item.category);
    setContentHtml(item.contentHtml);
    setLinks(item.relatedLinks.length ? item.relatedLinks.map((l) => ({ label: l.label, url: l.url })) : [{ label: "", url: "" }]);
    setStatus(item.status);
    setLoaded(true);
  }, [isEdit, existing.data, loaded]);

  const save = useMutation({
    mutationFn: () => {
      const relatedLinks = links.filter((l) => l.label.trim() && l.url.trim());
      const body = { title, category, contentHtml, relatedLinks, status: canMutate("knowledge_base.manage") ? status : undefined };
      if (isEdit) {
        return api<{ item: KbArticle }>(`/api/knowledge-base/${id}`, { method: "PUT", body: JSON.stringify(body) });
      }
      return api<{ item: KbArticle }>("/api/knowledge-base", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: (data) => {
      toast.success(isEdit ? "Article saved" : "Article created");
      void client.invalidateQueries({ queryKey: ["knowledge-base"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      navigate(`/knowledge-base/${data.item.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  if (readOnly) return <ErrorBlock message="View As is read-only." />;
  if (!canMutate("knowledge_base.create") && !isEdit) return <Navigate to="/knowledge-base" replace />;
  if (isEdit && !canMutate("knowledge_base.edit")) return <Navigate to="/knowledge-base" replace />;
  if (meta.isLoading || (isEdit && existing.isLoading)) return <LoadingBlock />;

  const categories = meta.data?.categories || [];
  const canManage = canMutate("knowledge_base.manage");

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <PageHeader eyebrow="Knowledge Base" title={isEdit ? "Edit article" : "New article"} />
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Choose category" />
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
          {canManage ? (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label>Content</Label>
          <KnowledgeBaseEditor value={contentHtml} onChange={setContentHtml} />
        </div>
        <div className="space-y-2">
          <Label>Related links (optional)</Label>
          {links.map((link, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="Label"
                value={link.label}
                onChange={(e) => {
                  const next = [...links];
                  next[i] = { ...next[i], label: e.target.value };
                  setLinks(next);
                }}
              />
              <Input
                placeholder="https://…"
                value={link.url}
                onChange={(e) => {
                  const next = [...links];
                  next[i] = { ...next[i], url: e.target.value };
                  setLinks(next);
                }}
              />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setLinks([...links, { label: "", url: "" }])}>
            Add link
          </Button>
        </div>
        <Button disabled={save.isPending || title.length < 3 || !category} onClick={() => save.mutate()}>
          {isEdit ? "Save changes" : "Create article"}
        </Button>
      </div>
    </div>
  );
}
