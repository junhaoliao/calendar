# Plan 004: Deduplicate quarter-hour snapping and fold the README movement section into the API pointer

## Approved implementation amendments

Status: DONE. The user approved the revised review on 2026-10-08.
These amendments supersede conflicting historical steps and done criteria below.

Share snapping between fallback and target. Compare the actual fallback start against target.time in boundary tests. Integrate movement guidance into the existing README section.


> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: written against commit `88930af` **plus the
> uncommitted `resolveEventMove` feature**. Confirm
> `grep -c "Math.min(1425, Math.round(" src/core/move.ts` prints `2`, and that
> `README.md` ends with a `## Host-defined event movement` section placed after
> `## Design and maintenance`. On mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/003-move-rejection-signaling.md (only to avoid edit conflicts in `src/core/move.ts`; there is no logical dependency)
- **Category**: tech-debt / docs
- **Planned at**: commit `88930af` + uncommitted working tree, 2026-10-08

## Why this matters

The quarter-hour snap and the last-slot clamp (`15`, `1425`) are now duplicated
in `src/core/move.ts`, in `moveEvent` (built-in fallback) and in `moveTarget`
(the value hosts receive as `target.minute`). If they drift apart, the
resolver's `target` and its `defaultResult` disagree, which breaks the
"preview equals commit" guarantee. Separately, the README got a verbatim copy
of the `docs/API.md` movement section, appended **after** the licence footer.

## Current state

- `src/core/move.ts` (inside `moveEvent`, ~line 47-49):

  ```ts
  if (typeof target.minute !== "undefined") {
      const dropped = startOfDay(target.date);
      dropped.setMinutes(Math.max(0, Math.min(1425, Math.round(target.minute / 15) * 15)));
  ```
- `src/core/move.ts` (inside `moveTarget`, ~line 108):

  ```ts
  const minute = lane === "timed" ? Math.max(0, Math.min(1425, Math.round(data.minute! / 15) * 15)) : null;
  ```
- `src/core/move.test.ts:44` already covers the `1425` clamp through `moveEvent`.
- `README.md` headings: `## Use` (33), `## Events and metadata` (76),
  `## Themes and portals` (101), `## Examples and validation` (138),
  `## Design and maintenance` (174), `## Host-defined event movement` (190, appended last).
  Lines 96-99 (in "Events and metadata"):

  ```md
  Optional controlled `date`/`view` navigation, `onEventClick`/`onSlotClick`
  workflow overrides, `renderEvent`, `onNotification({action, event})` and `readOnly` are documented
  in [the API](docs/API.md). Accessible feedback is built in; external toasts are
  optional. Changes are callbacks, not persistence transactions.
  ```
- `docs/API.md` also ends with an identical `## Host-defined event movement`
  section. Keep that one; API.md is the reference.

Conventions: module-level `const` constants in SCREAMING_SNAKE_CASE (see
`DEFAULT_TIMED_DURATION_MINUTES` at the top of `move.ts`), JSDoc with
`@param`/`@return` on helpers (see `timedConversionDuration`), exports
collected at the bottom. Run `pnpm lint:fix` before fixing lint by hand;
`pnpm format:check` enforces Prettier on Markdown.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Move tests | `pnpm exec vitest run src/core/move.test.ts src/core/move-resolver.test.ts` | all pass |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint:fix` | exit 0 |
| Format check | `pnpm format:check` | exit 0 |
| Full | `pnpm verify` | exit 0 |

## Scope

**In scope:** `src/core/move.ts`, `src/core/move.test.ts`, `README.md`.

**Out of scope:** `time-column.tsx` and `editor-fields.tsx`, which use `index * 15` for slot generation (a related but different concern; changing slot IDs risks breaking the browser tests). Also `docs/API.md`.

## Git workflow

Do NOT commit or push (project rule). If the operator asks: `refactor: share quarter-hour snapping`.

## Steps

### Step 1: Extract the snap helper

In `src/core/move.ts`, below `DEFAULT_TIMED_DURATION_MINUTES`, add:

```ts
const SNAP_MINUTES = 15;
const LAST_SLOT_MINUTE = 24 * 60 - SNAP_MINUTES;

