# Calendar architecture

This document describes the component boundaries, interaction engines and
distribution format. See [requirements](requirements.md) for supported behavior.

## Public boundary

`EventCalendar` consumes `CalendarEvent[]` with Date-valued start/end, stable
string id, title, optional description/location/color/allDay. All-day ends are
inclusive; timed end instants are exclusive, including midnight boundaries.
Timed events use elapsed duration. Inputs are never mutated.

Events are controlled by the consumer. `onEventAdd`, `onEventUpdate` and
`onEventDelete` report changes; no storage or host-app coupling exists. Date/view
can be controlled with `date`/`view` and change callbacks, or initialized with
`initialDate`/`initialView`. `now` allows deterministic snapshots/tests. Optional
`onEventClick` and `onSlotClick` replace the built-in editor for host workflows.
`readOnly` disables mutations while retaining navigation. `className` controls
the containing layout. Hosts can retain additional event metadata on updates.
`CalendarEvent<TMetadata>` types nested metadata. `EventCalendarProps<TEvent>`
infers extended fields for updates, selection and labels. Creation supplies an
id-less `NewCalendarEvent`; the host assigns its id and any required metadata. The public wrapper
adapts this type boundary; editor/move helpers spread existing consumer objects.

## Responsibilities

- types: data and callback contracts only.
- core/resize: pure single-endpoint snapping, duration/date clamps and
  metadata-safe updates, also exported from date-math.
- calendar-resize-context: one temporary endpoint session with native pointer
  activation, contained auto-scroll, keyboard preview and commit/cancellation.
  It does not mutate events. Timed previews retain lane geometry; core/month-lanes
  retains date-preview lanes. The controller emits one update/notification.
- core/timed-layout/resize-target: pure wall-clock pointer mapping and visible-range bounds.
- event-resize-handles: sibling endpoint controls with true-boundary detection,
  hover/focus/touch presentation and compact/read-only fallbacks. They stay
  separate from the native event button and the existing dnd-kit body sensors.
- src/event-calendar: typed public wrapper and instance style provider.
- lib/calendar-style: resolved per-instance theme, nearest ancestor class observation,
  and CSS variable propagation to portals and promoted drag surfaces. Root layout
  styles stay on the root; only custom properties carry into detached surfaces.
- core/dates, core/month-lanes and core/timed-layout/placements: pure local calendar-date math, range selection, segment lanes,
  and hourly overlap placement; directly tested without React or DnD.
- core/timed-layout/lanes assigns width-independent lanes, rightward expansion and
  per-covered-interval overflow. Time columns measure their width before paint;
  time-overflow-popover composes the shared shadcn popover with full labels/edit actions
  and selected-date navigation. No event times or identities are rewritten.
  Responsive capacity always retains at least one visible lane; overflow controls
  float across the day column with side gutters, clear of labels and resize edges.
- core/timed-layout/overflow-groups partitions hidden membership by available control space,
  retaining later separate controls when they fit and exact per-popup counts.
  core/timed-layout/overflow-trigger supplies the same geometry to grouping and rendering;
  this avoids a second threshold that can diverge from actual button size.
  JSON-encoded membership keys keep arbitrary event IDs unambiguous.
- core/move: pure conversion/move rules, occupied-date boundaries and no-op
  detection. The preview and completed drag share this function. Event previews
  read the normalized duration from the shared calendar context configuration.
- event-continuation keeps segment indicators separate from event labels.
  Resting events and drag previews share EventSurface and EventLabel. The
  destination type chooses the label layout and height; all-day band events carry
  their enclosing week/day view so conversion uses the native hourly component.
- calendar-collision combines dnd-kit's pointer intersection with the visible DOM
  stack, ignoring the promoted drag surface. Sticky all-day bands and date headers
  cannot accidentally target timed slots underneath them; outside points cancel.
- event-item: five explicit bar, timed, popover-row, month-list and agenda
  variants; event-variants derives their label, drag and resize capabilities.
  Draggable previews retain the native source button identity.
- Static month-list and agenda variants bypass useDraggable entirely, because
  its disabled state sets aria-disabled and would block normal event selection.
- Timed popover rows use the popover-row variant and a scoped drag id.
  EventSurface always uses the same native button DOM node. Resting details use
  shared shadcn buttonVariants; feedback uses only the canonical event classes,
  including a 16px line height independent of its portal ancestors. EventDetails
  owns full titles and concise same-day/full dated
  multi-day ranges. use-overflow-drag retains the portal source through the drag,
  blocks premature dismissal and allows grid hits beneath the popup.
  Escape propagates to the drag sensor while popup dismissal is suppressed.
  TimeColumn retains an active popup's coverage during resizing, even when all
  lanes become visible. event-drag-style uses destination dimensions and clears
  stationary overflow hit-area padding when rendering the shared drag surface.
