# Half Space deployment

## Content changes

Use **Publish Changes** inside Half Space admin. It reads the newest live
`index.html` immediately before uploading and automatically retries once if
GitHub changes between the read and the upload.

## Structural packages

After replacing files from a Codex package, double-click
`Deploy Half Space.command`. It validates the site, commits the changed files,
saves a recoverable Git bundle, synchronizes with the current `main` branch,
and pushes to GitHub. The script
retries one remote-update race and stops safely if a genuine same-file conflict
needs review.

The terminal equivalent is:

```sh
./tools/deploy-site.sh "Describe the structural update"
```

GitHub also runs `.github/workflows/validate-site.yml` after pushes and on pull
requests so broken file references or syntax errors are visible in repository
checks.
