# Half Space admin guide

## Normal workflow

Sign in, make a small group of related edits, preview them, then use **Publish
Changes**. The yellow publish control publishes the current private draft to the
public site; it is separate from the structural deployment file in Finder.

Blank optional fields should remain absent on the public site rather than
showing empty labels or placeholders.

## Main tools

- **Content Manager** finds and opens editable site content.
- **Media Manager** stores reusable image/media records and their accessibility
  descriptions.
- **Settings** controls labels, publishing defaults, available XI formations,
  and team-specific allowed formations.
- **Backups** creates, downloads, imports, and restores private draft snapshots.
- **Preview** shows the public result without leaving admin.
- **Undo/Redo** reverses edits in the current browser session.
- **SEO, Slugs, and Redirects** manage public discovery and old URLs.
- **Validation, Link Checker, Accessibility, and Performance** identify problems
  before publishing.

## XI rules

- Each formation contains exactly eleven positions, including goalkeeper.
- Settings determines which formations are enabled globally.
- **Allowed formations** on a team limits that specific team further.
- A selected player cannot occupy two starting positions or both the XI and bench.
- Changing formation should retain a player where the stored position remains
  compatible; empty selections remain empty.

## Media

Use Media Manager for reusable assets and provide meaningful alternative text
for informative images. Post-level inline memes, photographs, video embeds, and
the tactics-board widget remain roadmap work; do not paste unsafe embed code into
the current editor.

## Publishing content

Admin publishing reads the newest GitHub copy before uploading, retries once if
the live file changes during publishing, and creates a pre-publish backup. A
successful admin publish contains both the new content and all structural code
already deployed to the site.
