# Plan 003: Signal move rejections properly, with host-supplied reasons and an `onNotification` event

## Approved implementation amendments

Status: DONE. The user approved the revised review on 2026-10-08.
These amendments supersede conflicting historical steps and done criteria below.

Distinguish accepted/rejected outcomes from inapplicable drags. Support host-localized reasons. Add onMoveRejected and public EventMoveRejected; do not widen CalendarNotificationAction. No hover/cancel/stale callbacks. Replace the fixed timer with explicit dismissal and clearing on the next interaction; retain the success status region.


> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: written against commit `88930af` **plus the
> uncommitted `resolveEventMove` feature**, and it **assumes plan 002 has
> landed**. Confirm:
> - `grep -n "originalEvent\|conventions" src/core/move.ts` → no matches (plan 002 done);
> - `grep -n "moveRejected" src/components/event-calendar/use-calendar-controller.ts` → matches at the `useState` (~line 98) and in the return object;
> - `src/components/event-calendar/calendar-surface.tsx` contains `{!moveRejected && announcement}`.
> If any check fails, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (changes a public union type and a user-visible feedback path)
- **Depends on**: plans/002-trim-and-harden-move-contract.md
- **Category**: bug + direction (revised scope approved on 2026-10-08)
- **Planned at**: commit `88930af` + uncommitted working tree, 2026-10-08

## Why this matters

Three related defects and one approved feature, all about how a rejected move is
signalled:

1. **Bug: the banner is permanent.** After a rejected drop, the controller sets
   `moveRejected = true`. It is cleared only by the next drag start or the next
   success notification, so a red "Move not allowed" `role="alert"` bar stays
   under the calendar indefinitely. It also blanks the screen-reader status
   region the whole time.
2. **Bug: "rejected" and "not applicable" are conflated.** `resolveDrag` returns
   `null` both when the host rejects and when the move doesn't apply (no
   pickup, read-only, invalid target, event deleted or rescheduled since
   pickup). The dragged item then shows "Move not allowed" for the latter,
   although `endDrag` treats those cases as silent no-ops.
3. **Duplication.** `endDrag` repeats the staleness check that `resolveDrag` already performs.
4. **Feature (approved).** Hosts need to explain rejections ("Room is booked").
   A resolver may now return `{reject: "<host-localized reason>"}`. The reason
   is shown on the dragged item and in the alert. Every rejected **drop** is
   reported as `onNotification({action: "rejected", event, reason})` so hosts
   can toast it.

## Target design (implement exactly this)

Public types (`src/core/types.ts`):

```ts
/** Rejects a move with a host-localized, user-visible reason. Has no `id`, so it can't be mistaken for an event. */
interface EventMoveRejection {
    reject: string;
    id?: never;
}

/** Pure synchronous resolution: an event accepts, null or {reject} rejects. Returned dates are used exactly. */
type EventMoveResolver<TEvent extends CalendarEvent = CalendarEvent> = (
    context: EventMoveContext<TEvent>,
) => TEvent | EventMoveRejection | null;
```

Internal result (`src/core/move.ts`, exported type, not public):

```ts
/** Outcome of the shared preview/commit pipeline. A null reason means the built-in text. */
type MoveResolution<T extends CalendarEvent> =
    | {status: "accepted"; event: T}
    | {status: "rejected"; reason: string | null};
```

`resolveMove(...)` returns `MoveResolution<T>` (never null):
- resolver returns `null`, throws, or returns an invalid event → `{status: "rejected", reason: null}`;
- resolver returns an object **without an own `id` key** whose `reject` is a string → `{status: "rejected", reason: reject.trim() || null}`;
- otherwise run the existing validity checks → `{status: "accepted", event: copyEvent(candidate)}` or `{status: "rejected", reason: null}`.

Controller action (`CalendarActions.resolveDrag`): `(target: DropData) => MoveResolution<CalendarEvent> | null`.
`null` now means **only** "no applicable move": no pickup, invalid target, read-only, or the event was deleted or rescheduled since pickup. Never show rejection UI for `null`.

Notifications (`src/components/event-calendar/types.ts`):

