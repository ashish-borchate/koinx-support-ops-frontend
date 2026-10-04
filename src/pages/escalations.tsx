import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Empty, ErrorBlock, LoadingBlock, PageHeader, PriorityBadge, StatusBadge } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatWhen } from "@/lib/format";

const priorities = ["Low", "Medium", "High", "Critical"];
const statuses = ["Open", "Investigating", "Waiting on product", "Waiting on user", "Resolved", "Closed"];

type Item = {
  id: string;
  ticketRef: string;
  title: string;
  problem: string;
  category: string;
  priority: string;
  assigneeId: string;
  assignee: string;
  productOwner: string;
  product: string;
  status: string;
  resolution: string;
  rootCause: string;
  followUp: string;
  updatedAt: string;
};

const blank: Omit<Item, "id" | "assignee" | "updatedAt"> = {
  ticketRef: "",
  title: "",
  problem: "",
  category: "Data mismatch",
  priority: "High",
  assigneeId: "",
  productOwner: "",
  product: "",
  status: "Open",
  resolution: "",
  rootCause: "",
  followUp: "",
};

export function EscalationsPage() {
  const { canMutate } = useAuth();
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (priority !== "all") params.set("priority", priority);
  const query = useQuery({
    queryKey: ["escalations", status, priority],
    queryFn: () => api<{ escalations: Item[] }>(`/api/escalations?${params.toString()}`),
  });
  return (
    <div>
      <PageHeader
        eyebrow="Follow-up"
        title="Escalations"
        action={canMutate("escalations.edit") ? <Button onClick={() => setEditing("new")}>New escalation</Button> : null}
      />
      <div className="mb-4 flex gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {priorities.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {query.isLoading ? <LoadingBlock /> : null}
      {query.isError ? <ErrorBlock message={query.error.message} /> : null}
      {query.data?.escalations.length === 0 ? <Empty title="No escalations in this filter" body="Open ones are the queue. Resolved ones stay here so the root cause is not lost." /> : null}
      <div className="grid gap-3">
        {query.data?.escalations.map((item) => (
          <button key={item.id} className="rounded-2xl border bg-card px-4 py-3 text-left hover:border-primary" onClick={() => canMutate("escalations.edit") && setEditing(item)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{item.ticketRef} · {item.title}</p>
              <div className="flex gap-2"><PriorityBadge value={item.priority} /><StatusBadge value={item.status} /></div>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{item.problem}</p>
            <p className="mt-2 text-xs text-muted-foreground">{item.product || item.category} · {item.assignee || "Unassigned"} · {item.productOwner ? `product ${item.productOwner}` : "no product owner"} · {formatWhen(item.updatedAt)}</p>
          </button>
        ))}
      </div>
      {editing ? <EscalationDialog item={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function EscalationDialog({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const client = useQueryClient();
  const people = useQuery({ queryKey: ["users"], queryFn: () => api<{ users: { id: string; name: string }[] }>("/api/users") });
  const [form, setForm] = useState({ ...blank, ...item });
  const save = useMutation({
    mutationFn: () =>
      api(item ? `/api/escalations/${item.id}` : "/api/escalations", {
        method: item ? "PUT" : "POST",
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      toast.success("Escalation saved");
      void client.invalidateQueries({ queryKey: ["escalations"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{item ? "Update escalation" : "New escalation"}</DialogTitle></DialogHeader>
        <div className="grid gap-2">
          <Label>Ticket</Label><Input value={form.ticketRef} onChange={(event) => set("ticketRef", event.target.value)} />
          <Label>Title</Label><Input value={form.title} onChange={(event) => set("title", event.target.value)} />
          <Label>Problem</Label><Textarea value={form.problem} onChange={(event) => set("problem", event.target.value)} />
          <Label>Category</Label><Input value={form.category} onChange={(event) => set("category", event.target.value)} />
          <Label>Product</Label><Input value={form.product} onChange={(event) => set("product", event.target.value)} />
          <Label>Product owner</Label><Input value={form.productOwner} onChange={(event) => set("productOwner", event.target.value)} />
          <Label>Priority</Label>
          <Select value={form.priority} onValueChange={(value) => set("priority", value)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{priorities.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
          </Select>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(value) => set("status", value)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{statuses.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
          </Select>
          <Label>Assignee</Label>
          <Select value={form.assigneeId || "none"} onValueChange={(value) => set("assigneeId", value === "none" ? "" : value)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {people.data?.users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Label>Root cause</Label><Textarea value={form.rootCause} onChange={(event) => set("rootCause", event.target.value)} />
          <Label>Resolution</Label><Textarea value={form.resolution} onChange={(event) => set("resolution", event.target.value)} />
          <Label>Follow-up</Label><Textarea value={form.followUp} onChange={(event) => set("followUp", event.target.value)} />
        </div>
        <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
