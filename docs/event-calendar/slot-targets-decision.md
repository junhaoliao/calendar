# ADR: Keep per-quarter-hour timed slot targets

**Status:** Accepted, 2026-10-07. Decision: NO-GO for replacing timed slot
targets with one drop target per day column.

## Context

Week view renders 96 timed slot targets per day: 672 droppables and 672
keyboard tab stops, on top of event buttons and resize grips. Month cells and
the all-day band already use one target per date and are not affected.

The experiment replaced the 96 timed targets per day with one column target.
It computed the minute from the pointer position and added a roving-focus time
grid for keyboard creation. The public `DropData` / `CalendarDropTarget`
shape (`{date, minute?, allDay?}`) was kept.

## Options considered

| Option | Assessment |
| --- | --- |
| Keep 96 timed targets per day | Current behaviour. Simple collision and click model, but hundreds of droppables and tab stops. |
| One column target per day plus a roving time grid | Reduces timed targets from 672 to 7 and slot tab stops to one, while keeping quarter-hour creation. Requires exact keyboard drag movement. |
| One column target per day plus one "add" button | Simplest, but loses quarter-hour keyboard creation. Not pursued. |

## Decision

Keep the existing 96 timed slot targets per day. Do not adopt the
column-target prototype.

## Reasons

- **Keyboard dragging broke.** Picking up an event at 10:00 and pressing
  ArrowDown three times left the preview at 10:00 instead of moving it to 10:45.
  Moving to the next day with ArrowRight was never shown to work.
- **The existing browser suite did not pass.** Most failures were selectors
  that still pointed at the removed slot buttons (expected, and portable). One
  was real: resizing the window during an endpoint resize committed an update
  instead of cancelling. Its cause was not diagnosed; the experimental
  engine was not pursued.
- **What did work:** mouse and touch drags, exact quarter-hour boundaries
  under scrolling, sticky-header occlusion, and the roving grid's Tab
  entry/exit and quarter-hour creation.

  In development-mode React Profiler trials, initial Week cumulative rendering
  work was about 50 ms instead of about 200 ms over three callbacks. An
  accelerated calendar-clock update of exactly one minute recorded about
  16 ms instead of about 57 ms. These are single trials on one machine, not
  measurements of elapsed interaction latency.

## Consequences

- Timed slots keep one `CalendarDrop` per quarter-hour. Week view still has
  672 slot tab stops; this accessibility cost is accepted for now.
- `moveEvent`, event identity, metadata, durations, notifications and the
  `DropData` contract are unchanged.
- The prototype engine is not adopted; the production calendar keeps its
  existing timed targets.
- Slot labels are localized through the calendar's translations and computed
  once per slot; they are recomputed only when the slot's date, minute or locale changes.
- Follow-up: roving keyboard focus over the existing 96 slot targets per day
  (one tab stop per column, arrow keys to move between quarter-hours) remains unscheduled.

## Recommended follow-up

Add **roving-focus keyboard navigation on the existing slot targets**. Make the
timed grid a single tab stop, with arrow keys moving between quarter-hours and
days. That fixes the tab-stop problem without changing the drop-target engine.
Roving focus remains a separate, unscheduled follow-up.

A column-target engine may be revisited only if:
- keyboard dragging moves exactly from the pickup time in 15-minute steps;
- ArrowRight moves one local day at every responsive width;
- the full existing browser suite passes against it.