```ts
type CalendarNotificationAction = "added" | "updated" | "deleted" | "moved" | "resized" | "rejected";

/** A completed mutation request, or a rejected move (the event is unchanged). Added events have no id yet. */
type CalendarNotification<TEvent extends CalendarEvent = CalendarEvent> =
    | {action: "added"; event: NewCalendarEvent}
    | {action: Exclude<CalendarNotificationAction, "added" | "rejected">; event: TEvent}
    | {action: "rejected"; event: TEvent; reason: string | null};
```

Built-in feedback: controller state `rejection: {reason: string | null} | null`.
It is set on a rejected drop and cleared after `REJECTION_FEEDBACK_MS = 5000`,
or on the next drag start or the next success notification. The status region
always renders `announcement`. The visible alert gets
`data-slot="move-rejection"` and shows `reason ?? <i18n announcement.moveRejected>`.

## Current state

- `src/core/types.ts` — `EventMoveResolver` returns `TEvent | null` (after plan 002, near line ~60).
- `src/core/move.ts` — `resolveMove(event, anchor, target, resolver?, duration): T | null`. After plan 002 its tail is:

  ```ts
  // Invalid results reject just like null; identity is never replaced.
  if (
      !candidate ||
      candidate.id !== event.id ||
      ...
  )
      return null;
  return copyEvent(candidate);
  ```
- `src/components/event-calendar/calendar-context.tsx:22` — `resolveDrag: (target: DropData) => CalendarEvent | null;`
- `src/components/event-calendar/use-calendar-controller.ts`:
  - lines 75-86: `announcement` is built from a `{added, updated, deleted, moved, resized}[lastNotification.action]` object literal. Adding `"rejected"` to the action union makes this a type error unless a `rejected` key is added.
  - lines 90-98: `resolution` ref (cache with `result: CalendarEvent | null`) and `const [moveRejected, setMoveRejected] = useState(false);`
  - lines 132-145: the existing clock `useEffect`. Match its style, which always returns a cleanup function.
  - line 153-157: `announce` calls `setMoveRejected(false)`.
  - line 246-247: `beginDrag` calls `setMoveRejected(false)`.
  - lines 278-308: `resolveDrag` (stale check at 282-289, cache at 290-307).
  - lines 309-355: `endDrag`:

    ```ts
    const current = latest.current.events.find((item) => item.id === pickup.id);
    if (
        !current ||
        current.start.getTime() !== pickup.startTime ||
        ... ) {
        dragPickup.current = null;
        resolution.current = null;
        return;
    }
    const updated = resolveDrag(target);
    dragPickup.current = null;
    resolution.current = null;
    if (!updated) {
        setMoveRejected(true);
        return;
    }
    if (!eventDatesChanged(current, updated)) {
        return;
    }
    latest.current.onEventUpdate?.(updated);
    announce({action: "moved", event: updated});
    ```
  - line 403: returns `moveRejected`.
- `src/components/event-calendar/calendar-surface.tsx:37-38` destructures `moveRejected`. Lines 106-113:

  ```tsx
  <span className="sr-only" role="status">
      {!moveRejected && announcement}
  </span>
  {moveRejected && (
      <div role="alert" className="px-3 py-1 text-sm text-destructive">
          {tCalendar(($) => $.announcement.moveRejected)}
      </div>
  )}
  ```
- `src/components/event-calendar/event-item.tsx`:
  - `EventSurfaceProps` has `rejected?: boolean`. Line 126: `data-move-rejected={rejected || undefined}`. Lines 175-183 render `<span role="alert" className="truncate">{tCalendar(($) => $.announcement.moveRejected)}</span>` when `rejected`.
  - `DraggableEvent` lines 216-220:

    ```tsx
    const resolved = isDragging && destination?.date instanceof Date ? resolveDrag(destination) : undefined;
    const preview = resolved ?? event;
    const rejected = resolved === null;
    ```
