# Plan 005: Bar move previews no longer stretch to their cell's full height

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: this plan was written against commit `239dc67`
> **plus an uncommitted "transparent drag source" change** in the working tree
> (it added `src/components/event-calendar/move-feedback.tsx`). A SHA diff is
> therefore not meaningful. Instead run:
> `grep -nF 'className="pointer-events-none h-full"' src/components/event-calendar/event-item.tsx`
> It must print exactly one line (around line 274). If it prints nothing, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `239dc67` + uncommitted working tree, 2026-10-11

## Why this matters

During a drag, `EventMovePreview` draws a static copy of the event at the
destination. A recent change added the Tailwind class `h-full` (`height: 100%`)
to its wrapper so **timed** previews fill their slot. The same wrapper is also
used for **bar** previews (all-day and month bars). Those are absolutely
positioned with a `top` offset inside a `position: relative` cell. With
`height: 100%` added, the invisible wrapper box ends `lane * 28 + 4` px below
the cell. Inside the week/day all-day band, which is `overflow-y-auto`, this adds
scrollable overflow during every all-day drag. On platforms with classic
scrollbars (Windows), a scrollbar can appear and shift the band's columns out of
line with the time grid. Playwright runs headless with hidden scrollbars, so the
existing tests cannot see the scrollbar. They can measure the overflow.

## Current state

- `src/components/event-calendar/event-item.tsx:268-299`: the static preview:

  ```tsx
  /** Static destination surface: no drag registration or endpoint controls. */
  const EventMovePreview = (variant: EventItemVariant) => {
      const capabilities = eventCapabilities(variant, true);
      return (
          <div
              data-move-preview={variant.event.id}
              className="pointer-events-none h-full"
              aria-hidden="true"
              style={
                  variant.variant === "bar"
                      ? {
                            position: "absolute",
                            left: variant.hostView === "month" ? 0 : 4,
                            right: variant.hostView === "month" ? 0 : 4,
                            top: variant.lane * 28 + (variant.hostView === "month" ? 0 : 4),
                            zIndex: 20,
                        }
                      : undefined
              }
          >
  ```

  `cn` (class merge helper) is already imported at line 7:
  `import {cn} from "../../lib/utils";`.
- Timed previews are rendered by `src/components/event-calendar/time-column.tsx:146-170`.
  It wraps each preview in a div with an explicit `height: placement.height`, so
  timed previews **need** `h-full` to fill that box. The button inside uses the
  CSS class `.calendar-event-timed { height: 100% }` (`src/styles.css`).
- Bar previews are rendered by `src/components/event-calendar/time-view.tsx:130-144`
  (all-day band; the parent `CalendarDrop` is `relative min-w-0 ... p-1`, see
  `calendar-drop.tsx:67`; the band itself is
  `sticky ... max-h-40 overflow-y-auto` at `time-view.tsx:98`) and by
  `month-cell.tsx:54-65`. Bar buttons get a fixed `height: 24px` from
  `.calendar-event-bar`, so the wrapper never needs a height.
- Browser test pattern to copy: the test
  `"Day: overnight move has one snapped four-hour preview and no jump on drop"`
  in `tests/browser/drag-style.spec.ts` (right after the `helpers` function).
  It uses `mousePickup(page, source)` and `mouseMoveTo(page, target)` from
  `tests/browser/input.ts`. Both are already imported in that spec.
- Demo fixture (`demo/move-events.ts`): opening the demo with query `moves`
  shows the week of Sun Oct 4 2026. The all-day band contains `move-range`
  (all-day, Oct 4–6) and `move-point` ("Host deadline", all-day, Oct 5). Without
  a `resolver` query parameter, moves use the default policy and are accepted.
  All-day slot buttons are labelled `Add event <Month d, yyyy> all day`, e.g.
  `Add event October 7, 2026 all day`.

Conventions: 4-space indent, double quotes, no spaces inside braces
(`{a}`), `const` arrow functions. Run `pnpm lint:fix` before fixing any lint
issue by hand (project rule).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint (auto-fix first) | `pnpm lint:fix` | exit 0, no remaining errors |
| Format check | `pnpm format:check` | "All matched files use Prettier code style!" |
| Unit tests | `pnpm test` | all pass |
| Build demo once | `pnpm demo:build` | exit 0 |
| One browser spec | `pnpm exec playwright test tests/browser/drag-style.spec.ts` | all pass |
| Everything | `pnpm verify` | exit 0 |

Playwright needs Chromium once: `pnpm exec playwright install chromium`.
`pnpm demo:build` must be re-run after every source change before running
Playwright directly, because the browser tests use the production demo build.
The Playwright config reuses a server already listening on port 4173. If
another checkout's preview server is running there, stop it first.

## Scope

**In scope:**
- `src/components/event-calendar/event-item.tsx` (the `EventMovePreview` wrapper className only)
- `tests/browser/drag-style.spec.ts` (one new test)

**Out of scope:**
- The bar preview's `position`/`top`/`left`/`right` offsets. They are correct
  and other tests depend on them.
