# Event-calendar specification

The current library is documented in [the repository README](../../README.md)
and [the API reference](../API.md). Run `pnpm dev` and open
`/calendar-demo.html?date=2026-10-04` for the deterministic in-memory consumer.

These documents describe the library's behavior, architecture and validation:

- [Requirements](https://github.com/junhaoliao/calendar/blob/main/docs/event-calendar/requirements.md) and [design](https://github.com/junhaoliao/calendar/blob/main/docs/event-calendar/design.md)
- [Architecture](https://github.com/junhaoliao/calendar/blob/main/docs/event-calendar/architecture.md)
- [Drag rules](drag-rules.md)
- [Overlap layout](overlap-layout.md)
- [Endpoint resize rules](resize-rules.md)
- Decision record: [keep the native endpoint-resize engine](https://github.com/junhaoliao/calendar/blob/main/docs/event-calendar/resize-architecture-decision.md)
- Decision record: [keep per-quarter-hour timed slot targets](https://github.com/junhaoliao/calendar/blob/main/docs/event-calendar/slot-targets-decision.md)
- [Current library validation](https://github.com/junhaoliao/calendar/blob/main/docs/event-calendar/validation.md)

All-day ends are inclusive; timed ends are exclusive. Agenda headings show the
selected full month and year. The shared active event renderer, stable lanes,
footprint-based overflow membership and retained popup drag source are required
behavior. The standalone library adds package exports, typed consumer metadata,
scoped CSS/portal themes and independent React 18/19 host verification.
