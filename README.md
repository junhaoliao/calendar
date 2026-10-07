# React event calendar

A controlled React calendar with Month, Week, Day and Agenda views, an event
editor, date pickers, mouse/touch/keyboard moving and endpoint resizing, timed overnight segments,
and readable overlap lanes. The library owns its internal scrolling; your app
owns events, persistence and the surrounding page.

![Week view](https://raw.githubusercontent.com/junhaoliao/calendar/main/docs/event-calendar/screenshots/week.png)

The package is `@junhaoliao/calendar` (source: https://github.com/junhaoliao/calendar). It uses the [MIT license](LICENSE). It is not yet published to npm; until then, install it from a locally packed tarball.

## Install locally

Use Node 22.18+ and the pinned pnpm version in package.json to develop:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm pack --out artifacts/junhaoliao-calendar-0.1.0.tgz
```

In a separate app with React and React DOM installed:

```sh
npm install /absolute/path/to/junhaoliao-calendar-0.1.0.tgz
```

React and React DOM are peers (`^18.3.1 || ^19.0.0`). The standalone package smoke
test installs and exercises React 18.3.1 and 19.2.7. Base UI 1.6, dnd-kit 0.5,
date-fns, react-day-picker and the other runtime dependencies install with the
library. Tailwind, shadcn CLI, Sonner and fonts are not host requirements.

## Use

```tsx
import {useState} from "react";
import {EventCalendar, type CalendarEvent} from "@junhaoliao/calendar";
import "@junhaoliao/calendar/styles.css";

export function CalendarExample() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  return (
    <div style={{height: 700, minWidth: 0}}>
      <EventCalendar
        events={events}
        locale="fr"
        onEventAdd={event => {
          const created = {...event, id: crypto.randomUUID()};
          setEvents(current => [...current, created]);
        }}
        onEventUpdate={event => setEvents(current =>
          current.map(item => item.id === event.id ? event : item))}
        onEventDelete={id => setEvents(current =>
          current.filter(item => item.id !== id))}
      />
    </div>
  );
}
```

Choose `locale="en"` (default), `"fr"`, `"zh-Hans"` or `"zh-Hant"` for built-in
labels, dates and accessible text; weeks stay Sunday-first and M/W/D/A shortcuts
stay fixed. Blank titles are still saved as `(no title)` while built-in display
uses the selected language. French and Chinese wording needs native-speaker
review before an npm release.

`onEventAdd` receives a `NewCalendarEvent` without an `id`; assign one (a server ID, or `crypto.randomUUID()` in secure contexts).

Supply a definite height. In a flex/grid parent, permit `min-height: 0` and
`min-width: 0`. Import the CSS once in your app or framework stylesheet entry.
It includes compiled, scoped utilities, preflight and theme tokens; no Tailwind
setup or app alias is needed. It applies to the calendar, its portals and active
event surfaces. It does not set host html/body/root height or overflow, load
fonts, or restyle unrelated controls. Animation names are namespaced.

## Events and metadata

Events have unique nonempty string IDs, valid Date-valued `start`/`end`, a title
and optional `allDay`, color, description, location and metadata. `allDay` alone
defines the type. All-day end dates are inclusive; timed end instants are
exclusive. An end at midnight does not occupy the next date. Use local Date
constructors for local calendar dates; convert transport timestamps in your app.

Existing-event callbacks infer your extended event type. Edits and moves spread
the original event and retain arbitrary consumer properties and metadata
references. New events have no `id`; assign it and any required fields in `onEventAdd`:

```tsx
interface Meeting extends CalendarEvent<{source: string}> {
  projectId: string;
}
// With events: Meeting[], onEventUpdate receives Meeting.
// onEventAdd receives NewCalendarEvent, so add id, projectId and metadata yourself.
```

Optional controlled `date`/`view` navigation, `onEventClick`/`onSlotClick`
workflow overrides, `renderEvent`, `onNotification({action, event})`, `readOnly` and the
`resolveEventMove` drag policy are documented
in [the API](docs/API.md). Accessible feedback is built in; external toasts are
optional. Changes are callbacks, not persistence transactions.

`resolveEventMove` decides what a drag does: return the updated event or reject
with an optional reason. `onMoveRejected` reports refused drops separately from
success notifications. See [drag rules](docs/event-calendar/drag-rules.md).

## Themes and portals

The default theme follows the nearest `.dark`/`.light` ancestor and observes
class changes. Pass `theme="dark"` or `theme="light"` for an explicit instance
theme. This theme also applies to body portals and drag feedback. Portal
rendering preserves the upstream Base UI behavior and focus management.

Use the `style` prop to share CSS custom properties with those detached surfaces:

```tsx
import type {CSSProperties} from "react";
import {EventCalendar, type CalendarEvent} from "@junhaoliao/calendar";
import "@junhaoliao/calendar/styles.css";

export function ThemedCalendar({events}: {events: readonly CalendarEvent[]}) {
  return (
    <div style={{height: 700}}>
      <EventCalendar events={events} theme="dark"
        style={{
          "--radius": "0.75rem",
          "--event-calendar-font": "Inter, sans-serif"
        } as CSSProperties} />
    </div>
  );
}
```

Supported tokens include `--background`, `--foreground`, `--popover`,
`--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`,
`--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`,
`--accent-foreground`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`,
`--calendar-{sky,amber,violet,rose,emerald,orange}` and their `-ink` variants.
The event palette supports light and dark themes. Controls use shadcn's
base-vega style, built on Base UI.
`className` combines already available layout classes; additional Tailwind
classes added by a host still need that host's own CSS.

## Examples and validation

```sh
pnpm dev                 # /calendar-demo.html?date=2026-10-04
pnpm check               # lint (no auto-fix), types, unit tests, DST, package build
pnpm exec playwright install chromium  # first-time browser setup
pnpm test:browser        # Production mouse/touch/keyboard scenarios through Playwright
pnpm test:package        # pack, install, typecheck, SSR and browser hosts on 18/19
pnpm verify              # check + test:browser + test:package (full local gate)
```

The demo is an isolated in-memory consumer. Append `&empty`, `&debug`,
`&duration=90`, `&minWidth=120`, or
`&overlaps=contracts|column|single|short|overnight` to exercise deterministic fixtures.
Use `&resize=single|overnight|all-day|crowded|short` for endpoint and all-day-scroll
fixtures, and `&readOnly` to check the view-only behavior. Timed endpoint grips
snap to 15 minutes; Month/all-day grips edit dates. The overflow pill spans its
day column, and the all-day label stays at the bottom of its scrollable band.
[examples/consumer](https://github.com/junhaoliao/calendar/tree/main/examples/consumer) is a separate Vite host with no source
aliases or Tailwind. After producing the tarball, install dependencies there
and run its development server, or let `test:package` create fresh isolated copies.
Browser output, package results and consumer screenshots are under `artifacts/`.

ESM and CommonJS imports are safe without a browser. Static SSR of all four
views is exercised with both React versions, and the main entry keeps a
`"use client"` directive for React Server Component frameworks. Events and
callbacks belong in a client component; deserialize dates there. React 18 can
emit upstream layout-effect SSR advisories. Use deterministic `now`/`initialDate`
and consistent server/client timezone data for hydration. Interactions and width
measurement activate after mounting; SSR is not a timezone-independent renderer.

Validation uses Chromium and emulated touch. Physical-device, Safari and Firefox
interaction testing remains outside this validation. Modern CSS nesting,
color-mix, native popover feedback and ResizeObserver are used. The 24-hour grid
uses wall-clock rows, including on DST dates; see [drag rules](docs/event-calendar/drag-rules.md).

## Design and maintenance

The tarball includes the API and drag, overlap and endpoint-resize specifications.
Contributor guidance, architecture decisions and screenshots live in the
configured source repository.

- [API](docs/API.md) and [conventions](https://github.com/junhaoliao/calendar/blob/main/docs/CONVENTIONS.md)
- [Requirements](https://github.com/junhaoliao/calendar/blob/main/docs/event-calendar/requirements.md) and [design](https://github.com/junhaoliao/calendar/blob/main/docs/event-calendar/design.md)
- [Architecture](https://github.com/junhaoliao/calendar/blob/main/docs/event-calendar/architecture.md), [drag rules](docs/event-calendar/drag-rules.md) and [overlap layout](docs/event-calendar/overlap-layout.md)
- [Endpoint resize rules](docs/event-calendar/resize-rules.md)
- [Validation](https://github.com/junhaoliao/calendar/blob/main/docs/event-calendar/validation.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md) and verbatim texts in [LICENSES](LICENSES)

The npm package `@junhaoliao/calendar` is not yet published. This library uses
MIT; third-party notices and their applicable licenses are preserved independently.
