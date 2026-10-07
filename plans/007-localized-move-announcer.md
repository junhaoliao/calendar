# Plan 007: Drag moves have one localized screen-reader announcer

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: this plan was written against commit `239dc67`
> **plus an uncommitted "transparent drag source" change** in the working tree,
> so a SHA diff is not meaningful. Run both:
> 1. `grep -nF "Feedback.configure({dropAnimation: null})" src/components/event-calendar/calendar-surface.tsx` → one line (~28).
> 2. `grep -nF 'tCalendar(($) => $.event.label, {' src/components/event-calendar/move-feedback.tsx` → one line (~15).
> If either prints nothing, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/006-overlay-refusal-banner.md (same file; run 006 first to avoid edit conflicts)
- **Category**: bug (accessibility / i18n)
- **Planned at**: commit `239dc67` + uncommitted working tree, 2026-10-11

## Why this matters

The calendar ships English, French, Simplified and Traditional Chinese. Its API
docs promise localized "screen-reader text" (`docs/API.md:84`). During a drag,
screen-reader users currently get **two** live regions:

1. dnd-kit's built-in `Accessibility` plugin, which is on by default. It
   announces English sentences containing internal ids, e.g.
   `Draggable item ["week","review",1791...] was moved over droppable target time:1791...:840.`
2. The calendar's own `MoveFeedback` region. It announces the destination, but
   its wording is the event button's label (`"{{title}}, {{time}}"`) with
   hard-coded date patterns and a hard-coded `", "` join for all-day events. It
   never says the event is being *moved*. No test covers it.

