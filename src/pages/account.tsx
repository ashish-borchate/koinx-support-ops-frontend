import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function ProfilePage() {
  const { effective, readOnly } = useAuth();
  if (!effective) return null;
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader eyebrow="Account" title="Profile" />
      <Card>
        <CardHeader>
          <CardTitle>{effective.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-slate-500">Role</p>
            <p className="font-medium text-slate-900">{effective.roleName}</p>
          </div>
          <div>
            <p className="text-slate-500">Email</p>
            <p className="font-medium text-slate-900">{effective.email}</p>
          </div>
          <div>
            <p className="text-slate-500">Title</p>
            <p className="font-medium text-slate-900">{effective.title || effective.roleName}</p>
          </div>
          {readOnly ? <p className="text-slate-500">This profile is shown in read-only View As mode.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

export function PasswordPage() {
  const { readOnly } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const save = useMutation({
    mutationFn: () =>
      api("/api/account/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      }),
    onSuccess: () => {
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader eyebrow="Account" title="Change password" />
      {readOnly ? (
        <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">Password changes are unavailable while you are viewing as someone else.</p>
      ) : (
        <form
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="current">Current password</Label>
            <Input id="current" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="next">New password</Label>
            <Input id="next" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" required />
            <p className="text-xs text-slate-500">At least 8 characters, with a letter and a number.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input id="confirm" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required />
          </div>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Update password"}
          </Button>
        </form>
      )}
    </div>
  );
}

type Candidate = { id: string; name: string; roleName: string; title: string };

export function ViewAsPage() {
  const { can, startViewAs, readOnly } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["view-as-candidates"],
    queryFn: () => api<{ users: Candidate[] }>("/api/view-as/candidates"),
    enabled: can("view_as") && !readOnly,
  });

  async function choose(id: string) {
    setPending(id);
    setError("");
    try {
      await startViewAs(id);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start View As");
    } finally {
      setPending("");
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Account" title="View as" />
      <p className="mb-4 text-sm text-slate-600">See another person's dashboard and navigation. Nothing can be changed until you exit.</p>
      {readOnly ? <p className="text-sm text-slate-600">Exit the current view before choosing someone else.</p> : null}
      {error ? <p className="mb-3 text-sm text-rose-700">{error}</p> : null}
      {query.isLoading ? <p className="text-sm text-slate-500">Loading people…</p> : null}
      <div className="divide-y rounded-2xl border border-slate-200 bg-white">
        {(query.data?.users || []).map((person) => (
          <button
            key={person.id}
            type="button"
            disabled={readOnly || pending === person.id}
            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 disabled:opacity-60"
            onClick={() => void choose(person.id)}
          >
            <span>
              <span className="block text-sm font-medium text-slate-900">{person.name}</span>
              <span className="block text-xs text-slate-500">{person.roleName}</span>
            </span>
            <span className="text-sm text-blue-700">{pending === person.id ? "Opening…" : "View"}</span>
          </button>
        ))}
        {query.data && query.data.users.length === 0 ? <p className="px-4 py-8 text-sm text-slate-500">No one is available to view.</p> : null}
      </div>
    </div>
  );
}

