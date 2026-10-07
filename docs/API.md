# Public API

Three entry points are public. Internal views and UI primitives are private.
Both code entries ship ESM and CommonJS builds with self-contained declarations.

## `@junhaoliao/calendar`

| Export | Kind | Contract |
| --- | --- | --- |
| `EventCalendar` | component | `<EventCalendar<TEvent> {...EventCalendarProps<TEvent>}/>`; see "Component options" |
| `EventCalendarProps<TEvent>` | type | Props; `TEvent extends CalendarEvent` is inferred from `events` |
| `CalendarEvent<TMetadata>` | type | Event data; see "Event data" |
| `NewCalendarEvent` | type | `CalendarEvent` without `id`; the host assigns an id in `onEventAdd` |
| `CalendarNotification<TEvent>` | type | Completed mutation payload; `added` has an id-less `NewCalendarEvent`, other actions carry `TEvent` |
| `CalendarNotificationAction` | type | `"added" \| "updated" \| "deleted" \| "moved" \| "resized"` |
| `CalendarSlot` | type | `{start: Date; end: Date; allDay: boolean}` passed to `onSlotClick` |
| `CalendarView` | type | `"month" \| "week" \| "day" \| "agenda"` |
| `CalendarLocale` | type | `"en" \| "fr" \| "zh-Hans" \| "zh-Hant"` |
| `EventColor` | type | `"sky" \| "amber" \| "violet" \| "rose" \| "emerald" \| "orange"` |
| `EventMoveResolver<TEvent>` | type | Pure synchronous `(context: EventMoveContext<TEvent>) => TEvent \| EventMoveRejection \| null`; shared preview and commit policy |
| `EventMoveContext<TEvent>` | type | Current unconverted event, logical anchor, destination, fallback and conventions |
| `EventMoveAnchor` | type | Grabbed date/segment, local day and elapsed offsets, source lane and grid/popup origin |
| `EventMoveTarget` | type | Destination lane, local date, snapped minute and actual local instant; time fields are null for date-only targets |
| `EventMoveLane` | type | `"month" \| "all-day" \| "timed"`; Month movement does not imply conversion |
| `EventMoveConventions` | type | Inclusive all-day ends, exclusive timed ends, local days, numeric snapping interval and DST disambiguation |
| `EventMoveRejection` | type | `{reject: string; id?: never}`; a host-localized reason, with blank text using the built-in message |
| `EventMoveRejected<TEvent>` | type | `{event: TEvent; reason: string \| null}`; completion payload for a refused drop |

## `@junhaoliao/calendar/date-math`

Pure helpers with no React or DOM runtime. They use the local timezone of the
execution environment, and none of them mutates its inputs.

| Export | Signature | Contract |
| --- | --- | --- |
| `DEFAULT_TIMED_DURATION_MINUTES` | `60` | Default conversion duration from an all-day event to a timed event |
| `lastOccupiedDay` | `<T extends Pick<CalendarEvent, "start" \| "end" \| "allDay">>(event: T) => Date` | Last occupied local date; an exclusive terminal midnight does not occupy the next date |
| `moveEvent` | `<TEvent extends CalendarEvent>(event: TEvent, anchor: Date, target: CalendarDropTarget, defaultDurationMinutes = 60) => TEvent` | Moves or converts an event without mutating it or losing host fields |
| `eventDatesChanged` | `(before: CalendarEvent, after: CalendarEvent) => boolean` | Whether the effective all-day flag or either endpoint instant changed |
| `atMinute` | `(date: Date, minute: number) => Date` | New local date at the given minute of day, with seconds and milliseconds zeroed |
| `onDay` | `(event: CalendarEvent, day: Date) => boolean` | Whether an event occupies the local calendar date, including zero-duration events |
| `eventsOnDay` | `(events: readonly CalendarEvent[], day: Date) => CalendarEvent[]` | Events occupying the date, spanning/all-day events first and then by start |
| `daysFrom` | `(date: Date, count: number) => Date[]` | Consecutive local dates beginning at `startOfDay(date)` |
| `navigateDate` | `(date: Date, view: CalendarView, direction: number) => Date` | Moves one month, week, day or 30-day agenda step; months clamp end-of-month dates |
| `calendarHeading` | `(date: Date, view: CalendarView, options?: {locale?: Locale; patterns?: {monthYear?: string; dayHeading?: string; weekStart?: string; weekEnd?: string}}) => string` | Pure localized heading; the two-argument call retains the exact English same-month and cross-year defaults |
| `resizeEvent` | `<TEvent extends CalendarEvent>(event: TEvent, edge: ResizeEdge, target: Date, dateOnly = false) => TEvent` | Changes one endpoint, preserving the other instant and all host fields |
| `CalendarDropTarget` | `{date: Date; minute?: number; allDay?: boolean}` | Destination data used by `moveEvent` |
| `ResizeEdge` | `"start" \| "end"` | Endpoint selected by `resizeEvent` |