- `src/components/event-calendar/use-move-preview.ts` returns `resolveDrag(destination)` (an event or null) to Month/Time views.
- `src/event-calendar.tsx` — after plan 001 a `useMemo` adapter returns `hostResolveEventMove(context as EventMoveContext<TEvent>) ?? null`. Its return type follows `EventCalendarProps["resolveEventMove"]` automatically.
- `demo/main.tsx:141-150` — `onNotification` always calls `toast.success(...)`. `demo/move-events.ts` exports `moveEvents, hostMoveResolver, rejectMove, pointMove`. `demo/main.tsx:109-117` maps the `?resolver=` query param to them.
- Tests to update:
  - `src/components/event-calendar/use-calendar-controller.test.ts` lines ~82-168. Several tests use `resolveDrag(...)` results as events (`before?.title`, `toHaveBeenCalledExactlyOnceWith(after)`, `toBe(preview)`), and the `it.each(["reject", "cancel", "unchanged"])` test expects no notification and reads `result.current.moveRejected`.
  - `src/core/move-resolver.test.ts` — every `resolveMove(...)!` result is used as an event.
  - `tests/browser/drag.spec.ts:216-233` and `:290-308` — rejection tests. They expect `data-notifications` `"0"` (lines 231, 307) and use `page.getByRole("alert")` (lines 230, 305).
- Public exports: `src/components/event-calendar/types.ts` re-export block (~line 73-82), `src/index.ts`, `src/public-api.test.ts` (`MAIN_TYPES` and `_UsedTypes`).

Conventions: 4-space indent, double quotes, `{a}` without inner spaces,
`const` arrow functions, exports at the bottom. User-visible library strings go
through i18n (`tCalendar`); `src/i18n/no-hardcoded-text.test.ts` enforces it.
Host reasons are host-localized and rendered verbatim. Run `pnpm lint:fix` before fixing lint by hand.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `pnpm typecheck` | exit 0 |
| Core tests | `pnpm exec vitest run src/core/move-resolver.test.ts` | all pass |
| Controller tests | `pnpm exec vitest run src/components/event-calendar/use-calendar-controller.test.ts` | all pass |
| Lint | `pnpm lint:fix` | exit 0 |
| Unit tests | `pnpm test` | all pass |
| Browser + package | `pnpm verify` | exit 0 (needs Playwright browsers) |
| Browser subset | `pnpm demo:build && pnpm exec playwright test tests/browser/drag.spec.ts` | all pass |

## Scope

**In scope:**
- `src/core/types.ts`, `src/core/move.ts`, `src/core/move-resolver.test.ts`
- `src/components/event-calendar/types.ts`, `calendar-context.tsx`, `use-calendar-controller.ts`, `use-calendar-controller.test.ts`, `calendar-surface.tsx`, `event-item.tsx`, `use-move-preview.ts`
- `src/index.ts`, `src/public-api.test.ts`
- `demo/main.tsx`, `demo/move-events.ts`
- `tests/browser/drag.spec.ts`
- `docs/API.md`, `docs/event-calendar/drag-rules.md`
- `examples/consumer/types.cts` (add one type-level proof of `{reject}`)

**Out of scope:**
- i18n JSON files. No new keys: the existing `announcement.moveRejected` stays the default text.
- Resize rejections: `commitResize` doesn't use the resolver.
- The resolution cache's equality logic (other than the stored result type).
- `README.md` (plan 004 rewrites that section).

## Git workflow

Do NOT commit or push (project rule). If the operator asks: `feat: host rejection reasons for event moves`.

## Steps

### Step 1: Core types and `resolveMove`

1. In `src/core/types.ts` add `EventMoveRejection` and change `EventMoveResolver` exactly as in "Target design". Export `EventMoveRejection` in the second `export type {...}` block.
2. In `src/core/move.ts`, add and export `type MoveResolution<T>` (exact shape above). Change `resolveMove`'s return type to `MoveResolution<T>`:
   - the `catch` branch (from plan 002) and `null` → `return {status: "rejected", reason: null};`
   - before the validity `if`, add the rejection detection:

     ```ts
     if (candidate && !Object.hasOwn(candidate, "id") && typeof (candidate as EventMoveRejection).reject === "string") {
         return {status: "rejected", reason: (candidate as EventMoveRejection).reject.trim() || null};
     }
     ```
     If `Object.hasOwn` is unavailable for the TS `lib` target, use `!Object.prototype.hasOwnProperty.call(candidate, "id")`.
   - the validity `if` → `return {status: "rejected", reason: null};`, and the success path → `return {status: "accepted", event: copyEvent(candidate as T)};`
   - Type `candidate` as `T | EventMoveRejection | null`.
