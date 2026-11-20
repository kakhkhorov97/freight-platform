import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { formatDateTime, formatKg } from "./format";
import { errorMessage, isUnauthenticated } from "./graphql";
import { createLoad, listLoadsForShipper } from "./loads";
import type { Load } from "./loads";
import { corridorPlaces, placeName, tashkentLocalToIso } from "./places";

const MAX_WEIGHT_KG = 2_147_483_647; // The API's integer limit.

type ListState =
  | { state: "loading" }
  | { state: "ready"; loads: Load[] }
  | { state: "error"; message: string };

export function LoadsPage({
  token,
  userId,
  onSessionEnded,
}: {
  token: string;
  userId: string;
  onSessionEnded: () => void;
}) {
  const [list, setList] = useState<ListState>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setList({ state: "loading" });
    listLoadsForShipper(token, userId)
      .then((loads) => {
        if (!active) return;
        setList({ state: "ready", loads });
        if (loads.length === 0) setFormOpen(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (isUnauthenticated(error)) onSessionEnded();
        else setList({ state: "error", message: errorMessage(error) });
      });
    return () => {
      active = false;
    };
  }, [token, userId, attempt, onSessionEnded]);

  function handleCreated(load: Load) {
    setList((prev) => ({
      state: "ready",
      loads: [...(prev.state === "ready" ? prev.loads : []), load].sort(
        (a, b) => a.pickupWindowStart.localeCompare(b.pickupWindowStart),
      ),
    }));
    setAddedId(load.id);
    setFormOpen(false);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 id="page-title">My loads</h1>
          <p className="muted">
            Cargo you need moved, to be matched with trucks on return trips.
          </p>
        </div>
        {!formOpen && list.state === "ready" && (
          <button className="button" onClick={() => setFormOpen(true)}>
            Post load
          </button>
        )}
      </div>

      {formOpen && (
        <PostLoadForm
          token={token}
          canCancel={list.state === "ready" && list.loads.length > 0}
          onCancel={() => setFormOpen(false)}
          onCreated={handleCreated}
          onSessionEnded={onSessionEnded}
        />
      )}

      {list.state === "loading" && (
        <p className="muted" role="status">
          Loading loads…
        </p>
      )}

      {list.state === "error" && (
        <div className="error-block" role="alert">
          <p className="error">{list.message}</p>
          <button
            className="button button--ghost"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Try again
          </button>
        </div>
      )}

      {list.state === "ready" && list.loads.length === 0 && !formOpen && (
        <div className="empty">
          <p>You have not posted any loads yet.</p>
        </div>
      )}

      {list.state === "ready" && list.loads.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">Your loads</caption>
            <thead>
              <tr>
                <th scope="col">Route</th>
                <th scope="col" className="num">
                  Weight
                </th>
                <th scope="col">Pickup from</th>
                <th scope="col">Pickup by</th>
              </tr>
            </thead>
            <tbody>
              {list.loads.map((load) => (
                <tr
                  key={load.id}
                  className={load.id === addedId ? "row--new" : undefined}
                >
                  <td>
                    {placeName(load.pickup)} → {placeName(load.delivery)}
                  </td>
                  <td className="num">{formatKg(load.weightKg)}</td>
                  <td>{formatDateTime(load.pickupWindowStart)}</td>
                  <td>{formatDateTime(load.pickupWindowEnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function PostLoadForm({
  token,
  canCancel,
  onCancel,
  onCreated,
  onSessionEnded,
}: {
  token: string;
  canCancel: boolean;
  onCancel: () => void;
  onCreated: (load: Load) => void;
  onSessionEnded: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const pickup = corridorPlaces.find((p) => p.id === form.get("pickup"));
    const delivery = corridorPlaces.find((p) => p.id === form.get("delivery"));
    const windowStart = String(form.get("windowStart") ?? "");
    const windowEnd = String(form.get("windowEnd") ?? "");
    const weightKg = Number(form.get("weight"));

    if (!pickup || !delivery) {
      setError("Choose a pickup and a delivery place.");
      return;
    }
    if (pickup.id === delivery.id) {
      setError("Pickup and delivery must be different places.");
      return;
    }
    if (!Number.isInteger(weightKg) || weightKg < 1) {
      setError("Weight must be a whole number of kilograms above zero.");
      return;
    }
    if (!windowStart || !windowEnd) {
      setError("Enter when the pickup window opens and closes.");
      return;
    }
    const pickupWindowStart = tashkentLocalToIso(windowStart);
    const pickupWindowEnd = tashkentLocalToIso(windowEnd);
    if (new Date(pickupWindowEnd) <= new Date(pickupWindowStart)) {
      setError("The pickup window must close after it opens.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      onCreated(
        await createLoad(token, {
          pickup,
          delivery,
          pickupWindowStart,
          pickupWindowEnd,
          weightKg,
        }),
      );
    } catch (err) {
      if (isUnauthenticated(err)) {
        onSessionEnded();
        return;
      }
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <h2>Post a load</h2>
      <div className="inline-form__fields">
        <label className="field">
          <span>Pickup</span>
          <select name="pickup" required defaultValue="tashkent">
            {corridorPlaces.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Delivery</span>
          <select name="delivery" required defaultValue="samarkand">
            {corridorPlaces.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Weight (kg)</span>
          <input
            name="weight"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_WEIGHT_KG}
            step={1}
            placeholder="5000"
            required
          />
        </label>
      </div>
      <div className="inline-form__fields">
        <label className="field">
          <span>Pickup window opens</span>
          <input name="windowStart" type="datetime-local" required />
          <small className="hint">Tashkent time.</small>
        </label>
        <label className="field">
          <span>Pickup window closes</span>
          <input name="windowEnd" type="datetime-local" required />
          <small className="hint">
            The latest time a truck can collect the load.
          </small>
        </label>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions actions--tight">
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Posting…" : "Post load"}
        </button>
        {canCancel && (
          <button
            className="button button--ghost"
            type="button"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
