# 🛡️ Kubernetes Guardrail Browser Extension

A lightweight browser extension that validates Kubernetes YAML files in real time against common security and compliance guardrails.

## Features
- Inline linting for Kubernetes YAML files (GitHub, GitLab, Bitbucket).
- Built-in guardrails:
  - No privileged containers
  - Resource requests/limits required
  - No hostPath mounts
  - Image tag must not be 'latest'

## Installation
1. Clone this repo.
2. Go to `chrome://extensions` → Enable **Developer mode**.
3. Click **Load unpacked** → select this folder.

## Example
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: insecure-pod
spec:
  containers:
    - name: bad
      image: nginx:latest
      securityContext:
        privileged: true
```

➡️ Flags issues like privileged containers or `latest` tag.

## License
Apache 2.0
