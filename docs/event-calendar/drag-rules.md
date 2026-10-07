# Drag rules and timed segments

These rules define event movement, type conversion and timed segments.
Preview and drop use the same calculation; controls retain their shadcn styling.
See [requirements](https://github.com/junhaoliao/calendar/blob/main/docs/event-calendar/requirements.md)
for the full library behavior.

## Host move resolver

`resolveEventMove(context)` synchronously returns the complete event to preview and
commit, or `null` / `{reject: reason}` to reject. It runs before rendering candidate feedback, for all
mouse, touch and keyboard body moves, including continued timed segments and timed
overflow popup rows. Month overflow rows and Agenda rows remain static. Endpoint
resizing has a separate pipeline and never calls this resolver.

```tsx
<EventCalendar
    events={tasks}
    resolveEventMove={({event, anchor, target, defaultResult}) => {
        if (!canMove(event, target)) return {reject: t("moveNotAllowed")};
        if (target.lane !== "timed") return defaultResult;
        // The consumer owns deadline-only and endpoint precision semantics.
        if (event.metadata.deadlineOnly) {
            return {...event, allDay: false, start: target.time!, end: target.time!};
        }
        const start = addDays(target.time!, -anchor.dayOffset);
        const end = addDays(start, differenceInCalendarDays(event.end, event.start));
        return {...event, allDay: false, start, end};
    }}
    onEventUpdate={saveTask}
    onMoveRejected={({event, reason}) => showMoveError(event, reason)}
/>
```

The example uses `addDays` and `differenceInCalendarDays` from `date-fns`. Its policy
is illustrative: the host chooses the exact span and interprets its own metadata.
A task may use a point to represent a deadline without adding a task Start field.

| Input | Meaning |
| --- | --- |
| `event` | Unconverted event with the latest consumer fields and pickup schedule |
| `anchor.date` | Grabbed local day, including interior days and continued segments |
| `anchor.segmentStart` | Later of event start and grabbed day midnight; a logical pickup, independent of pointer position |
| `anchor.dayOffset` | Local calendar-day offset from original start |
| `anchor.offsetMilliseconds` | Elapsed offset of segment start from original start |
| `anchor.lane` / `source` | `month`, `all-day`, or `timed`; `grid` or `popup` |
| `target.lane` | `month` date move, `all-day` conversion/band, or `timed` slot |
| `target.date` | Local destination midnight |
| `target.minute` | Snapped wall-clock minute (0–1425), or null for date destinations |
| `target.time` | Actual local snapped instant after DST normalization, or null |
| `defaultResult` | Built-in movement/conversion result, including custom fields |
| `conventions` | Inclusive all-day ends, exclusive timed ends, local calendar days, 15-minute snapping, forward DST-gap and earlier DST-fold disambiguation |

The callback must be pure, synchronous and deterministic. It can run during React
rendering and may run more than once; do not save, notify, set state, mutate arguments
or consumer metadata in it. Schedule Date objects are defensive copies; consumer
fields and metadata retain their references. Use immutable host updates. Return
`defaultResult` to use the built-in policy, or omit the callback entirely. Returning
null rejects; invalid dates, reversed endpoints or a changed id also reject.
A thrown exception is logged and rejects the move; it never accepts the fallback.
The controller caches this failure, so preview and completion share one resolution
and do not log it again for an unchanged destination.

Use a module-level resolver or `useCallback` to retain its identity across unrelated
host renders. The library adapter stays stable until the host function changes.

Resolution is cached for the current logical destination, event reference/fields, resolver
and fallback duration. An unchanged destination commits the cached preview.
Concurrent consumer-field updates refresh resolution with current fields; deletion,
or a schedule/type change since pickup, invalidates the move. Treat replacing the
resolver as a policy change that refreshes resolution. Hover, Escape, missing targets
and unchanged schedules emit no mutation or success notification. A changed accepted
drop emits exactly one `onEventUpdate` and one `onNotification` with action `moved`,
both carrying the resolved event. A rejected drop calls `onMoveRejected` exactly
once with `{event, reason}`, and never calls `onEventUpdate` or `onNotification`.
The event contains the unchanged schedule and current host fields. Hover, Escape,
no destination, deletion, rescheduling and read-only invalidation call neither hook.

Host reasons are plain text rendered in the preview and completion alert; localize
them in the consumer. Whitespace-only reasons use the built-in localized message
and `reason: null`. Invalid events and exceptions also use that default.
The completion alert has a Dismiss button and clears on the next pointer/keyboard
interaction outside the alert or the next successful mutation. There is no fixed
timeout. Dismissal restores focus to the calendar and emits no callbacks.
Inapplicable moves (including deleted/rescheduled events) show no refusal feedback.
The success status region remains available while the alert is displayed.

The returned `start`, `end` and `allDay` determine all feedback, occupied dates,
segment geometry and labels. Valid returned instants (including seconds, milliseconds
and later DST-fold instants) are copied exactly, without snapping, duration repair or
endpoint normalization. `start === end` remains a point, rendered with a minimum
16px draggable surface. Keep the id unchanged and spread `event`/`defaultResult` to
preserve current custom fields; the library does not add task-model fields.

## Event type and range conventions

`allDay` alone controls the type. A timed event can span any number of dates.
All-day ranges have inclusive ends, usually 23:59:59.999 on the last date.
Timed intervals are half-open: an event ending precisely at midnight does not
occupy the new day. Zero-duration timed events occupy their start date and render
with a minimum visible height. Conversion to all day covers at least one date.

| Source → destination | Built-in fallback result |
| --- | --- |
| Any all-day event → timed slot | Start at the dropped local date/quarter-hour; set `allDay: false`; duration is `defaultTimedDurationMinutes`, default 60 |
| Timed event → all-day date | Set `allDay: true`; cover its occupied local dates, align the grabbed date with the destination, normalize to midnight through the final date's end |
| Timed → timed | Move the whole event and retain elapsed duration; a continued segment retains its elapsed offset from the whole event's start |
| All day → all day | Move by local calendar dates, retaining inclusive date count and original time boundaries |
| Month date cell | Move the date without converting the type; retain timed duration or all-day date count |
| Escape or no destination | Discard the candidate; no consumer update or success toast |

For example, October 5 at 10 PM → October 6 at 2 AM becomes October 7 at 9 PM →
October 8 at 1 AM when its initial segment is dropped at October 7, 9 PM. Grabbing
the October 6 midnight segment and dropping at October 8, 9 AM places the whole
event at October 8, 7–11 AM. Both moves retain four elapsed hours and one event id.

## Rendering and feedback

Week/day views put only actual all-day events in the all-day band. That band stays
available when empty so timed events always have an all-day destination. Timed
multi-day events render clipped hourly-grid segments for each occupied date,
with local segment times and accessible «/» continuation markers. Segments share
the original event object; selecting any segment edits the whole event.

The preview and completed drop use the shared resolution pipeline. Destination
segments show every visible occupied date while the pickup node remains mounted.
The dragged event block itself previews the resulting presentation. A timed
destination uses the same hourly event component, with title above its time range
and the resulting segment height; an all-day destination uses the usual compact
bar. There is no separate popup beneath the event. Slots snap to quarter-hours.
Only a completed changed drop emits one
`onEventUpdate`; hovering emits none. IDs, descriptions, colors, locations and
custom metadata are retained by spreading the original event. The demo's success
toast uses the existing shadcn/Sonner styling.

## DST and configuration

`defaultTimedDurationMinutes` is a positive finite number. Invalid values fall
back to 60. It controls only all-day → timed conversion, including a conversion
that crosses midnight or DST. Timed moves retain elapsed milliseconds. All-day
moves use local calendar-date arithmetic, so 23-hour and 25-hour dates retain
their date count. JavaScript's local-Date normalization applies when a dropped
wall-clock time is nonexistent during a spring transition.

The hourly grid has 24 wall-clock rows. Repeated fall-back hour instants occupy
the same hour rows; event identity and elapsed duration stay intact. A segment
whose end clock appears earlier than its start uses its elapsed minutes for a
positive visible height. This is a wall-clock calendar, not a separate 25-row
timezone timeline.

Pure tests cover conversions, configured/invalid durations, metadata identity,
terminal midnight, zero duration, continued-segment movement, segment geometry,
and DST. Browser acceptance exercises mouse, emulated touch and keyboard input,
preview/commit agreement, cancellation and update counts using the demo consumer.

Endpoint resizing is a separate interaction described in [resize rules](resize-rules.md).
It edits only start or end and preserves type/metadata. Body dragging retains all
the movement and conversion rules above.
