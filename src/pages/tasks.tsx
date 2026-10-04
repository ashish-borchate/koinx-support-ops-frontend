import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Empty, ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const statuses = ["Open", "In Progress", "Blocked", "Done"] as const;
type Status = (typeof statuses)[number];

type Task = {
  id: string;
  title: string;
  ownerId: string;
  owner: string;
  frequency: string;
  dueDate: string;
  status: Status;
  notes: string;
};

export function TasksPage() {
  const { canMutate, effective } = useAuth();
  const client = useQueryClient();
  const [creating, setCreating] = useState(false);
  const query = useQuery({ queryKey: ["tasks"], queryFn: () => api<{ tasks: Task[] }>("/api/tasks") });
  const update = useMutation({
    mutationFn: (task: Task) => api(`/api/tasks/${task.id}`, { method: "PUT", body: JSON.stringify(task) }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["tasks"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <div>
      <PageHeader eyebrow="Operations" title="Tasks" action={canMutate("tasks.edit") ? <Button onClick={() => setCreating(true)}>New task</Button> : null} />
      {query.isLoading ? <LoadingBlock /> : null}
      {query.isError ? <ErrorBlock message={query.error.message} /> : null}
      {query.data?.tasks.length === 0 ? <Empty title="The board is clear" body="Recurring support work can live here instead of a side spreadsheet." /> : null}
      <div className="grid gap-3 lg:grid-cols-4">
        {statuses.map((status) => (
          <section key={status} className="rounded-2xl bg-muted/60 p-3">
            <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{status}</p>
            <div className="space-y-2">
              {(query.data?.tasks || []).filter((task) => task.status === status).map((task) => {
                const editable = canMutate("tasks.edit") || (canMutate("tasks.update_own") && task.ownerId === effective?.id);
                return (
                  <article key={task.id} className="rounded-xl bg-card px-3 py-2 text-sm shadow-sm">
                    <p className="font-medium">{task.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{task.owner || "Unassigned"} · {task.frequency}{task.dueDate ? ` · due ${task.dueDate}` : ""}</p>
                    {task.notes ? <p className="mt-1 text-xs">{task.notes}</p> : null}
                    {editable ? (
                      <Select value={task.status} onValueChange={(value) => update.mutate({ ...task, status: value as Status })}>
                        <SelectTrigger className="mt-2 w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>{statuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {creating ? <TaskDialog onClose={() => setCreating(false)} /> : null}
    </div>
  );
}

function TaskDialog({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const people = useQuery({ queryKey: ["users"], queryFn: () => api<{ users: { id: string; name: string }[] }>("/api/users") });
  const [title, setTitle] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [frequency, setFrequency] = useState("Weekly");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const save = useMutation({
    mutationFn: () => api("/api/tasks", { method: "POST", body: JSON.stringify({ title, ownerId, frequency, dueDate, status: "Open", notes }) }),
    onSuccess: () => {
      toast.success("Task created");
      void client.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
        <div className="grid gap-2">
          <Label>Task</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} />
          <Label>Owner</Label>
          <Select value={ownerId || "none"} onValueChange={(value) => setOwnerId(value === "none" ? "" : value)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {people.data?.users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Label>Frequency</Label>
          <Select value={frequency} onValueChange={setFrequency}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{["Once", "Daily", "Weekly", "Monthly"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
          <Label>Due date</Label><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          <Label>Notes</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