## `@junhaoliao/calendar/styles.css`

Compiled, scoped stylesheet. Import it once; see the README "Themes and portals" section.

## Event data

| Field | Type / meaning |
| --- | --- |
| `id` | A unique, nonempty, stable string. Delimiter characters are supported. |
| `title` | A string. The editor saves blank titles as `(no title)` in every locale. |
| `start`, `end` | Valid `Date` values; `end` must be greater than or equal to `start`. |
| `allDay` | An optional boolean. A false or omitted value means timed, even across dates. |
| `color` | The color is sky, amber, violet, rose, emerald or orange. The visual default is sky. |
| `description`, `location` | These fields are optional strings. |
| `metadata` | An optional consumer-owned value of `TMetadata`, retained by reference. |

An interface extending CalendarEvent can require additional top-level fields.
`events` infers that type for updates, selection and custom rendering. No
calendar helper mutates input objects or Date instances. Consumers must not
change event IDs during a drag.

## Component options

| Prop | Contract |
| --- | --- |
| `events` | The required readonly consumer array. The library does not fetch or persist events. |
| `onEventAdd(event)` | Receives a `NewCalendarEvent` without an `id`. The host assigns the id and any required fields. |
| `onEventUpdate(event)` | Receives the complete updated existing `TEvent`, including consumer metadata. |
| `onMoveRejected({event, reason})` | Optional refusal feedback, exactly once for a rejected drop. `event` has its unchanged schedule and current host fields; `reason` is host text or null. Hover, cancellation, invalidated drags and accepted unchanged drops emit nothing. `onNotification` remains for completed mutations. |
| `onEventDelete(id)` | Receives the id of an existing event. |
| `onEventClick(event)` | Replaces built-in edit selection and still works in `readOnly` mode. |
| `onSlotClick(slot)` | Replaces the creation editor. It receives Date-valued start/end and `allDay`, and is suppressed in `readOnly` mode. |
| `date`, `view` | These optional values control navigation. Pair them with change callbacks. |
| `initialDate`, `initialView` | These values initialize uncontrolled navigation. The defaults are today and Month view. |
| `locale` | `"en"` (default), `"fr"`, `"zh-Hans"` or `"zh-Hant"`; built-in labels, dates and screen-reader text. Weeks stay Sunday-first and physical keyboard shortcuts stay M/W/D/A. |
| `onDateChange(date)`, `onViewChange(view)` | Report navigation requests. A controlled host must apply them. |
| `now` | Provides a fixed clock. When omitted, the clock updates once per minute. |
| `readOnly` | Disables creating, editing, deleting, moving and resizing events. Navigation and a host-supplied `onEventClick` still work. |
| `renderEvent(event, view)` | Replaces the shared label inside the native event surface. Avoid nested interactive controls. All-day bars in the Week/Day band receive `week`/`day`; use `event.allDay` to distinguish bars from timed cards. Other sources retain their existing preview presentation view during drag conversions. |
| `onNotification({action, event})` | Optional feedback hook. `action` is added, updated, deleted, moved or resized. `event` is the host's event type, except `added`, which is a NewCalendarEvent without id. The built-in screen-reader status is separate. |
| `defaultTimedDurationMinutes` | Sets the all-day to timed conversion duration in positive finite minutes. The default and invalid-value fallback are 60. |
| `resolveEventMove(context)` | Pure synchronous host policy returning the complete `TEvent`, or null / `{reject: reason}` to reject. Runs before preview and commit for all supported body-drag inputs. Valid endpoints and type are preserved exactly; it does not handle endpoint resizing. See [the resolver contract](event-calendar/drag-rules.md). |
| `minimumTimedEventWidth` | Sets the preferred timed lane width in positive finite CSS pixels. The default and invalid-value fallback are 90; at least one lane stays visible. |
| `className` | Adds root layout classes. The parent provides a height and permits the required min-width/min-height behavior. |
| `style` | Sets the root layout style. CSS custom properties are shared with portals and event surfaces. |
| `theme` | Selects a light/dark override. When omitted, the theme follows the nearest dark/light ancestor and observes class changes. |

The library uses a private i18next instance per calendar and leaves any host
instance and custom `renderEvent` content under the host's translation context.
Empty titles and the persisted `(no title)` sentinel display with a localized
built-in fallback; callbacks and custom renderers still receive the original
title. Switching `locale` does not rewrite events or emit mutation callbacks.
French, Simplified Chinese and Traditional Chinese strings require native-speaker
review before publication.

