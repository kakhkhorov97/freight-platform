# Uzbekistan freight matching prototype

A graduate thesis prototype exploring how
matching return-trip trucks with cargo could reduce empty road freight trips
in Uzbekistan. The first planned corridor is Tashkent ↔ Samarkand.

Drivers will post return trips, and shippers will post loads. A match becomes
final only after both sides confirm. Payments are outside the project scope.

## Current status

This project currently contains documentation and basic file conventions.
There is no runnable application, matching implementation, or simulation yet.
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
There are no application packages yet.

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
version range. No application source packages exist yet, so lint currently
checks the ESLint configuration itself.

Build and test commands will be added with the first source package.

Keep secrets in ignored `.env` files. Only `.env.example` files containing
safe example values belong in version control.

Store database timestamps in UTC. The UI will display Asia/Tashkent time.

## License

Licensed under the [MIT License](LICENSE).
