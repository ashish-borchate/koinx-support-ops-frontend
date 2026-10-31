import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const PASSWORD_REQUIREMENTS = "At least 8 characters, at most 72, and include both a letter and a number.";

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

function validatePasswordClient(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (password.length > 72) return "Password must be 72 characters or fewer";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Password must include a letter and a number";
  return null;
}

export function PeoplePage() {
  const { canMutate, user: actor } = useAuth();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [fallbackPassword, setFallbackPassword] = useState<UserRow | null>(null);
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
  const resendInvite = useMutation({
    mutationFn: (person: UserRow) => api<{ devInvitePath?: string }>(`/api/users/${person.id}/resend-invite`, { method: "POST" }),
    onSuccess: (data) => {
      if (data?.devInvitePath) toast.success(`Invite resent. Dev link: ${data.devInvitePath}`);
      else toast.success("Invitation resent");
      void client.invalidateQueries({ queryKey: ["users-admin"] });
    },
    onError: (error) => toast.error(error.message),
  });
  const assignable = new Set((roles.data?.roles || []).filter((role) => role.assignable).map((role) => role.key));
  const visibleUsers = users.data?.users.filter((person) => showArchived || person.active) ?? [];
  const userGroups = groupUsersByRole(visibleUsers);

  function renderUserRow(person: UserRow) {
    const manageable = canMutate("users.manage") && assignable.has(person.roleKey) && person.id !== actor?.id;
    const canResetPassword = canMutate("users.reset_password") && manageable;
    return (
      <tr key={person.id} className="border-t border-border align-middle">
        <td className="max-w-[12rem] px-3 py-2 font-medium">{person.name}</td>
        <td className="min-w-[10rem] max-w-xs break-words px-3 py-2 text-muted-foreground">{person.email}</td>
        <td className="whitespace-nowrap px-3 py-2">{person.roleName}</td>
        <td className="whitespace-nowrap px-3 py-2">{person.active ? "Active" : "Archived"}</td>
        <td className="whitespace-nowrap px-3 py-2">
          {!person.active ? "—" : person.emailVerified ? "Activated" : "Invite pending"}
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{person.createdAt ? formatWhen(person.createdAt) : "—"}</td>
        <td className="w-px whitespace-nowrap px-2 py-2 text-right">
          {manageable || canResetPassword ? (
            <UserActionsMenu
              person={person}
              manageable={manageable}
              canResetPassword={canResetPassword}
              onEdit={() => setEditing(person)}
              onToggleArchive={() => toggle.mutate(person)}
              onSendResetLink={() => setResetting(person)}
              onSetFallbackPassword={() => setFallbackPassword(person)}
              onResendInvite={() => resendInvite.mutate(person)}
              resendPending={resendInvite.isPending}
              onDelete={() => setDeleting(person)}
            />
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
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <thead className="border-b border-border text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Access</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {userGroups.map((group) => (
              <Fragment key={group.roleKey}>
                <tr className="border-t border-border bg-muted/40">
                  <td colSpan={7} className="px-3 py-1.5">
                    <span className="text-xs font-semibold tracking-wide text-primary uppercase">{group.roleName}</span>
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      · {group.users.length} {group.users.length === 1 ? "person" : "people"}
                    </span>
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
      {resetting ? <ResetPasswordEmail person={resetting} onClose={() => setResetting(null)} /> : null}
      {fallbackPassword ? <SetFallbackPassword person={fallbackPassword} onClose={() => setFallbackPassword(null)} /> : null}
      {deleting ? <DeleteUser person={deleting} onClose={() => setDeleting(null)} /> : null}
    </div>
  );
}

function UserActionsMenu({
  person,
  manageable,
  canResetPassword,
  onEdit,
  onToggleArchive,
  onSendResetLink,
  onSetFallbackPassword,
  onResendInvite,
  resendPending,
  onDelete,
}: {
  person: UserRow;
  manageable: boolean;
  canResetPassword: boolean;
  onEdit: () => void;
  onToggleArchive: () => void;
  onSendResetLink: () => void;
  onSetFallbackPassword: () => void;
  onResendInvite: () => void;
  resendPending: boolean;
  onDelete: () => void;
}) {
  const showResend = manageable && person.active && !person.emailVerified;
  const showResetLink = canResetPassword && person.active && person.emailVerified;
  const showFallback = canResetPassword && person.active;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 px-2">
          Actions
          <MoreHorizontal className="size-4 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-[12rem]">
        {manageable ? (
          <>
            <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
            <DropdownMenuItem onSelect={onToggleArchive}>{person.active ? "Archive" : "Restore"}</DropdownMenuItem>
          </>
        ) : null}
        {showResend ? (
          <DropdownMenuItem onSelect={onResendInvite} disabled={resendPending}>
            Resend invite
          </DropdownMenuItem>
        ) : null}
        {showResetLink ? <DropdownMenuItem onSelect={onSendResetLink}>Send reset link</DropdownMenuItem> : null}
        {showFallback ? (
          <DropdownMenuItem onSelect={onSetFallbackPassword}>Set / Reset fallback password</DropdownMenuItem>
        ) : null}
        {manageable ? (
          <>
            {(showResend || showResetLink || showFallback) ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
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

function ResetPasswordEmail({ person, onClose }: { person: UserRow; onClose: () => void }) {
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
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Send email</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SetFallbackPassword({ person, onClose }: { person: UserRow; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmedReplace, setConfirmedReplace] = useState(false);
  const [fieldError, setFieldError] = useState("");

  const save = useMutation({
    mutationFn: () => api(`/api/users/${person.id}/password`, { method: "POST", body: JSON.stringify({ password }) }),
    onSuccess: () => {
      toast.success("Fallback password updated");
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  function submit() {
    setFieldError("");
    const problem = validatePasswordClient(password);
    if (problem) {
      setFieldError(problem);
      return;
    }
    if (password !== confirm) {
      setFieldError("Password and confirmation do not match");
      return;
    }
    if (!confirmedReplace) {
      setFieldError("Confirm that you want to replace the current fallback password");
      return;
    }
    save.mutate();
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set / Reset fallback password</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <p className="font-medium text-foreground">{person.name}</p>
            <p className="break-all text-muted-foreground">{person.email}</p>
          </div>
          {!person.emailVerified ? (
            <p className="text-muted-foreground">
              This account is not activated yet. You can set a fallback password now, but email and password sign-in will only work after the employee activates their account (invitation link or first Google sign-in).
            </p>
          ) : null}
          <p className="text-muted-foreground">
            This replaces any existing fallback password immediately. Share the new password with the employee through a secure channel — it is never shown here again.
          </p>
          <div className="space-y-2">
            <Label htmlFor="fallback-new">New password</Label>
            <div className="relative">
              <Input
                id="fallback-new"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fallback-confirm">Confirm password</Label>
            <Input
              id="fallback-confirm"
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <p className="text-xs text-muted-foreground">{PASSWORD_REQUIREMENTS}</p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={confirmedReplace}
              onChange={(e) => setConfirmedReplace(e.target.checked)}
            />
            <span>I confirm this will replace the employee&apos;s current fallback password (if any).</span>
          </label>
          {fieldError ? <p className="text-destructive">{fieldError}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
