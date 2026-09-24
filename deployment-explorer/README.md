# Builder App Deployment Explorer

Interactive React visualization of the Embr Builder App deployment lifecycle. It covers manual
first deploy, deploy-latest replacement, exact-commit deployment, retained-version redeploy, and
explicit AppVersion activation.

## Views

**Overview** is one canvas for product and leadership demos. A single flow selector
chooses the deployment scenario; there is no separate Configuration menu. Release
inputs, build/delivery, the running app, and app-wide policy are visible together.

The source and desired version configuration become a frozen AppVersion snapshot.
The connected flow shows the ADC build sandbox, OCI publishing to Embr ACR, managed-
identity import into an ADC Artifact, Artifact App creation, health checks, and YARP.
The running app keeps its current version and frozen values until traffic switches.
Static files have their own Embr Blob Storage path. Retained versions bypass build.

The app-wide policy path bypasses the AppVersion. Its inline scaling command shows
pending and applied policy without advancing the deployment or changing its snapshot.
The policy survives scenario changes, version activation, and deployment reset. These
are illustrative values; no live settings are changed. Resetting app policy is explicit.

Playback highlights the active handoff with a moving payload and one short caption.
Direct station selection and previous/next controls share deployment progress with
Technical. Background cleanup remains distinct from deployment success.

**Technical** retains the detailed sequence, API calls, resource examples, and inspection
drawer. Switching views preserves the selected flow and progress and pauses playback.
The technical deployment map automatically fits its available pane, with map-only zoom
in, zoom out, and fit controls. Captions and controls keep their normal text size.

- Overview: `/#overview` (also the default at `/`).
- Technical: `/#technical`.
- Technical configuration walkthrough: `/#technical/configuration`.
- Legacy `/#overview/configuration` links open the unified Overview.
- All scenarios are illustrative, not live telemetry. Playback does not deploy or modify an app.
- Exact-commit deployment illustrates retained-match reuse; a missing exact match requires a build.
- Redeploy uses the same app version on fresh runtime resources. Version activation is
  health-checked recovery from retained outputs, not an instant traffic toggle.

## Technical configuration walkthrough

Technical also retains a dedicated **Configuration** walkthrough:

1. v1 is active with a frozen `CURRENCY=USD` value.
2. Edit the app's desired version configuration to EUR; the live v1 does not change.
3. Create v2, capturing EUR with its source and manifest into a new immutable snapshot.
4. Deploy v2; the active runtime now uses v2's EUR value.
5. Save a new app-wide scaling range and CPU target; show policy application pending.
6. Apply that policy without creating an AppVersion or rebuilding.
7. Activate retained v1; USD returns, while the current scaling policy remains in effect.

Its fields are `BuilderApp.versionConfiguration`, `AppVersion.configuration`,
`runtime.versionConfiguration`, and `BuilderApp.scaling`, with inspectable example JSON.
"App settings" is a conceptual group, not an invented `appSettings` API property.

Scaling follows the aligned preview feature contract, not a live stamp control or a
claim that scaling is already in main. Examples use replica policy, not compute sizing
or scale-to-zero. Easy Auth, identity, and automation are other app-owned settings,
but their mutations are not simulated.

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