After this plan, there is one announcer, owned by the calendar and localized in
all four locales. It is phrased like the existing resize announcer ("Resizing
{{title}}: …") and also announces cancellation. dnd-kit's live region stays
silent.

## Current state

- `src/components/event-calendar/calendar-surface.tsx:1-4, 24-29`:

  ```tsx
  import {Feedback} from "@dnd-kit/dom";
  ...
  const calendarPlugins: NonNullable<ComponentProps<typeof DragDropProvider>["plugins"]> = (defaults) => [
      ...defaults,
      // Feedback maintains the drag shape used by collision detection and sensors.
      // Its source stays transparent; EventMovePreview supplies the visible feedback.
      Feedback.configure({dropAnimation: null}),
  ];
  ```
  `defaults` is `[Accessibility, AutoScroller, Cursor, Feedback, PreventSelection]`.
  dnd-kit's plugin registry dedupes by constructor, and the **last** options
  win, which is how `Feedback.configure` above already overrides the default
  `Feedback`. `Accessibility` (exported from `@dnd-kit/dom`) takes
  `{announcements}`, typed as
  `{dragstart: Fn; dragmove?: Fn; dragover?: Fn; dragend: Fn}`, where
  `Fn = (event, manager) => string | undefined`. **`dragstart` and `dragend` are
  required**, so `{}` does not typecheck. A function returning `undefined`
  suppresses that announcement. Keep the plugin itself: it also attaches
  keyboard instructions via `aria-describedby`.
- `src/components/event-calendar/move-feedback.tsx` (after plan 006; the `<span>` is unchanged by 006):

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
                  {event &&
                      tCalendar(($) => $.event.label, {
                          title: displayTitle(event.title, tCalendar),
                          time: event.allDay
                              ? `${format(event.start, "PPP", {locale: dateLocale})} – ${format(event.end, "PPP", {locale: dateLocale})}, ${tCalendar(($) => $.common.allDay)}`
                              : `${format(event.start, "PPPp", {locale: dateLocale})} – ${format(event.end, "PPPp", {locale: dateLocale})}`,
                      })}
              </span>
              {/* rejection overlay from plan 006 (do not touch) */}
          </>
      );
  };
  ```
  `useMoveResolution()` (`use-move-preview.ts`) returns `null` when there is no
  drag or no destination. Otherwise it returns
  `{status: "accepted"; event: CalendarEvent} | {status: "rejected"; reason: string | null}`.
- **Exemplar to mirror:** the resize announcer in
  `src/components/event-calendar/calendar-resize-context.tsx:142-157`:

  ```tsx
  const announce = (event: CalendarEvent) =>
      tCalendar(($) => $.resize.announcement, {
          title: displayTitle(event.title, tCalendar),
          start: format(event.start, tCalendar(($) => $.formats.resizeInstant), {locale: dateLocale}),
          end: format(event.end, tCalendar(($) => $.formats.resizeInstant), {locale: dateLocale}),
      });
  ```
  (`en` `resize.announcement` = `"Resizing {{title}}: {{start}} – {{end}}"`.)
- Existing translation keys you will reuse (present in all four locales):
  `formats.resizeInstant` (en `"MMM d, h:mm a"`), `formats.dayCompact`
  (en `"MMM d, yyyy"`), `event.allDayRange` (en `"{{start}} – {{end}} · All day"`).
  All-day events use an **inclusive** end date (a one-day event has
  `start` and `end` on the same date).
- Locale files: `src/i18n/locales/{en,fr,zh-Hans,zh-Hant}/calendar.json`. The
  `"announcement"` object is at lines ~114-122 in each. `src/i18n/resource-parity.test.ts`
  fails if any locale has different keys or different `{{interpolation}}` names.
  Translation types derive from these JSON resources automatically. No manual
  type file needs editing.
- `@dnd-kit/react` exports `useDragDropMonitor(handlers)`, with handlers such as
  `onDragStart(event)` and `onDragEnd(event)`. The drag-end event has
  `event.canceled: boolean` and `event.operation.target` (null when released
  outside every drop slot). The controller treats both as "no move"
  (`use-calendar-controller.ts`, `endDrag`). Accepted drops are already announced
  by the controller's own status region ("Event "{{title}}" moved"). Refused drops
  show the `role="alert"` banner.
- Unit-test pattern for mocking a module while keeping the rest:
  `src/components/event-calendar/render-isolation.test.tsx:15-30` uses
  `vi.mock("@dnd-kit/react", async (importOriginal) => { const actual = await importOriginal<typeof import("@dnd-kit/react")>(); return {...actual, useDraggable: ...}; })`.
  i18n context for isolated components: wrap in `CalendarI18nProvider` from
  `src/i18n/provider.tsx` (props `{locale?: "en" | "fr" | "zh-Hans" | "zh-Hant"; children}`),
  as `gesture-conflicts.test.tsx:76` does.
- Browser keyboard-drag pattern: the test
  `"keyboard: resolver preview agrees with a changed drop ..."` in
  `tests/browser/drag.spec.ts` (~line 245). It opens `{query: "moves", view: "Week", scrollTop: 0}`,
  focuses `[data-slot="all-day-band"] [data-calendar-event="move-range"]`, then
  presses `Space` and `ArrowDown` until `[data-drop-target="true"][data-minute]` exists.
  `move-range` has title `Host range`.

Conventions: 4-space indent, double quotes, `{a}` without inner spaces, `const`
arrow functions with JSDoc on components, exports at the bottom. Run
`pnpm lint:fix` before fixing lint by hand. `src/i18n/no-hardcoded-text.test.ts`
forbids bare English JSX text in `src/components/event-calendar/*.tsx`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint (auto-fix first) | `pnpm lint:fix` | exit 0 |
| Format check | `pnpm format:check` | "All matched files use Prettier code style!" |
| i18n tests | `pnpm exec vitest run src/i18n` | all pass |
| New unit test | `pnpm exec vitest run src/components/event-calendar/move-feedback.test.tsx` | all pass |
| Unit tests | `pnpm test` | all pass |
| Build demo | `pnpm demo:build` | exit 0 (re-run after each source change) |
| Browser spec | `pnpm exec playwright test tests/browser/drag.spec.ts` | all pass |
| Everything | `pnpm verify` | exit 0 |

## Scope

**In scope:**
- `src/components/event-calendar/calendar-surface.tsx` (`calendarPlugins` and its import only)
- `src/components/event-calendar/move-feedback.tsx` (the announcement `<span>`, imports, component state)
- `src/i18n/locales/en/calendar.json`, `fr/calendar.json`, `zh-Hans/calendar.json`, `zh-Hant/calendar.json` (two new keys each)
- `src/components/event-calendar/move-feedback.test.tsx` (create)
- `tests/browser/drag.spec.ts` (one new test)

**Out of scope:**
- dnd-kit's `screenReaderInstructions` (the English "press the space bar" text).
  Localizing it needs locale-aware plugin configuration. That is a separate design.
- The rejection overlay in `move-feedback.tsx` (plan 006).
- The controller's status region and `announcement` (`use-calendar-controller.ts`, `calendar-surface.tsx:125-127`).
- `calendar-resize-context.tsx`. It is only the exemplar, so don't refactor it.
- Debouncing announcements (see Maintenance notes).

## Git workflow

Do NOT commit or push (project rule). If asked: `fix: localize drag move announcements`.

## Steps

### Step 1: Add the translation keys

In each locale file, add two keys **at the end** of the `"announcement"` object
(after `"dismissRejection"`, adding a comma to the previous line):

| File | `"movePreview"` | `"moveCancelled"` |
|---|---|---|
| `en/calendar.json` | `"Moving {{title}}: {{range}}"` | `"Move cancelled"` |
| `fr/calendar.json` | `"Déplacement de {{title}} : {{range}}"` | `"Déplacement annulé"` |
| `zh-Hans/calendar.json` | `"正在移动 {{title}}：{{range}}"` | `"已取消移动"` |
| `zh-Hant/calendar.json` | `"正在移動 {{title}}：{{range}}"` | `"已取消移動"` |

(These mirror each locale's existing `resize.announcement` and `moveRejected` phrasing.)

**Verify**: `pnpm exec vitest run src/i18n` → all pass (resource parity holds).

### Step 2: Silence dnd-kit's built-in announcements

In `calendar-surface.tsx`, change the import to
`import {Accessibility, Feedback} from "@dnd-kit/dom";` and make `calendarPlugins`:

```tsx
const silent = () => undefined;

const calendarPlugins: NonNullable<ComponentProps<typeof DragDropProvider>["plugins"]> = (defaults) => [
    ...defaults,
    // MoveFeedback owns localized move announcements; dnd-kit's defaults are English with internal ids.
    Accessibility.configure({announcements: {dragstart: silent, dragover: silent, dragend: silent}}),
    // Feedback maintains the drag shape used by collision detection and sensors.
    // Its source stays transparent; EventMovePreview supplies the visible feedback.
    Feedback.configure({dropAnimation: null}),
];
```

**Verify**: `pnpm typecheck` → exit 0.

### Step 3: Rewrite the announcement in `MoveFeedback`

In `move-feedback.tsx`:

1. Imports: add `import {useState} from "react";` and
   `import {useDragDropMonitor} from "@dnd-kit/react";`, and keep the existing ones.
2. Inside the component, after the existing hooks, add:

   ```tsx
   const [cancelled, setCancelled] = useState(false);
   useDragDropMonitor({
       onDragStart: () => setCancelled(false),
       // Released outside every slot is a cancellation too (the controller ignores it).
       onDragEnd: (drag) => setCancelled(drag.canceled || !drag.operation.target),
   });
   const pattern = (key: "resizeInstant" | "dayCompact") => tCalendar(($) => $.formats[key]);
   const range = event
       ? event.allDay
           ? tCalendar(($) => $.event.allDayRange, {
                 start: format(event.start, pattern("dayCompact"), {locale: dateLocale}),
                 end: format(event.end, pattern("dayCompact"), {locale: dateLocale}),
             })
           : `${format(event.start, pattern("resizeInstant"), {locale: dateLocale})} – ${format(event.end, pattern("resizeInstant"), {locale: dateLocale})}`
       : "";
   ```
   If `tCalendar(($) => $.formats[key])` does not typecheck, use two explicit
   calls instead, `tCalendar(($) => $.formats.dayCompact)` and
   `tCalendar(($) => $.formats.resizeInstant)`. That is not a STOP.
3. Replace the `<span ... data-slot="move-announcement">` children with:

   ```tsx
   {event
       ? tCalendar(($) => $.announcement.movePreview, {title: displayTitle(event.title, tCalendar), range})
       : cancelled
         ? tCalendar(($) => $.announcement.moveCancelled)
         : null}
   ```
4. Update the component's JSDoc to:
   `/** Localized move announcements (destination, cancellation) and mid-drag refusal feedback. */`

**Verify**: `pnpm typecheck` → exit 0; `pnpm lint:fix` → exit 0;
`pnpm exec vitest run src/i18n/no-hardcoded-text.test.ts` → pass.

### Step 4: Unit test `MoveFeedback`

Create `src/components/event-calendar/move-feedback.test.tsx`:

```tsx
import {act, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import type {CalendarEvent} from "./types";

type Outcome = {status: "accepted"; event: CalendarEvent} | {status: "rejected"; reason: string | null} | null;
const state = vi.hoisted(() => ({
    outcome: null as unknown,
    monitor: {} as {onDragStart?: () => void; onDragEnd?: (event: unknown) => void},
}));
vi.mock("./use-move-preview", () => ({useMoveResolution: () => state.outcome as Outcome}));
vi.mock("@dnd-kit/react", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@dnd-kit/react")>()),
    useDragDropMonitor: (handlers: typeof state.monitor) => {
        state.monitor = handlers;
    },
}));

