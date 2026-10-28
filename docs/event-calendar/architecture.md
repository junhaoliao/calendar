# Calendar architecture

## Public boundary and state

`src/event-calendar.tsx` exposes the typed component and instance style provider.
The consumer owns events and persistence; callbacks request changes synchronously.
The controller owns navigation, editor selection, and mutation commands. Calendar
context separates stable actions/configuration from the clock value.

The editor creates a draft for each open session and retains it through the close
transition. Existing-event operations preserve consumer fields and metadata.
Each calendar has an isolated i18next instance with one react-i18next binding;
components read the translator, date-fns locale, and cached slot labels from
context. See the [API](../API.md) for the public data, navigation, and callback
contracts.

## Core and presentation

| Subsystem                        | Responsibility                                                          |
| -------------------------------- | ----------------------------------------------------------------------- |
| `src/core/dates.ts`              | Local date arithmetic and visible ranges                                |
| `src/core/move.ts`               | Move resolution, conversions, and unchanged-result detection            |
| `src/core/resize.ts`             | Single-endpoint snapping and range constraints                          |
| `src/core/month-lanes.ts`        | Spanning-event lanes                                                    |
| `src/core/timed-layout/`         | Timed lanes, responsive capacity, overflow geometry, and resize targets |
| `src/components/event-calendar/` | Views, controller, editor, event rendering, and interaction sessions    |
| `src/lib/calendar-style.tsx`     | Instance theme and CSS-variable propagation                             |
| `demo/`                          | In-memory consumer and interaction fixtures                             |

Core modules have no React or DOM dependencies. EventSurface and EventLabel share
presentation between resting events and previews. Overflow grouping and rendering
use the same control geometry. Views own their headers and scroll regions; sticky
headers and the all-day band share the timed viewport.

## Movement

Body dragging uses dnd-kit pointer and keyboard sensors. Source data carries event
identity, source scope, and the grabbed segment date. Structured IDs distinguish
popup and grid sources without relying on delimiter parsing.

The move resolver determines both preview and commit. A grid-aligned static preview
shows the destination while the sensor's source node stays mounted. Popup sources
remain mounted through dragging and width changes, and allow hits on the grid
beneath them. Collision detection excludes occluded targets and the promoted source.
Cancellation emits no mutation. The [movement contract](drag-rules.md) defines
resolution caching, host updates, conversion, rejection, and date semantics.

## Resizing: native input sessions

Endpoint resizing uses CalendarResizeProvider with pointer and keyboard sessions.
It shares activation thresholds and pure time mapping with the rest of the calendar,
while `resizeEvent` supplies preview and commit calculations.

This keeps resize geometry stationary and independent of the body drag feedback
lifecycle. The tradeoff is maintaining separate input-session code. A replacement
should support stationary collision geometry, remove duplicate input listeners,
and pass repeated keyboard, touch, cancellation, and resize tests without increasing
render cost. See the [resize contract](resize-rules.md).

## Timed targets: one per quarter-hour

Week and Day views use one CalendarDrop per quarter-hour. Explicit targets give
pointer creation and keyboard dragging the same date/minute destinations. A week
has 672 timed slot targets and corresponding slot tab stops, in addition to events.

Slot targets are never disabled, and the inputs passed to dnd-kit stay referentially
stable. dnd-kit recomputes every collision for each target that changes, so toggling
all of them while a drop settles stalls the main thread. Read-only calendars render
no drag sources and ignore drops instead.

The cost is target registration and a large keyboard tab sequence. Roving keyboard
focus could reduce tab stops independently of the drop-target model. A column-level
target design must preserve exact quarter-hour movement, cross-day keyboard moves,
sticky-header occlusion, and cancellation before replacing explicit targets.

## Styling and distribution

The host provides the calendar height. Calendar views contain their own scrolling.
Instance themes and custom properties propagate to body portals and drag surfaces;
root layout styles stay on the component root. See [visual design](design.md).

The build bundles local JavaScript modules into ESM and CommonJS while keeping npm
dependencies external. The main entry preserves `"use client"`; date-math has no
React or DOM runtime. TypeScript and rollup-plugin-dts produce declarations for both
module formats. Public exports include the component, date-math, styles.css, and
package metadata.

PostCSS expands Tailwind, tw-animate-css, and shadcn CSS, scopes selectors and
preflight to the calendar, and namespaces animations. Fonts and demo page styles
are outside the library. Distribution includes code, declarations, source maps,
compiled CSS, API guides, and license notices. Tests and demo sources are excluded.
See the [testing guide](validation.md) for package-consumer checks.
