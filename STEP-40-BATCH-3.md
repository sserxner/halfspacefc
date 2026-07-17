# Step 40 — Batch 3: XI Live-Data Reliability

## Improvements

- Brazil now searches live published comments for “HEXACAMP” and restores the original “HEXACAMPEÃO!!!” entry regardless of its historical page key.
- Duplicate recovery results are removed before Brazil’s dedicated thread renders.
- Lineup-image comments and profile saves use compact, bounded data to avoid oversized comment bodies or account metadata.
- Saved XIs replace the matching team entry case-insensitively instead of creating accidental duplicates.
- Phone layouts use larger searchable inputs, larger suggestion targets, clearer pitch names, and usable action buttons.
- Formation layouts remain global by formation across every Club, Country, and Streets builder.

## Owner test

1. Open Brazil’s Country XI and confirm “HEXACAMPEÃO!!!” appears below it.
2. Post a test XI image comment and confirm it appears only on that exact XI page.
3. Save an XI to the signed-in profile, reload, and restore it from My saved XIs.
4. Repeat player search, selection, image saving, and comment posting on a phone-sized screen.
