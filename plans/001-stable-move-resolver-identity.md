# Plan 001: Keep the `resolveEventMove` adapter stable across host renders

## Approved implementation amendments

Status: DONE. The user approved the revised review on 2026-10-08.
These amendments supersede conflicting historical steps and done criteria below.

Memoize the generic adapter on the host function. Keep the existing renderEvent adapter out of scope. Test stable host renders and genuine policy replacement.


> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: this plan was written against commit `88930af`
> **plus the uncommitted `resolveEventMove` feature** in the working tree. A SHA
> diff is therefore not meaningful. Instead confirm the excerpts below still
> match: `grep -n "resolveEventMove" src/event-calendar.tsx` must show the
> inline arrow at lines ~54-58. On mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf / bug
- **Planned at**: commit `88930af` + uncommitted working tree, 2026-10-08

## Why this matters

`EventCalendar` (the public generic wrapper) passes an inline arrow function as
`resolveEventMove` to the internal `CalendarSurface` on **every render**. The
internal controller puts `resolveEventMove` into a memoized `config` object, so
`config` changes identity on every host render. Every component that calls
`useCalendarConfig()` (7 of them, including every draggable event) then
re-renders, and the controller's resolution cache (which checks
`cached.resolver === resolver`) always misses, so any unrelated host re-render
during a drag re-runs the host's resolver. The docs promise that only "replacing
the resolver" refreshes resolution; this makes that promise true.

## Current state

- `src/event-calendar.tsx` — public generic boundary; adapts host-typed callbacks
  to the internal `CalendarEvent` type. Lines 49-58:

  ```tsx
  return (
      <CalendarI18nProvider locale={props.locale}>
          <CalendarStyleProvider theme={props.theme} style={props.style} lang={props.locale ?? DEFAULT_LOCALE}>
              <CalendarSurface
                  {...props}
                  resolveEventMove={
                      props.resolveEventMove
                          ? (context) => props.resolveEventMove?.(context as EventMoveContext<TEvent>) ?? null
                          : undefined
                  }
  ```

  Line 3 imports only `useContext` from React.

- `src/components/event-calendar/use-calendar-controller.ts:102-111` — the config memo:

  ```ts
  const config = useMemo<CalendarConfig>(
      () => ({
          readOnly: readOnly,
          renderEvent: renderEvent,
          minimumTimedEventWidth: minimumTimedEventWidth,
          defaultDuration: timedConversionDuration(defaultTimedDurationMinutes),
          resolveEventMove,
      }),
      [defaultTimedDurationMinutes, minimumTimedEventWidth, readOnly, renderEvent, resolveEventMove],
  );
  ```

- `src/components/event-calendar/use-calendar-controller.ts:290-304` — the
  resolution cache compares `cached.resolver === resolver`.

- Test exemplar: `src/components/event-calendar/render-isolation.test.tsx`. It
  mocks `@dnd-kit/react`'s `useDraggable` to count renders per event id
  (`counts.draggableById`, helper `rendersFor(id)`, reset with `resetCounts()`),
  then renders `<EventCalendar>` and asserts render counts. Match its style.

Conventions: 4-space indent, double quotes, `{a}` without inner spaces, arrow
functions, short comments only where non-obvious. Run `pnpm lint:fix` before
fixing any lint issue by hand (project rule in `AGENTS.md`).

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Single test file | `pnpm exec vitest run src/components/event-calendar/render-isolation.test.tsx` | all pass |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint (auto-fix first) | `pnpm lint:fix` | exit 0, no remaining errors |
| Unit tests | `pnpm test` | all pass |
| Full verification (behavior change) | `pnpm verify` | exit 0 (needs Playwright browsers installed) |

## Scope

**In scope** (the only files you should modify):
- `src/event-calendar.tsx`
- `src/components/event-calendar/render-isolation.test.tsx`

**Out of scope** (do NOT touch):
- The `renderEvent` wrapper in `src/event-calendar.tsx:37-48`. It has the same
  identity problem, but its dependencies (`hostInstance`, `hostDefaultNS`, which
  is a freshly spread array) need separate design. Leave it.
- `use-calendar-controller.ts` — the cache and memo are correct once the input is stable.

## Git workflow