3. Update `src/core/move-resolver.test.ts`:
   - Results that were `resolveMove(...)!` and used as events: assert `expect(result.status).toBe("accepted")`, then use `result.event`. A small local helper is fine:
     `const accepted = <T,>(r: MoveResolution<T>) => { if (r.status !== "accepted") throw new Error(r.reason ?? "rejected"); return r.event; };`
   - In the `it.each([null, ...])` rejection test, expect `toEqual({status: "rejected", reason: null})`.
   - The throw test from plan 002: expect `{status: "rejected", reason: null}`.
   - New tests:
     - `() => ({reject: "Room is booked"})` → `{status: "rejected", reason: "Room is booked"}`;
     - `() => ({reject: "   "})` → `{status: "rejected", reason: null}`;
     - a host event that has a `reject` field **and** an id (`({event}) => ({...event, reject: "not a rejection"})`, cast as needed) → `status: "accepted"`.

**Verify**: `pnpm exec vitest run src/core/move-resolver.test.ts` → all pass. `pnpm typecheck` is expected to FAIL at this point, in the controller and components. That is fine; continue.

### Step 2: Notification types and public exports

1. `src/components/event-calendar/types.ts`: apply the `CalendarNotificationAction` / `CalendarNotification` change from "Target design", and add `EventMoveRejection` to the re-export block.
2. `src/index.ts`: export the type `EventMoveRejection`. `src/public-api.test.ts`: add `EventMoveRejection` to the import, `MAIN_TYPES` and `_UsedTypes`.
3. `examples/consumer/types.cts`: inside the existing `resolveEventMove` proof, add a line proving the rejection shape type-checks, e.g. `if (context.target.lane === "timed") return {reject: "Closed"};` before `return context.defaultResult;`.

### Step 3: Controller

In `use-calendar-controller.ts`:
1. Add a module constant `const REJECTION_FEEDBACK_MS = 5000;` near the imports.
2. Replace `const [moveRejected, setMoveRejected] = useState(false);` with `const [rejection, setRejection] = useState<{reason: string | null} | null>(null);`. Replace both `setMoveRejected(false)` calls (in `announce` and `beginDrag`) with `setRejection(null)`.
3. Add an effect in the style of the clock effect:

   ```ts
   useEffect(() => {
       if (!rejection) {
           return () => {
               // Nothing to dismiss.
           };
       }
       const timer = window.setTimeout(() => {
           setRejection(null);
       }, REJECTION_FEEDBACK_MS);

       return () => {
           window.clearTimeout(timer);
       };
   }, [rejection]);
   ```
4. In the `announcement` object literal add `rejected: ""` with the comment `// Rejections use the visible alert instead.` (`announce` is never called with `rejected`, but the union now contains it).
5. Change the cache's `result` type to `MoveResolution<CalendarEvent>` (import the type from `../../core/move`). `resolveDrag` keeps its `null` early returns; those now mean "not applicable".
6. Rewrite the tail of `endDrag`, from the `const current = ...` stale block through the end, to:

   ```ts
   const outcome = resolveDrag(target);
   const current = latest.current.events.find((item) => item.id === pickup.id);
   dragPickup.current = null;
   resolution.current = null;
   // null: the move no longer applies (deleted, rescheduled or read-only); stay silent.
   if (!outcome || !current) {
       return;
   }
   if (outcome.status === "rejected") {
       setRejection({reason: outcome.reason});
       latest.current.onNotification?.({action: "rejected", event: current, reason: outcome.reason});
       return;
   }
   if (!eventDatesChanged(current, outcome.event)) {
       return;
   }
   latest.current.onEventUpdate?.(outcome.event);
   announce({action: "moved", event: outcome.event});
   ```
   This deletes the duplicated stale block (old lines 332-342). Keep the earlier early-return blocks (cancel/resize/no-target/no-pickup/read-only, and no-source/non-Date target) unchanged.
7. In the returned object replace `moveRejected` with `rejection`.
8. `calendar-context.tsx`: change `resolveDrag` to `(target: DropData) => MoveResolution<CalendarEvent> | null;`, with the JSDoc `/** null: no applicable move (no pickup, invalid target, read-only, or event changed since pickup). */`.

**Verify**: `pnpm typecheck` → errors only in `calendar-surface.tsx`, `event-item.tsx` and `use-move-preview.ts` (fixed next). If errors appear elsewhere, STOP.

