import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { formatDateTime, formatKg } from "./format";
import { errorMessage, isUnauthenticated } from "./graphql";
import { corridorPlaces, placeName, tashkentLocalToIso } from "./places";
import { createTrip, listTripsForTrucks } from "./trips";
import type { Trip } from "./trips";
import { listTrucks } from "./trucks";
import type { Truck } from "./trucks";

type ListState =
  | { state: "loading" }
  | { state: "ready"; trucks: Truck[]; trips: Trip[] }
  | { state: "error"; message: string };

export function TripsPage({
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
    (async () => {
      const trucks = await listTrucks(token);
      const trips =
        trucks.length === 0
          ? []
          : await listTripsForTrucks(token, new Set(trucks.map((t) => t.id)));
      return { trucks, trips };
    })()
      .then(({ trucks, trips }) => {
        if (!active) return;
        setList({ state: "ready", trucks, trips });
        if (trucks.length > 0 && trips.length === 0) setFormOpen(true);
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

  function handleCreated(trip: Trip) {
    setList((prev) =>
      prev.state === "ready"
        ? {
            ...prev,
            trips: [...prev.trips, trip].sort((a, b) =>
              a.departureAt.localeCompare(b.departureAt),
            ),
          }
        : prev,
    );
    setAddedId(trip.id);
    setFormOpen(false);
  }

  const trucks = list.state === "ready" ? list.trucks : [];
  const truckById = new Map(trucks.map((t) => [t.id, t]));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 id="page-title">My return trips</h1>
          <p className="muted">
            Trips your trucks will drive, so empty space can be matched with
            loads.
          </p>
        </div>
        {!formOpen && list.state === "ready" && trucks.length > 0 && (
          <button className="button" onClick={() => setFormOpen(true)}>
            Post trip
          </button>
        )}
      </div>

      {formOpen && list.state === "ready" && (
        <PostTripForm
          token={token}
          trucks={trucks}
          canCancel={list.trips.length > 0}
          onCancel={() => setFormOpen(false)}
          onCreated={handleCreated}
          onSessionEnded={onSessionEnded}
        />
      )}

      {list.state === "loading" && (
        <p className="muted" role="status">
          Loading trips…
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

      {list.state === "ready" && trucks.length === 0 && (
        <div className="empty">
          <p>
            Add a truck before posting a trip.{" "}
            <a href="#trucks">Go to My trucks</a>
          </p>
        </div>
      )}

      {list.state === "ready" &&
        trucks.length > 0 &&
        list.trips.length === 0 &&
        !formOpen && (
          <div className="empty">
            <p>You have not posted any trips yet.</p>
          </div>
        )}

      {list.state === "ready" && list.trips.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">Your return trips</caption>
            <thead>
              <tr>
                <th scope="col">Route</th>
                <th scope="col">Truck</th>
                <th scope="col">Departure</th>
                <th scope="col">Latest arrival</th>
              </tr>
            </thead>
            <tbody>
              {list.trips.map((trip) => {
                const truck = truckById.get(trip.truckId);
                return (
                  <tr
                    key={trip.id}
                    className={trip.id === addedId ? "row--new" : undefined}
                  >
                    <td>
                      {placeName(trip.origin)} → {placeName(trip.destination)}
                    </td>
                    <td>
                      {truck ? (
                        <span className="plate">{truck.plateNumber}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{formatDateTime(trip.departureAt)}</td>
                    <td>{formatDateTime(trip.latestArrivalAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function PostTripForm({
  token,
  trucks,
  canCancel,
  onCancel,
  onCreated,
  onSessionEnded,
}: {
  token: string;
  trucks: Truck[];
  canCancel: boolean;
  onCancel: () => void;
  onCreated: (trip: Trip) => void;
  onSessionEnded: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const truckId = String(form.get("truck") ?? "");
    const origin = corridorPlaces.find((p) => p.id === form.get("origin"));
    const destination = corridorPlaces.find(
      (p) => p.id === form.get("destination"),
    );
    const departure = String(form.get("departure") ?? "");
    const arrival = String(form.get("arrival") ?? "");

    if (!truckId || !origin || !destination) {
      setError("Choose a truck, an origin, and a destination.");
      return;
    }
    if (origin.id === destination.id) {
      setError("Origin and destination must be different places.");
      return;
    }
    if (!departure || !arrival) {
      setError("Enter the departure and latest arrival times.");
      return;
    }
    const departureAt = tashkentLocalToIso(departure);
    const latestArrivalAt = tashkentLocalToIso(arrival);
    if (new Date(latestArrivalAt) <= new Date(departureAt)) {
      setError("Latest arrival must be after departure.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      onCreated(
        await createTrip(token, truckId, {
          origin,
          destination,
          departureAt,
          latestArrivalAt,
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
      <h2>Post a return trip</h2>
      <div className="inline-form__fields">
        <label className="field">
          <span>Truck</span>
          <select name="truck" required defaultValue={trucks[0]?.id}>
            {trucks.map((truck) => (
              <option key={truck.id} value={truck.id}>
                {truck.plateNumber} · {formatKg(truck.capacityKg)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>From</span>
          <select name="origin" required defaultValue="samarkand">
            {corridorPlaces.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>To</span>
          <select name="destination" required defaultValue="tashkent">
            {corridorPlaces.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="inline-form__fields">
        <label className="field">
          <span>Departure</span>
          <input name="departure" type="datetime-local" required />
          <small className="hint">Tashkent time.</small>
        </label>
        <label className="field">
          <span>Latest arrival</span>
          <input name="arrival" type="datetime-local" required />
          <small className="hint">
            The latest time you can reach the destination.
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
          {busy ? "Posting…" : "Post trip"}
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
