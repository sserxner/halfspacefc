# Half Space architecture

## Runtime

Half Space is a static site. GitHub serves `index.html`, CSS files, JavaScript
files, and local assets directly; there is no application server required to
assemble pages for visitors.

`index.html` contains a `baked_data` block. That block is the published content
snapshot visitors receive. Browser admin edits live privately until publishing
replaces the snapshot in the assembled page.

## Source layout

- `src/index.template.html` defines the document shell and component includes.
- `src/components/` contains page-level HTML sections.
- `css/` contains focused public, admin, rankings, XI, community, feature, and
  responsive styles.
- `js/data/` contains football catalogs.
- `js/public/` contains navigation, content display, rankings, and XIs.
- `js/admin/` contains editing and GitHub publishing.
- Root JavaScript files contain independent admin/community tools retained for
  compatibility.
- `tools/` contains guarded build, validation, and deployment programs.
- `tests/` contains dependency-free regression and content-integrity checks.

## Build flow

The guarded builder assembles the template and components into a temporary
page, validates it, and replaces `index.html` only after success. The live site
never fetches component files at runtime.

## Important boundaries

- Admin **Publish Changes** changes published content in `index.html`.
- `Deploy Half Space.command` publishes structural files and safely integrates
  current GitHub content.
- Supabase provides account/authentication and public-profile services; secrets
  must not be committed.
- Browser draft data and published baked data are deliberately distinct.
