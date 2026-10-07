# Plan 002: Trim the public move-resolver contract and treat resolver exceptions as rejection

## Approved implementation amendments

Status: DONE. The user approved the revised review on 2026-10-08.
These amendments supersede conflicting historical steps and done criteria below.

Remove public originalEvent; event remains the current unconverted event. Keep scalar pickup schedule guards. Keep dayOffset, offsetMilliseconds and conventions; widen conventions.snapMinutes to number. Compute anchors once at pickup. Catch and log resolver exceptions, rejecting without accepting the fallback.


> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: written against commit `88930af` **plus the
> uncommitted `resolveEventMove` feature**. Confirm that
> `grep -n "offsetMilliseconds\|originalEvent\|EventMoveConventions" src/core/types.ts`
> shows lines 37, 55, 60 and 63, and that `src/core/move.ts:116-160` matches the
> `resolveMove` excerpt below. On mismatch, STOP.

## Status

- **Priority**: P1 (must land before the package is published; it is currently `private`, version 0.1.0)
- **Effort**: M
- **Risk**: LOW (type-checked, mechanical; the public API is unpublished)
- **Depends on**: none (plan 001 is independent; plan 003 depends on this one)
- **Category**: tech-debt / interface
- **Planned at**: commit `88930af` + uncommitted working tree, 2026-10-08

## Why this matters

The new `resolveEventMove` API exposes more than hosts need, and every extra
field becomes a breaking change to remove once published:

1. **`EventMoveConventions`/`context.conventions`** is a constant object whose
   fields are literal types (`snapMinutes: 15`). It carries no runtime
   information, and making snapping configurable later would be a type break.
   It belongs in documentation.
2. **`anchor.offsetMilliseconds`** is just `segmentStart - event.start`.
3. **`context.originalEvent`** differs from `context.event` only in non-schedule
   fields, because any schedule change since pickup already cancels the move.
   It confuses hosts about which one to use.
4. **The draggable carries two anchors.** It has the legacy `anchor: Date`
   (still used elsewhere) and a full `moveAnchor` object rebuilt on every render.
   `beginDrag` then copies the `moveAnchor` dates back. Pass two primitives and
   derive the anchor once in `beginDrag`.
5. **A resolver that throws crashes the calendar.** The resolver runs during
   React render (drag preview), and there is no error boundary. Catch, log with
   `console.error`, and reject the move.

## Current state

- `src/core/types.ts` — public data contracts. Lines 31-75:

  ```ts
  interface EventMoveAnchor {
      /** Local date of the grabbed day/continued segment. */
      date: Date;
      /** Logical start of that segment, not the pointer's position. */
      segmentStart: Date;
      dayOffset: number;
      offsetMilliseconds: number;
      lane: EventMoveLane;
      source: "grid" | "popup";
  }
  ...
  interface EventMoveContext<TEvent extends CalendarEvent = CalendarEvent> {
      /** Unconverted event, including current consumer fields. */
      event: TEvent;
      /** Snapshot at pickup, before any concurrent consumer update. */
      originalEvent: TEvent;
      anchor: EventMoveAnchor;
      target: EventMoveTarget;
      defaultResult: TEvent;
      /** Built-in date/time contract. Resolver output is never snapped again. */
      conventions: EventMoveConventions;
  }

  interface EventMoveConventions {
      readonly allDayEnd: "inclusive";
      ... (6 readonly literal fields)
  }
  ```
  The second `export type {...}` block at the end of the file lists `EventMoveConventions`.

- `src/core/move.ts:87-100` — `moveAnchor(event, date, lane, source = "grid")` builds the anchor, including `offsetMilliseconds: segmentStart.getTime() - event.start.getTime()` (line 98).
- `src/core/move.ts:116-160` — `resolveMove(event, originalEvent, anchor, target, resolver?, duration)`:

  ```ts
  const candidate = resolver
      ? resolver({
            event: copyEvent(event),
            originalEvent: copyEvent(originalEvent),
            anchor: {...anchor, date: new Date(anchor.date), segmentStart: new Date(anchor.segmentStart)},
            target: {...target, date: new Date(target.date), time: target.time ? new Date(target.time) : null},
            defaultResult: fallback,
            conventions: { allDayEnd: "inclusive", ... },
        })
      : fallback;
  // Invalid results reject just like null; identity is never replaced.
  if (!candidate || candidate.id !== event.id || ... ) return null;
  return copyEvent(candidate);
  ```

