# Security policy

Thank you for taking the time to help keep this project secure. This document explains how to report security vulnerabilities and our expectations for responsible disclosure.

## Reporting a vulnerability

Please do not open public issues for security-sensitive vulnerabilities. Instead, contact the maintainers privately at: sajalnigam@gmail.com or open a private GitHub Security Advisory. We strongly encourage using GitHub's private security advisories when possible so we can coordinate fixes privately.

When reporting, include:

- A clear description of the vulnerability and affected components.
- Steps to reproduce (minimal repro if possible).
- Impact and suggested mitigation.

We aim to acknowledge reports within 48 hours and coordinate a fix/patch and disclosure timeline.

## Disclosure timeline

We follow responsible disclosure: we will work to provide a fix and coordinate disclosure with the reporter. If no timeline is agreed, we may publicly disclose the issue after 90 days.

## Developer guidance

- Do not commit secrets (tokens, keys) to the repository. Use environment variables or secret stores.
- Validate and sanitize inputs in any code that may be exposed.

## How we handle reports

1. Triage & acknowledge within 48 hours.
2. Assign a severity and remediation plan.
3. Prepare a patch and coordinate release.
4. Public disclosure once a patch is available or after an agreed period.

If you have questions about this policy or need to contact the maintainers, open a private GitHub security advisory or email the security contact.
