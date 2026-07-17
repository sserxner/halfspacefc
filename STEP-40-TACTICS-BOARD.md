# Step 40 — Tactics Board

Purpose: create reusable tactical diagrams without flattening the editable source.

- Studio opens the owner-only board editor.
- Boards support formation presets, draggable players, arrows, zones, labels, undo, redo, duplication, clearing, draft saving, reopening, deletion, and PNG export.
- Matchday Diaries and Transfer Recommendations receive an admin-only “Add tactics board” control.
- Embedded boards remain editable for the owner and read-only for public readers.
- A post stores board references while the board library retains the editable original.
- Reused Club and Country detail containers now reset to the customizable XI before every render; Editor’s XI remains available through its explicit toggle.
