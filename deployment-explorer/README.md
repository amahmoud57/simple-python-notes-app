# Builder App Deployment Explorer

Interactive React visualization of the Embr Builder App deployment lifecycle. It covers manual
first deploy, deploy-latest replacement, exact-commit deployment, retained-version redeploy, and
explicit AppVersion activation.

## Views

**Overview** is the default screen for product and leadership demos. A connected diagram
follows source -> build sandbox -> OCI packaging and ACR -> ADC Artifact -> Artifact App
-> health checks -> YARP -> customer URL. Playback moves a payload along the active
handoff and highlights the current station. Retained-version flows skip the build.

A separate customer-traffic line stays on the existing version until routing changes;
background cleanup follows release verification. Static files have their own Blob
Storage path. One short caption accompanies the current action. Direct station
selection and previous/next controls share progress with the technical view.

**Technical** retains the detailed sequence, API calls, resource examples, and inspection
drawer. Switching views preserves the selected flow and progress and pauses playback.

- Overview: `/#overview` (also the default at `/`).
- Technical: `/#technical`.
- All scenarios are illustrative, not live telemetry. Playback does not deploy or modify an app.
- Exact-commit deployment illustrates retained-match reuse; a missing exact match requires a build.
- Redeploy uses the same app version on fresh runtime resources. Version activation is
	health-checked recovery from retained outputs, not an instant traffic toggle.

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
