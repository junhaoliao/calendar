# Calendar library validation

Use this guide to run checks, inspect failures, and refresh screenshots.

## Unit, DST and builds

- `pnpm test` runs the full unit and interaction suite. Pure date, move, resize
  and layout suites live under `src/core`; controller, editor and renderer
  tests live beside their components. Locale isolation, resource parity and
  display/data-contract tests live under `src/i18n`.
- `pnpm test:dst` reruns every suite with `TZ=America/Toronto`, including DST
  and exclusive midnight boundaries that depend on a transition timezone.
- `pnpm check` runs non-mutating lint, strict TypeScript, units, DST and the
  distributable build. Run `pnpm lint:fix` before resolving remaining lint issues.
- Builds produce ESM/CommonJS entries, bundled declarations, source maps and
  scoped CSS. The main entry retains its use-client directive; date-math has no
  React/DOM or i18next runtime.

## Production browser acceptance

`pnpm test:browser` builds the standalone demo and runs the Playwright specs
in `tests/browser` against port 4173. They use real mouse, emulated touch and
keyboard input rather than synthetic drag callbacks. The current reports are
written to `artifacts/playwright-report`; failure traces and screenshots are
under `artifacts/playwright-results`.

| Suite                  | Covers                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `calendar.spec.ts`     | CRUD, editor/date controls, slots, navigation, views and responsive containment         |
| `drag.spec.ts`         | Mouse/touch/keyboard movement, conversions, overnight segments and cancellation         |
| `overlap.spec.ts`      | Lane capacity, exact membership, controls, navigation and responsive retention          |
| `popover-drag.spec.ts` | Popup source movement, simultaneous sources, touch/keyboard and dismissal rules         |
| `drag-style.spec.ts`   | Separate controls, canonical feedback metrics and native source identity                |
| `resize.spec.ts`       | Timed/date endpoints, snapping, clamps, metadata, cancellation and internal auto-scroll |

## Packed consumer verification

`pnpm test:package` packs into artifacts and installs the tarball into fresh
separate React 18.3.1 and 19.2.7 projects, using their matching React types.
The host uses package exports and CSS, with no source aliases or Tailwind.
Checks cover NodeNext ESM/CommonJS declarations, ESM/CommonJS imports without a
browser, all four static SSR views from both formats, a built production host,
metadata-safe editing, controlled navigation, editor/date/menu portals, explicit
light/dark themes, custom CSS variables, readOnly and absence of runtime errors.

Host layout checks retain a 13px body margin, Georgia font, visible page overflow,
scrollable content below the calendar and an unrelated `.flex` element's native
block display. Root layout style stays on the root; only custom properties
propagate into portals and event surfaces. Generated animations are namespaced.

Artifacts contain `package-smoke.json`, the tarball, per-version host screenshots
and the Playwright report/trace directories above. Passing temporary consumer
hosts are removed; failed hosts remain at their logged `.tmp` paths for debugging.

## Screenshots

Generate these with `pnpm docs:screenshots`:

- Views: [Month](screenshots/month.png), [Week](screenshots/week.png),
  [Day](screenshots/day.png), [Agenda](screenshots/agenda.png).
- Responsive themes: [Mobile](screenshots/mobile.png),
  [Dark mobile](screenshots/dark-mobile.png).
- Controls: [Editor](screenshots/editor-create.png),
  [Date picker](screenshots/date-picker.png), [Time selector](screenshots/time-select.png),
  [View menu](screenshots/view-menu.png).
- Overlaps: [Column-wide overflow](screenshots/contracts-overflow.png),
  [Event popover](screenshots/contracts-popover.png).

## Repeat

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm verify
```

The standalone demo includes its React/UI runtime, fonts and optional toasts.
Vite may warn when its JavaScript chunk exceeds the default size threshold; see
current `pnpm demo:build` output for sizes. The library externalizes third-party
JavaScript dependencies, so that demo warning does not describe an extra
calendar dependency bundle embedded in the package.

## Coverage limits

Chromium only; touch is emulated, not a physical-device test. Safari/Firefox and
physical-device interaction checks have not been run. SSR imports/static renders
work in both development and production; client effects provide interaction and
responsive measurements. React 18 development SSR can emit layout-effect warnings. Deterministic clocks and consistent
server/client local timezone are needed for stable hydration.

For development setup and demo fixture parameters, see the
[contributor guide](../CONVENTIONS.md).
