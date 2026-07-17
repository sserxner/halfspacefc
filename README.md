# Half Space FC

Half Space is a static editorial football site with a browser-based owner/admin
system. The public site is served from `index.html`; the admin tools update the
site's content and publish that assembled file to GitHub.

## The two publishing paths

### Editing content

For writing, rankings, XIs, formations, labels, media records, and other normal
site content:

1. Open Half Space admin.
2. Make and preview the change.
3. Select **Publish Changes** in the admin toolbar.

This publishes content directly. A private backup is created first.

### Installing structural work

For a ZIP supplied by Codex:

1. Copy the ZIP contents into the `halfspacefc` folder and choose **Replace All**.
2. Test the requested behavior locally.
3. Double-click **Deploy Half Space.command**.

The deployment runs automated tests and validation, creates a recoverable code
backup, synchronizes with GitHub, and publishes only if all checks pass.

## Owner documentation

- [ADMIN-GUIDE.md](ADMIN-GUIDE.md) — daily editing and admin tools
- [ARCHITECTURE.md](ARCHITECTURE.md) — file layout and how the systems connect
- [CONTENT-DATA.md](CONTENT-DATA.md) — where content is stored and published
- [DEPLOYMENT.md](DEPLOYMENT.md) — both publishing paths
- [BACKUPS.md](BACKUPS.md) — backup and recovery procedures
- [TESTING.md](TESTING.md) — automated protection
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — safe responses to common failures
- [ROADMAP.md](ROADMAP.md) — preserved future product work
- [SECURITY.md](SECURITY.md) — credentials, authorization, and incident response
- [LICENSE.md](LICENSE.md) — proprietary use restrictions
- [STUDIO.md](STUDIO.md) — unified owner workspace and admin-bar organization

## Safety rules

- Never delete or replace the complete `halfspacefc` folder to install a package.
- Never force-push Git history.
- Do not place passwords, access tokens, or private keys in site files.
- If deployment stops, read its message; files remain safe and nothing should be
  forced through.
