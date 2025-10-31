# Release checklist

Use this template when preparing a release.

## Before release
- [ ] Bump version in package.json and manifest if needed
- [ ] Update CHANGELOG.md (Unreleased -> new version)
- [ ] Run test suite: `npm test` and fix failures
- [ ] Ensure linting / formatting (if applicable)
- [ ] Build artifacts (if any)

### Distribution ZIPs (Chrome Web Store)

We provide small helper scripts to create a trimmed distribution ZIP suitable for the Chrome Web Store. Use these locally to validate the exact package you will upload, or rely on the CI workflow which will automatically build and attach ZIPs when a GitHub Release is published.

- Local creation (preferred for a final pre-release check):

	PowerShell (Windows):

	```powershell
	# from repository root
	.\scripts\build-dist.ps1
	# optional: specify output filename
	.\scripts\build-dist.ps1 -OutFile guardon-latest.zip
	```

	Bash (Linux/macOS/WSL):

	```bash
	chmod +x ./scripts/build-dist.sh
	./scripts/build-dist.sh
	# or with explicit output
	./scripts/build-dist.sh guardon-latest.zip
	```

	Quick verification:

	```bash
	unzip -l guardon-*.zip
	```

	Or (PowerShell):

	```powershell
	Expand-Archive -LiteralPath .\guardon-*.zip -DestinationPath .\tmp-dist -Force
	Get-ChildItem -Path .\tmp-dist -Recurse
	```

	Ensure `manifest.json` and the UI/runtime files (popup/options, background.js, content.js, and `src/lib` runtime libs) are present in the archive before uploading.

- CI automation: the repository contains a GitHub Actions workflow that runs when a GitHub Release is published. That workflow:
	- Builds distribution ZIP(s) on a small matrix (Ubuntu + Windows)
	- Names the artifacts using the release version and OS
	- Attaches the ZIPs to the GitHub Release automatically

	If you prefer to attach assets manually, create the ZIP locally (using the scripts above) and upload it as a release asset when creating the GitHub Release.

## Tagging & publishing
- [ ] Create a Git tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
- [ ] Push tag: `git push origin vX.Y.Z`
- [ ] Create a GitHub release and attach artifacts

## Post-release
- [ ] Update docs (README, release notes)
- [ ] Announce release (optional)

## Notes & troubleshooting

- The repository previously used an automated SVG -> PNG conversion step that required headless Chrome in CI; that job was converted to manual/manual-dispatch to avoid intermittent runner issues. If you depend on generated assets (SVG->PNG), run the conversion locally or dispatch the manual workflow from the Actions tab.

- The build scripts read `manifest.json` to form the release ZIP filename and to decide which files to include. If you change the manifest structure, update `scripts/build-dist.*` accordingly.

- If the release workflow fails to attach artifacts, the easiest remediation is to run the local build script, confirm the ZIP contents, and upload it manually to the GitHub Release.