- `time-column.tsx`, `time-view.tsx`, `month-cell.tsx`, `styles.css`.
- `move-feedback.tsx` and `use-move-preview.ts` (other plans change them).

## Git workflow

Do NOT commit or push (project rule: "Never commit or push unless explicitly
asked"). If the operator asks for a commit, use the repo's conventional style,
e.g. `fix: keep bar move previews to their own height`.

## Steps

### Step 1: Write the failing browser test first

Add this test to `tests/browser/drag-style.spec.ts`, directly after the
`"Day: overnight move ..."` test:

```ts
test("Week: all-day bar preview adds no overflow to the all-day band", async ({page, calendar}) => {
    await calendar.open({query: "moves", view: "Week"});
    const band = page.locator('[data-slot="all-day-band"]');
    const source = band.locator('[data-calendar-event="move-point"]').first();
    await mousePickup(page, source);
    await mouseMoveTo(page, page.getByRole("button", {name: "Add event October 7, 2026 all day", exact: true}));

    const wrapper = band.locator('[data-move-preview="move-point"]');
    await expect(wrapper).toHaveCount(1);
    const bar = wrapper.locator("[data-calendar-event]");
    await expect(bar).toBeVisible();
    const wrapperBox = await calendar.stableBox(wrapper);
    const barBox = await calendar.stableBox(bar);
    // The wrapper only spans the bar plus its 4px top margin, never the whole cell.
    expect(wrapperBox.height).toBeLessThanOrEqual(barBox.height + 4);
    expect(await band.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(0);

    await page.keyboard.press("Escape");
    await page.mouse.up();
    expect(await calendar.updates()).toBe(0);
});
```

**Verify**: `pnpm demo:build && pnpm exec playwright test tests/browser/drag-style.spec.ts -g "adds no overflow"`
→ the new test **fails** on one of the two `toBeLessThanOrEqual` assertions.
That failure reproduces the bug. If it **passes** before any source change,
STOP (see STOP conditions).

### Step 2: Apply `h-full` to timed previews only

In `src/components/event-calendar/event-item.tsx`, inside `EventMovePreview`,
replace

```tsx
            className="pointer-events-none h-full"
```

with

```tsx
            className={cn("pointer-events-none", variant.variant === "timed" && "h-full")}
```

Change nothing else in the component.

**Verify**: `pnpm typecheck` → exit 0. Then
`pnpm demo:build && pnpm exec playwright test tests/browser/drag-style.spec.ts`
→ all tests pass. This includes the new test and the existing
`"Day: overnight move ..."` test, which asserts a 256px timed preview and
proves timed previews still fill their slot.

### Step 3: Format and full verification

Run `pnpm exec prettier --write src/components/event-calendar/event-item.tsx tests/browser/drag-style.spec.ts`.
Only format in-scope files.

**Verify**: `pnpm lint:fix` → exit 0. `pnpm format:check` → "All matched files use Prettier code style!". `pnpm verify` → exit 0.

## Test plan

- New: `"Week: all-day bar preview adds no overflow to the all-day band"` in
  `tests/browser/drag-style.spec.ts`. It covers the regression: the wrapper
  height and the band's scroll overflow during an accepted all-day preview.
- Existing coverage that must keep passing: the `"Day: overnight move ..."`
  test (timed preview height 256px, no jump on drop) and the drag-style metrics
  tests (90-minute review preview is 96px tall).

## Done criteria

- [ ] `grep -nF 'className="pointer-events-none h-full"' src/components/event-calendar/event-item.tsx` prints nothing
- [ ] `grep -nF 'variant.variant === "timed" && "h-full"' src/components/event-calendar/event-item.tsx` prints one line
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm verify` exits 0, and the new test is listed as passed
- [ ] `git status --short` shows changes only in the two in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` row 005 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The drift-check grep doesn't find the `h-full` className.
- The new test passes in Step 1 **before** the fix. The overflow did not
  reproduce. Report the measured `wrapperBox.height`, `barBox.height` and
  `scrollHeight - clientHeight` values, and do not change the source.
- After Step 2, any timed-preview test fails (heights other than expected).
  That means timed previews relied on `h-full` in a way this plan missed.
- The overflow assertion fails by exactly 1px after the fix. This is
  probably subpixel rounding. Report it rather than loosening the
  assertion yourself.

## Maintenance notes

- If bar previews ever need a height again (e.g. multi-line month bars), set it
  explicitly per variant. Never use `height: 100%` on an absolutely positioned
  element with a `top` offset.
- The same overflow pattern would reappear if someone adds `h-full`/`inset-0`
  to the wrapper for hit-testing. Previews are `pointer-events: none` by design,
  because `calendar-collision.ts` hit-tests with `elementsFromPoint`.

## Execution result — 2026-10-11

DONE. See the run 2 execution review and completion evidence in `plans/README.md`.
The combined implementation passed `pnpm verify` (244 DST tests, 67 browser tests,
and React 18/19 package consumers) and the 57-run drag repetition check.
