> Execution amendment (2026-10-11): origin fallback uses the controller's validated
> `getDragEvent()` instead of `source.data.event`. The mounted source may outlive a
> host deletion, reschedule, or read-only change. The shared applicability check
> preserves null/inapplicable outcomes; the public move and commit contracts are unchanged.

# Plan 008: A dragged grid event stays visible at its origin when the destination is refused or off-grid

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: this plan was written against commit `239dc67`
> **plus an uncommitted "transparent drag source" change** in the working tree,
> so a SHA diff is not meaningful. Run:
> 1. `grep -nF 'return outcome?.status === "accepted" ? outcome.event : null;' src/components/event-calendar/use-move-preview.ts` → one line.
> 2. `grep -nF "filter((event) => event.id !== movePreview.id), movePreview]" src/components/event-calendar/time-column.tsx src/components/event-calendar/time-view.tsx src/components/event-calendar/month-view.tsx` → three lines, one per file.
> 3. `grep -nF "expect(result.destinationSegments).toHaveLength(0);" tests/browser/drag.spec.ts` → one line (~231).
> If any check prints a different number of lines, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (changes what every view shows during refused/off-grid hovers; edits a shared browser-test helper)
- **Depends on**: plans 005, 006 and 007 should land first. There is no logical dependency, but 005/006 add tests to `drag-style.spec.ts` and 007 adds a test to `drag.spec.ts`, the files this plan also edits.
- **Category**: bug (UX) + tests
- **Planned at**: commit `239dc67` + uncommitted working tree, 2026-10-11

## Why this matters

During a drag, the calendar hides the original event and draws a static preview
where it would land. This preview is called `EventMovePreview` and is rendered by
each view from the `useMovePreview()` hook. The dragged DOM node itself stays
mounted, because dnd-kit needs it, but it is made fully transparent. dnd-kit's
placeholder at the origin is `visibility: hidden`. The problem: `useMovePreview()`
only returns an event for **accepted** destinations. When the destination is
**refused** by the host's move policy, or the pointer is **outside the grid**,
there is no preview at all:

- A single-segment event **disappears** from the calendar for the rest of the hover.
- A multi-day or overnight event shows a **hole** where the dragged segment was.
- Keyboard users are focused on a transparent button, so there is **no visible focus**.

After this plan, every grid-sourced drag always has a preview. It shows the
destination when the move is accepted, and otherwise the event at its **original
position**, meaning "dropping now leaves it here." This matches the existing rule
that Escape and outside drops cancel.

The plan also fixes a race in the shared browser-test helper. It currently picks
its preview element with one-shot `count()` calls immediately after the pointer
move and silently falls back to the transparent source.

## Current state

- `src/components/event-calendar/use-move-preview.ts` (whole file):

  ```ts
  import {useDragOperation} from "@dnd-kit/react";
  import {useCalendarActions} from "./calendar-context";
  import type {DropData} from "./types";

  /** All destination surfaces share the controller's cached resolution. */
  const useMoveResolution = () => {
      const {source, target} = useDragOperation();
      const {resolveDrag} = useCalendarActions();
      const destination = target?.data as DropData | undefined;
      return source && destination?.date instanceof Date ? resolveDrag(destination) : null;
  };

  const useMovePreview = () => {
      const outcome = useMoveResolution();
      return outcome?.status === "accepted" ? outcome.event : null;
  };

  export {useMovePreview, useMoveResolution};
  ```
  `useMoveResolution` is also used by `move-feedback.tsx` (announcements and the
  refusal banner). **Its behavior must not change.**
- Every draggable sets its dnd-kit data in `event-item.tsx` (`DraggableEvent`, ~line 184):

  ```ts
  data: {
      anchor: day,
      moveLane: ...,
      moveSource: variant.variant === "popover-row" ? "popup" : "grid",
      dragScope: capabilities.dragScope,
      event: event,
  },
  ```
