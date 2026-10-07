# Endpoint resizing

Body movement retains the existing dnd-kit rules and duration. Endpoint controls
edit one boundary in place; they never change allDay or move the opposite boundary.
Edits emit one onEventUpdate and one notification only after a changed commit.
Consumer IDs and metadata remain intact; previews do not mutate controlled events.

## Time and date rules

Timed Week/Day cards have top/start and bottom/end handles only on true event
endpoints. A midnight continuation cut is not an endpoint. The changed time snaps
to 15-minute boundaries; an off-grid fixed endpoint retains its exact instant.
The minimum resized duration is 15 minutes. Crossing the opposite endpoint clamps
to the nearest valid snapped boundary without swapping edges. Explicit DST
occurrences remain intact when snapping an instant; pointer time targets use the
same browser-local Date normalization as ordinary grid movement.

Week pointer resizing can extend into adjacent date columns. Day remains within
its visible date, including a terminal midnight. Use the editor for dates outside
the current view. The internal calendar viewport auto-scrolls near its edges.

Month and all-day bars have horizontal start/end date handles. Only the true
first/last occupied dates expose handles. All-day edits normalize the changed
boundary to start/end of day and retain at least one inclusive date. Timed Month
edits preserve the changed endpoint's original clock time; terminal midnight
remains exclusive and the handle belongs to the previous occupied date.

## Interaction and presentation

Desktop activation takes 5px of movement. Touch grips use a 250ms hold within 5px
tolerance. Grips reveal on hover/focus, and use larger visible targets on touch.
Short timed cards below 48px use the editor; touch time handles require 72px of
card height. Very narrow touch date bars use the editor instead of overlapping
grip targets. The event body remains available for click-to-edit and moving.
Popup rows retain their original editing and movement behavior without resizing.

Focus a handle, use Space/Enter to start or an arrow to start and adjust, then
Enter to commit or Escape to cancel. Arrow keys adjust one snapped time slot or
local date. Tab, window resize, blur and pointer cancellation cancel the session.
Pointer release outside a valid calendar surface cancels. A click without a drag
does not snap or change a boundary. readOnly suppresses endpoint controls.

The card and its inline time range preview the candidate. There is no extra range
popup. Timed previews retain the source lane and width; date previews retain lanes
until commit, when normal overlap grouping settles. Source surfaces stay mounted
when needed through date changes. Overflow controls are temporarily hidden during
endpoint adjustment, so they cannot cover the active grip. Handles are siblings
of the native event button, preserving its renderer and avoiding nested buttons.

The pure date-math subpath exports resizeEvent(event, edge, target, dateOnly?) with
the consumer event's generic return type. The same calculation powers preview,
keyboard and commit. The existing clickable date/time editor remains the complete
alternative to drag interactions.
