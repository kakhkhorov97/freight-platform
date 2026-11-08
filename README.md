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

Install the pinned development dependencies from the project root:

```sh
npm ci
```

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

With Node.js 20.19 or newer, install dependencies and run from the project root:

```sh
npm ci
npm run build
npm run start:api
```

Open `http://127.0.0.1:3000/health` to receive `{"status":"ok"}`. This endpoint
checks API liveness only. It does not check PostgreSQL or Redis. The API does
not connect to those services yet. Stop it with Ctrl+C.

Run `npm test` for the HTTP health and unknown-route tests. Tests compile the
API first and use a temporary local port. Run `npm run lint` and
`npm run format:check` for code and formatting checks.

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
