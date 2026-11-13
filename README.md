# Uzbekistan freight matching prototype

A graduate thesis prototype exploring how
matching return-trip trucks with cargo could reduce empty road freight trips
in Uzbekistan. The first planned corridor is Tashkent ↔ Samarkand.

Drivers will post return trips, and shippers will post loads. A match becomes
final only after both sides confirm. Payments are outside the project scope.

## Current status

This project contains a minimal NestJS API, development tooling, and local
data-service configuration. Matching and simulation are not implemented yet.
No experiments have been run, and no performance results are claimed.

## Research questions

- How much can batch matching reduce empty runs compared with
  first-come-first-served and greedy nearest matching?
- How does the benefit change at adoption levels of 10%, 30%, and 60%?
- How do detour limits, time-window slack, and load chaining affect results?

These adoption levels are planned experiment settings, not measured adoption.

## Planned architecture

- NestJS and code-first GraphQL API, with subscriptions for match alerts.
- PostgreSQL with PostGIS for relational data and geospatial queries.
- Redis and BullMQ for scheduled matching jobs.
- OSRM with OpenStreetMap for road distances and travel times.
- React and TypeScript web client for shippers and administrators.
- Telegram bot for drivers.
- A simulator that uses the same matching logic as the live worker.

The matcher will be a pure TypeScript package with no database or network I/O.
Feasibility checks, configurable costs, baselines, and batch assignment will
each receive unit tests before integration.

Folders will be added only when their implementation step needs them.

## Development

Use Node.js 24.9 or newer within the 24.x line. With nvm, install and select
the exact version pinned in `.nvmrc`, then install dependencies from the root:

```sh
nvm install
nvm use
npm ci
```

The API uses NestJS 12.4.0, whose platform adapter includes the fixed Multer
2.5.0 dependency. No dependency override is needed.

The root package is private to prevent accidental npm publication. npm
workspaces will discover packages under `apps/*` and `packages/*` once added.
The first application workspace is `apps/api`.

`tsconfig.base.json` provides shared strict TypeScript settings. Each future
package will extend it and choose its own module and runtime settings.
Unchecked indexed access and optional properties receive additional checks.

Format supported project files or check their formatting:

```sh
npm run format
npm run format:check
```

Prettier uses the editor settings in `.editorconfig` and preserves existing
Markdown line wrapping. It skips files covered by `.gitignore` and the
generated npm lockfile listed in `.prettierignore`.

Check JavaScript and TypeScript for code issues:

```sh
npm run lint
```

ESLint uses the recommended JavaScript and TypeScript rules, including checks
for unused variables and explicit `any`. Warnings fail the command. Generated
build and coverage folders are excluded. Prettier handles formatting.

TypeScript is pinned to 6.0.3 to stay within the lint integration's supported
version range. Lint checks application source, tests, and the ESLint configuration.

Keep secrets in ignored `.env` files. Only `.env.example` files containing
safe example values belong in version control.

Store database timestamps in UTC. The UI will display Asia/Tashkent time.

## API

After selecting Node.js 24 with `nvm use`, run from the project root:

```sh
npm ci
npm run build
npm run start:api
```

Open `http://127.0.0.1:3000/health` to receive `{"status":"ok"}`. This endpoint
checks API liveness only. Startup requires a successful PostgreSQL connection;
it does not connect to Redis yet. Stop it with Ctrl+C to close the connection.

Start PostgreSQL with `docker compose up -d --wait postgres` before the API.
The root `.env` supplies `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`,
`POSTGRES_USER`, and the required non-empty `POSTGRES_PASSWORD`. Host, port,
database name, and user default to `127.0.0.1`, `5432`, `freight`, and `freight`.
Use your configured host port, such as `5433` if `5432` is occupied.
The API sets database sessions to UTC and disables automatic schema changes,
migration execution, and extension installation. The database stores users, trucks, trips, and loads.
Connection failures stop startup after one attempt with a five-second
connection timeout. Configuration and controller tests do not require Docker.

Set `API_HOST` and `API_PORT` in the root `.env` file to change the listener.
They default to `127.0.0.1` and `3000`. `API_HOST` accepts IPv4 or IPv6
addresses; `API_PORT` accepts whole numbers from 1 to 65535. Invalid values
stop startup. Shell environment values take precedence over `.env`.
The root file is loaded even when starting through the npm workspace.

Run `npm test` for the HTTP health and unknown-route tests. Tests compile the
API first and use a temporary local port. The test command enables Node's VM
modules support so Jest can load NestJS 12's ES modules. Run `npm run lint` and
`npm run format:check` for code and formatting checks.

## Database migrations

The API and migration CLI share validated database options. The CLI loads the
root `.env`; shell environment settings take precedence. Migration commands
use compiled JavaScript and build the API before connecting.

From the project root:

