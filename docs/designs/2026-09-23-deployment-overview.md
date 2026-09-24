# Design: Builder App Deployment Overview

| Field | Value |
|-------|-------|
| Date | 2026-09-23 |
| Status | Implemented |

## Problem Statement

The Deployment Explorer explains four deployment flows through individual API calls,
resources, and state transitions. PM and VP demos need the same accurate story at
the customer-outcome level without losing access to the technical view.

## Proposed Solution

Add an Overview view alongside the existing Technical view. Open Overview by default
and support direct links to either view. Keep four deployment scenarios: first deploy,
deploy, activate previous version, and redeploy.

Make the deployment path the primary visual: source, build sandbox, OCI packaging
and ACR, ADC Artifact, Artifact App, health checks, YARP, and customer URL. Each
handoff is a distinct playback checkpoint derived from real technical steps.
Retained-version flows bypass the build. A moving payload and current-station
highlight show where the flow is; one short caption replaces explanatory panels.

A separate customer-traffic line stays on the current version until route activation.
Static files have a separate Blob Storage path. Release verification and subsequent
background cleanup remain distinct. Do not imply global availability, guaranteed
zero downtime, instant rollback, or unmodeled platform features.

Playback supports run, pause, previous, next, reset, and direct milestone selection.
Switching views preserves the selected scenario and progress while stopping playback.
The existing detailed explorer remains available unchanged in meaning.

### Component Structure

- App: shared scenario/progress state, view navigation, and playback integration.
- Overview component and scoped styles: connected stations, animated handoffs,
  static output and customer-traffic paths using the existing brand and Lucide icons.
- Overview projection: derive milestone boundaries from existing step IDs/phases;
  derive traffic from the shared cutover model rather than inventing a second engine.
- Existing model and component test files: projection and interaction regressions.

### Local Hypothesis

The existing scenario steps and cutover states contain enough information to show
an accurate high-level release without changing any deployment behavior. Tests
will disconfirm this if a milestone omits a step, misorders health and cutover, or
shows the candidate serving before the existing route-activation boundary.

## Alternatives Considered

| Approach | Benefit | Trade-off |
|----------|---------|-----------|
| Interactive Overview (recommended) | Short customer story with technical drill-down | Requires milestone projection and interaction tests |
| Simplify the existing technical diagram | Smaller UI change | Still exposes internal architecture and removes useful detail |
| Static presentation page | Easy to present | Does not demonstrate version transitions or flow differences |

## Implementation Plan

1. Add milestone projection and focused tests for all four scenarios.
2. Add Overview and view navigation; retain the technical controls and inspect drawer.
3. Test playback, view changes, keyboard access, reduced motion, and responsive layout.
4. Build and lint; commit/push only with approval, then deploy this demo app to amahmoud11.

## Testing Strategy

Vitest and Testing Library already exist. Extend existing tests for complete and
ordered milestone coverage, first-deploy versus replacement traffic, retained-output
flows, playback cancellation, scenario reset, and technical-view regressions.

Run the full demo tests, TypeScript/Vite build, and Oxlint. Verify real interactions
and screenshots at desktop and mobile sizes using Playwright. After deployment,
check the public URL and both views. All diagrams are illustrative scenarios,
not live telemetry or controls that mutate the stamp.

### Verification Results

- 95 Vitest tests pass, covering commands and Deployment actions, the shared CLI timeline,
  both configuration lifecycles, the `builder.yaml` contract, per-component build order, Deployment
  document timing and status per stage, the Builder App ARM view, every deploy journey, Overview
  JSON inspection, playback, and Technical map fit.
- TypeScript/Vite production build and Oxlint pass.
- Playwright verified all four scenarios, health-before-traffic ordering, release
  success before cleanup, view switching, keyboard stage navigation, and pause. Traversed lines
  keep moving at every stage, including Health check and after completion.
- No clipped content or horizontal overflow at 390, 1024, 1280, 1366, and 1440px;
  1280x720, 1366x768, and 1440x900 fit without vertical scrolling. Every command is fully
  visible at 1280 and 1366px. With the inspector open, the map stays a canvas beside it at 1280
  and 1366px, every element remains clickable, and the command bar and playback controls stay
  clear of the inspector from 900px up.
- Reduced motion hides payloads and stops line motion. Axe reports no violations in 8
  Overview states and 8 inspector targets at 390, 1280, and 1366px.

## Rollout Plan

Use the existing demo/builder-deployment-explorer branch of
amahmoud57/simple-python-notes-app and the existing deployment-explorer-demo Builder
App on amahmoud11/westus2. Confirm its source configuration and auto-deploy behavior
before deploying. Do not modify Embr platform services or unrelated demo apps.

