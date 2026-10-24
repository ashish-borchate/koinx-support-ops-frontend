import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, getToken, getViewAs, setToken, setViewAs } from "./api";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  roleKey: string;
  roleName: string;
  title: string;
  permissions: string[];
};

export type ViewAsUser = {
  id: string;
  name: string;
  roleKey: string;
  roleName: string;
};

type SessionPayload = {
  user: AuthUser;
  effective: AuthUser;
  viewAs: ViewAsUser | null;
};

type AuthState = {
  user: AuthUser | null;
  effective: AuthUser | null;
  viewAs: ViewAsUser | null;
  loading: boolean;
  readOnly: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => void;
  can: (...keys: string[]) => boolean;
  canMutate: (...keys: string[]) => boolean;
  startViewAs: (userId: string) => Promise<void>;
  exitViewAs: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [effective, setEffective] = useState<AuthUser | null>(null);
  const [viewAs, setViewAsUser] = useState<ViewAsUser | null>(null);
  const [loading, setLoading] = useState(Boolean(getToken()));
  const queryClient = useQueryClient();

  async function applySession() {
    const data = await api<SessionPayload>("/api/auth/me");
    setUser(data.user);
    setEffective(data.effective);
    setViewAsUser(data.viewAs);
  }

  async function refresh() {
    await applySession();
  }

  useEffect(() => {
    if (!getToken()) return;
    applySession()
      .catch(async () => {
        if (getViewAs()) {
          setViewAs(null);
          try {
            await applySession();
            return;
          } catch {
            /* session itself is invalid */
          }
        }
        setToken(null);
        setUser(null);
        setEffective(null);
        setViewAsUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function applyLoginResponse(data: { token: string; user: AuthUser; effective: AuthUser; viewAs: ViewAsUser | null }) {
    setToken(data.token);
    setUser(data.user);
    setEffective(data.effective);
    setViewAsUser(data.viewAs);
  }

  async function login(email: string, password: string) {
    setViewAs(null);
    const data = await api<{ token: string; user: AuthUser; effective: AuthUser; viewAs: ViewAsUser | null }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await applyLoginResponse({ ...data, viewAs: null });
  }

  async function loginWithGoogle(credential: string) {
    setViewAs(null);
    const data = await api<{ token: string; user: AuthUser; effective: AuthUser; viewAs: ViewAsUser | null }>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    });
    await applyLoginResponse({ ...data, viewAs: null });
  }

  function logout() {
    setToken(null);
    setViewAs(null);
    setUser(null);
    setEffective(null);
    setViewAsUser(null);
  }

  function can(...keys: string[]) {
    return keys.some((key) => effective?.permissions.includes(key));
  }

  function canMutate(...keys: string[]) {
    if (viewAs) return false;
    return can(...keys);
  }

  async function startViewAs(userId: string) {
    await api("/api/view-as", { method: "POST", body: JSON.stringify({ userId }) });
    setViewAs(userId);
    await applySession();
    await queryClient.invalidateQueries();
  }

  async function exitViewAs() {
    await api("/api/view-as/end", { method: "POST" });
    setViewAs(null);
    await applySession();
    await queryClient.invalidateQueries();
  }

  return (
    <AuthContext.Provider
      value={{ user, effective, viewAs, loading, readOnly: Boolean(viewAs), login, loginWithGoogle, logout, can, canMutate, startViewAs, exitViewAs, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}
