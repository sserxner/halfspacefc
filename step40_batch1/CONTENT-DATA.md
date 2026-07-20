# Half Space content and data

## Data lifecycle

1. The published snapshot loads from `window.__HALFSPACE_DATA__` in `index.html`.
2. Admin edits are saved as a private browser draft.
3. Preview renders the draft without changing the public site.
4. Publish creates a backup and writes the draft into the published data block.

Publishing structural code does not erase normal admin content. The deployment
first synchronizes with the latest GitHub version so the current published
`index.html` remains part of the result.

## Major records

- `ranking_*` — ranking blurbs, tiers, players, notes, and honorable mentions
- `xi_country_*`, `xi_club_*`, and bench records — saved lineups
- `site_settings_v1` — labels, formations, definitions, and per-team allowances
- `media_library_v1` — reusable media metadata
- `redirect_management_v1` — manual redirect rules
- article, diary, transfer, editorial, SEO, slug, and publishing records —
  managed by their corresponding admin tools

The exact record schema may evolve. Admin modules and automated tests are the
source of truth; avoid manually editing the minified baked-data line.

## Portability

Use **Tools → Backups → Download** for a portable JSON copy of the complete
private draft. Authentication sessions and GitHub credentials are intentionally
excluded and must be configured separately on a new browser.