## Definition of Done

- Design approved.
- All four deploy flows have accurate, readable journeys, and their settings are inspectable.
- Existing technical scenarios and inspection remain functional.
- Tests, build, lint, desktop/mobile, and keyboard checks pass.
- Existing amahmoud11 public URL serves the verified update.

## Configuration in the Flow

A running Artifact App always combines two settings, and the canvas draws each one where it
enters the flow:

- Version configuration: `versionConfiguration.variables` on the Builder App is desired state.
  Creating an AppVersion snapshots it with the commit and `builder.yaml`; the build and the
  Artifact App both use that frozen copy. Saving a new value makes no provider call and creates
  no AppVersion or Deployment. Redeploy and activation use the selected version's own values.
- Scaling: `scaling` is current Builder App policy and is never frozen. Every new Artifact App
  gets the current policy. Changing it saves the policy and sends one complete `PUT` to the
  active Artifact App, replacing only its scale block. There is no build, AppVersion,
  Deployment, or route change.

The example variable is `API_URL`: v16 froze `legacy.contoso.com`, and later versions use
`api.contoso.com`. Scaling for `api` is 1–3 replicas at 70% CPU.

Overview: a settings band holds both values. Version config drops into the AppVersion, beside
`builder.yaml` from the commit. Scaling drops into the Artifact App being created. Blue marks the
version and its frozen config, amber marks scaling, and green marks live traffic. Each Artifact
App slot shows its version, frozen `API_URL`, and replica range. Activation marks the desired
value as unused. Clicking a chip shows its JSON: the desired value beside its frozen AppVersion
copy, or the policy beside the scale block Embr sends to ADC.

Technical: the starting state lists both settings. Example JSON shows desired values on the
Builder App, frozen values on AppVersions and Deployments, and frozen environment plus current
scale on Artifact Apps.

Out of scope: compute sizing, scale-to-zero, and Easy Auth, identity, or automation updates.

Local hypothesis: projecting both settings from the shared scenario steps keeps both views
consistent. Tests will disconfirm this if activation rewinds scaling or a new Artifact App lacks
frozen variables or current scaling.

<details>
<summary>Contract provenance</summary>

Inspected Embr main at `e1676dea9f54aae74ad24d8dbe562e86cc8ed218`:

- `docs/designs/2026-09-14-builder-app-version-lifecycle.md` and
  `docs/designs/2026-09-10-builder-app-resource-autoscaling.md` define the two lifecycles.
- `ArtifactAppCandidateRequestFactory.Create(version, runtimePolicy)` builds each Artifact App
  request from the AppVersion's frozen variables and the app's current scaling.
- `AppVersionBuildExecutionService` passes the same frozen variables to the build.
- `BuilderAppService.UpdateAppAsync` only persists `versionConfiguration`. For `scaling`, it
  also calls `AppScalingService.ApplyAsync`, which uses `ArtifactAppRuntimeProvider.ApplyScalingAsync`.
- ARM `PUT .../builderApps/{name}` carries both settings and returns 200; `PATCH` covers only
  identity and source. `builder app scale` sends that `PUT`.

</details>

## Deploy, Activate, and Redeploy

Deploy and activation both roll out a new Deployment, so the demo names each flow by the command
that starts it and the Deployment `action` it records, the same way the Builder CLI does:

- Deploy from source: `builder app deploy <name>` resolves the configured branch with the current
  version config and builds a new AppVersion.
- Reuse a built version: `builder app version activate <name> --previous` reuses the previous
  AppVersion with its own frozen config. ARM-only `POST .../redeploy` reuses the active version.
- Settings: version config and scaling are Builder App settings, not flows; they create no
  Deployment.

Every Deployment uses the CLI timeline phases Queue, Build, Provision, Verify, Route, and Cleanup.
Overview groups its stages under those phases; activation and redeploy mark Build as reused, as the
CLI does. Completion uses the CLI receipts: Deployment completed or Activation completed. The API
status `activating` means routing traffic in every Deployment, so the demo labels it Routing and
reserves "activate" for the version activation command.

<details>
<summary>CLI provenance</summary>

Inspected `src/Embr.Builder.Cli` at Embr main `e1676dea9f54aae74ad24d8dbe562e86cc8ed218`:

- `commands/apps.ts`: `app deploy` with `--commit`, and `app scale` "without creating an app version".
- `commands/app.ts`: `app version activate`, "Activate an immutable app version as a new
  deployment", with `[version-id]` or `--previous`.
- `deployment-progress.ts`: timeline phases Queue, Build, Provision, Verify, Route, and Cleanup;
  headers `BUILDER / DEPLOYMENT` and `BUILDER / ACTIVATION`; activation shows Build as `reused`,
  labels its version "Reused version", and completes as "Activation completed".
