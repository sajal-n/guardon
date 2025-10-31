# Contributing to Guardon

Thanks for your interest in contributing! This document explains how to report issues, propose changes, and submit pull requests so we can review and accept contributions quickly.

## Code of conduct
Please read and follow the project's [Code of Conduct](./CODE_OF_CONDUCT.md).

## How to file a good issue

Preferred issue types:

- Bug report — explain what you expected and what happened, include steps to reproduce, browser/OS, extension version, and any console logs.
- Feature request — describe the problem and proposed user-facing behavior.

When filing a bug, include:

- A minimal reproduction (YAML snippet, steps to reproduce on GitHub/GitLab, or screenshots).
- Console output from the extension popup (open DevTools for the popup).
- Any relevant rules or settings you changed in Options.

## Development workflow

1. Fork the repository and create a branch: `git checkout -b feature/your-feature`.
2. Implement changes with clear, focused commits.
3. Add or update unit tests for new/changed behavior.
4. Run tests locally: `npm install` and `npm test` (see README for details).
5. Push your branch and open a pull request against `main` (or the target branch).

## Pull request guidelines

- Keep PRs small and focused.
- Add tests that cover new behavior and edge cases.
- Document noteworthy changes in the PR description.
- Use descriptive commit messages and a short PR title.

We will review PRs in a timely manner. Review feedback is expected — we may request changes before merging.

## Developer Certificate of Origin (DCO)

This project uses the Developer Certificate of Origin (DCO). By contributing,
you agree that you have the right to submit the work under the project's
license. When creating commits, include a sign-off line to certify the origin
of the contribution. For example:

```
git commit -s -m "Fix: example change"
```

The sign-off is a short statement certifying you have the right to submit the
work and follows the DCO 1.1. If you are unable to sign-off on commits,
please open an issue so maintainers can advise on alternative contribution
mechanisms.

## Local testing

- Tests are implemented using Jest for utility modules. Run:

  ```powershell
  npm install
  npm test
  ```

If you need help running tests or your environment shows errors, open an issue with the `npm` output.

## Repository assets

The repository includes an architecture PNG at `assets/architecture-diagram.png` used as a README-friendly diagram. If you want to update the diagram, edit `assets/architecture-diagram.svg` and open a PR with the updated SVG and PNG (maintainers will regenerate or accept an updated PNG).