Do NOT commit or push (project rule: "Never commit or push unless explicitly
asked"). Leave changes in the working tree. If the operator asks for a commit,
use conventional commits, e.g. `fix: keep move resolver identity stable`.

## Steps

### Step 1: Add a failing render-isolation test

In `src/components/event-calendar/render-isolation.test.tsx`, add to the
existing `describe("render isolation", ...)` block two tests. Add
`import {useState} from "react";` and import the type
`EventMoveResolver` from `"../../index"` (alongside the existing `EventCalendar` import).

```tsx
it("does not rerender events when the host rerenders with the same move resolver", async () => {
    const user = userEvent.setup();
    const events: CalendarEvent[] = [
        {id: "meeting", title: "Meeting", start: sunday, end: new Date(2026, 9, 4, 11)},
    ];
    const resolveEventMove: EventMoveResolver = ({defaultResult}) => defaultResult;
    const Host = () => {
        const [count, setCount] = useState(0);
        return (
            <>
                <button type="button" onClick={() => setCount(count + 1)}>
                    {`Host render ${count}`}
                </button>
                <EventCalendar
                    events={events}
                    initialDate={sunday}
                    initialView="week"
                    now={sunday}
                    resolveEventMove={resolveEventMove}
                />
            </>
        );
    };
    render(<Host />);
    resetCounts();
    await user.click(screen.getByRole("button", {name: "Host render 0"}));
    expect(screen.getByRole("button", {name: "Host render 1"})).toBeInTheDocument();
    expect(rendersFor("meeting")).toBe(0);
});

it("refreshes events when the host replaces its move resolver", async () => {
    // Same Host shape, but each click switches between two resolver functions:
    // const policies: EventMoveResolver[] = [({defaultResult}) => defaultResult, () => null];
    // resolveEventMove={policies[count % 2]}
    // After the click, expect(rendersFor("meeting")).toBeGreaterThan(0).
});
```

Write the second test out fully following the comment.

**Verify**: `pnpm exec vitest run src/components/event-calendar/render-isolation.test.tsx`
→ the **first** new test FAILS (`rendersFor("meeting")` > 0); the second passes.

### Step 2: Memoize the adapter on the host function's identity

In `src/event-calendar.tsx`:
- Change the React import to `import {useContext, useMemo} from "react";`.
- After the `hostDefaultNS` constant (line ~36) and before `renderEvent`, add:

```tsx
const hostResolveEventMove = props.resolveEventMove;
// Stable adapter: config consumers and the resolution cache refresh only when the host policy changes.
const resolveEventMove = useMemo<EventCalendarProps["resolveEventMove"]>(
    () =>
        hostResolveEventMove
            ? (context) => hostResolveEventMove(context as EventMoveContext<TEvent>) ?? null
            : undefined,
    [hostResolveEventMove],
);
```

- Replace the inline JSX prop (lines 54-58) with `resolveEventMove={resolveEventMove}`.

**Verify**: `pnpm exec vitest run src/components/event-calendar/render-isolation.test.tsx` → all pass, including both new tests.

### Step 3: Full checks

**Verify**:
- `pnpm typecheck` → exit 0
- `pnpm lint:fix` → exit 0
- `pnpm test` → all pass (baseline before this plan: 219 passed, 2 skipped, plus your 2 new tests)
- `pnpm verify` → exit 0

## Test plan

- Two new tests in `render-isolation.test.tsx` (step 1): a host re-render with
  the same resolver causes 0 draggable renders; swapping the resolver re-renders.
- Existing `use-calendar-controller.test.ts` test "refreshes preview resolution
  when the host replaces its policy" must keep passing unchanged.

## Done criteria

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0; both new render-isolation tests exist and pass
- [ ] `grep -n "props.resolveEventMove?.(" src/event-calendar.tsx` returns no matches
- [ ] `git diff --name-only` lists no files beyond the two in scope (plus `plans/README.md`) compared with the pre-plan state
- [ ] `plans/README.md` status row updated

## STOP conditions

- The first new test **passes before** step 2. That means something else
  already stabilises `config`, or the draggable doesn't consume config. Report it.
- After step 2 the first test still fails. Some other prop is unstable; report
  which `useCalendarConfig` field changes, and don't chase it.
- `react-hooks` lint complains about the hook placement and `pnpm lint:fix`
  doesn't resolve it.

## Maintenance notes

- Any future callback that is put into `CalendarConfig` must be passed through a
  stable adapter like this one, or it will re-render every config consumer.
- `renderEvent` has the same issue (deferred; see "Out of scope").
- Hosts that pass an inline resolver lambda still get a refresh on every render.
  That is documented as "replacing the policy". Consider recommending
  `useCallback` or a module-level resolver in `docs/event-calendar/drag-rules.md`.