import {CalendarI18nProvider} from "../../i18n/provider";
import {MoveFeedback} from "./move-feedback";

const review: CalendarEvent = {
    id: "review",
    title: "Design review",
    start: new Date(2026, 9, 5, 14),
    end: new Date(2026, 9, 5, 18),
};
const announcement = () => document.querySelector('[data-slot="move-announcement"]')!;
const show = (outcome: Outcome, locale?: "en" | "fr") => {
    state.outcome = outcome;
    return render(
        <CalendarI18nProvider locale={locale}>
            <MoveFeedback />
        </CalendarI18nProvider>,
    );
};

describe("MoveFeedback announcements", () => {
    it("announces an accepted timed destination as a move", () => {
        show({status: "accepted", event: review});
        expect(announcement().textContent).toBe("Moving Design review: Oct 5, 2:00 PM – Oct 5, 6:00 PM");
    });
    it("announces all-day destinations with the localized all-day range", () => {
        show({status: "accepted", event: {...review, allDay: true, start: new Date(2026, 9, 5), end: new Date(2026, 9, 6)}});
        expect(announcement().textContent).toBe("Moving Design review: Oct 5, 2026 – Oct 6, 2026 · All day");
    });
    it("localizes the announcement", () => {
        show({status: "accepted", event: review}, "fr");
        expect(announcement().textContent).toMatch(/^Déplacement de Design review : /u);
    });
    it("leaves refusals to the alert and announces cancellation until the next drag", () => {
        show({status: "rejected", reason: "Room is booked"});
        expect(announcement().textContent).toBe("");
        expect(screen.getByRole("alert")).toHaveTextContent("Room is booked");
        act(() => state.monitor.onDragEnd?.({canceled: true, operation: {target: null}}));
        expect(announcement().textContent).toBe("Move cancelled");
        act(() => state.monitor.onDragStart?.());
        expect(announcement().textContent).toBe("");
    });
    it("does not announce cancellation after a drop on a slot", () => {
        show(null);
        act(() => state.monitor.onDragEnd?.({canceled: false, operation: {target: {}}}));
        expect(announcement().textContent).toBe("");
    });
});
```

The en/fr expected strings come from the locale formats listed in "Current
state". If an exact en string differs **only** in whitespace characters
(date-fns may emit a narrow no-break space before `PM`), normalize with
`.replace(/\s/gu, " ")` on the actual value. Do not change any other expectation.

**Verify**: `pnpm exec vitest run src/components/event-calendar/move-feedback.test.tsx` → 5 passed.

### Step 5: Browser test: one announcer, localized cancel

Add to `tests/browser/drag.spec.ts`, after the
`"keyboard: resolver preview agrees with a changed drop ..."` test:

```ts
test("keyboard: the calendar is the only move announcer", async ({page, calendar}) => {
    await calendar.open({query: "moves", view: "Week", scrollTop: 0});
    const source = page.locator('[data-slot="all-day-band"] [data-calendar-event="move-range"]').first();
    await source.focus();
    await page.keyboard.press("Space");
    for (
        let step = 0;
        step < 20 && (await page.locator('[data-drop-target="true"][data-minute]').count()) === 0;
        step++
    ) {
        await page.keyboard.press("ArrowDown");
    }
    const announcement = page.locator('[data-slot="move-announcement"]');
    await expect(announcement).toContainText("Moving Host range:");
    await page.keyboard.press("Escape");
    await expect(announcement).toHaveText("Move cancelled");
    // dnd-kit's own live region exists but stays silent.
    await expect(page.locator('[id^="dnd-kit-announcement"]')).toHaveText("");
    await expect(page.locator("main")).toHaveAttribute("data-event-updates", "0");
});
```

**Verify**: `pnpm demo:build && pnpm exec playwright test tests/browser/drag.spec.ts` → all pass.

### Step 6: Format and full verification

Run `pnpm exec prettier --write src/components/event-calendar/calendar-surface.tsx src/components/event-calendar/move-feedback.tsx src/components/event-calendar/move-feedback.test.tsx tests/browser/drag.spec.ts src/i18n/locales`.
Only format in-scope files. Do not run `pnpm format` on the whole repo.

**Verify**: `pnpm lint:fix` → exit 0. `pnpm format:check` → "All matched files use Prettier code style!". `pnpm verify` → exit 0.

## Test plan

- New unit file `move-feedback.test.tsx` (5 tests): accepted timed and all-day
  wording, French localization, refusal goes to the alert and not the status,
  cancellation announced and cleared on the next drag start, and no cancel
  announcement after a drop on a slot.
- New browser test: keyboard drag announces `Moving …`, Escape announces
  `Move cancelled`, and dnd-kit's live region stays empty.
- Existing: `src/i18n/resource-parity.test.ts` and `no-hardcoded-text.test.ts`
  must still pass.

## Done criteria

- [ ] `grep -n "Accessibility.configure" src/components/event-calendar/calendar-surface.tsx` prints one line
- [ ] `grep -n '"PPP' src/components/event-calendar/move-feedback.tsx` prints nothing (hard-coded patterns gone)
- [ ] `grep -c '"movePreview"\|"moveCancelled"' src/i18n/locales/*/calendar.json` prints `2` for each of the four files
- [ ] `pnpm exec vitest run src/components/event-calendar/move-feedback.test.tsx` → 5 passed
- [ ] `pnpm verify` exits 0, and the new browser test is listed as passed
- [ ] `git status --short` shows changes only in in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` row 007 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check fails.
- `Accessibility.configure({...})` does not typecheck with the three `silent`
  functions. The dnd-kit types may have changed. Report the compiler error.
- In the browser test, `[id^="dnd-kit-announcement"]` resolves to 0 or more than
  1 element, or it still contains text after Step 2. The plugin override did not
  take effect. Do not remove the `Accessibility` plugin as a workaround, because
  it also provides `aria-describedby` instructions.
- The en expected strings in Step 4 differ by more than whitespace (e.g. a
  different date format). Report the actual string. The locale data may have
  changed.
- Resource parity fails for a reason other than a typo in your new keys.

## Maintenance notes

- Pointer drags update the destination on every quarter-hour slot, so a fast drag
  produces many polite announcements. dnd-kit debounced its own announcements by
  500ms. If screen-reader users report chatter, debounce the `movePreview` text,
  but keep keyboard steps immediate.
- dnd-kit's English `screenReaderInstructions` (the `aria-describedby` text) remain.
  They say "press space again to drop", while `docs/API.md` documents Enter.
  Localizing them is a follow-up that needs the plugin options to change with
  the locale.
- Any future drag kind (e.g. a host-policy resize) should announce through the
  same pattern: one calendar-owned region, keys under `announcement.*`.

## Execution result — 2026-10-11

DONE. See the run 2 execution review and completion evidence in `plans/README.md`.
The combined implementation passed `pnpm verify` (244 DST tests, 67 browser tests,
and React 18/19 package consumers) and the 57-run drag repetition check.