- Consumers of `useMovePreview()`:
  - `event-item.tsx:221-223`, `EventItem`:
    `const movePreview = useMovePreview(); const moving = movePreview?.id === variant.event.id;`.
    When `moving` is true, the original segment wrapper gets
    `data-move-source` (CSS: `opacity: 0; pointer-events: none`) and its resize
    handles are not rendered. This automatically hides all original segments
    once the hook returns the pickup event.
  - `time-column.tsx:92-99` (timed previews):

    ```ts
    const movePlacements =
        movePreview && !movePreview.allDay
            ? timedPlacements([...events.filter((event) => event.id !== movePreview.id), movePreview], day)
            : [];
    ```
  - `time-view.tsx:72-75` (all-day band previews):

    ```ts
    const moveSegments = movePreview?.allDay
        ? weekSegments([...spanning.filter((event) => event.id !== movePreview.id), movePreview], days)
        : null;
    ```
  - `month-view.tsx:66-71` (month previews):

    ```ts
    const previews = movePreview
        ? weekSegments(
              [...events.filter((event) => event.id !== movePreview.id), movePreview],
              weekDays,
          )
        : null;
    ```
  Resting layouts use the **unmodified** `events` order: `timedPlacements(events, day)`,
  and `resizeSegments(events, days, null)` which equals `weekSegments(events, days)`.
  Lane assignment sorts by start time and is otherwise **stable on input
  order** (`src/core/month-lanes.ts:10-12`). So the current "filter, then append"
  moves the previewed event behind every event with the same start. A preview of
  the original at its origin would then land in a different lane than the
  resting card and overlap its neighbor. Building the list **in place** fixes
  this. It also matches how hosts typically apply updates: the demo does
  `current.map((item) => (item.id === event.id ? event : item))` (`demo/main.tsx:144`).
