# Builder App Deployment Explorer

Interactive React visualization of the Embr Builder App deployment lifecycle. It covers manual
first deploy, deploy-latest replacement, exact-commit deployment, retained-version redeploy,
explicit AppVersion activation, and the two Builder App settings changes: version configuration
and scaling.

## Views

**Overview** is one canvas for product and leadership demos. One scenario selector groups the
deploy flows and the settings changes. Configuration is drawn where it enters the flow:

- **Version config** (`API_URL`) drops into the AppVersion with the commit and `builder.yaml`.
  It is frozen there and reaches both the build and the Artifact App. Saving a new value
  changes nothing that is running; the next deploy captures it.
- **Scaling** drops straight into the Artifact App. Every deploy, redeploy, and activation uses
  the current policy, and changing it updates the running app in place.

The flow shows the ADC build sandbox, OCI publishing to Embr ACR, the AcrPull import into an ADC
Artifact, the new Artifact App beside the live one, the health check, the YARP switch, public
verification, and cleanup. Static files go through Embr Blob. Retained versions skip the build;
activation brings back that version's own `API_URL` while keeping the current scaling.

Playback moves payloads along the active handoffs with one short caption. The stage stepper and
previous/next controls share progress with Technical.

**Technical** retains the detailed sequence, API calls, resource examples, and inspection
drawer for the same scenarios. Settings changes show the ARM `PUT`, Regional validation and
persistence, and, for scaling, the in-place Artifact App `PUT`. The starting state lists the
desired `versionConfiguration` and `scaling`; example JSON shows desired, frozen, and running
values. The map fits its pane, with map-only zoom in, zoom out, and fit controls.

- Overview: `/#overview` (also the default at `/`).
- Technical: `/#technical`.
- Older `/#overview/configuration` and `/#technical/configuration` links open the matching view.
- All scenarios are illustrative, not live telemetry. Playback does not deploy or modify an app.
- Exact-commit deployment illustrates retained-match reuse; a missing exact match requires a build.
- Redeploy uses the same app version on fresh runtime resources. Version activation is
  health-checked recovery from retained outputs, not an instant traffic toggle.

## Configuration model

| Setting | Stored on | Enters the flow | A change takes effect | Version activation |
|---|---|---|---|---|
| `versionConfiguration.variables` | Builder App (desired); AppVersion (frozen) | AppVersion creation; used by build and runtime | When a deploy creates the next AppVersion | Restores the selected version's own values |
| `scaling` | Builder App only | Artifact App creation | Immediately, through one `PUT` to the running Artifact App | Keeps the current policy |

Variable values are write-only in API responses, which list names only. Compute sizing and
scale-to-zero are not modeled. Easy Auth, identity, and automation are other app-owned settings,
but their updates are not simulated.

The sequence distinguishes desired version configuration from its immutable AppVersion snapshot,
source authorization from customer-facing Easy Auth, AppVersion creation from the durable
Deployment, ADC native readiness from direct HTTPS health, atomic YARP activation from public-route
verification, and deployment success from serialized, independently retried cleanup.

## Local development

```powershell
npm install
npm run dev
```

## Verification

```powershell
npm test
npm run build
npm run lint
```

## Builder App deployment

The repository-root `builder.yaml` declares this directory as a static Vite component. Builder
detects the framework from `package.json`, builds `dist/`, publishes the immutable static output to
Blob Storage, and activates it through the Builder App route.

The existing demo app is `deployment-explorer-demo` on `amahmoud11/westus2`, with source branch
`demo/builder-deployment-explorer` in `amahmoud57/simple-python-notes-app`.

Live demo: https://deployment-explorer-demo-c25af3b6.app.westus2.amahmoud11.embr-test.windows-int.net/
