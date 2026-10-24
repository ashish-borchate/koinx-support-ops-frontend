import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setError("");
    try {
      await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
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
        <h1 className="text-2xl font-semibold">Forgot password</h1>
        <p className="mt-1 text-sm text-muted-foreground">We will email a reset link if this address belongs to an active employee account.</p>
        {sent ? (
          <p className="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
            If an account exists for that email, a reset link is on its way.
          </p>
        ) : (
          <div className="mt-6 space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          </div>
        )}
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        {!sent ? (
          <Button type="submit" className="mt-6 w-full" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        ) : null}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link to="/login">Back to sign in</Link>
        </p>
      </form>
    </div>
  );
}
