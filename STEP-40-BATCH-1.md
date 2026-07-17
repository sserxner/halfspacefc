# Step 40 — Batch 1: Site Architecture

This batch reorganizes the public site without rewriting its content.

- **Rankings** is now one top-level destination. Its first switch is **Present Day** or **21st Century**, followed by the existing position controls.
- **Build a Club XI** and **Build a Country XI** are permanent top-level destinations.
- **Streets Won't Forget** remains under **Misc**.
- Existing Club, Country, and Streets Editor XIs stay in their original storage keys. A migration contract prevents a deployment if XI selections, benches, managers, or formations disappear.
- Club and Country comment threads remain team-specific. The legacy **HEXACAMPEONES** thread is recovered on Brazil rather than left on the former shared Country XI page.
- Player names on the Editor's XI pitch and bench open their existing player cards when a unique match exists. Reader-built XIs remain unlinked.
- Public XI pages lead with **Build your XI** and keep the Editor's XI behind a secondary view control.
- Choosing a Club or Country now opens the customizable XI directly as an inline pitch; no extra build button is required.
- **Save image to device** downloads the rendered PNG directly on phones and computers.
- Admin mode includes **Player card links** so abbreviated or unusual XI labels can be assigned to the correct existing card.
- The Streets Won't Forget introduction is inline-editable in admin mode.
- Old `present-rankings`, `rankings`, `club-xi`, and `country-xi` routes remain valid.

This is the structural pass. The full site and pitch visual redesign remains a dedicated later Step 40 batch.