- `src/components/event-calendar/use-calendar-controller.ts`:
  - lines 33-40: `interface DragPickup { id; startTime; endTime; allDay; anchor: EventMoveAnchor; original: CalendarEvent; }`
  - lines 249-276 (`beginDrag`): reads `source.data` as `{event?, anchor?: Date, moveAnchor?: EventMoveAnchor}`; if `moveAnchor` is present it copies it with new `Date`s, else calls `moveAnchor(original, new Date(anchorTime), original.allDay ? "all-day" : "timed")`; sets `original: copyEvent(original)`.
  - line 305: `resolveMove(current, pickup.original, pickup.anchor, target, resolver, duration)`.
- `src/components/event-calendar/event-item.tsx:201-213` (`DraggableEvent`) — draggable data:

  ```tsx
  data: {
      anchor: day,
      moveAnchor: moveAnchor(
          event,
          day,
          variant.variant === "bar" ? (variant.hostView === "month" ? "month" : "all-day") : "timed",
          variant.variant === "popover-row" ? "popup" : "grid",
      ),
      dragScope: capabilities.dragScope,
      event: event,
  },
  ```
  The legacy `anchor: day` must stay. `time-column.tsx:125`, the resize code and many tests read it.

- Re-exports of `EventMoveConventions`: `src/components/event-calendar/types.ts:81`,
  `src/index.ts:19`, `src/public-api.test.ts:21,56,95`,
  `examples/consumer/main.tsx:12,25-26`, `examples/consumer/types.cts:10,30-31`.
- Tests touching removed fields: `src/core/move-resolver.test.ts` (destructures
  `originalEvent`/`conventions`, asserts `offsetMilliseconds` twice, and passes
  the event twice to every `resolveMove(...)` call). Also
  `src/components/event-calendar/use-calendar-controller.test.ts:137-138`
  (`originalEvent` in a resolver mock).
- Docs: `docs/API.md` lines 21, 25, 169. `docs/event-calendar/drag-rules.md`
  table rows for `originalEvent` (line 41), `anchor.offsetMilliseconds` (45) and
  `conventions` (52), plus the sentence "Exceptions are programming errors and
  are not a fallback to an accepted move." `README.md:192` mentions `originalEvent`.

Conventions: 4-space indent, double quotes, `{a}` no inner spaces, exports at
file bottom, short JSDoc on public types. No `console` usage exists in `src/`
yet, and ESLint has no `no-console` rule. Run `pnpm lint:fix` before fixing
lint by hand.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `pnpm typecheck` | exit 0 |
| Resolver unit tests | `pnpm exec vitest run src/core/move-resolver.test.ts` | all pass |
| Controller tests | `pnpm exec vitest run src/components/event-calendar/use-calendar-controller.test.ts` | all pass |
| Lint | `pnpm lint:fix` | exit 0 |
| All unit tests | `pnpm test` | all pass |
| Full | `pnpm verify` | exit 0 (needs Playwright browsers) |

## Scope

**In scope:**
- `src/core/types.ts`, `src/core/move.ts`, `src/core/move-resolver.test.ts`
- `src/components/event-calendar/types.ts`, `src/components/event-calendar/use-calendar-controller.ts`, `src/components/event-calendar/use-calendar-controller.test.ts`, `src/components/event-calendar/event-item.tsx`
- `src/index.ts`, `src/public-api.test.ts`
- `examples/consumer/main.tsx`, `examples/consumer/types.cts`
- `docs/API.md`, `docs/event-calendar/drag-rules.md`, `README.md` (only the `originalEvent` mention)

