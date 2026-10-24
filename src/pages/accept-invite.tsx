import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function AcceptInvitePage() {
  const { user, login } = useAuth();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [validating, setValidating] = useState(true);

  useEffect(() => {
    if (!token) {
      setValidating(false);
      setError("Invitation link is missing or invalid.");
      return;
    }
    void api<{ email: string }>(`/api/auth/invite/validate?token=${encodeURIComponent(token)}`)
      .then((data) => setEmail(data.email))
      .catch((err) => setError(err instanceof Error ? err.message : "Invitation link is invalid or expired"))
      .finally(() => setValidating(false));
  }, [token]);

  if (user) return <Navigate to="/" replace />;

  async function submit() {
    setPending(true);
    setError("");
    try {
      await api("/api/auth/accept-invite", {
        method: "POST",
        body: JSON.stringify({ token, password, confirmPassword: confirm }),
      });
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not activate account");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-6 py-12">
      <form
        className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h1 className="text-2xl font-semibold">Activate your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Set a password to finish joining KoinX Support Operations.</p>
        {validating ? <p className="mt-4 text-sm text-muted-foreground">Checking invitation…</p> : null}
        {!validating && email ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Email: <span className="font-medium text-foreground">{email}</span>
          </p>
        ) : null}
        <div className="mt-6 space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        </div>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="mt-6 w-full" disabled={pending || validating || !token || !email}>
          {pending ? "Activating…" : "Activate and sign in"}
        </Button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link to="/login">Back to sign in</Link>
        </p>
      </form>
    </div>
  );
}
