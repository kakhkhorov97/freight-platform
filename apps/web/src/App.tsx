import { useEffect, useState } from "react";
import { AuthPanel } from "./AuthPanel";
import { errorMessage, isUnauthenticated } from "./graphql";
import { clearSession, loadSession, logout } from "./session";
import type { Session } from "./session";
import { fetchMe } from "./user";
import type { CurrentUser } from "./user";
import { Workspace } from "./Workspace";

type ApiStatus = "checking" | "up" | "down";

type Profile =
  | { state: "loading" }
  | { state: "ready"; user: CurrentUser }
  | { state: "error"; message: string };

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
  const [profile, setProfile] = useState<Profile>({ state: "loading" });
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Load the signed-in user's name and role whenever the session changes.
  useEffect(() => {
    if (!session) return;
    let active = true;
    setProfile({ state: "loading" });
    fetchMe(session.token)
      .then((user) => {
        if (active) setProfile({ state: "ready", user });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (isUnauthenticated(error)) {
          clearSession();
          setAuthNotice("Your session has ended. Please sign in again.");
          setSession(null);
        } else {
          setProfile({ state: "error", message: errorMessage(error) });
        }
      });
    return () => {
      active = false;
    };
  }, [session, attempt]);

  function handleSignedIn(next: Session) {
    setAuthNotice(null);
    setProfile({ state: "loading" });
    setSession(next);
  }

  async function handleSignOut() {
    if (!session) return;
    setSigningOut(true);
    try {
      await logout(session);
    } catch {
      // The local session is already cleared; an expired token is fine.
    }
    setSigningOut(false);
    setSession(null);
    history.replaceState(null, "", location.pathname);
  }

  return (
    <div className="page">
      <header className="topbar">
        <span className="brand">Return-trip freight</span>
        <span className={`status status--${apiStatus}`} role="status">
          <span className="status__dot" aria-hidden="true" />
          {statusLabel[apiStatus]}
        </span>
      </header>

      {!session ? (
        <main className="content">
          <AuthPanel initialNotice={authNotice} onSignedIn={handleSignedIn} />
        </main>
      ) : profile.state === "ready" ? (
        <Workspace
          user={profile.user}
          signingOut={signingOut}
          onSignOut={handleSignOut}
        />
      ) : profile.state === "loading" ? (
        <main className="content">
          <p className="muted" role="status">
            Loading your account…
          </p>
        </main>
      ) : (
        <main className="content">
          <section className="card">
            <h1>Could not load your account</h1>
            <p className="error" role="alert">
              {profile.message}
            </p>
            <div className="actions">
              <button
                className="button"
                onClick={() => setAttempt((n) => n + 1)}
              >
                Try again
              </button>
              <button
                className="button button--ghost"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                Sign out
              </button>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
