# Development conventions

Use the pinned package manager and lockfile. Keep React/React DOM as peers and
the validated dnd-kit 0.5 versions together. When changing dependencies, rebuild
the tarball, rerun both React consumer versions and regenerate third-party notices.

The seven preexisting non-dnd runtime dependencies use caret ranges validated against their
minimum and currently newest allowed releases in fresh React 18/19 tarball hosts;
the two new translation dependencies are exact pins pending separate range
verification. This does not claim future releases are tested. Keep the three @dnd-kit 0.5.0
packages exact and move them together. Consumers have a separately verified Node
>=18.20.8 engine floor (strict install and SSR on 18.20.8, 20.19.0, 22.18.0
and 24.16.0); contributors use devEngines Node >=22.18 and .node-version 24.
npm 11 enforced the contributor declaration in testing, while npm 10 did not. The optional
@types/react peer starts at 18.3.0 because 18.0.0 lacks React.JSX; React 19
starts at 19.0.0. pnpm test:package runs strict publint and node16-profile
attw against the tarball, excluding only the CSS side-effect entrypoint from
attw while retaining its declaration. Recheck the lower/newer resolution and
Node matrices whenever these ranges change.

The tested registry snapshot on 2026-10-07 resolved these exact versions;
“none” means no newer version was allowed by that range on that date.

| Runtime dependency | Minimum tested | Newer allowed tested |
| --- | --- | --- |
| @base-ui/react | 1.6.0 | 1.8.0 |
| class-variance-authority | 0.7.1 | none |
| clsx | 2.1.1 | none |
| date-fns | 4.4.0 | none |
| i18next | 26.4.2 (exact) | not allowed by exact pin |
| lucide-react | 1.24.0 | 1.52.0 |
| react-i18next | 17.0.16 (exact) | not allowed by exact pin |
| react-day-picker | 10.0.2 | none |
| tailwind-merge | 3.6.0 | 3.7.0 |

Revalidate and regenerate notices when the installed runtime closure changes,
even if its declared ranges do not.
The 2026-10-07 final tarball with i18next 26.4.2 and react-i18next 17.0.16
passed strict install, ESM/CJS imports and development/production SSR on
Node 18.20.8, 20.19.0, 22.18.0 and 24.16.0 with both React 18.3.1 and
19.2.7. Neither new package declared a Node engine in the installed closure.
Keep these new pins exact until a minimum/newer-allowed resolution matrix and
the same consumer checks justify a wider range.

Calendar code uses relative imports. There are no app aliases, stores, native
bridges or persistence adapters. Private per-calendar i18n initialization lives
under `src/i18n` and leaves the host instance untouched. Extend the host callbacks
for business workflows. Keep public exports small and declarations portable.
The development-only #calendar path mapping lets the shadcn CLI resolve its
components.json destinations; shipped source imports and output use no aliases.

Run `pnpm lint:fix` before manually fixing remaining lint issues. `pnpm check`
does not rewrite authored source/configuration; it may write ignored build output.
For behavior changes, run `pnpm verify` (check, browser and package tests). Browser
checks use production builds and real input through Playwright; touch is emulated.
Install Chromium once with `pnpm exec playwright install chromium`.

Keep pure date/conversion/lane/overflow helpers separate from React presentation.
Put them in `src/core/`; it must not import React, dnd-kit or the DOM.
Preview and drop must use the same movement helper. Retain the original consumer
event through segmented rendering; metadata must survive both drag and editor.
Use structured IDs rather than ambiguous delimiter concatenation.

Shared EventSurface/EventLabel owns active event presentation. Do not apply
control/button centering or gaps to feedback. Use shadcn variants and sizes
before adding classes; edit `src/components/ui` primitives directly when that
is simpler and semantics stay the same. Keep 16px event line height, 4px title
offset and 20px time offset. Hidden membership
uses the same 24px/16px trigger footprints and 4px gaps as rendering. Never infer
it solely from overlapping event durations.
Full-column controls must avoid every visible lane's label and endpoint grips.
Keep event fills continuous; there is no white strip or reserved card footer.
Endpoint preview/commit use resizeEvent; the other endpoint stays fixed. Preserve
body movement, true overnight endpoints, cancellation and the editor fallback.

Modify source `src/styles.css`, then run `pnpm build:css`. Build tooling scopes
all selectors, including Tailwind preflight/property initialization, and namespaces
animation names. Portal and promoted drag sources carry their instance scope,
theme and style. Keep host page layout rules only in demo/host CSS.

`dist/`, `.tmp/` and `artifacts/` are generated and ignored. Builds emit only
the two entrypoints, declarations, maps and scoped CSS. Packing excludes the
demo, tests and source working files. Build/test tools and the demo's toast/font
dependencies are development dependencies.

The library uses MIT; retain the root LICENSE and third-party notices in packs.
Publishing `@junhaoliao/calendar` is a separate owner action: remove the `private`
guard and publish.


Formatting is Prettier (`pnpm format`); CI runs `pnpm format:check`. ESLint
covers correctness, React, hooks and jsx-a11y rules. Library code under `src/`
(excluding tests and the demo) is type-checked without Node or Vitest types via
`tsconfig.lib.json`. After re-adding shadcn components with the CLI, run
`pnpm format`.
