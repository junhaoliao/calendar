# Calendar design

The calendar combines shadcn controls with dedicated event surfaces and contained
scrolling. See [requirements](requirements.md) for supported behavior.

Use shadcn base-vega primitives (built on Base UI) for toolbar buttons, menus, sheet,
fields, input/textarea, checkboxes, select, popover, date calendar and radio group.
Their control styles stay intact. The layout uses a rounded bordered
surface, 16px desktop toolbar padding, restrained separators, 24px month bars,
64px hour rows, equal-width Sunday-first columns and a 30-day agenda.
Agenda uses the selected month's full name and year in its heading. That heading stays
stable while the agenda's date range crosses months.

Event colors are semantic calendar tokens in the scoped library CSS, with
light/dark definitions. Calendar-only event
buttons are custom because shadcn Button is a control, not an event renderer.
Native shadcn interaction and variants remain on the other controls. The editor uses Sheet as the
right-side drawer, with FieldGroup/Field.

Use the control primitives' built-in variants and sizes, adding layout classes as needed. When a project-wide change is simpler in a copied primitive
and preserves its semantics, edit that primitive directly.

The compiled stylesheet supplies only calendar scopes. Theme defaults and
utilities also apply to body portals and promoted drag sources; they leave host
page layout alone. An instance follows nearby dark/light classes or takes an
explicit theme. CSS variables passed through style apply to all its surfaces;
root layout styles do not leak into cards or portals. Fonts are host-owned.

The containing app gives the calendar a height. The component uses min-height:0
and overflow containment; month rows fill the available height and scroll inside
the surface when the minimum usable row height cannot fit. Time and agenda views
scroll inside their content region. On narrow screens, toolbar controls abbreviate
visually but retain full accessible names. Dates, event labels and time gutters
shrink without imposing a page-level minimum width.

Timed events spanning midnight have clipped hourly-grid segments and small
continuation markers.
A single grid-aligned preview provides drag feedback, using the destination type's
normal segment layout and height. The original segments and pointer-following
surface are hidden throughout valid grid drags; refused or off-grid hovers show
the event at its origin. Popup rows preview only accepted destinations. The all-day band is always available
as a destination, including weeks without any all-day events.

Timed overlaps use separate stable lanes and responsive overflow with a default
90px preferred minimum readable width and at least one visible lane. Single-line
overflow buttons float across their day columns with small gutters and open the shared
shadcn popover for full details, editing and selected-day navigation. Popover rows
share grid dragging with a full-detail presentation and distinct drag ids.
The mounted source button retains sensor identity; a separate static destination
surface uses the normal event styles and canonical 16px line height. Popup control
alignment, gaps and inherited typography cannot affect the destination preview.
Overflow partitions depend on the actual button footprints, allowing a later
standalone control even when its event overlaps earlier hidden events.
Event fills remain continuous behind the floating pill.
Pills avoid labels and endpoint grips; compact controls sit below short labels.
The bounded all-day band uses a sticky bottom label in its time gutter.
Endpoint grips appear on hover/focus and have larger touch targets where there
is room. They are siblings of the native event button; preview uses the same
event label/palette and keeps the opposite endpoint fixed. See [resize rules](resize-rules.md).
See [overlap layout](overlap-layout.md) for the placement and count policy.