### Step 4: Components

1. `use-move-preview.ts`: return `outcome?.status === "accepted" ? outcome.event : null` where `outcome` is the `resolveDrag(...)` result.
2. `event-item.tsx`:
   - `EventSurfaceProps`: replace `rejected?: boolean` with `rejection?: {reason: string | null} | null`. Default `rejection = null`.
   - `data-move-rejected={rejection ? true : undefined}`.
   - The rejected label renders `{rejection.reason ?? tCalendar(($) => $.announcement.moveRejected)}` in the same `<span role="alert" className="truncate">`.
   - `DraggableEvent`:

     ```tsx
     const outcome = isDragging && destination?.date instanceof Date ? resolveDrag(destination) : null;
     const preview = outcome?.status === "accepted" ? outcome.event : event;
     const rejection = outcome?.status === "rejected" ? outcome : null;
     ```
     Pass `rejection={rejection}` to `EventSurface`.
3. `calendar-surface.tsx`: destructure `rejection` instead of `moveRejected`. The status span renders `{announcement}` unconditionally. The alert becomes:

   ```tsx
   {rejection && (
       <div role="alert" data-slot="move-rejection" className="px-3 py-1 text-sm text-destructive">
           {rejection.reason ?? tCalendar(($) => $.announcement.moveRejected)}
       </div>
   )}
   ```

**Verify**: `pnpm typecheck` → exit 0.

### Step 5: Controller tests

In `use-calendar-controller.test.ts`:
1. Add a helper near the top: `const acceptedEvent = (outcome: ReturnType<CalendarActions["resolveDrag"]>) => (outcome?.status === "accepted" ? outcome.event : null);`. Wrap every `result.current.actions.resolveDrag(...)` whose result is used as an event (`before`, `after`, `preview`) with `acceptedEvent(...)`. For the `toBe(preview)` identity assertion, compare the wrapped values; the cache returns the same outcome object, so `.event` is identical.
2. Update `it.each(["reject", "cancel", "unchanged"])`. For `reject`, expect `onNotification` toHaveBeenCalledExactlyOnceWith `{action: "rejected", event: meeting, reason: null}` and `result.current.rejection` toEqual `{reason: null}`. For the others, expect `onNotification` not called and `rejection` null. `onEventUpdate` is never called in any case.
3. New tests:
   - **reason propagates**: resolver `() => ({reject: "Room is booked"})` → after endDrag, `rejection` equals `{reason: "Room is booked"}` and the notification carries the same reason.
   - **auto-dismiss**: `vi.useFakeTimers()` before rendering; reject a drop; `act(() => { vi.advanceTimersByTime(4999); })` → `rejection` still set; `act(() => { vi.advanceTimersByTime(1); })` → `rejection` is null. (`afterEach` already restores real timers.)
   - **next drag clears it**: reject, then `act(() => actions.beginDrag(dragStart()))` → `rejection` null.
   - **stale is not a rejection**: begin a drag, then rerender (via `renderWithProps`) with `events: []`. `resolveDrag({date: new Date(2026, 9, 5), minute: 600})` returns `null`; `endDrag` emits no update or notification, and `rejection` stays null.

**Verify**: `pnpm exec vitest run src/components/event-calendar/use-calendar-controller.test.ts` → all pass.

### Step 6: Demo and browser tests

1. `demo/move-events.ts`: add and export `const reasonMove: EventMoveResolver = ({target, defaultResult}) => (target.lane === "timed" ? {reject: "Room is booked"} : defaultResult);`.
2. `demo/main.tsx`: map `params.get("resolver") === "reason"` to `reasonMove` in the existing ternary. In `onNotification`, keep the counters, then branch: if `notification.action === "rejected"`, call `toast.error(notification.reason ?? "Move not allowed", {position: "bottom-left"})`; otherwise run the existing `toast.success(...)` call unchanged.
3. `tests/browser/drag.spec.ts`:
   - In both rejection tests (`host rejection shows an alert...`, around line 216, and `keyboard: rejected conversion...`, around line 290), replace `page.getByRole("alert")` with `page.locator('[data-slot="move-rejection"]')`, and change the `data-notifications` expectation from `"0"` to `"1"`. Keep the "no success toast" assertion and `data-event-updates` `"0"`.
   - After the alert assertion in the line-216 test, add `await expect(page.locator('[data-slot="move-rejection"]')).toHaveCount(0, {timeout: 8000});` (auto-dismiss).
   - Add a test modeled on the line-216 test (mouse mode only), opening `query: "moves&resolver=reason"` and dragging `move-point` to `"Add event October 7, 2026 at 10:00 AM"`. Expect `result.rejected` `"true"`, `result.text` `"Room is booked"`, the move-rejection alert text `"Room is booked"`, and an error toast: `page.locator('[data-sonner-toast][data-type="error"]')` has count 1.

