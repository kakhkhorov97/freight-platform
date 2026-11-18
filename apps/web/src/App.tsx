import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { GraphQLRequestError } from "./graphql";
import { loadSession, login, logout, register } from "./session";
import type { RegisterRole, Session } from "./session";

type ApiStatus = "checking" | "up" | "down";

// The database stores UTC; the UI shows Tashkent local time.
const tashkentTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tashkent",
});

function errorMessage(error: unknown): string {
  return error instanceof GraphQLRequestError
    ? error.message
    : "Something went wrong. Please try again.";
}

function useApiStatus(): ApiStatus {
  const [status, setStatus] = useState<ApiStatus>("checking");
  useEffect(() => {
    let active = true;
    fetch("/health")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { status?: string } | null) => {
        if (active) setStatus(body?.status === "ok" ? "up" : "down");
      })
      .catch(() => {
        if (active) setStatus("down");
      });
    return () => {
      active = false;
    };
  }, []);
  return status;
}

const statusLabel: Record<ApiStatus, string> = {
  checking: "Checking API…",
  up: "API online",
  down: "API offline",
};

export function App() {
  const apiStatus = useApiStatus();
  const [session, setSession] = useState<Session | null>(loadSession);

  return (
    <div className="page">
      <header className="topbar">
        <span className="brand">Return-trip freight</span>
        <span className={`status status--${apiStatus}`} role="status">
          <span className="status__dot" aria-hidden="true" />
          {statusLabel[apiStatus]}
        </span>
      </header>

      <main className="content">
        {session ? (
          <SignedIn session={session} onSignedOut={() => setSession(null)} />
        ) : (
          <AuthPanel onSignedIn={setSession} />
        )}
      </main>
    </div>
  );
}

function SignedIn({
  session,
  onSignedOut,
}: {
  session: Session;
  onSignedOut: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    try {
      await logout(session);
    } catch {
      // The local session is already cleared; an expired token is fine.
    }
    onSignedOut();
  }

  return (
    <section className="card">
      <h1>You are signed in</h1>
      <p className="muted">
        Session expires {tashkentTime.format(new Date(session.expiresAt))}{" "}
        (Tashkent time).
      </p>
      <button className="button" onClick={handleLogout} disabled={busy}>
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </section>
  );
}

function AuthPanel({ onSignedIn }: { onSignedIn: (s: Session) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <section className="card">
      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={mode === "login"}
          className="tab"
          onClick={() => setMode("login")}
        >
          Sign in
        </button>
        <button
          role="tab"
          aria-selected={mode === "register"}
          className="tab"
          onClick={() => {
            setMode("register");
            setNotice(null);
          }}
        >
          Create account
        </button>
      </div>

      {mode === "login" ? (
        <LoginForm notice={notice} onSignedIn={onSignedIn} />
      ) : (
        <RegisterForm
          onRegistered={() => {
            setNotice("Account created. Sign in to continue.");
            setMode("login");
          }}
        />
      )}
    </section>
  );
}

function LoginForm({
  notice,
  onSignedIn,
}: {
  notice: string | null;
  onSignedIn: (s: Session) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      onSignedIn(
        await login(String(form.get("email")), String(form.get("password"))),
      );
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      {notice && <p className="notice">{notice}</p>}
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button" type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function RegisterForm({ onRegistered }: { onRegistered: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await register(
        String(form.get("email")),
        String(form.get("password")),
        String(form.get("displayName")),
        form.get("role") as RegisterRole,
      );
      onRegistered();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <fieldset className="roles">
        <legend>I am a</legend>
        <label className="role">
          <input type="radio" name="role" value="Driver" defaultChecked />
          <span>
            <strong>Driver</strong>
            <small>I post return trips</small>
          </span>
        </label>
        <label className="role">
          <input type="radio" name="role" value="Shipper" />
          <span>
            <strong>Shipper</strong>
            <small>I post loads</small>
          </span>
        </label>
      </fieldset>
      <label className="field">
        <span>Display name</span>
        <input
          name="displayName"
          maxLength={100}
          autoComplete="name"
          required
        />
      </label>
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button" type="submit" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
