# Half Space HTML components

The public page markup is split into logical files under `components/`. The deployed
`index.html` remains a complete static document, so GitHub Pages and the admin
publishing flow do not depend on runtime HTML requests.

- Edit page markup in the relevant component.
- Run `node tools/build-html.mjs .` to assemble `index.html`.
- If the admin publisher has updated `index.html`, run
  `node tools/modularize-html.mjs .` before editing components so the latest live
  content is retained.

Inline JavaScript remains in the template for Step 31.

## CSS modules

Step 30 moved active styling into `css/`, grouped by public, admin, rankings,
XI, community, feature, and responsive concerns. `styles.css` remains only as a
compatibility marker. New styles should be added to the narrowest relevant
module instead of restoring rules to the legacy file.

## JavaScript modules

Step 31 moved the remaining inline application logic into `js/`, grouped by
data catalogs, public navigation/XIs, public content, admin editing,
authentication/publishing, responsive behavior, and initialization. The
`baked_data` script intentionally remains inline because the browser publishing
workflow updates that block when creating the deployable page.
