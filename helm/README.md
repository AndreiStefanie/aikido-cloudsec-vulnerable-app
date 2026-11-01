# Helm charts for testing Helm image onboarding

These charts are not used by the workshop deployment (CloudFormation only installs `app/`). They exist to test Aikido's automatic onboarding of public container images referenced in Helm charts:

- lambda-sast spiders every chart (`Chart.yaml` + `values*.yaml` + `templates/`) during a full scan with the `checkov` scanner and reports image references to core.
- core (`reportHelmImages`) onboards the ones on a known public registry as public container images and starts a scan for each.

| Chart | Purpose |
|---|---|
| `lifecycle-app/` | The workshop app: split `registry`/`repository`/`tag` values with `docker.io`, plus a hardcoded nginx sidecar |
| `observability-sidecars/` | One image per public registry, plus a duplicate of the nginx sidecar spelled `docker.io/library/nginx` |
| `edge-cases/` | References that must be skipped, plus known detection gaps |

## Before testing

- Use a paid account. Free plans allow 1 public image, and multiple tags of the same image (`nginx:1.16.0` + `nginx:latest`) need a paid plan.
- About 9 public image slots are used.
- Only full scans run the spider, not CI/PR scans.

## Expected result of the first full scan

| Reference (as written in the chart) | Onboarded as | Notes |
|---|---|---|
| `docker.io` + `library/node` + `18.12.0` (`lifecycle-app` values) | `node:18.12.0` (Docker Hub) | `docker.io/` and `library/` are stripped |
| `nginx:1.16.0` (`lifecycle-app` template) | `nginx:1.16.0` (Docker Hub) | onboarded once together with the row below |
| `docker.io/library/nginx:1.16.0` (`observability-sidecars` template) | same image as above | the second occurrence is skipped as already onboarded |
| `envoyproxy/envoy` + `v1.28.0` | `envoyproxy/envoy:v1.28.0` (Docker Hub) | was `v1.27.0`: after the bump, the existing image is retargeted to the new tag and rescanned |
| `quay.io/prometheus/node-exporter:v1.6.1` | Quay | |
| `registry.k8s.io` + `ingress-nginx/controller` + `v1.8.1` | k8s public registry | |
| `ghcr.io/stefanprodan/podinfo:6.5.0` | GitHub Container Registry | |
| `public.ecr.aws/docker/library/redis` + `7.0.11` | AWS public ECR | |
| `registry.example.com/team/api:2.3.0` | skipped | private registry |
| `myregistry.internal:5000/app:1.0` | skipped | private registry with a port |
| `ghcr.io/aikidosec/this-does-not-exist-xyz:1.0` | skipped | not pullable without credentials (private or missing) |
| `ghcr.io.example.com/team/app:1.0` | skipped | looks like `ghcr.io`, but is a different host |
| `nginx@sha256:…` | skipped | pinned by digest, no tag |
| `{{ .Values... }}` image lines in templates | skipped | Helm template expressions (their values are picked up from `values.yaml` instead) |

### Known gaps (wrong or missing today)

| Reference | Today | Should be |
|---|---|---|
| `nginx` + `tag: ""` with `appVersion: "1.25.3"` | `nginx:latest` | `nginx:1.25.3` |
| `alpine` + `tag: 3.10` (unquoted) | `alpine:3.1` (a different, real image) | `alpine:3.10` |
| `- image: busybox:1.36` (list item in a template) | not detected | `busybox:1.36` |
| `eu.gcr.io/k8s-artifacts-prod/pause:3.9` | skipped as private | onboarded from regional GCR |

## Expected result of a second full scan

Nothing new is onboarded. Every image above is skipped by the "already onboarded" check before core calls the Docker Hub API.
