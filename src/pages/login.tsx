import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkApiHealth } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [apiIssue, setApiIssue] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await checkApiHealth({ retries: 6, delayMs: 1000 });
      if (cancelled) return;
      if (!result.ok) setApiIssue(result.detail);
      else setApiIssue("");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (user) return <Navigate to="/" replace />;

  async function submit() {
    setPending(true);
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-2">
      <section className="hidden flex-col justify-between border-r border-border bg-card px-14 py-12 lg:flex">
        <div>
          <p className="text-sm font-semibold text-primary">KoinX</p>
          <h1 className="mt-10 max-w-md text-4xl font-semibold tracking-tight text-foreground">Support Operations Hub</h1>
          <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
            One place for the support team to see the work in front of them, the people who own it, and the records already in the hub.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">Internal operations · weeks start Monday, Asia/Kolkata</p>
      </section>
      <section className="flex items-center px-6 py-12">
        <form
          className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] p-8 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <h2 className="text-2xl font-semibold text-foreground">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use your work email and password.</p>
          {apiIssue ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              {apiIssue}
            </p>
          ) : null}
          <div className="mt-6 space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
          </div>
          <div className="mt-4 space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
          </div>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Development password: <span className="font-medium text-foreground/90">DevOnly#2026</span> (from <code className="text-[11px]">SEED_PASSWORD</code> in{" "}
            <code className="text-[11px]">server/.env</code>). Use your @koinx.com email — punit, ashish, prabhat, harsh, sayali, or guna. Legacy seed used{" "}
            <span className="font-medium text-foreground/90">Support#2026</span>; reset via Account → Password after sign-in.
          </p>
          <Button type="submit" className="mt-6 w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </section>
    </div>
  );
}
