# Half Space automated checks

Every deployment checks the site's essential contracts before committing or publishing.

Coverage includes navigation and history, Country XI card clicks, desktop dropdown reopening,
publishing safeguards, automatic backups, search, media, profiles, ranking data, XI formations,
duplicate-player protection, redirects, and the one-click deployment file.
The suite also verifies that the owner documentation and preserved roadmap remain present.
Step 37 adds credential-storage, server authorization, public-input, and secret-scanning checks.

Run locally with `npm test`, or double-click `Deploy Half Space.command`; deployment stops safely
if any check fails. GitHub repeats the same checks after every push.
