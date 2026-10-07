# Event calendar requirements

The calendar is a controlled React component. The host owns events, persistence
and surrounding page layout; the library owns its editor and internal scrolling.

## Views and editing

- Default month view; Sunday-first grid includes adjacent-month dates. Previous,
  Next and Today navigate. Month steps one month, week seven days, day one day,
  agenda 30 days. Week headings describe their range; Agenda shows the selected
  month and year even when its listing crosses months.
- View menu offers Month, Week, Day, Agenda with M/W/D/A keyboard shortcuts.
  Typing in inputs, textareas or contenteditable and an open editor suppress them.
- Month: today is a dark circle; outside dates are muted; 24px event bars with
  4px gaps, time prefixes for timed events, truncation, six pastel colors.
  Multi-day bars have square interior ends, rounded outer ends and one visible
  title. Spanning events precede timed events. Event capacity responds to cell
  height; overflow opens a date-labelled popover containing every event that day.
- Week/day: 24-hour grid, 64px per hour, quarter-hour creation/drop targets.
  Week has eight equal columns including the time gutter. Date headers show
  timezone and today. Only all-day events appear in the all-day band; timed
  multi-day events have clipped hourly segments with continuation markers.
  Overlapping timed events use separate responsive lanes and overflow popovers.
  Events below 45 minutes use a compact single-line label. Current time has a
  dark line and dot, updated every minute. Past events are struck through.
- Agenda: 30 inclusive calendar dates starting at the selected date, omit empty
  days, repeat spanning events on each day, date dividers, event title, uppercase
  time range or All day, optional location and description. Empty range shows
  “No events found” and “There are no events scheduled for this time period.”
- Clicking an event opens Edit Event; empty month space opens Create Event at
  9 AM on that date, with one-hour duration. Timed space uses its quarter-hour.
  New event uses today's date and 9–10 AM, regardless of navigated date.
- Editor: right drawer, Title, Description, Start Date/Time, End Date/Time,
  All day, Location, Etiquette; Sky/Amber/Violet/Rose/Emerald/Orange radio colors.
  Date controls use shadcn date popovers. End dates before start are disabled;
  advancing start past end also advances end. All day hides time controls;
  newly chosen all-day boundaries use midnight through 23:59:59.999 on the
  inclusive final date. Untouched existing endpoints retain their exact instants.
- Blank titles save as “(no title)”. End-before-start shows an error; equal
  timestamps are accepted. Cancel, Escape and backdrop dismiss without saving.
  Existing events have immediate Delete event. Save/delete/move emit feedback.
- Dragging moves an event while preserving duration. Month moves retain time;
  timed grid drops snap to quarter-hours. No target or Escape cancels.
  Mouse dragging activates after 5px; touch uses a 250ms hold with 5px tolerance.
  The drag preview's time follows the hovered quarter-hour, has rounded ends,
  and drops immediately without a return animation.

## Interaction guarantees

- Timed cards occupy separate responsive lanes. [Overlap layout](overlap-layout.md) specifies the
  configurable 90px minimum, precise hidden counts/coverage, full event popover,
  and selected-date “Open day view” action.
- Narrow columns keep at least one full-width event visible,
  keep overflow independent of side rails and make timed-popover rows
  draggable with the same conversion/cancellation rules. Full ranges omit repeated
  same-day dates; the hidden-count subtitle and illustration annotations are absent.
- Overflow pills float across the whole day column with small
  gutters, continuous event backgrounds and no white strip. Actual footprints
  keep controls clear of labels and endpoint grips. The all-day label sticks to
  its scrollable band's bottom. Endpoint resizing follows resize-rules.md;
  body moves retain their original duration and conversion behavior.
- Dragging uses one canonical event surface from both
  popup and grid sources. Hidden events get separate controls whenever their
  actual button footprints fit, even when their durations overlap. The 10 AM
  review remains separate from the earlier 9:00/9:45 meeting group.
- [Drag rules](drag-rules.md) specifies movement and conversion:
  explicit type conversion, configurable one-hour default, exclusive timed ends,
  hourly multi-day segments, shared preview/commit rules, one update per drop.
- Agenda's heading displays the selected month and year, such as “October 2026,”
  so the heading stays stable while the listing crosses months. Its 30-day
  listing and navigation interval remain unchanged.
- Calendar owns its scroll viewport. Toolbar remains visible; time headers and
  all-day band stay visible. No document overflow at desktop or mobile widths.
- Scoped keyboard shortcuts avoid interfering with other calendar instances,
  dialogs, modified keyboard shortcuts, or unrelated host form controls.
- Calendar-date comparison includes month and year. Month navigation clamps
  end-of-month dates.
- The quarter-hour time list ends at 23:45. Overnight events use the next date explicitly.
- Continued segments remain named for assistive technology and can be moved;
  start date is shifted relative to the grabbed segment.
- All-day empty space also supports creation. Deep overlap widths stay inside
  the day. Editor has a scrollable body and reachable footer on short screens.

## Acceptance

Unit tests cover date math, inclusive spanning, lane layout, overlap positioning,
duration-preserving moves and DST boundaries. Interaction tests cover creation,
editing, validation, deletion, keyboard/menu navigation and controlled callbacks.
Playwright exercises the standalone demo, actual pointer dragging,
cancellation, date/time pickers, overflow popover, all four views, dark mode and
desktop/mobile containment. Screenshots and results go in validation.md.

## Library integration and distribution

The library provides a typed public API with metadata-safe existing-event callbacks,
consumer-controlled events/navigation, workflow/label overrides and readOnly.
An independent CSS import must work without host Tailwind or app aliases, cover
portals and promoted feedback, and leave host page height/scrolling untouched.
Root style layout must stay separate from CSS variables shared with overlays.

Build and pack ESM/CommonJS, declarations and scoped CSS. Install the tarball in
fresh React 18.3.1 and 19.2.7 hosts; check NodeNext types, server imports/static
rendering, runtime exports, editor/menu/date portals, light/dark and host layout.
Keep application business logic and persistence in the host. The calendar uses
private per-instance locale state and leaves host localization untouched.
Retain third-party license notices and maintain these specifications.
The library is MIT-licensed and named `@junhaoliao/calendar`
(https://github.com/junhaoliao/calendar). Its npm package stays `private: true`
until an npm release.