/**
 * Snaps a wall-clock minute to the nearest quarter hour inside one day.
 *
 * @param minute Raw minute from a drop target.
 * @return A minute from 0 to LAST_SLOT_MINUTE.
 */
const snapMinute = (minute: number): number =>
    Math.max(0, Math.min(LAST_SLOT_MINUTE, Math.round(minute / SNAP_MINUTES) * SNAP_MINUTES));
```

Replace both inline expressions with `snapMinute(target.minute)` and `snapMinute(data.minute!)`. Add `snapMinute` to the bottom export list next to `moveTarget`.

**Verify**: `grep -c "1425" src/core/move.ts` → `0`; `pnpm exec vitest run src/core/move.test.ts src/core/move-resolver.test.ts` → all pass.

### Step 2: Pin the shared behavior with a test

In `src/core/move.test.ts`, import `snapMinute` and `moveTarget` and add:

```ts
it.each([
    [7, 0],
    [8, 15],
    [-30, 0],
    [1440, 1425],
])("snaps %i to %i for both the fallback and the resolver target", (raw, snapped) => {
    expect(snapMinute(raw)).toBe(snapped);
    expect(moveTarget({date: new Date(2026, 9, 8), minute: raw})?.minute).toBe(snapped);
});
```
Follow the existing `describe` and `it.each` style in that file.

**Verify**: `pnpm exec vitest run src/core/move.test.ts` → all pass, including 4 new cases.

### Step 3: README

- Delete the whole `## Host-defined event movement` section at the end of `README.md`, from that heading to the end of the file.
- In the "Events and metadata" paragraph (lines 96-99), add the resolver to the list. Change "`renderEvent`, `onNotification({action, event})` and `readOnly` are documented" to "`renderEvent`, `onNotification({action, event})`, `readOnly` and the `resolveEventMove` drag policy hook are documented". After that paragraph, add one new sentence: "`resolveEventMove` lets you decide what a drag does: return the updated event, or reject the move (see [drag rules](docs/event-calendar/drag-rules.md))."

**Verify**: `grep -c "## Host-defined event movement" README.md` → `0`; `grep -c "resolveEventMove" README.md` → `2`; `pnpm format:check` → exit 0. If formatting fails on README, run `pnpm exec prettier --write README.md` and re-check.

### Step 4: Full checks

**Verify**: `pnpm lint:fix` → exit 0; `pnpm typecheck` → exit 0; `pnpm verify` → exit 0.

## Test plan

- New: the 4-case `it.each` in `move.test.ts` asserting that `snapMinute` and `moveTarget` agree.
- Existing: `move.test.ts:44` (the 1425 clamp through `moveEvent`) must still pass.

## Done criteria

- [ ] `grep -c "1425" src/core/move.ts` → 0
- [ ] `pnpm test` exits 0 with the 4 new cases
- [ ] README has no trailing movement section and mentions `resolveEventMove` in "Events and metadata"
- [ ] `pnpm verify` exits 0
- [ ] Only `src/core/move.ts`, `src/core/move.test.ts`, `README.md` (and `plans/README.md`) changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- `move.ts` has more than two snap expressions, or they use different constants. That means drift; report it.
- Any existing move test changes its expected values after step 1. The refactor must be behavior-neutral.

## Maintenance notes

- If snapping becomes configurable, `snapMinute` is the single place to thread
  the setting through. Expose it to resolvers as a `number` on `EventMoveTarget`.
- The slot generators (`time-column.tsx:78-80`, `editor-fields.tsx:110-113`)
  still hard-code 15. Unify them in a follow-up if snapping becomes configurable.
