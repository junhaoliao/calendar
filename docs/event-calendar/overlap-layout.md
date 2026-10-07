# Readable timed overlaps

Separate responsive lanes keep overlapping
events readable. The existing
shadcn palette, event labels, conversion rules and consumer callbacks remain.

## Lanes and responsive capacity

Each day's clipped timed segments form connected overlap groups. Touching ends
are separate, except that a zero/very short event retains the existing 16px
minimum visible height. Sort by top, longer duration, then stable id. Assign the
lowest available lane once, independently of width. Reordering the input array
or resizing does not change lane ids. Disconnected groups reset to full width.

Cards occupy separate horizontal lanes. A card expands into lanes to its right
only if they stay free for its entire interval; its left edge remains fixed.
Start times, end instants and heights do not change. Midnight is still an
exclusive timed end, so the next date never receives an empty terminal segment.

`minimumTimedEventWidth` is a positive finite CSS-pixel value, default 90. The
capacity accounts for the card's 4px horizontal gutter and the column's border.
Invalid values fall back to 90. ResizeObserver measures each actual column before
paint. The minimum decides the number of parallel lanes, with at least one lane
always visible. A lone event never collapses, even below 90px. It uses the column's
full width; truncated text remains available through the editor and day view.
There is no side rail or reserved horizontal space for overflow.
An active dragged segment stays mounted during a resize, even if its lane would
otherwise overflow; the stationary layout returns to the normal rule on release.
Window resizing cancels keyboard dragging. In particular, dnd-kit's keyboard
feedback ends on resize, which the calendar treats as cancellation rather than
committing a newly detected slot.

## Hidden coverage and popover

Hidden memberships are partitioned using the actual control footprints, including
the title/time area and card end clamp. Ordinary controls are 24px high, compact
controls are 16px high, and controls need a 4px vertical gap.
Duration overlap does not force hidden events into one popup. Partition from later
starts backwards so a later event remains separate when its control fits, merging
earlier crowded starts as needed. Controls span the whole day column, so different
former anchors cannot hold colliding controls at the same time. Real gaps keep
separate controls when they fit; a short card with
only one footer slot combines them rather than rendering overlapping buttons.
Each “+N more” counts only that control's unique hidden members. A hidden event is
listed in exactly one hidden membership; related visible cards supply context in
each popup. For the regression fixture, meetings at 9:00 and 9:45 are grouped at
9:00, while Review contracts gets its own “+1 more” at 10:00.
Coverage is used internally for grouping, including hidden
tails beyond visible cards. Full ranges in the popover explain the
hidden events. The single-line “+N more” button floats across the day column with
8px side gutters. There is no white background strip and event fills remain
continuous. Placement avoids visible labels and true resize edges in every lane.
Cards keep their duration height. Short cards use a compact 16px “+N” control
below the label, with a full accessible name. No reserved card footer padding or
side rail is needed; controls remain sibling DOM buttons, never nested buttons.
Separate hidden intervals can anchor separate controls within a long card.

The shadcn popover lists all participating events for that covered interval,
including visible cards alongside hidden ones. Titles wrap in full, ranges show
the whole event's start/end times, retaining dates across midnight or multiple
dates. Same-day rows omit repeated dates and there is no “N hidden” subtitle.
Each row reuses EventItem's sensors, shared destination preview, move calculation
and original consumer event, with a popup-specific drag id to distinguish it from
the simultaneously mounted grid source. Clicking/tapping still invokes editing;
Space picks up an editable row, arrows move and Enter drops. Read-only rows stay
clickable and static. The list scrolls inside the
popover while “Open day view” remains reachable. Clicking, tapping, Enter/Space
and Escape open/dismiss the popover. The popup stays mounted during an active drag
and ignores dismissal until drop/cancellation. It stops intercepting pointer hits
so the grid underneath can receive drops. A completed drop closes it; cancellation
does not emit an update, edit action or success toast.
Escape is allowed to reach the sensor even when the popup's dismissal handler
runs first. Widening the grid retains an active pointer source until completion;
keyboard resizing cancels. Drag feedback uses the destination card's dimensions
and clears the stationary card's reserved overflow padding.
EventSurface uses one native button DOM node for grid cards, popup rows and active
feedback. Resting popup rows use the shared shadcn `buttonVariants` ghost styles;
those classes are absent during dragging, so centered alignment, control gaps and
borders cannot leak into the event card. A canonical 16px event line height also
prevents the popup's text styles from changing the shared title/time spacing.
Continuation decoration is disabled during whole-event feedback. Browser tests
compare the same 90-minute review from both sources: identical classes, 96px height,
padding, gap, colors, shadow, and label offsets (title 4px, time 20px).

“Open day view” selects that exact local date and switches to Day. Controlled
hosts receive `onDateChange` and `onViewChange`, as with normal calendar navigation.
Day has the same width policy, with more available space for reading and dragging.

## Validation

Pure tests cover transitive overlap grouping, stable ids/order, touching ends,
lane reuse, rightward expansion, narrow/wide capacity, configurable minimums,
hidden counts, separated gaps, midnight coverage and original event identity.
Interaction tests cover keyboard popover entry, full labels/ranges, existing edit
actions, selected-date navigation, controlled callbacks and live policy changes.
Browser validation covers actual resizing, touch/keyboard access, coverage beyond
the visible card, day-view lanes and unchanged drag/cancellation/update rules.
Popup-source browser scenarios cover mouse, touch, keyboard, cancellation,
simultaneous sources, short/narrow cards and continued overnight conversion.

The standalone demo accepts `&minWidth=120` (or another positive value) for manual
checks. `&overlaps=single`, `&overlaps=short`, and `&overlaps=overnight` supply
dedicated edge fixtures. No persistence or host data-model integration is introduced.
`&overlaps=contracts` reproduces the long conference, earlier overlapping meetings
and 10 AM review. `tests/browser/drag-style.spec.ts` checks its control
positions, separate popup membership, resizing, cancellation and actual drag styles.
