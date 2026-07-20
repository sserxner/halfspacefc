# Step 39 — Customizable reader XIs

- Club, Country, and both Streets XI versions offer a reader-facing **Build your XI** action.
- The action remains visibly positioned above the pitch when a detail page opens.
- Misc includes one **Streets Won't Forget** page with **Premier League Version** and **World Cup Version** tabs.
- Each Streets version displays the published XI and bench first, then offers the same reader builder and Save image flow as Club/Country XIs.
- Streets reader dropdowns come only from the position pools configured in admin; ranking tiers are never imported automatically.
- Readers use only the formations enabled for that team.
- A player selected in the starting XI or bench is removed from every other dropdown.
- Formation changes retain selections in compatible positions where possible.
- **Remember XI** stores the editable lineup on that device.
- **Save image** creates a 1080 × 1350 PNG and opens the phone share sheet when supported.
- Media is a permanent primary admin-toolbar action.
- Admins can create Club/Country XI profiles and remove profiles from the public catalog and global search with confirmation; removed lineup data remains recoverable.
- **Reader player options** lets the admin configure positional dropdown pools independently for every Club, Country, and Streets profile.
- Publishing strips temporary admin overlays and development reload scripts, and deployment validates again after synchronization.

Profile-based, cross-device XI storage and public sharing remain the next step because they require dedicated database privacy rules.

## Parked visual-direction idea

During the final visual pass, consider making XI customization the primary XI tab. Sam's published XI remains the example inside that experience, potentially moved into a supporting tab/sub-tab where the hierarchy is clearer.
