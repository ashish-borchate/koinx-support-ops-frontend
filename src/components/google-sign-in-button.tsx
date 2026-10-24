import { useEffect, useRef, useState, type MutableRefObject } from "react";

const SCRIPT_ID = "google-gsi-client";
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Google Sign-In")), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google Sign-In"));
    document.head.appendChild(script);
  });
}

type Props = {
  clientId: string;
  disabled?: boolean;
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
};

export function GoogleSignInButton({ clientId, disabled, onCredential, onError }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential) as MutableRefObject<(credential: string) => void>;
  const onErrorRef = useRef(onError) as MutableRefObject<(message: string) => void>;
  onCredentialRef.current = onCredential;
  onErrorRef.current = onError;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!clientId || disabled) return;
    let cancelled = false;
    void loadGoogleScript()
      .then(() => {
        if (cancelled || !hostRef.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) onCredentialRef.current(response.credential);
            else onErrorRef.current("Google did not return a sign-in credential");
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        hostRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(hostRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          width: "360",
        });
        setReady(true);
      })
      .catch((err) => onErrorRef.current(err instanceof Error ? err.message : "Could not load Google Sign-In"));
    return () => {
      cancelled = true;
    };
  }, [clientId, disabled]);

  if (!clientId) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        Google Sign-In is not configured. Set <code className="text-xs">VITE_GOOGLE_CLIENT_ID</code> on the frontend build.
      </p>
    );
  }

  return (
    <div className="flex min-h-11 flex-col items-stretch justify-center">
      <div ref={hostRef} className={disabled ? "pointer-events-none opacity-50" : ""} />
      {!ready && !disabled ? <p className="mt-2 text-center text-xs text-muted-foreground">Loading Google Sign-In…</p> : null}
    </div>
  );
}
