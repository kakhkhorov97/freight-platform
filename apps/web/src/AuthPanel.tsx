import { useState } from "react";
import type { FormEvent } from "react";
import { errorMessage } from "./graphql";
import { login, register } from "./session";
import type { RegisterRole, Session } from "./session";

export function AuthPanel({
  initialNotice,
  onSignedIn,
}: {
  initialNotice: string | null;
  onSignedIn: (s: Session) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [notice, setNotice] = useState<string | null>(initialNotice);

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