**Verify**: `pnpm demo:build && pnpm exec playwright test tests/browser/drag.spec.ts` → all pass.

### Step 7: Docs

- `docs/API.md`: in the `onNotification` row, add `rejected` to the action list and add: "`rejected` reports a refused move with the unchanged event and `reason` (host text or null); it is not a mutation." In the `resolveEventMove` row, change "returning the complete `TEvent` or null to reject" to "returning the complete `TEvent`, or `null` / `{reject: reason}` to reject". Add a type row: `EventMoveRejection` | type | `{reject: string}`; a host-localized reason shown on the dragged item and in the alert.
- `docs/event-calendar/drag-rules.md` "Host move resolver" section: document `{reject: reason}` (reason is rendered verbatim, so localize it; blank means the built-in text). Replace "Null/invalid results show visible rejection text and an accessible alert, including on completion, with no success callbacks." with: "Rejected results show the reason (or the built-in text) on the dragged item. A rejected drop shows an alert for 5 seconds and emits one `onNotification` with action `rejected`; it never calls `onEventUpdate`. A deleted or rescheduled event, or a read-only calendar, makes the move inapplicable: no rejection feedback and no callbacks." Also add `{reject: ...}` to the code example (e.g. `if (!canMove(event, target)) return {reject: t("roomBooked")};`).

**Verify**: `grep -n "reject" docs/API.md docs/event-calendar/drag-rules.md` shows the new text.

### Step 8: Full checks

**Verify**: `pnpm lint:fix` → exit 0; `pnpm typecheck` → exit 0; `pnpm test` → all pass; `pnpm verify` → exit 0.

## Test plan

- Core (`move-resolver.test.ts`): reason, blank reason, `reject`-field-with-id is accepted, null/invalid/throw → reason null.
- Controller (`use-calendar-controller.test.ts`): the rejection notification and state, the reason, the 5 s auto-dismiss (fake timers), the next drag clears it, and stale ≠ rejected.
- Browser (`drag.spec.ts`): the updated rejection tests (notification count 1, alert auto-dismisses) and the new host-reason test.

## Done criteria

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0, including the new core and controller tests
- [ ] `pnpm verify` exits 0, including the new browser test
- [ ] `grep -rn "moveRejected" src --include=*.ts --include=*.tsx` → matches only the i18n key usages `$.announcement.moveRejected`
- [ ] `grep -n "{!moveRejected && announcement}" src/components/event-calendar/calendar-surface.tsx` → no matches
- [ ] Only in-scope files changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- Plan 002 hasn't landed (drift check).
- In step 3, typecheck errors appear outside the three expected component files. Some other consumer of `CalendarNotification` or `resolveDrag` exists; report it.
- Sonner's error toast also exposes `data-slot="move-rejection"`, or the new browser assertions are ambiguous for any other reason.
- `no-hardcoded-text.test.ts` fails because of the host reason rendering. Report it; do not add an i18n key for host text.
- A browser test outside the two rejection tests starts failing.

## Maintenance notes

- Adding `"rejected"` to `CalendarNotificationAction` widens a public union.
  Hosts with exhaustive `switch`es will get a compile error. That's acceptable
  before the first publish; call it out in release notes.
- If resize gets a resolver later (`resolveEventResize`), reuse
  `MoveResolution`, `EventMoveRejection` and the `rejection` state. Don't add a
  parallel mechanism.
- Reviewer: check that `endDrag` emits **exactly one** callback per outcome
  (accepted and changed → `onEventUpdate` + `moved`; rejected → `rejected` only;
  stale/unchanged/canceled → nothing). Also check that the status region is no
  longer gated.
