# Step 40 — Batch 4: Player-Card Foundation

## Improvements

- Every footballer keeps one reusable card record across Present and 21st Century rankings.
- A sleek horizontal career map presents each club stint as a connected stop.
- Each stop supports years, appearances, goals, assists and trophies.
- Current players support current club, age and Half Space transfer value.
- Compact structured individual awards can include the club/country and year.
- Owner-controlled sections support player comparisons, clubs that should be interested and an optional suggested move.
- Photos and Half Space editorial writing remain owner-controlled.
- Every optional field disappears completely when blank.
- Existing images, timelines, stats, titles, notes and position links remain compatible until structured data replaces them.
- Admin ranking rows clearly separate **Edit ranking entry** from **Edit player card**.
- Empty structured profiles show an admin-only setup panel; public visitors never see it.

## Admin format

- Career stop: `Club | Years | Apps | Goals | Assists | Trophy; Trophy`
- Individual award: `Award | Club or country | Year`
- Use an open-ended year such as `2023—` for a current stint.
- Unknown values may be left empty between separators.

## Owner test

1. Open an existing player card and confirm all previous information remains.
2. In admin mode, edit one player appearing in multiple rankings.
3. Add two career stops, including statistics and trophies.
4. Add one structured individual award.
5. Add current club and age.
6. Leave transfer value, comparisons and suggested move blank; confirm those sections do not render.
7. Add each owner-controlled field and confirm it appears once.
8. Reopen the player from another ranking and confirm the shared card matches.
