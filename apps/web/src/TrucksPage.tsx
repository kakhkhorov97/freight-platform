import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { formatDate, formatKg } from "./format";
import { errorMessage, isUnauthenticated } from "./graphql";
import { createTruck, listTrucks, normalisePlate } from "./trucks";
import type { Truck } from "./trucks";

const MAX_CAPACITY_KG = 2_147_483_647; // The API's integer limit.

type ListState =
  | { state: "loading" }
  | { state: "ready"; trucks: Truck[] }
  | { state: "error"; message: string };

export function TrucksPage({
  token,
  onSessionEnded,
}: {
  token: string;
  onSessionEnded: () => void;
}) {
  const [list, setList] = useState<ListState>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setList({ state: "loading" });
    listTrucks(token)
      .then((trucks) => {
        if (!active) return;
        setList({ state: "ready", trucks });
        if (trucks.length === 0) setFormOpen(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (isUnauthenticated(error)) onSessionEnded();
        else setList({ state: "error", message: errorMessage(error) });
      });
    return () => {
      active = false;
    };
  }, [token, attempt, onSessionEnded]);

  function handleCreated(truck: Truck) {
    setList((prev) =>
      prev.state === "ready"
        ? { state: "ready", trucks: [truck, ...prev.trucks] }
        : { state: "ready", trucks: [truck] },
    );
    setAddedId(truck.id);
    setFormOpen(false);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 id="page-title">My trucks</h1>
          <p className="muted">
            Trucks you can use when posting a return trip.
          </p>
        </div>
        {!formOpen && list.state === "ready" && (
          <button className="button" onClick={() => setFormOpen(true)}>
            Add truck
          </button>
        )}
      </div>

      {formOpen && (
        <AddTruckForm
          token={token}
          canCancel={list.state === "ready" && list.trucks.length > 0}
          onCancel={() => setFormOpen(false)}
          onCreated={handleCreated}
          onSessionEnded={onSessionEnded}
        />
      )}

      {list.state === "loading" && (
        <p className="muted" role="status">
          Loading trucks…
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

      {list.state === "ready" && list.trucks.length === 0 && !formOpen && (
        <div className="empty">
          <p>You have not added any trucks yet.</p>
        </div>
      )}

      {list.state === "ready" && list.trucks.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">Your trucks</caption>
            <thead>
              <tr>
                <th scope="col">Plate number</th>
                <th scope="col" className="num">
                  Capacity
                </th>
                <th scope="col">Added</th>
              </tr>
            </thead>
            <tbody>
              {list.trucks.map((truck) => (
                <tr
                  key={truck.id}
                  className={truck.id === addedId ? "row--new" : undefined}
                >
                  <td>
                    <span className="plate">{truck.plateNumber}</span>
                  </td>
                  <td className="num">{formatKg(truck.capacityKg)}</td>
                  <td>{formatDate(truck.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function AddTruckForm({
  token,
  canCancel,
  onCancel,
  onCreated,
  onSessionEnded,
}: {
  token: string;
  canCancel: boolean;
  onCancel: () => void;
  onCreated: (truck: Truck) => void;
  onSessionEnded: () => void;
}) {
  const [plate, setPlate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = normalisePlate(plate);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const capacity = Number(new FormData(event.currentTarget).get("capacity"));
    if (!preview) {
      setError("Enter a plate number.");
      return;
    }
    if (!Number.isInteger(capacity) || capacity < 1) {
      setError("Capacity must be a whole number of kilograms above zero.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onCreated(await createTruck(token, preview, capacity));
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
      <h2>Add a truck</h2>
      <div className="inline-form__fields">
        <label className="field">
          <span>Plate number</span>
          <input
            name="plate"
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            maxLength={64}
            autoComplete="off"
            spellCheck={false}
            placeholder="01 A 123 BC"
            aria-describedby="plate-hint"
            required
          />
          <small id="plate-hint" className="hint">
            {preview && preview !== plate
              ? `Saved as ${preview}`
              : "Spaces are removed and letters uppercased."}
          </small>
        </label>
        <label className="field">
          <span>Capacity (kg)</span>
          <input
            name="capacity"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_CAPACITY_KG}
            step={1}
            placeholder="20000"
            required
          />
          <small className="hint">Maximum cargo weight in kilograms.</small>
        </label>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions actions--tight">
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save truck"}
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