- No CLI command calls `/redeploy`; `AppDeploymentAction` defines `deploy`, `redeploy`, and
  `activate` Deployment actions.

</details>

## builder.yaml Example

The Technical `builder.yaml` node shows a complete manifest for the example app. The file has
only two top-level keys: optional `name` and `components`. Everything else belongs to a component:

- Static `web`: `role: static`, `rootDirectory`, `platform`, `platformVersion`, `build`,
  `output`, and `path: /`. Vite supplies `nodejs`, `npm run build`, and `dist` when omitted.
- Runtime `api`: `role: web`, `rootDirectory`, `platform: python`, `platformVersion`,
  `path: /api`, and `run` with `port`, `start`, and a required `healthCheckPath` under `/api`.

Version configuration and scaling are Builder App settings, not manifest fields. The example ends
with a comment showing their current scenario values. The AppVersion stores the same parsed manifest.

<details>
<summary>Manifest provenance</summary>

Inspected Embr main at `e1676dea9f54aae74ad24d8dbe562e86cc8ed218`:

- `docs/app-manifest.md` defines the component fields, build modes, and web health contract.
- `AppManifest` has only `name` and `components`. `AppManifestDeserializer` rejects unknown keys,
  including component `variables`, requires `path` on every component of a multi-component app,
  and requires each health path to sit within its component mount.
- `ComponentBuildAdapters`: Vite resolves `nodejs`, `npm run build`, and `dist` when omitted.
  Generic Oryx compute needs `role: web` or `run` plus a supported platform, rejects `output`,
  and defaults `run.port` to 8080.
- `BuilderAppVersion.manifest` is the parsed `AppManifest`.

</details>

## Build Order and Documents

The AppVersion and the Deployment both exist before ARM returns 202. Everything after that runs in a
background worker, and each document fills in as the rollout advances:

1. Admission: reserve the app, resolve the commit, and read `builder.yaml`. Then create the pending
   AppVersion (source, manifest, frozen config, one pending entry per component) and the Building
   Deployment (AppVersion ID, action, config copy, previous provider). ARM returns 202.
2. Build: a worker claims the Deployment and the app build lease, and marks the AppVersion building.
   Components build one at a time in manifest order. Each gets its own temporary sandbox, checkout,
   build, and publish, then records its build settings and outputs and becomes ready: web to Blob,
   then api to ACR through an ACR Task. The AppVersion becomes ready when every component is.
3. Provision: the Deployment records its outputs and the candidate it will create. Embr then PUTs an
   ADC Artifact with the digest-pinned image and the AcrPull identity. That PUT is what makes ADC pull
   from Embr ACR; ADC never watches the registry. The Artifact App runs that Artifact Version.
4. Verify and route: the Deployment records the candidate FQDN (`healthChecking`), then `activating`
   after the direct health check, then the public URL when YARP switches, and finally `succeeded`.

Overview shows this as two Build stages, web then api. Technical shows each step.

The Overview draws both records as clickable resources. The Builder App
(`Microsoft.Web/builderApps`) sits between its two settings, shows which version is live, and
opens as its ARM resource with variable names only, then the Regional document. The Deployment
heads the pipeline lane with its current status. Its first stage ends once the Deployment exists,
so stage 2 shows it Building (deploy), Pending (activate), or Provisioning (redeploy). For activate
and redeploy, the Reused stage is the worker confirming the retained version's outputs before
it creates the Artifact.

<details>
<summary>Build and runtime provenance</summary>

Inspected Embr main at `e1676dea9f54aae74ad24d8dbe562e86cc8ed218`:

- `AppDeploymentService.TriggerInternalAsync` admits the app, calls
  `AppVersionService.CreatePendingFromReferenceAsync`, creates the Deployment, and signals the
  worker. `BuilderAppController.Deploy` returns 202 with the Deployment ID only after that call.
- `DriveOwnedAsync` claims execution, then `EnsureVersionReadyAsync` acquires the build lease and
  runs `AppVersionBuildExecutionService.DriveAsync`, which builds components sequentially.
- `ComponentBuildOrchestrator.ExecuteAsync` provisions a sandbox per component, checks out source,
  runs Oryx, publishes outputs, and deletes the sandbox. `AcrComputeImagePublisher` uploads the
  build context and calls ACR `scheduleRun`.
- `ArtifactAppRuntimeProvider.EnsureDeploymentArtifactAsync` PUTs `Microsoft.App/artifacts` with
  `source.kind: registry`, `imageUrl`, and the registry pull identity, then waits for the Artifact
  Version. `BuildAppBody` references it through `artifactVersionUrl`.

</details>