- calendar-sensors: stable pointer configuration (5px mouse, 250ms touch with
  5px tolerance) and keyboard sensor. @dnd-kit/dom supplies activation constraints
  for @dnd-kit/react's provider; no legacy @dnd-kit/core is used.
- calendar-sensors cancels and cleans up keyboard sessions on window resize before
  Feedback can treat it as a drop. The controller emits no update or success
  notification for canceled sessions.
- Draggable event presentation derives its temporary dates from useDragOperation
  and the pure move helper. Hover changes update preview labels without mutating
  consumer data. Feedback keeps default accessibility/auto-scroll plugins and
  disables the return animation after a completed drop.
- Drag IDs encode scope/event/date as a JSON tuple. Popup/grid retention compares
  explicit source data (dragScope, original event ID and anchor date), rather than
  parsing concatenated identifiers. Delimiter-bearing consumer IDs stay unambiguous.
- month-view: responsive capacity, stable spanning lanes and overflow popover.
- time-view: shared week/day grid, time gutter, quarter-hour targets and now line.
- agenda-view: 30-day grouped summaries and empty state.
- event-editor: draft state lives only during an open sheet; date/time validation
  and save/delete callbacks. No mirroring of consumer event state in an effect.
- calendar-surface: provider composition, current-view rendering and
  toolbar/editor wiring.
- use-calendar-controller owns navigation/mutation commands and the single `readOnly`
  policy. `calendar-context` supplies stable actions/configuration plus a separate
  clock value, so views read shared values there instead of deeply drilling them.
- use-event-draft and editor-fields separate editor validation from form layout.
- month-cell owns date overflow; time-column owns slots, positioning and the
  current-time line. Views own headers, range selection and scroll containment.
- The month row observer reconnects whenever its first date changes, so changing
  months retains responsive event capacity even when React replaces week rows.
- Week/day headers and time columns share one scroll viewport so scrollbar space
  is consistent. Headers and the bounded all-day band stick inside that viewport.
  A bottom-sticky label in the all-day gutter remains visible through band scrolling.
- The editor retains its draft until Sheet reports that its close transition has
  completed, then restores calendar focus and unmounts. Each opening initializes
  a fresh draft; this retains raw shadcn enter/exit behavior without a state mirror.
- demo/: consumer-owned in-memory events and toasts, separate Vite entry.

`src/core/` contains pure, React-free logic; `src/components/` contains React presentation.

@dnd-kit/react DragDropProvider/useDraggable/useDroppable supplies drag lifecycle,
overlay feedback, cancellation, keyboard and pointer sensors. Droppable data
contains local date and optional minute. Draggable data contains the event and
the displayed segment date; the latter avoids jumping when a continued segment
is dragged. Pure move calculations preserve duration and skip no-op updates.

The demo can later be replaced by a persistence adapter without altering views
or layout logic.

## Dependencies

React/React DOM 18.3.1 or 19 are peers. Runtime dependencies include
Base UI, the exact dnd-kit/react/dom/collision 0.5 trio, date-fns, lucide-react,
react-day-picker, CVA, clsx, tailwind-merge, i18next and react-i18next. Dependency
range and contributor/consumer runtime policies are recorded in
[development conventions](../CONVENTIONS.md). The copied UI dependency closure
contains button, dropdown-menu, sheet, field, input, textarea, checkbox, popover,
calendar, select, radio-group, alert, empty, label and separator. Sonner belongs
only to the demo. Controls use shadcn's base-vega style, built on Base UI.

## Distribution

The main entry bundles local component modules, keeps package imports external,
and preserves the main entry’s use-client directive. A separate date-math entry has no React/DOM
runtime. TypeScript emits declarations into .tmp/types; rollup-plugin-dts bundles
each public entry into self-contained ESM/CommonJS declarations. No published
module refers to app aliases or local pnpm paths.

Tailwind 4, tw-animate-css and shadcn CSS are build tools. PostCSS expands the
source stylesheet, namespaces animations and applies a zero-specificity scope
constraint to utilities, event styles and preflight/property initialization.
Theme/preflight roots map to data-event-calendar-scope. Body portals and event
sources carry that scope and their resolved theme. The host imports one compiled
CSS file; fonts and demo page layout stay outside the package.

Builds emit ESM, CommonJS, maps, CSS and declarations. Exports expose only the
main component, date-math, styles.css and package metadata. Packing excludes demo,
tests and working sources. A fresh separate React 18/19 consumer installs the
tarball and checks NodeNext types, server imports/rendering, production runtime,
portals, theme propagation and host-page scrolling. The library uses MIT and
the npm package is not yet published.
