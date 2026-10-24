import { Fragment, useState } from "react";
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

type UserRow = {
  id: string;
  name: string;
  email?: string;
  roleKey: string;
  roleName: string;
  title: string;
  active: boolean;
  emailVerified?: boolean;
  createdAt?: string;
};
type Role = { key: string; name: string; description: string; assignable: boolean };

const ROLE_SECTION_ORDER = ["admin", "supervisor", "senior_agent", "agent", "tech_agent"] as const;

function roleSectionIndex(roleKey: string) {
  const index = ROLE_SECTION_ORDER.indexOf(roleKey as (typeof ROLE_SECTION_ORDER)[number]);
  return index === -1 ? ROLE_SECTION_ORDER.length : index;
}

function groupUsersByRole(users: UserRow[]) {
  const byRole = new Map<string, UserRow[]>();
  for (const person of users) {
    const bucket = byRole.get(person.roleKey) ?? [];
    bucket.push(person);
    byRole.set(person.roleKey, bucket);
  }

  const groups: { roleKey: string; roleName: string; users: UserRow[] }[] = [];
  for (const roleKey of ROLE_SECTION_ORDER) {
    const members = byRole.get(roleKey);
    if (!members?.length) continue;
    members.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    groups.push({ roleKey, roleName: members[0]?.roleName || roleKey, users: members });
    byRole.delete(roleKey);
  }

  const unknown = [...byRole.entries()].sort(([a], [b]) => roleSectionIndex(a) - roleSectionIndex(b) || a.localeCompare(b));
  for (const [roleKey, members] of unknown) {
    members.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    groups.push({ roleKey, roleName: members[0]?.roleName || roleKey, users: members });
  }

  return groups;
}

function sortRolesForSelect(roles: Role[]) {
  return [...roles].sort((a, b) => roleSectionIndex(a.key) - roleSectionIndex(b.key) || a.name.localeCompare(b.name));
}

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
  const visibleUsers = users.data?.users.filter((person) => showArchived || person.active) ?? [];
  const userGroups = groupUsersByRole(visibleUsers);

  function renderUserRow(person: UserRow) {
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
        <td className="px-3 py-3">
          {!person.active ? "—" : person.emailVerified ? "Activated" : "Invite pending"}
        </td>
        <td className="px-3 py-3">{person.createdAt ? formatWhen(person.createdAt) : "—"}</td>
        <td className="px-3 py-3">
          {manageable ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(person)}>Edit</Button>
              <Button variant="outline" size="sm" onClick={() => toggle.mutate(person)}>{person.active ? "Archive" : "Restore"}</Button>
              {canMutate("users.reset_password") ? <Button variant="outline" size="sm" onClick={() => setResetting(person)}>Send reset link</Button> : null}
              {canMutate("users.manage") && person.active && !person.emailVerified ? <ResendInviteButton person={person} /> : null}
              <Button variant="outline" size="sm" className="text-rose-700" onClick={() => setDeleting(person)}>Delete</Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
      </tr>
    );
  }

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
              <Button onClick={() => setOpen(true)}>Invite employee</Button>
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
              <th className="px-3 py-3 font-medium">Access</th>
              <th className="px-3 py-3 font-medium">Created</th>
              <th className="px-3 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {userGroups.map((group) => (
              <Fragment key={group.roleKey}>
                <tr className="border-t bg-muted/30">
                  <td colSpan={7} className="px-4 py-2.5">
                    <p className="text-xs font-semibold tracking-wide text-primary uppercase">{group.roleName}</p>
                    <p className="text-[11px] text-muted-foreground">{group.users.length} {group.users.length === 1 ? "person" : "people"}</p>
                  </td>
                </tr>
                {group.users.map((person) => renderUserRow(person))}
              </Fragment>
            ))}
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
  const [active, setActive] = useState(person?.active ?? true);
  const save = useMutation({
    mutationFn: async () => {
      if (person) {
        await api(`/api/users/${person.id}`, { method: "PATCH", body: JSON.stringify({ name, email, roleKey, active }) });
        return null;
      }
      return api<{ devInvitePath?: string; delivery?: string }>("/api/users", { method: "POST", body: JSON.stringify({ name, email, roleKey, active }) });
    },
    onSuccess: (data) => {
      if (person) toast.success("User updated");
      else if (data?.devInvitePath) toast.success(`Invitation created. Dev link: ${data.devInvitePath}`);
      else if (data?.delivery === "google") toast.success("Employee added. They can sign in with Google using this email.");
      else toast.success("Invitation email sent");
      void client.invalidateQueries({ queryKey: ["users-admin"] });
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{person ? "Edit user" : "Invite employee"}</DialogTitle></DialogHeader>
        <div className="grid gap-2">
          <Label>Full name</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Label>Role</Label>
          <Select value={roleKey} onValueChange={setRoleKey}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{sortRolesForSelect(roles).map((role) => <SelectItem key={role.key} value={role.key}>{role.name}</SelectItem>)}</SelectContent>
          </Select>
          {person ? null : (
            <p className="text-sm text-muted-foreground">
              If email delivery is configured, we send a password activation link. Otherwise the employee signs in with Google using this
              exact email address.
            </p>
          )}
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
            Active (uncheck to archive — they cannot sign in)
          </label>
        </div>
        <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>{person ? "Save" : "Send invitation"}</Button></DialogFooter>
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

function ResendInviteButton({ person }: { person: UserRow }) {
  const client = useQueryClient();
  const resend = useMutation({
    mutationFn: () => api<{ devInvitePath?: string }>(`/api/users/${person.id}/resend-invite`, { method: "POST" }),
    onSuccess: (data) => {
      if (data?.devInvitePath) toast.success(`Invite resent. Dev link: ${data.devInvitePath}`);
      else toast.success("Invitation resent");
      void client.invalidateQueries({ queryKey: ["users-admin"] });
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Button variant="outline" size="sm" onClick={() => resend.mutate()} disabled={resend.isPending}>
      Resend invite
    </Button>
  );
}

function ResetPassword({ person, onClose }: { person: UserRow; onClose: () => void }) {
  const save = useMutation({
    mutationFn: () => api<{ devResetPath?: string }>(`/api/users/${person.id}/send-password-reset`, { method: "POST" }),
    onSuccess: (data) => {
      if (data?.devResetPath) toast.success(`Reset link created. Dev link: ${data.devResetPath}`);
      else toast.success("Password reset email sent");
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Send password reset for {person.name}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          A single-use link will be emailed to <strong>{person.email}</strong>. It expires after a short time.
        </p>
        <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>Send email</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
