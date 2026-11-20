import { useEffect, useState } from "react";
import { TripsPage } from "./TripsPage";
import { TrucksPage } from "./TrucksPage";
import type { CurrentUser, UserRole } from "./user";

interface PageDef {
  id: string;
  label: string;
  title: string;
  summary: string;
}

// Pages are listed per role; each one is filled in by a later step.
const pages: Record<UserRole, PageDef[]> = {
  Driver: [
    {
      id: "trucks",
      label: "My trucks",
      title: "My trucks",
      summary: "Register your trucks with plate number and capacity.",
    },
    {
      id: "trips",
      label: "My trips",
      title: "My return trips",
      summary:
        "Post a return trip with origin, destination, departure, and latest arrival.",
    },
    {
      id: "matches",
      label: "Matches",
      title: "Matches",
      summary:
        "Loads proposed for your trips, waiting for both sides to confirm.",
    },
  ],
  Shipper: [
    {
      id: "loads",
      label: "My loads",
      title: "My loads",
      summary:
        "Post a load with pickup, delivery, pickup window, and weight in kilograms.",
    },
    {
      id: "matches",
      label: "Matches",
      title: "Matches",
      summary:
        "Trucks proposed for your loads, waiting for both sides to confirm.",
    },
  ],
  Admin: [
    {
      id: "users",
      label: "Users",
      title: "Users",
      summary: "All registered drivers, shippers, and administrators.",
    },
    {
      id: "matches",
      label: "Matches",
      title: "Matches",
      summary: "Every proposed and confirmed match on the platform.",
    },
  ],
};

const roleLabel: Record<UserRole, string> = {
  Driver: "Driver",
  Shipper: "Shipper",
  Admin: "Administrator",
};

/** Keeps the selected page in the URL hash so a reload stays on it. */
function useHashPage(available: PageDef[]): PageDef {
  const read = () => location.hash.replace(/^#/, "");
  const [hash, setHash] = useState(read);
  useEffect(() => {
    const onChange = () => setHash(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const first = available[0];
  if (!first) throw new Error("Every role needs at least one page");
  return available.find((page) => page.id === hash) ?? first;
}

export function Workspace({
  user,
  token,
  signingOut,
  onSignOut,
  onSessionEnded,
}: {
  user: CurrentUser;
  token: string;
  signingOut: boolean;
  onSignOut: () => void;
  onSessionEnded: () => void;
}) {
  const available = pages[user.role];
  const current = useHashPage(available);

  return (
    <div className="workspace">
      <nav className="sidenav" aria-label="Main">
        <div className="profile">
          <span className="profile__name">{user.displayName}</span>
          <span className={`badge badge--${user.role.toLowerCase()}`}>
            {roleLabel[user.role]}
          </span>
        </div>
        <ul className="navlist">
          {available.map((page) => (
            <li key={page.id}>
              <a
                href={`#${page.id}`}
                className="navlink"
                aria-current={page.id === current.id ? "page" : undefined}
              >
                {page.label}
              </a>
            </li>
          ))}
        </ul>
        <button
          className="button button--ghost"
          onClick={onSignOut}
          disabled={signingOut}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </nav>

      <section className="panel" aria-labelledby="page-title">
        {user.role === "Driver" && current.id === "trucks" ? (
          <TrucksPage token={token} onSessionEnded={onSessionEnded} />
        ) : user.role === "Driver" && current.id === "trips" ? (
          <TripsPage token={token} onSessionEnded={onSessionEnded} />
        ) : (
          <>
            <h1 id="page-title">{current.title}</h1>
            <p className="muted">{current.summary}</p>
            <div className="empty">
              <p>This screen is not built yet.</p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
