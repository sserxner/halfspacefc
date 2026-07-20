# Half Space backups

## Browser data

Open **Admin - Tools - Backups** to create, download, import, restore, or delete
snapshots. A snapshot contains the complete private draft and currently
published data, including content, media records, formations, settings,
rankings, XIs, and other CMS data. Authentication sessions and GitHub tokens are
deliberately excluded.

The site creates a safety snapshot automatically immediately before every
admin publish and retains the twelve newest automatic snapshots in IndexedDB.
Manual and imported snapshots are not removed automatically.

Restoring a snapshot changes only the private browser draft. The public site
does not change until the restored draft is reviewed and published.

Use **Download** for an off-browser JSON copy and **Import backup** to bring that
file into another browser. **Download site code** exports the assembled
`index.html` separately.

## Code

Every run of `Deploy Half Space.command` creates a complete Git bundle in the
sibling `halfspacefc-backups` folder before synchronizing and pushing. GitHub
also creates a repository bundle after every push and once daily, retained as a
workflow artifact for 90 days.
