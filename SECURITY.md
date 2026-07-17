# Half Space security

## Public and private values

All HTML, CSS, JavaScript, images, and published content sent to a visitor are
publicly inspectable. The Supabase project URL and publishable/anon key are
designed for browser use; database Row Level Security and server-side RPC checks
must decide what that key can access.

Passwords, Supabase service-role keys, GitHub tokens, private keys, unpublished
drafts, and backup files must never be committed or placed in published data.

## Publishing controls

Admin publishing now requires a current Supabase session and a successful
`is_site_admin` server check immediately before GitHub access. GitHub credentials
are session-only, removed when the browser session ends, and should be
fine-grained to the `halfspacefc` repository with Contents write access only.

Every deployment scans source files for recognized private credentials,
hard-coded passwords, private keys, and dynamic code execution before commit.

## User content

Public comment text is length-limited, stripped of unsafe control characters,
escaped before rendering, and submitted through database RPC functions. The
database must retain Row Level Security and server-side limits; browser checks
are an additional layer, never the authorization boundary.

## Incident response

If a private credential is ever committed, deleting it from the latest file is
not enough. Revoke/rotate it immediately, review provider logs, then remove it
from history if appropriate. Treat unexpected admin publishes, database writes,
or authentication emails as potential incidents.
