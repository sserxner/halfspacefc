# Half Space build pipeline

The deployed site remains a static `index.html`, but its maintainable source is
split across `src/components/`, `css/`, and `js/`.

## Commands

- `node tools/build-site.mjs` assembles `index.html`, validates the temporary
  result, and replaces the deployed file only after all checks pass.
- `node tools/validate-site.mjs` checks the current assembled site without
  changing anything.
- `node tools/modularize-html.mjs .` synchronizes a newer published
  `index.html` back into the HTML component source before structural work.

The equivalent npm shortcuts are `npm run build`, `npm run check`,
`npm run sync`, and `npm run refresh` on systems with npm installed.

## Checks

The pipeline verifies component assembly, local stylesheet and script links,
JavaScript syntax, CSS brace balance, the publishable data block, incomplete
HTML, development-only reload code, unresolved includes, and new duplicate IDs.

The existing `italy` and `juventus` duplicate IDs are reported as known legacy
warnings. Any additional duplicate ID fails the build.