```sh
npm run migration:show
npm run migration:run
npm run migration:revert
```

`show` lists migration status, `run` applies pending migrations, and `revert`
undoes the most recently applied migration. TypeORM initializes its migration
history table on first use, including when showing status.

To create a migration in a future implementation step:

```sh
npm run migration:create -- src/database/migrations/DescriptiveName
```

The path is relative to `apps/api`. This creates a timestamped TypeScript file;
implement and review its `up` and `down` methods before running it. The schema migrations
create the users, trucks, trips, loads, matches, and session tables. Keep applied migrations immutable.

## User schema

The `users` table contains a generated UUID, `displayName` up to 100 characters,
a required `driver`/`shipper`/`admin` role, and UTC-aware `createdAt`/`updatedAt`
timestamps. Empty and space-only names are rejected. TypeORM updates `updatedAt`
when updating through its repository; direct SQL updates must set it explicitly.

Run `npm run migration:run` to apply the approved migration to your configured
database. Run `npm run test:database` with PostgreSQL running to test persistence,
constraints, schema agreement, and rollback in a temporary database. The configured
database user needs permission to create databases. Tests delete that database
afterward. `npm test` remains independent of PostgreSQL.

## Truck schema

A truck references a user and stores a unique uppercase plate without whitespace,
a positive integer capacity in kilograms, and UTC timestamps. The database rejects
deletion of a user with registered trucks. The truck creation mutation checks
the driver's role.

## Trip and Load schemas

A trip references a truck and records its origin, destination, departure time,
and latest arrival time. A load references a shipper and records its pickup and
delivery points, pickup window, and positive weight in whole kilograms.

Locations are PostGIS geography points with SRID 4326. GeoJSON coordinates use
longitude first, then latitude. The migrations require PostGIS, which the local
Compose database provides. Trip and pickup windows must end after they start.
The Load creation mutation checks the shipper's role.

## Matches and GraphQL operations

A match links one trip and one load. Each pair is unique. The driver and shipper
confirm separately. The match is final when both confirmation timestamps exist.

Send GraphQL requests to `POST /graphql` on the local API. Apply migrations
before using authentication. Call `register(email, password, displayName, role)`
with `Driver` or `Shipper`, then call `login(email, password) { token expiresAt }`.
Pass the token as `Authorization: Bearer <token>` and call `logout` to revoke
the current session. Passwords are hashed with scrypt. Sessions expire after
24 hours, and the database stores token hashes. The local API allows ten
registration or login attempts per IP address per minute, per process.

Existing user rows retain their records and need explicit credential setup.
Administrators can list users and inspect any profile. Other users can read
their own profile. Truck reads are scoped to the owner or an administrator.
Trip and Load reads are available to authenticated users. Match reads are scoped
to the assigned driver, shipper, or an administrator.

List queries accept `limit` (1–100, default 20) and `offset` (default 0), ordered
by UUID. Trip and Load point coordinates use longitude, latitude order.

### Create trucks, trips, and loads

Use these mutations on the local GraphQL endpoint:

- `createTruck(plateNumber: String!, capacityKg: Int!)` assigns the truck to
  the signed-in driver. It removes plate whitespace, uppercases the result, and accepts
  plates up to 32 characters.
- `createTrip(truckId: ID!, input: CreateTripInput!)` requires one of the signed-in driver's trucks.
  The input contains `origin`, `destination`, `departureAt`, and `latestArrivalAt`.
- `createLoad(input: CreateLoadInput!)` assigns the load to the signed-in shipper.
  The input contains `pickup`, `delivery`, `pickupWindowStart`,
  `pickupWindowEnd`, and `weightKg`.

Location inputs take `longitude` and `latitude` as separate numbers. Send times
as ISO 8601 timestamps with a timezone. Capacity and weight use whole kilograms.

## Matching core

The pure TypeScript matcher accepts candidate trip and load pairs with route
estimates supplied by the caller. Capacity and weight use whole kilograms.
Timestamps use epoch milliseconds. Pickup must fall within the load window and
follow truck departure. Final truck arrival must meet the trip deadline.
Capacity and detour limits include equality.

Filter pairs with `filterFeasiblePairs`, then score each feasible pair with
`calculatePairCost`. Its four weighted terms are detour in kilometres, delay
in minutes, absolute price gap in Uzbek soum, and `1 - reliability`. Reliability
ranges from 0 to 1. A zero weight disables that term. The matcher accepts
explicit inputs for these values and performs no routing or database calls.

`firstComeFirstServed` scans candidates in the caller's supplied arrival order.
`greedyNearest` chooses the shortest `pickupDistanceKm` first, with input order
breaking ties. Supply road distance from the truck's starting point to the load
pickup for this estimate. Existing feasibility and cost functions also accept
estimates without pickup distance.