- `src/core/move.ts`: pure helpers, with no React, dnd-kit or DOM (project rule:
  "Keep pure date/conversion/lane/overflow helpers ... in `src/core/`; it must not
  import React, dnd-kit or the DOM"). Its last export line (188) is
  `export {copyEvent, moveAnchor, moveTarget, resolveMove, snapMinute};`.
  Tests live in `src/core/move.test.ts` (imports at the top:
  `import {eventDatesChanged, moveEvent} from "./move";`).
  `CalendarEvent` (`src/core/types.ts:5-13`) requires `id, title, start, end`.
- Shared browser helper `tests/browser/drag.spec.ts`, function `drag` inside
  `helpers` (~lines 25-165). It defines
  `const target = page.getByRole("button", {name: targetName, exact: true});`
  (~line 57). `targetName` is either a slot label (the slot `<button>` sits
  inside a `<div data-slot="calendar-drop">` that gets `data-drop-target="true"`
  while targeted) or `"Reset demo"`, a demo button **outside** the calendar
  used by the outside-drop tests. After the final pointer move it does (~lines 104-108):

  ```ts
          await page.locator("[data-dnd-dragging=true]").waitFor();
          const segments = page.locator("[data-move-preview] [data-calendar-event]");
          const refusal = page.locator('[data-slot="move-preview-rejection"]');
          const rejected = (await refusal.count()) ? "true" : null;
          const preview = rejected ? refusal : (await segments.count()) ? segments.first() : source;
  ```
  and later (~lines 122-125):

  ```ts
          const resolvedRange = {
              start: (await segments.count()) ? await segments.first().getAttribute("data-segment-start") : null,
              end: (await segments.count()) ? await segments.last().getAttribute("data-segment-end") : null,
          };
  ```
  `[data-dnd-dragging=true]` already exists from pickup, so the `waitFor` does
  not wait for the destination to resolve. The `count()` calls do not retry.
- `tests/browser/drag.spec.ts` ~line 220-231, test
  `` `${mode}: host rejection shows an alert and emits neither mutation nor success` ``:
  it opens `{query: "moves&resolver=reject", view: "Week"}`, captures
  `const before = await h.events();`, drags
  `[data-slot="all-day-band"] [data-calendar-event="move-point"]` to
  `"Add event October 7, 2026 at 10:00 AM"`, then asserts
  `expect(result.destinationSegments).toHaveLength(0);`. That assertion encodes
  the old "disappear" behavior. `h.events()` returns the demo's events with
  ISO-string dates. `data-segment-start/end` on bar previews are
  `event.start/end.toISOString()`, the same format.
- `tests/browser/drag.spec.ts` ~line 299, test
  `"keyboard: rejected conversion announces failure without mutation"`. After
  `await expect(page.locator('[data-slot="move-preview-rejection"]')).toBeVisible();`
  you will add one assertion.
- Demo fixtures (`demo/move-events.ts`): `move-point` ("Host deadline",
  all-day Oct 5 2026) and `move-range` ("Host range", all-day Oct 4–6) in the
  week of Oct 4. With `resolver=reason`, every timed destination is refused with
  "Room is booked". With `resolver=reject`, every destination is refused with
  "Move not allowed".
- New-test pattern: `tests/browser/drag-style.spec.ts`, test
  `"Day: overnight move has one snapped four-hour preview and no jump on drop"`.
  It shows `mousePickup`/`mouseMoveTo` (already imported there),
  `calendar.stableBox(locator)`, and the `target.evaluate(...)` snippet that
  scrolls a slot to the middle of the viewport.
- Docs that describe the old behavior (exact current lines):
  - `docs/event-calendar/drag-rules.md:130-133`:
    `... Escape restores the original presentation; releasing outside the` /
    `drop area cancels the move. Rejected destinations show a visible alert and do not` /
    `change the event. Destination changes are also announced to` / `screen readers.`
  - `docs/event-calendar/design.md:45-46`:
    `normal segment layout and height. The original segments and pointer-following` /
    `surface are hidden during accepted moves. No additional event popup is rendered. The demo uses`
  - `docs/event-calendar/overlap-layout.md:77`:
    `styles or resize controls. Original segments are hidden during accepted moves.`

Conventions: 4-space indent, double quotes, `{a}` without inner spaces, `const`
arrow functions with a one-line `/** ... */` JSDoc, exports at the bottom of
the file. Run `pnpm lint:fix` before fixing lint by hand.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint (auto-fix first) | `pnpm lint:fix` | exit 0 |
| Format check | `pnpm format:check` | "All matched files use Prettier code style!" |
| Core tests | `pnpm exec vitest run src/core/move.test.ts` | all pass |
| Unit tests | `pnpm test` | all pass |
| Build demo | `pnpm demo:build` | exit 0 (re-run after every source change) |
| Drag specs | `pnpm exec playwright test tests/browser/drag.spec.ts tests/browser/drag-style.spec.ts` | all pass |
| Flake check | `pnpm exec playwright test tests/browser/drag.spec.ts --repeat-each=3` | all pass |
| Everything | `pnpm verify` | exit 0 |

Playwright needs Chromium once: `pnpm exec playwright install chromium`. It
reuses any server already on port 4173. Stop other checkouts' preview servers first.

## Scope

**In scope:**
- `src/core/move.ts` (add `replaceEvent`), `src/core/move.test.ts`
- `src/components/event-calendar/use-move-preview.ts`
- `src/components/event-calendar/time-column.tsx`, `time-view.tsx`, `month-view.tsx` (only the three preview-list lines and an import)
- `tests/browser/drag.spec.ts` (helper sync, one assertion change, one assertion added)
- `tests/browser/drag-style.spec.ts` (one new test)
- `docs/event-calendar/drag-rules.md`, `design.md`, `overlap-layout.md` (the sentences quoted above)

**Out of scope:**
- `useMoveResolution` behavior. Announcements and the refusal banner must stay
  accepted/rejected-only.
- **Popup sources** (`moveSource === "popup"`, rows in the timed-overflow popup).
  Their event is hidden behind a "+N" control at rest, so drawing it at its origin
  would overlap visible events. They keep today's behavior.
- `event-item.tsx`, `move-feedback.tsx`, `calendar-surface.tsx`, `styles.css`.
- Any change to the drop/commit logic in `use-calendar-controller.ts`.

## Git workflow

Do NOT commit or push (project rule). If asked: `fix: keep refused drags visible at their origin`.

## Steps

### Step 1: Add a pure in-place replacement helper

In `src/core/move.ts`, above the final `export {copyEvent, ...}` line, add:

```ts
/** Replaces an event by id in place so previews keep the host's order for equal-start lanes; appends if absent. */
const replaceEvent = <T extends CalendarEvent>(events: readonly T[], next: T): T[] =>
    events.some((event) => event.id === next.id)
        ? events.map((event) => (event.id === next.id ? next : event))
        : [...events, next];
```

and change the export to
`export {copyEvent, moveAnchor, moveTarget, replaceEvent, resolveMove, snapMinute};`.
`CalendarEvent` is already imported in that file. If not, STOP.

In `src/core/move.test.ts`, extend the import to
`import {eventDatesChanged, moveEvent, replaceEvent} from "./move";`, add
`import {weekSegments} from "./month-lanes";`, and append:

```ts
describe("preview event lists", () => {
    const first = {id: "a", title: "A", allDay: true, start: new Date(2026, 9, 5), end: new Date(2026, 9, 5)};
    const second = {...first, id: "b", title: "B"};
    const days = [new Date(2026, 9, 4), new Date(2026, 9, 5), new Date(2026, 9, 6)];

    it("replaces in place so tied events keep their resting lanes", () => {
        expect(replaceEvent([first, second], {...first})).toEqual([first, second]);
        expect(weekSegments(replaceEvent([first, second], {...first}), days)).toEqual(
            weekSegments([first, second], days),
        );
    });
    it("appends an event that is not in the list", () => {
        const third = {...first, id: "c"};
        expect(replaceEvent([first, second], third)).toEqual([first, second, third]);
    });
});
```

**Verify**: `pnpm exec vitest run src/core/move.test.ts` → all pass (2 new).

### Step 2: Build preview lists in place

Replace the three "filter, then append" expressions:

- `time-column.tsx`: `timedPlacements([...events.filter((event) => event.id !== movePreview.id), movePreview], day)`
  → `timedPlacements(replaceEvent(events, movePreview), day)`
- `time-view.tsx`: `weekSegments([...spanning.filter((event) => event.id !== movePreview.id), movePreview], days)`
  → `weekSegments(replaceEvent(spanning, movePreview), days)`
- `month-view.tsx`: the multi-line `weekSegments([...events.filter(...), movePreview], weekDays)`
  → `weekSegments(replaceEvent(events, movePreview), weekDays)`

Add `import {replaceEvent} from "../../core/move";` to each of the three files,
next to their other `../../core/...` imports.

**Verify**: `pnpm typecheck` → exit 0. `pnpm demo:build && pnpm exec playwright test tests/browser/drag.spec.ts tests/browser/drag-style.spec.ts tests/browser/overlap.spec.ts`
→ all pass. Accepted previews are unchanged except for tie order.

### Step 3: Fall back to the grid source's original event

Rewrite `src/components/event-calendar/use-move-preview.ts` to:

```ts
import {useDragOperation} from "@dnd-kit/react";
import {useCalendarActions} from "./calendar-context";
import type {CalendarEvent, DropData} from "./types";

/** One drag subscription shared by the resolution and preview hooks. */
const useMoveState = () => {
    const {source, target} = useDragOperation();
    const {resolveDrag} = useCalendarActions();
    const destination = target?.data as DropData | undefined;
    const outcome = source && destination?.date instanceof Date ? resolveDrag(destination) : null;
    return {source, outcome};
};

/** All destination surfaces share the controller's cached resolution. */
const useMoveResolution = () => useMoveState().outcome;

/**
 * The event every view previews: the accepted destination, or a grid source at its
 * origin while the destination is refused or outside the grid, so it never vanishes.
 */
const useMovePreview = (): CalendarEvent | null => {
    const {source, outcome} = useMoveState();
    if (outcome?.status === "accepted") return outcome.event;
    const data = source?.data as {event?: CalendarEvent; moveSource?: string} | undefined;
    return data?.moveSource === "grid" && data.event ? data.event : null;
};

export {useMovePreview, useMoveResolution};
```

(`CalendarEvent` and `DropData` are both exported from `./types`. If `CalendarEvent` is not, STOP.)

**Verify**: `pnpm typecheck` → exit 0; `pnpm test` → all pass.

### Step 4: Make the drag helper wait for the resolved destination

In `tests/browser/drag.spec.ts`, inside `drag`, replace the five-line block
quoted in "Current state" (starting `await page.locator("[data-dnd-dragging=true]").waitFor();`) with:

```ts
        await page.locator("[data-dnd-dragging=true]").waitFor();
        // Sync on the resolved destination (or on "no destination") before reading preview state.
        const drop = target.locator('xpath=ancestor::*[@data-slot="calendar-drop"][1]');
        if (await drop.count()) {
            await expect(drop).toHaveAttribute("data-drop-target", "true");
        } else {
            await expect(page.locator('[data-drop-target="true"]')).toHaveCount(0);
        }
        const segments = page.locator("[data-move-preview] [data-calendar-event]");
        const refusal = page.locator('[data-slot="move-preview-rejection"]');
        // Grid sources always preview: the destination, or the origin when refused or outside.
        await expect(segments.first()).toBeVisible();
        const rejected = (await refusal.count()) ? "true" : null;
        const preview = rejected ? refusal : segments.first();
```

and replace the `resolvedRange` object with:

```ts
        const resolvedRange = {
            start: await segments.first().getAttribute("data-segment-start"),
            end: await segments.last().getAttribute("data-segment-end"),
        };
```

If `source` becomes unused anywhere in `drag`, ESLint will report it. In
that case leave its declaration, because it is still used for the pickup
coordinates. Only remove what ESLint flags as unused.

### Step 5: Update the rejection assertions

1. In `` `${mode}: host rejection shows an alert ...` `` replace
   `expect(result.destinationSegments).toHaveLength(0);` with:

   ```ts
        // A refused hover keeps the event visible at its origin.
        const point = before.find((event) => event.id === "move-point")!;
        expect(result.destinationSegments).toEqual([{start: point.start, end: point.end}]);
   ```
2. In `"keyboard: rejected conversion announces failure without mutation"`, directly
   after `await expect(page.locator('[data-slot="move-preview-rejection"]')).toBeVisible();` add:

   ```ts
    await expect(page.locator('[data-move-preview] [data-calendar-event="move-range"]').first()).toBeVisible();
   ```

**Verify**: `pnpm demo:build && pnpm exec playwright test tests/browser/drag.spec.ts` → all pass.
Then `pnpm exec playwright test tests/browser/drag.spec.ts --repeat-each=3` → all pass (no flakes).

### Step 6: New browser test for refused and off-grid hovers

Add to `tests/browser/drag-style.spec.ts`, after the `"Day: overnight move ..."` test:

```ts
test("Week: refused and off-grid hovers keep the event visible at its origin", async ({page, calendar}) => {
    await calendar.open({query: "moves&resolver=reason", view: "Week"});
    const source = page.locator('[data-slot="all-day-band"] [data-calendar-event="move-point"]').first();
    const before = await calendar.stableBox(source);
    const origin = page.locator('[data-move-preview] [data-calendar-event="move-point"]');
    const atOrigin = async () => {
        await expect(origin).toHaveCount(1);
        const box = await calendar.stableBox(origin);
        for (const key of ["x", "y", "width", "height"] as const) {
            expect(Math.abs(box[key] - before[key]), key).toBeLessThanOrEqual(1);
        }
    };

    await mousePickup(page, source);
    const target = page.getByRole("button", {name: "Add event October 7, 2026 at 10:00 AM", exact: true});
    await target.evaluate((element) => {
        const scroller = element.closest('[data-slot="calendar-scroll"]')!;
        const frame = scroller.getBoundingClientRect();
        scroller.scrollTop += element.getBoundingClientRect().top - (frame.top + frame.height / 2);
    });
    await mouseMoveTo(page, target);
    await expect(page.locator('[data-slot="move-preview-rejection"]')).toHaveText("Room is booked");
    await atOrigin();
    await expect(page.locator('[data-move-source="true"]').first()).toHaveCSS("opacity", "0");

    await mouseMoveTo(page, page.getByRole("button", {name: "Reset demo", exact: true}));
    await expect(page.locator('[data-slot="move-preview-rejection"]')).toHaveCount(0);
    await atOrigin();

    await page.mouse.up();
    await expect(page.locator("[data-move-preview]")).toHaveCount(0);
    expect(await calendar.updates()).toBe(0);
    await expect(source).toHaveCSS("opacity", "1");
});
```

**Verify**: `pnpm demo:build && pnpm exec playwright test tests/browser/drag-style.spec.ts` → all pass.

### Step 7: Update the docs

- `docs/event-calendar/drag-rules.md`: replace the sentence
  `Rejected destinations show a visible alert and do not change the event.` with
  `While the destination is refused or outside the grid, the preview shows the event at its original position, so it never disappears; refused destinations also show a visible alert and do not change the event.`
  Re-wrap the paragraph to roughly the surrounding line length (~85 chars).
- `docs/event-calendar/design.md`: replace
  `surface are hidden during accepted moves.` with
  `surface are hidden throughout the drag; a refused or off-grid hover previews the event at its origin.`
- `docs/event-calendar/overlap-layout.md`: replace
  `Original segments are hidden during accepted moves.` with
  `Original grid segments are hidden throughout the drag and a refused or off-grid hover previews them at their origin; popup rows only preview accepted destinations.`

**Verify**: `grep -rn "during accepted moves" docs/` → no output.

### Step 8: Format and full verification

Run `pnpm exec prettier --write` on every file you changed (the in-scope list only).

**Verify**: `pnpm lint:fix` → exit 0. `pnpm format:check` → passes. `pnpm verify` → exit 0.

## Test plan

- Unit (`src/core/move.test.ts`): `replaceEvent` replaces in place, keeps tied
  lanes identical to the resting layout, and appends when absent.
- Browser (new, `drag-style.spec.ts`): a refused mouse hover and an off-grid
  hover both show exactly one origin preview within 1px of the resting card. The
  originals are transparent, nothing changes on release, and the original is
  visible afterwards.
- Browser (updated, `drag.spec.ts`): the parametrized host-rejection test now
  expects the origin segment. The keyboard rejection test asserts an origin preview.
  The shared helper syncs on `data-drop-target` before reading state, so its
  results are deterministic (`--repeat-each=3`).

## Done criteria

- [ ] `grep -rnF "filter((event) => event.id !== movePreview.id)" src/` → no output
- [ ] `grep -n "replaceEvent" src/core/move.ts src/components/event-calendar/time-column.tsx src/components/event-calendar/time-view.tsx src/components/event-calendar/month-view.tsx` → at least one line per file
- [ ] `grep -n ': source;' tests/browser/drag.spec.ts` → no output (silent fallback removed)
- [ ] `grep -rn "during accepted moves" docs/` → no output
- [ ] `pnpm exec playwright test tests/browser/drag.spec.ts --repeat-each=3` → all pass
- [ ] `pnpm verify` exits 0
- [ ] `git status --short` shows changes only in in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` row 008 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any drift check fails.
- After Step 2 (before the hook change), any **existing** browser test fails. In-place
  ordering changed an accepted-preview expectation. Report the test name and
  the measured vs. expected values. Do not edit the expectation.
- In Step 6, the origin preview box differs from the resting box by more than
  1px. Report all four deltas. The bar-preview offsets in `event-item.tsx`
  may not match the resting bar, which is a separate fix.
- `--repeat-each=3` shows a flaky test. The `data-drop-target` sync may not be in
  the same render as the preview. Report which assertion flaked rather than
  adding sleeps.
- The popup-source tests (`tests/browser/popover-drag.spec.ts`) fail. This plan
  intends no popup behavior change.

## Maintenance notes

- `useMovePreview` now means "what to draw for this drag", not "accepted
  destination". Code that needs only accepted outcomes must use
  `useMoveResolution` (as `move-feedback.tsx` does).
- Execution amendment: `getDragEvent()` shares the controller's existing pickup
  applicability check. Deletion, rescheduling, type changes, or read-only changes
  suppress the origin fallback instead of drawing stale `source.data.event`.
  Metadata-only changes use the current host event; the drop rules are unchanged.
- Month cells draw previews regardless of the "+N more" capacity. This is
  pre-existing for accepted previews. An origin preview of a lane hidden in
  one of its cells would overlap that cell's "+N" button. Revisit if capacity-aware
  previews are added.
- Possible follow-up (not in scope): give the hovered **slot** a destructive
  ring when the outcome is refused. Today `calendar-drop.tsx:67` uses the same
  `bg-accent` ring for accepted and refused targets.

## Execution result — 2026-10-11

DONE. See the run 2 execution review and completion evidence in `plans/README.md`.
The combined implementation passed `pnpm verify` (244 DST tests, 67 browser tests,
and React 18/19 package consumers) and the 57-run drag repetition check.
