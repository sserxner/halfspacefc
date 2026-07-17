# Step 40 — Batch 2: Complete Reader XI Workflow

This batch turns the inline XI builder into a reusable reader feature.

## Added

- Empty positions retain a subtle marker; a selected player replaces it with a prominent name.
- Player selection uses a type-to-search field instead of a long dropdown. Results include only eligible, currently unselected players.
- Admins add each reader-selectable player once, then assign all eligible positions in the same row.
- Admins can visually drag every formation position into place on the pitch.
- Each formation layout is global: editing it once updates that formation on every Club, Country, and Streets page.
- Right/left pitch coordinates remain corrected without moving existing player assignments.
- Admin mode always displays the complete Editor XI and bench alongside its setup controls.
- Optional private lineup notes. Empty notes render nothing on saved images or comments.
- Direct PNG download on phones and computers.
- Signed-in readers can save an XI to their profile and review saved XIs under Account.
- Readers can optionally post the rendered lineup as an image in the exact Club, Country, or Streets Won't Forget comment thread.
- Posting is never automatic. A reader must press **Post as comment** and may add an optional blurb.

## Preserved

- Editor XIs and benches.
- Editor-only player-card links and admin controls.
- Formation restrictions, position eligibility, and XI/bench duplicate prevention.
- Club, Country, and Streets Won't Forget page-specific comments.
- Brazil retains the legacy “HEXACAMPEÃO!!!” comment in its dedicated thread.
- Fast Club/Country navigation and stable back buttons.

## Owner test

1. Open one Club XI, one Country XI, and both Streets versions.
2. Confirm the builder appears immediately and the Editor XI remains optional.
3. Select a player: the empty marker disappears and the player name becomes prominent.
4. Confirm a selected player disappears from all other XI and bench dropdowns.
5. Add notes, save the image, and confirm the PNG reaches the device.
6. Sign in, save the XI, and confirm it appears in **Account → My saved XIs**.
7. Post the XI as a comment with and without a blurb; confirm it appears only on that lineup page.
8. Repeat the key layout checks on a phone-sized screen.