`batchAssign` finds a maximum-cardinality one-to-one assignment, then minimizes
its total weighted cost using successive shortest augmenting paths. Residual
edges allow it to revise earlier pairings. Bellman-Ford handles the negative
reverse costs. This is a prototype implementation with O(F × V × E) work,
where F is the number of matches. Scheduling repeated batches belongs to the
worker. This version assigns at most one load to each trip.

All strategies filter infeasible pairs first and preserve caller data. Duplicate
trip/load pairs and contradictory records for the same ID are rejected. Batch
results follow candidate input order, and equal-cost choices are deterministic
for the same input. Numeric overflow or an unstable floating-point residual
path raises an error. Hand-made unit tests and exhaustive enumeration of all
three-by-three candidate graphs check assignment correctness.

Run `npm test --workspace @freight/matcher` for the isolated tests. The root
build and test commands also cover the matcher workspace.

## Synthetic simulation

`packages/simulator` generates repeatable synthetic demand and runs FCFS,
greedy nearest, and batch assignment through the shared matcher. Seed and
configuration are included in the JSON report. Its default 100 km line corridor,
50 km/h speed, prices, reliability values, and cost weights are illustrative
inputs. They are not measured Uzbekistan road data or calibrated research results.
The example schedule starts on 1 January 2030 UTC.

```sh
npm run --silent simulate -- --seed 42 --trips 20 --loads 30 --adoption 0.3 --detour 20
```

Counts range from 0 to 100. Adoption ranges from 0 to 1 and selects
`floor(trips × adoption)` participating trucks. With the same seed and population
sizes, changing adoption preserves all trips and loads and uses nested samples.
FCFS scans load-window opening times, then trip departure times. The default
single run compares a full-information snapshot. Use rolling replay to reveal
trip and load availability over time.

Metrics require `baselineDistanceKm` for every trip and `loadedDistanceKm` for
each assigned pair. Unmatched and nonparticipating trips travel their baseline
route empty. A matched trip travels baseline distance plus detour, of which
`loadedDistanceKm` is loaded. Empty-kilometre share divides all fleet empty
kilometres by all fleet kilometres. Matched-load rate uses all posted loads.
Average detour and wait use matched loads only. Wait starts when the pickup
window opens. Empty denominators return zero.

Run `npm test --workspace @freight/simulator` for generator, runner, and CLI
checks. The root build and test commands include the simulator.

### Rolling replay and adoption sweeps

```sh
npm run --silent simulate -- --mode rolling --interval 15 --seed 42
npm run --silent simulate -- --sweep --seeds 1,2,3 --rates 0.1,0.3,0.6 --format csv
```

Rolling replay interprets trip departure as earliest readiness. Trucks wait at
their origin until selected. A load becomes known when its pickup window opens.
All strategies run on the same batch clock, and pickup and final arrival times
are recalculated from the decision time using the illustrative constant speed.
Assignments reserve both the trip and the load, with immediate acceptance
assumed for simulation. Each result records `assignedAtMs`. Replay supports
whole-minute intervals from 1 to 60, with a default of 15 and a 10000-batch limit.

A sweep defaults to rolling mode at 10%, 30%, and 60% adoption. The same seeded
population is reused at each adoption level. Use `--mode snapshot` for snapshot
sweeps. Seeds and rates must be unique, with at most 100 combinations.

`--format csv` writes one row per seed, adoption level, and strategy. Rows include
model settings, weights, limits, and metrics for reproducibility. The default
format is JSON. Redirect standard output to save either format. These runs use
synthetic assumptions and do not establish measured platform benefits.

## Local data services

Install and start [Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/)
with Docker Compose support. From the project root:

```sh
cp .env.example .env
```

Set a non-empty `POSTGRES_PASSWORD` in `.env`, then run:

```sh
docker compose config --quiet
docker compose up -d --wait
docker compose ps
```

PostgreSQL 18 with PostGIS 3.6 listens on `127.0.0.1:5432`; Redis 7.4 listens
on `127.0.0.1:6379`. Change `POSTGRES_PORT` or `REDIS_PORT` in `.env` if those
ports are occupied. These are local development services. Redis has no password.

The [PostGIS image](https://hub.docker.com/r/postgis/postgis) requires amd64
emulation on Apple Silicon. Its default database includes the PostGIS extension.
PostgreSQL uses UTC. Redis uses append-only persistence and disables key eviction
so future queue jobs are not removed to free memory.

Verify the database extension and Redis response:

```sh
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT PostGIS_Version(); SHOW timezone;"'
docker compose exec redis redis-cli ping
```

Expect a PostGIS version, `UTC`, and `PONG`. These are expected checks, not
recorded test results. Stop the services with `docker compose down`; named
volumes retain data. Database environment settings initialize only an empty
volume. Changing `.env` does not change an existing database user's password.

## License

Licensed under the [MIT License](LICENSE).
