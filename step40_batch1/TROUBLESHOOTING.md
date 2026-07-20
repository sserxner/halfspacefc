# Half Space troubleshooting

## Deployment says the folder is not connected

`Deploy Half Space.command` was opened from an extracted ZIP or another folder.
Copy the package contents into `Documents/halfspacefc`, then open the command
from that folder beside `index.html`.

## Deployment reports a conflict

Stop. Do not force-push and do not delete either copy. The deployment has
aborted safely; give Codex the complete Terminal message so both versions can
be integrated.

## Tests or validation fail

Nothing has been published. Keep the Terminal output and report the first
failing check. The checks are intended to block an unsafe deployment.

## Admin content looks missing

Do not immediately publish. Check whether the correct browser/profile is open,
then inspect **Tools → Backups**. Restoring a backup changes only the private
draft, allowing review before publication.

## A public change has not appeared

Wait for GitHub deployment to finish, then reload once. If code was updated,
the package increments relevant asset versions to bypass stale browser caches.

## An admin window will not close

Try its close button and Escape once. If neither works, reload without
publishing and report the exact tool name; the private autosave should preserve
the draft.

## XI pages feel slow or do not open

Confirm both Country and Club XIs locally and note whether the delay occurs when
opening a team or returning to the list. Step 35 includes regression checks for
card binding, fast slug resolution, and immediate in-page Back behavior.
