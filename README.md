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
create the users, trucks, trips, loads, and matches tables. Keep applied migrations immutable.

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
deletion of a user with registered trucks. The truck registration API will check
the driver's role.

## Trip and Load schemas

A trip references a truck and records its origin, destination, departure time,
and latest arrival time. A load references a shipper and records its pickup and
delivery points, pickup window, and positive weight in whole kilograms.

Locations are PostGIS geography points with SRID 4326. GeoJSON coordinates use
longitude first, then latitude. The migrations require PostGIS, which the local
Compose database provides. Trip and pickup windows must end after they start.
The database checks that the shipper exists. The future Load API will check the
shipper's role.

## Matches and User queries

A match links one trip and one load. Each pair is unique. The driver and shipper
confirm separately. The match is final when both confirmation timestamps exist.

Send GraphQL requests to `POST /graphql` on the local API. The `users` query
accepts `limit` (1–100, default 20) and `offset` (default 0), ordered by UUID.
The `user(id: ID!)` query validates the UUID and returns null if it is missing.
These queries expose display names, roles, and timestamps. Apply the migrations
before querying. Keep the API local while authentication is pending.

```graphql
query {
  users(limit: 10) {
    id
    displayName
    role
  }
}
```

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