Callbacks are optional, but provide mutation callbacks for an editable calendar
to persist changes. Without them, the built-in editor can show a candidate and
feedback while controlled input data stays the same. Use readOnly for an explicit
view-only interface. The library emits synchronous mutation requests and does
not wait for network acknowledgment or implement rollback.

The editor saves untouched existing start/end instants exactly, including imported all-day boundaries, off-quarter-hour times and seconds. New all-day drafts and explicitly changed all-day boundaries normalize to midnight/end of day. Timed-to-all-day conversion uses the effective edited draft's last occupied date. Clearing All day without choosing times defaults to 00:00 through 23:59:59.999 on the same dates, including noncanonical imported events. Absent optional fields stay absent.
New event toolbar defaults to today's 9–10 AM. Month slots use clicked dates;
time slots use their clicked quarter-hour; all-day band slots request allDay=true from local midnight through 23:59:59.999 on the clicked date.
`defaultTimedDurationMinutes` affects drag conversion, not the creation defaults.

## Navigation and dragging

Previous/Next move by the visible range: one calendar month in Month view
(clamped to the last day of shorter months), seven local dates in Week view,
one date in Day view and 30 dates in Agenda view. Weeks start on Sunday. Agenda lists 30 dates from the selection while
its heading shows the full selected month/year. Focused-calendar M/W/D/A
shortcuts avoid form controls, dialogs, modifier keys and active drags.

A mouse drag starts after the pointer moves 5px. A touch drag starts after a
250ms press, as long as the finger stays within 5px.
Space picks up; arrows navigate; Enter drops; Escape cancels. A changed completed
drop emits one update and one notification. Hover, canceled/outside drops and
unchanged drops emit none. Window resize cancels keyboard dragging. Timed popup
sources stay mounted through pointer drag and width changes.
Drops are computed from the latest `events` entry using the immutable pickup
facts, so host-owned fields stay current. A drop is ignored if the host changed
that event's dates or type, or deleted it, during the drag.

Same-type timed moves retain elapsed milliseconds; all-day moves retain local
date count. All-day to timed uses the dropped quarter-hour and configured
duration, regardless of original date count. Timed to all-day uses occupied
dates relative to the grabbed segment. [Drag rules](event-calendar/drag-rules.md)
and [overlap layout](event-calendar/overlap-layout.md) define the edge cases.

Endpoint handles resize rather than move. Week/Day uses top/start and bottom/end;
Month/all-day uses left/start and right/end on true endpoints. The changed time
snaps to 15 minutes, with at least 15 minutes of timed duration or one all-day date.
The opposite instant remains exact. Focus a handle and use arrows, Enter to save
and Escape to cancel. Short cards/popup rows use the editor or Open day view.
See [resize rules](event-calendar/resize-rules.md) for touch, date and cancellation
behavior. Notifications use the action `resized`; onEventUpdate remains the same
typed callback. readOnly suppresses resize handles.
A completed resize applies only the dragged endpoint to the latest `events` entry.
It is ignored if the event was deleted or changed type, the edge did not
move, or the result would be shorter than 15 minutes for timed events or end
before it starts for all-day events.

## Pure date helpers

The table above lists every helper and type exported by this entry.

`moveEvent<TEvent>(event, anchor, target, duration?)` returns TEvent. Anchor is
the displayed segment's local date. Target has a Date `date`, optional `minute`
and optional `allDay`. With a minute it snaps to a quarter-hour timed slot; with
allDay=true it moves/converts to the all-day date; with neither it moves as a
month date without changing type. This entry imports no React runtime or DOM
code. Date helpers use the execution environment's local timezone.

`resizeEvent<TEvent>(event, edge, target, dateOnly?)` returns TEvent with only the
requested start/end changed. `edge` is the exported ResizeEdge type (start/end).
`target` is a Date. Date-only timed edits preserve wall-clock endpoint times;
all-day edits always use inclusive local dates. The default timed path snaps the
changed instant and clamps its minimum duration.

## Host-defined event movement

Pass `resolveEventMove({event, anchor, target, defaultResult})` to
resolve body movement before preview or commit. Return a complete event, null, or
`{reject: reason}`. Refused drops use `onMoveRejected`, without success notifications. Host-defined ranges, points and metadata are supported across mouse, touch
and keyboard. `EventMoveResolver<TEvent>`, `EventMoveContext<TEvent>`,
`EventMoveAnchor`, `EventMoveTarget`, `EventMoveLane`, `EventMoveConventions`,
`EventMoveRejection` and `EventMoveRejected<TEvent>` are public package types.
See [the resolver contract](event-calendar/drag-rules.md) for inputs, purity, cache timing, fallback,
rejection feedback, inclusive all-day / exclusive timed ends and local DST behavior.
