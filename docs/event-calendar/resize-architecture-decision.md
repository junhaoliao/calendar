# ADR: Keep the native endpoint-resize engine

**Status:** Accepted, 2026-10-07. Decision: NO-GO for moving endpoint resizing
onto dnd-kit.

## Context

Body moves use dnd-kit. Endpoint resizes use the calendar's own pointer and
keyboard session (`CalendarResizeProvider`). Having two engines duplicates
activation thresholds, cancellation, auto-scroll and click suppression.

A cleanup already reduced that duplication: shared 5 px / 250 ms thresholds, a
pure time mapping, layout geometry passed in as props, separate stable actions
and preview state, and one click-suppression timer. The experiment asked
whether moving the remaining resize input onto dnd-kit 0.5.0 would keep every
rule in [resize-rules.md](resize-rules.md) and make the code simpler or cheaper.
The public `resizeEvent` helper and the resize rules were not changed.

## Decision

Keep the native resize engine. Do not adopt the dnd-kit prototype.

## Reasons

- **Parity was not reliable.** The prototype passed all 15 existing resize
  browser scenarios in one run, but a repeat run failed three of them:
  - the start-grip preview did not appear;
  - the keyboard resize status stayed after Enter;
  - an all-day resize failed its single-update check.

  The native engine passed the original and repeat checks. The prototype also
  failed two of five extra probes on repeat: a synthetic touch long-press and
  a keyboard quarter-hour preview.
- **It was not simpler.** Making dnd-kit work needed:
  - a direct `@dnd-kit/geometry` dependency;
  - imperative mutation of the drag operation's shape (with feedback disabled,
    dnd-kit otherwise dropped every collision target);
  - a resize-specific keyboard sensor;
  - a bridge component with its own blur/resize listeners;
  - a `WeakMap` for the grab offset.

  The prototype also still read card and column rectangles from the DOM.
- **No rendering improvement was measured.** In development-mode React
  Profiler trials of the same eight-step drag, the prototype made 19 commits
  where the native engine made 10. Its total render time was roughly 20–40%
  higher, depending on the trial. These are single trials on one machine, not
  a benchmark.
- **Touch timing is unproven.** Chromium's DevTools input delivered the first
  move after the 250 ms hold window, so a real early-move touch cancellation
  could not be shown either way.

## Consequences

- The cleaned native engine and `resizeEvent` remain the single resize path.
- Body moves, the published resize contract and the interaction docs are
  unchanged.
- The prototype engine is not adopted; the production calendar keeps the
  native implementation.

## Revisit when

dnd-kit offers a supported way to keep collision detection with stationary
(no-feedback) dragging. A new attempt must:
- pass every existing resize scenario repeatedly;
- prove a real early-move touch gesture;
- remove the native listeners instead of keeping two engines;
- show equal or lower render cost over repeated trials.
