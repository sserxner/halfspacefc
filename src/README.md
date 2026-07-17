# Half Space HTML components

The public page markup is split into logical files under `components/`. The deployed
`index.html` remains a complete static document, so GitHub Pages and the admin
publishing flow do not depend on runtime HTML requests.

- Edit page markup in the relevant component.
- Run `node tools/build-html.mjs .` to assemble `index.html`.
- If the admin publisher has updated `index.html`, run
  `node tools/modularize-html.mjs .` before editing components so the latest live
  content is retained.

CSS remains in its current files for Step 30. Inline JavaScript remains in the
template for Step 31.
