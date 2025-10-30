# Release checklist

Use this template when preparing a release.

## Before release
- [ ] Bump version in package.json and manifest if needed
- [ ] Update CHANGELOG.md (Unreleased -> new version)
- [ ] Run test suite: `npm test` and fix failures
- [ ] Ensure linting / formatting (if applicable)
- [ ] Build artifacts (if any)

## Tagging & publishing
- [ ] Create a Git tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
- [ ] Push tag: `git push origin vX.Y.Z`
- [ ] Create a GitHub release and attach artifacts

## Post-release
- [ ] Update docs (README, release notes)
- [ ] Announce release (optional)
