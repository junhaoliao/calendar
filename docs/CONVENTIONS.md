# Contributing

## Setup and demo

Use Node 22.18+ (the version in .node-version is recommended) and the pnpm version
pinned in package.json.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm dev
```

The demo runs at http://127.0.0.1:1420/calendar-demo.html with in-memory events.
Use `?date=2026-10-04` for a reproducible date. Append these parameters to exercise
specific scenarios:

| Parameter                                                          | Scenario                                     |
| ------------------------------------------------------------------ | -------------------------------------------- |
| `&empty`                                                           | Empty calendar                               |
| `&debug`                                                           | Interaction debugging                        |
| `&duration=90`                                                     | Default all-day-to-timed conversion duration |
| `&minWidth=120`                                                    | Preferred timed-event lane width             |
| `&overlaps=contracts`, `single`, `short`, `overnight`, or `column` | Overlap fixtures                             |
| `&resize=single`, `overnight`, `all-day`, `crowded`, or `short`    | Endpoint-resize fixtures                     |
| `&readOnly`                                                        | View-only calendar                           |

## Local package testing

```sh
pnpm build
pnpm pack --out artifacts/calendar.tgz
```

Install that tarball into a separate React app with
`npm install /absolute/path/to/artifacts/calendar.tgz`.
The [consumer example](../examples/consumer) uses package exports and compiled CSS.
`pnpm test:package` creates and tests fresh consumer projects automatically.

## Checks and formatting

Run `pnpm lint:fix` before manually fixing remaining lint issues. Use
`pnpm format` for Prettier formatting and `pnpm check` for lint, formatting,
types, unit/DST tests, and the build. Checks may write ignored build artifacts
but do not rewrite authored source.

Run `pnpm verify` for behavior changes. See the [testing guide](event-calendar/validation.md)
for individual suites, screenshots, and debugging artifacts. ESLint covers React,
hooks, and accessibility rules. Library types are checked without test or Node
globals through tsconfig.lib.json.

## Dependencies and packaging

- Keep React and React DOM as peers and update the three pinned dnd-kit packages together.
- Before widening dependency ranges, check the minimum and newer allowed versions
  in fresh React 18/19 consumers and the supported Node runtime matrix.
- Keep runtime dependencies separate from build/test and demo dependencies.
- Update third-party notices when copied components or redistributed CSS change.
  Preserve the root LICENSE and required notices in the tarball.
- Keep public exports small and declarations portable. The development-only
  `#calendar` mapping supports shadcn CLI destinations; source modules use relative imports.
- Edit src/styles.css, then run `pnpm build:css`. Keep host page styles in the demo
  or consumer app. Calendar styles, portals, and animations must remain scoped.

## Code organization

Keep date, layout, movement, and resize calculations in React-free `src/core/`
modules. Preview and commit must share their resolution logic. Preserve event IDs,
custom fields, and metadata when editing or moving events. Use structured drag IDs.

Use the shared event renderer and shadcn control variants. Keep overflow controls
clear of labels and resize grips; the [design guide](event-calendar/design.md) and
[overlap rules](event-calendar/overlap-layout.md) define presentation constraints.
Each calendar owns its locale state and must leave host localization untouched.

See [architecture](event-calendar/architecture.md) for subsystem responsibilities
and [releasing](RELEASING.md) for publishing instructions.