**Out of scope:**
- The legacy `anchor: day` draggable field and its readers.
- `EventMoveTarget` (`minute` plus `time` is a deliberate wall-clock/instant pair; keep both).
- Rejection reasons and notifications: that is plan 003.
- The resolution cache in `resolveDrag` (other than the `resolveMove` call's arguments).

## Git workflow

Do NOT commit or push (project rule). If the operator asks: `refactor: trim move resolver contract`.

## Steps

### Step 1: Remove `conventions` and `EventMoveConventions`

- `src/core/types.ts`: delete the `conventions` field and its comment from
  `EventMoveContext`, delete `interface EventMoveConventions`, and remove it
  from the export list. Add this JSDoc above `interface EventMoveContext`:
  `/** Built-in conventions: inclusive all-day ends, exclusive timed ends, local calendar days, 15-minute snapping, forward DST-gap and earlier DST-fold resolution. Resolver output is never snapped again. */`
- `src/core/move.ts`: delete the `conventions: {...}` object in `resolveMove`.
- Remove the `EventMoveConventions` re-export from `src/components/event-calendar/types.ts` and `src/index.ts`. Remove the entries in `src/public-api.test.ts` (import, `MAIN_TYPES` string, `_UsedTypes` tuple).
- `examples/consumer/main.tsx` and `examples/consumer/types.cts`: remove the import and the two `conventions` lines.
- `src/core/move-resolver.test.ts`: remove `conventions` from the first test's destructuring and delete its `expect(conventions).toEqual({...})`.
- Docs: delete the `EventMoveConventions` row in `docs/API.md` (line 25), drop "and conventions" from line 21, and delete the `conventions` table row in `drag-rules.md`. Below that table, add one sentence: "Built-in conventions: inclusive all-day ends, exclusive timed ends, local calendar days, 15-minute snapping, forward DST-gap and earlier DST-fold resolution."

**Verify**: `pnpm typecheck` → exit 0; `grep -rn "EventMoveConventions\|conventions:" src examples docs README.md` → no matches.

### Step 2: Remove `anchor.offsetMilliseconds`

- Delete the field from `EventMoveAnchor` (`types.ts:37`) and its line in `moveAnchor` (`move.ts:98`).
- `move-resolver.test.ts`: delete the `offsetMilliseconds:` lines in the two `toMatchObject` calls.
- `drag-rules.md`: delete the `anchor.offsetMilliseconds` row.

**Verify**: `pnpm typecheck` → exit 0; `grep -rn offsetMilliseconds src docs tests demo examples` → no matches.

### Step 3: Remove `originalEvent`

- `types.ts`: delete `originalEvent` and its comment from `EventMoveContext`.
- `move.ts`: remove the `originalEvent: T` parameter from `resolveMove` (new signature `resolveMove(event, anchor, target, resolver?, duration)`), and remove the `originalEvent:` context line.
- `use-calendar-controller.ts`: remove `original` from `DragPickup`, the `original: copyEvent(original),` line in `beginDrag`, and the `pickup.original` argument at line 305. Remove `copyEvent` from the import if it becomes unused.
- `move-resolver.test.ts`: in **every** `resolveMove(` call, delete the second argument (the repeated event). Remove `originalEvent` from destructurings. Delete `expect(event).toEqual(originalEvent);` and `originalEvent.end.setFullYear(2000);`.
- `use-calendar-controller.test.ts:137-138`: remove `originalEvent` from the mock's destructuring and delete the `expect(originalEvent.title)...` line. Rename that test to `"refreshes consumer data for resolution"`.
- Docs: delete the `originalEvent` row in `drag-rules.md`. In `docs/API.md` line 21, change "Current unconverted event, pickup snapshot, logical anchor..." to "Current unconverted event, logical anchor, destination and fallback". In `docs/API.md:169` and `README.md:192`, change `({event, originalEvent, anchor, target, defaultResult})` to `({event, anchor, target, defaultResult})`.

**Verify**: `pnpm typecheck` → exit 0; `grep -rn originalEvent src docs tests demo examples README.md` → no matches; `pnpm exec vitest run src/core/move-resolver.test.ts src/components/event-calendar/use-calendar-controller.test.ts` → all pass.

### Step 4: Pass anchor primitives instead of a prebuilt anchor object

- `event-item.tsx` `DraggableEvent` data: replace the `moveAnchor: moveAnchor(...)` entry with two primitives:

  ```tsx
  moveLane: variant.variant === "bar" ? (variant.hostView === "month" ? "month" : "all-day") : "timed",
  moveSource: variant.variant === "popover-row" ? "popup" : "grid",
  ```
  Remove the now-unused `moveAnchor` import from `event-item.tsx`.
- `use-calendar-controller.ts` `beginDrag`: type the source data as
  `{event?: CalendarEvent; anchor?: Date; moveLane?: EventMoveLane; moveSource?: EventMoveAnchor["source"]} | undefined`.
  Replace the `anchor:` ternary with:

  ```ts
  anchor: moveAnchor(
      original,
      new Date(anchorTime),
      source?.moveLane ?? (original.allDay ? "all-day" : "timed"),
      source?.moveSource ?? "grid",
  ),
  ```
  Import the `EventMoveLane` type from `./types`.

**Verify**: `pnpm typecheck` → exit 0; `grep -rn "moveAnchor:" src` → no matches; `pnpm test` → all pass.

### Step 5: Treat resolver exceptions as rejection

In `move.ts` `resolveMove`, replace the `const candidate = resolver ? resolver({...}) : fallback;` expression with:

```ts
let candidate: T | null = fallback;
if (resolver) {
    try {
        candidate = resolver({ /* same context object as before */ });
    } catch (error) {
        // A host policy bug rejects this move instead of unmounting the calendar mid-drag.
        console.error("resolveEventMove threw; the move was rejected.", error);
        candidate = null;
    }
}
```

Add a test to `move-resolver.test.ts`:

```ts
it("rejects and logs when the resolver throws", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = resolveMove(event, moveAnchor(event, date(4), "all-day"), moveTarget({date: date(8)})!, () => {
        throw new Error("host bug");
    });
    expect(result).toBeNull();
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
});
```
(Import `vi` from `vitest`.) In `drag-rules.md`, replace "Exceptions are programming errors and are not a fallback to an accepted move." with "A thrown exception is logged with `console.error` and rejects the move; it never falls back to an accepted move."

**Verify**: `pnpm exec vitest run src/core/move-resolver.test.ts` → all pass including the new test.

### Step 6: Full checks

**Verify**: `pnpm lint:fix` → exit 0; `pnpm typecheck` → exit 0; `pnpm test` → all pass; `pnpm verify` → exit 0.
`tests/browser/popover-drag.spec.ts:72` asserts metadata `pickup` with `toMatchObject({source: "popup", lane: "timed", dayOffset: 0})`. That still holds without `offsetMilliseconds`.

## Test plan

- Updated: `move-resolver.test.ts` (signature and removed fields), `use-calendar-controller.test.ts` (one mock).
- New: the resolver-throws test (step 5).
- The browser suite (`pnpm verify`) checks that the popup and grid anchors still produce identical commits.

## Done criteria

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0, including the new throw test
- [ ] `grep -rn "EventMoveConventions\|offsetMilliseconds\|originalEvent\|moveAnchor:" src examples docs tests demo README.md` → no matches
- [ ] `pnpm verify` exits 0
- [ ] Only in-scope files changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- Any file outside the scope list references a removed field. `demo/move-events.ts` is fine: it reads `anchor.dayOffset` only. If something else turns up, report it rather than widening scope.
- A browser test fails on anchor values after step 4. The popup or grid lane derivation would then differ from the old `moveAnchor` call; report it, don't patch the tests.
- `pnpm lint:fix` reports a `no-console` violation (a rule exists that recon missed).

## Maintenance notes

- Plan 003 changes `EventMoveResolver`'s return type and `resolveMove`'s return
  shape. It assumes the signature `resolveMove(event, anchor, target, resolver?, duration)` from this plan.
- If snapping becomes configurable, expose it as a `number` on `EventMoveTarget`
  (e.g. `snapMinutes`), not as a literal-typed conventions object.
- Reviewer: check that no host-visible behavior changed other than the removed
  fields and the throw→reject path.
