# Plan 006: The during-drag refusal banner overlays the grid instead of resizing it

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: this plan was written against commit `239dc67`
> **plus an uncommitted "transparent drag source" change** in the working tree,
> so a SHA diff is not meaningful. Instead run:
> `grep -nF 'data-slot="move-preview-rejection" className="px-3 py-1 text-sm text-destructive"' src/components/event-calendar/move-feedback.tsx`
> It must print exactly one line. If it prints nothing, compare the
> "Current state" excerpt with the live file. On a mismatch, STOP.
> (If plan 007 already ran, the announcement `<span>` above it will differ.
> That is expected, and only the rejection `<div>` must match.)

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (run before plan 007; both edit `move-feedback.tsx`)
- **Category**: bug
- **Planned at**: commit `239dc67` + uncommitted working tree, 2026-10-11

## Why this matters

While an event is dragged over a destination that the host's move policy
refuses, `MoveFeedback` renders a red `role="alert"` line ("Move not allowed" or
the host's reason). It is rendered **in normal flex flow** at the bottom of the
calendar's `flex-col` root. The month/week/day view above it is `flex-1`, so
the scroll viewport shrinks by about 28px every time a refusal appears and grows
back when it disappears. This shifts the layout mid-drag. With the pointer in the
bottom ~28px of the viewport it can also flicker: the hover is refused, the banner
covers that strip, the pointer is no longer over a slot, the banner unmounts, and
the next pointer move is refused again. The fix renders the banner as an overlay
pinned to the bottom of the view. It does not participate in layout and does not
intercept the pointer.

## Current state

- `src/components/event-calendar/move-feedback.tsx` (whole file, 31 lines):

  ```tsx
  import {useCalendarTranslation} from "../../i18n/translations";
  import {displayTitle} from "./event-display";
  import {format} from "date-fns";
  import {useMoveResolution} from "./use-move-preview";

  /** Announce destination changes and keep refusals visible without a floating card. */
  const MoveFeedback = () => {
      const outcome = useMoveResolution();
      const {tCalendar, dateLocale} = useCalendarTranslation();
      const event = outcome?.status === "accepted" ? outcome.event : null;
      return (
          <>
              <span className="sr-only" role="status" aria-atomic="true" data-slot="move-announcement">
                  {/* ...accepted-destination announcement... */}
              </span>
              {outcome?.status === "rejected" && (
                  <div role="alert" data-slot="move-preview-rejection" className="px-3 py-1 text-sm text-destructive">
                      {outcome.reason ?? tCalendar(($) => $.announcement.moveRejected)}
                  </div>
              )}
          </>
      );
  };

  export {MoveFeedback};
  ```
- `src/components/event-calendar/calendar-surface.tsx`:
  - lines 66-82: the root is
    `<div ... className={cn("event-calendar flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border ...", className)}>`.
  - lines 93-114: `<DragDropProvider ...>` contains the toolbar, then exactly one
    view (`MonthView` / `TimeView` / `AgendaView`), then `<MoveFeedback />` at
    line 113. `DragDropProvider` (from `@dnd-kit/react`) renders **no DOM element**
    of its own. Its children are direct flex children of the root div.
  - lines 128-144: the **post-drop** rejection bar (`data-slot="move-rejection"`,
    with a Dismiss button). It is also in flow, but it appears only after the drag
    has ended. Leave it alone (see Scope).
- Views are `flex-1` columns with an inner scroll container:
  `time-view.tsx:89-90` (`flex min-h-0 flex-1 flex-col` → `min-h-0 flex-1 overflow-auto` with `data-slot="calendar-scroll"`),
  `month-view.tsx:44,52` (same pattern).
- Z-index levels inside views: events `zIndex: 10`, move previews `20`, resize
  handles `25` (`styles.css`), all-day band `z-30`, time header `z-40`
  (`time-view.tsx:34,98`). The overlay must sit above all of them, so use `z-50`.
- `src/components/event-calendar/calendar-collision.ts` decides drop targets by
  hit-testing `elementsFromPoint`. Elements with `pointer-events: none` are
  skipped by hit-testing, so the overlay **must** be `pointer-events-none`.
- Tests that locate the banner (selectors must keep working):
  `tests/browser/drag.spec.ts` uses `[data-slot="move-preview-rejection"]`
  (helper near line 106 and the keyboard test near line 312).
  `page.getByRole("alert")` is used after drops, when only the post-drop alert exists.
- Tailwind tokens already used in this repo: `bg-background/80`
  (`time-view.tsx:34`), `border-border/70` (everywhere), `text-destructive`.
- Browser test pattern: the `"Day: overnight move ..."` test in
  `tests/browser/drag-style.spec.ts`. It scrolls a slot to the middle of the
  viewport with `target.evaluate(...)` before `mouseMoveTo`. Copy that snippet.
- Demo fixture: query `moves&resolver=reason` shows the week of Oct 4 2026.
  Moving `move-point` ("Host deadline", all-day band) onto any **timed** slot
  is refused with reason `Room is booked` (`demo/move-events.ts`, `reasonMove`).

Conventions: 4-space indent, double quotes, `{a}` without inner spaces. Short
`//` comments explain *why*, as in `calendar-surface.tsx:26-27`. Run
`pnpm lint:fix` before fixing lint by hand.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint (auto-fix first) | `pnpm lint:fix` | exit 0 |
| Format check | `pnpm format:check` | "All matched files use Prettier code style!" |
| Unit tests | `pnpm test` | all pass |
| Build demo | `pnpm demo:build` | exit 0 (re-run after each source change) |
| Browser specs | `pnpm exec playwright test tests/browser/drag-style.spec.ts tests/browser/drag.spec.ts` | all pass |
| Everything | `pnpm verify` | exit 0 |

Playwright needs Chromium once: `pnpm exec playwright install chromium`. It
reuses any server already on port 4173. Stop other checkouts' preview servers first.

## Scope

**In scope:**
- `src/components/event-calendar/move-feedback.tsx` (the rejection markup only)
- `tests/browser/drag-style.spec.ts` (one new test)

**Out of scope:**
- The post-drop rejection bar in `calendar-surface.tsx:128-144`. It needs
  pointer events for its Dismiss button and appears after the drag, when a
  layout change is harmless.
- The `move-announcement` `<span>` in `move-feedback.tsx` (plan 007 owns it).
- `calendar-surface.tsx` root classes. Do not add `relative` to the root. The
  zero-height anchor below avoids changing the root's containing block.
- Any change to where `<MoveFeedback />` is mounted.

## Git workflow

Do NOT commit or push (project rule). If asked: `fix: overlay drag refusal feedback`.

## Steps

### Step 1: Write the failing browser test

Add to `tests/browser/drag-style.spec.ts`, after the `"Day: overnight move ..."` test:

```ts
test("Week: refusal feedback overlays the grid without resizing the scroll viewport", async ({page, calendar}) => {
    await calendar.open({query: "moves&resolver=reason", view: "Week"});
    const viewport = page.locator('[data-slot="calendar-scroll"]');
    const height = await viewport.evaluate((element) => element.clientHeight);
    await mousePickup(page, page.locator('[data-slot="all-day-band"] [data-calendar-event="move-point"]').first());
    const target = page.getByRole("button", {name: "Add event October 7, 2026 at 10:00 AM", exact: true});
    await target.evaluate((element) => {
        const scroller = element.closest('[data-slot="calendar-scroll"]')!;
        const frame = scroller.getBoundingClientRect();
        scroller.scrollTop += element.getBoundingClientRect().top - (frame.top + frame.height / 2);
    });
    await mouseMoveTo(page, target);

    const refusal = page.locator('[data-slot="move-preview-rejection"]');
    await expect(refusal).toHaveText("Room is booked");
    expect(await viewport.evaluate((element) => element.clientHeight)).toBe(height);
    await expect(refusal).toHaveCSS("pointer-events", "none");
    const box = (await refusal.boundingBox())!;
    const frame = (await viewport.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height + 1);

    await page.keyboard.press("Escape");
    await page.mouse.up();
    expect(await calendar.updates()).toBe(0);
});
```

**Verify**: `pnpm demo:build && pnpm exec playwright test tests/browser/drag-style.spec.ts -g "overlays the grid"`
→ **fails** at the `clientHeight` assertion (the viewport is ~28px shorter).
If it passes before the fix, STOP.

### Step 2: Render the refusal as an overlay

In `src/components/event-calendar/move-feedback.tsx`, replace the rejection block

```tsx
            {outcome?.status === "rejected" && (
                <div role="alert" data-slot="move-preview-rejection" className="px-3 py-1 text-sm text-destructive">
                    {outcome.reason ?? tCalendar(($) => $.announcement.moveRejected)}
                </div>
            )}
```

with

```tsx
            {outcome?.status === "rejected" && (
                // A zero-height anchor keeps mid-drag feedback out of the flex layout, so
                // the scroll viewport and drop targets don't move under the pointer.
                <div className="pointer-events-none relative z-50 h-0 shrink-0">
                    <div
                        role="alert"
                        data-slot="move-preview-rejection"
                        className="absolute inset-x-0 bottom-0 border-t border-border/70 bg-background/95 px-3 py-1 text-sm text-destructive"
                    >
                        {outcome.reason ?? tCalendar(($) => $.announcement.moveRejected)}
                    </div>
                </div>
            )}
```

Keep `role="alert"` and `data-slot="move-preview-rejection"` on the **inner**
element, which is the one with the text. Change nothing else in the file.

**Verify**: `pnpm typecheck` → exit 0. Then
`pnpm demo:build && pnpm exec playwright test tests/browser/drag-style.spec.ts tests/browser/drag.spec.ts`
→ all pass, including the new test and the existing rejection tests
(`"... host rejection shows an alert ..."`, `"keyboard: rejected conversion ..."`,
`"host rejection reason matches preview ..."`).

### Step 3: Format and full verification

Run `pnpm exec prettier --write src/components/event-calendar/move-feedback.tsx tests/browser/drag-style.spec.ts`.
Only format in-scope files.

**Verify**: `pnpm lint:fix` → exit 0. `pnpm format:check` → "All matched files use Prettier code style!". `pnpm verify` → exit 0.

## Test plan

- New: `"Week: refusal feedback overlays the grid without resizing the scroll viewport"`
  (`tests/browser/drag-style.spec.ts`). It asserts that the viewport height is
  unchanged while the refusal is visible, that the banner is `pointer-events: none`,
  and that the banner lies inside the viewport's bottom edge.
- Existing rejection tests in `tests/browser/drag.spec.ts` keep passing. They
  read the banner text through the same `data-slot`.

## Done criteria

- [ ] `grep -nF 'className="pointer-events-none relative z-50 h-0 shrink-0"' src/components/event-calendar/move-feedback.tsx` prints one line
- [ ] `grep -cF 'data-slot="move-preview-rejection"' src/components/event-calendar/move-feedback.tsx` prints `1`
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm verify` exits 0, and the new test is listed as passed
- [ ] `git status --short` shows changes only in the in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` row 006 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check fails.
- The new test passes in Step 1 before the fix. Report the two `clientHeight`
  values. The layout assumption in this plan is then wrong.
- After the fix, the banner is not visible (e.g. `toHaveText` times out, or its
  box is outside the viewport). A positioned ancestor or `overflow` setting this
  plan didn't account for may be involved. Report the banner's `boundingBox()`
  and do not try other positioning schemes.
- Any existing test fails because `getByRole("alert")` now matches two elements
  **during** a drag. That would mean the post-drop alert and this one coexist,
  which this plan assumes never happens.

## Maintenance notes

- The banner now covers the bottom ~28px of the grid while visible. That is
  acceptable because it is translucent, pointer-transparent and only shown during
  a refused hover. If a design wants refusal feedback **at the destination slot**
  instead, the zero-height anchor can be removed.
- After a refused **drop**, this overlay disappears and the post-drop bar
  (`data-slot="move-rejection"`) appears below the grid in normal flow. That
  post-drop layout change is intentional, because the Dismiss button needs to be
  reachable.
- Plan 007 edits the `<span>` above this block in the same file. Run 006 first.

## Execution result — 2026-10-11

DONE. See the run 2 execution review and completion evidence in `plans/README.md`.
The combined implementation passed `pnpm verify` (244 DST tests, 67 browser tests,
and React 18/19 package consumers) and the 57-run drag repetition check.
