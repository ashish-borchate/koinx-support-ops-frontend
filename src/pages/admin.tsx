import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatWhen } from "@/lib/format";

type UserRow = { id: string; name: string; email?: string; roleKey: string; roleName: string; title: string; active: boolean; createdAt?: string };
type Role = { key: string; name: string; description: string; assignable: boolean };

export function PeoplePage() {
  const { canMutate, user: actor } = useAuth();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [showArchived, setShowArchived] = useState(true);
  const users = useQuery({ queryKey: ["users-admin"], queryFn: () => api<{ users: UserRow[] }>("/api/users") });
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => api<{ roles: Role[] }>("/api/roles"), enabled: canMutate("users.manage") });
  const toggle = useMutation({
    mutationFn: (person: UserRow) => api(`/api/users/${person.id}`, { method: "PATCH", body: JSON.stringify({ active: !person.active }) }),
    onSuccess: (_, person) => {
      toast.success(person.active ? "User archived" : "User restored");
      void client.invalidateQueries({ queryKey: ["users-admin"] });
    },
    onError: (error) => toast.error(error.message),
  });
  const assignable = new Set((roles.data?.roles || []).filter((role) => role.assignable).map((role) => role.key));
  const visibleUsers =
    users.data?.users.filter((person) => showArchived || person.active) ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Management"
        title="Users"
        action={
          canMutate("users.manage") ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                Show archived
              </label>
              <Button onClick={() => setOpen(true)}>Add user</Button>
            </div>
          ) : null
        }
      />
      {users.isLoading ? <LoadingBlock /> : null}
      {users.isError ? <ErrorBlock message={users.error.message} /> : null}
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-3 py-3 font-medium">Email</th>
              <th className="px-3 py-3 font-medium">Role</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Created</th>
              <th className="px-3 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((person) => {
              const manageable = canMutate("users.manage") && assignable.has(person.roleKey) && person.id !== actor?.id;
              return (
                <tr key={person.id} className="border-t">
                  <td className="px-4 py-3">
                    <p className="font-medium">{person.name}</p>
                    <p className="text-xs text-muted-foreground">{person.title}</p>
                  </td>
                  <td className="px-3 py-3">{person.email}</td>
                  <td className="px-3 py-3">{person.roleName}</td>
                  <td className="px-3 py-3">{person.active ? "Active" : "Archived"}</td>
                  <td className="px-3 py-3">{person.createdAt ? formatWhen(person.createdAt) : "—"}</td>
                  <td className="px-3 py-3">
                    {manageable ? (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditing(person)}>Edit</Button>
                        <Button variant="outline" size="sm" onClick={() => toggle.mutate(person)}>{person.active ? "Archive" : "Restore"}</Button>
                        {canMutate("users.reset_password") ? <Button variant="outline" size="sm" onClick={() => setResetting(person)}>Reset password</Button> : null}
                        <Button variant="outline" size="sm" className="text-rose-700" onClick={() => setDeleting(person)}>Delete</Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open && roles.data ? <UserDialog roles={roles.data.roles.filter((role) => role.assignable)} onClose={() => setOpen(false)} /> : null}
      {editing && roles.data ? <UserDialog roles={roles.data.roles.filter((role) => role.assignable)} person={editing} onClose={() => setEditing(null)} /> : null}
      {resetting ? <ResetPassword person={resetting} onClose={() => setResetting(null)} /> : null}
      {deleting ? <DeleteUser person={deleting} onClose={() => setDeleting(null)} /> : null}
    </div>
  );
}

function UserDialog({ roles, person, onClose }: { roles: Role[]; person?: UserRow; onClose: () => void }) {
  const client = useQueryClient();
  const [name, setName] = useState(person?.name || "");
  const [email, setEmail] = useState(person?.email || "");
  const [roleKey, setRoleKey] = useState(person?.roleKey || roles.find((role) => role.key === "agent")?.key || roles[0]?.key || "");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(person?.active ?? true);
  const save = useMutation({
    mutationFn: () => {
      if (person) {
        return api(`/api/users/${person.id}`, { method: "PATCH", body: JSON.stringify({ name, email, roleKey, active }) });
      }
      return api("/api/users", { method: "POST", body: JSON.stringify({ name, email, roleKey, password, active }) });
    },
    onSuccess: () => {
      toast.success(person ? "User updated" : "User added");
      void client.invalidateQueries({ queryKey: ["users-admin"] });
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{person ? "Edit user" : "Add user"}</DialogTitle></DialogHeader>
        <div className="grid gap-2">
          <Label>Full name</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Label>Role</Label>
          <Select value={roleKey} onValueChange={setRoleKey}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{roles.map((role) => <SelectItem key={role.key} value={role.key}>{role.name}</SelectItem>)}</SelectContent>
          </Select>
          {person ? null : (
            <>
              <Label>Temporary password</Label>
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
            </>
          )}
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
            Active (uncheck to archive — they cannot sign in)
          </label>
        </div>
        <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>{person ? "Save" : "Create"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUser({ person, onClose }: { person: UserRow; onClose: () => void }) {
  const client = useQueryClient();
  const [confirmEmail, setConfirmEmail] = useState("");
  const remove = useMutation({
    mutationFn: () => api(`/api/users/${person.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("User deleted");
      void client.invalidateQueries({ queryKey: ["users-admin"] });
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });
  const emailOk = confirmEmail.trim().toLowerCase() === (person.email || "").toLowerCase();
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Delete {person.name}?</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          This permanently removes the account. Their KPI, legacy task ownership, and assignments are moved to other team members where needed. Prefer <strong>Archive</strong> if they may return.
        </p>
        <div className="grid gap-2">
          <Label>Type {person.email} to confirm</Label>
          <Input value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} autoComplete="off" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={() => remove.mutate()} disabled={!emailOk || remove.isPending}>
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPassword({ person, onClose }: { person: UserRow; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const save = useMutation({
    mutationFn: () => {
      if (password !== confirm) throw new Error("New password and confirmation do not match");
      return api(`/api/users/${person.id}/password`, { method: "POST", body: JSON.stringify({ password }) });
    },
    onSuccess: () => {
      toast.success("Password reset");
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Reset password for {person.name}</DialogTitle></DialogHeader>
        <div className="grid gap-2">
          <Label>New password</Label>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
          <Label>Confirm password</Label>
          <Input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" />
        </div>
        <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>Reset password</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
