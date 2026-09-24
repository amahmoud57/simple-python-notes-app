# Design: Builder App Deployment Overview

| Field | Value |
|-------|-------|
| Date | 2026-09-23 |
| Status | Implemented |

## Problem Statement

The Deployment Explorer explains five deployment flows through individual API calls,
resources, and state transitions. PM and VP demos need the same accurate story at
the customer-outcome level without losing access to the technical view.

## Proposed Solution

Add an Overview view alongside the existing Technical view. Open Overview by default
and support direct links to either view. Keep all five existing deployment scenarios:
first deploy, deploy latest, deploy commit, redeploy, and activate version.

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

1. Add milestone projection and focused tests for all five scenarios.
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

- 93 Vitest tests pass, including the unified Overview, configuration lifecycles,
  and technical map-fit tests.
- TypeScript/Vite production build and Oxlint pass.
- Playwright verified all five journeys, health-before-traffic ordering, release
  success before cleanup, view switching, keyboard navigation, and pause.
- No clipped controls or horizontal overflow at 320, 390, 820, and 1440px.
- Reduced-motion behavior passes. Axe reports no WCAG A/AA or best-practice
  violations in the Overview at desktop and mobile sizes.

## Rollout Plan

Use the existing demo/builder-deployment-explorer branch of
amahmoud57/simple-python-notes-app and the existing deployment-explorer-demo Builder
App on amahmoud11/westus2. Confirm its source configuration and auto-deploy behavior
before deploying. Do not modify Embr platform services or unrelated demo apps.

## Definition of Done

- Design approved.
- All five flows have accurate, readable high-level journeys.
- Existing technical scenarios and inspection remain functional.
- Tests, build, lint, desktop/mobile, and keyboard checks pass.
- Existing amahmoud11 public URL serves the verified update.

## Configuration Story

Status: Technical walkthrough retained; Overview superseded by the unified design below.

Add a shared Deployment / Configuration story selector to both Overview and Technical.
Keep existing deployment scenarios and map-fit controls. Configuration is illustrative
playback, not a form that changes stamp settings.

Use two visibly labeled paths, not explanatory paragraphs:

- Version configuration: desired app values -> immutable AppVersion snapshot -> active
  version. Show a plain build/runtime variable changing from USD to EUR. Editing desired
  values does not mutate the active version; creating and deploying v2 captures the edit.
- App settings: one app-wide policy -> whichever version is active. Show scaling moving
  from a 1-2 replica CPU policy to a 2-5 replica policy, applying without a new AppVersion or
  build. Activating v1 restores its USD snapshot but retains the newer scaling policy.

Playback stages: initial v1, edit desired version configuration, create v2 snapshot,
activate v2, change scaling policy, confirm policy application, activate retained v1.
Desired, captured, and active states remain visibly distinct. App-wide settings use a
different icon and label as well as color; independence does not imply instant application.

Overview shows short names, values, arrows, and version locks. Technical shows the same
state with BuilderApp.versionConfiguration, AppVersion.configuration, BuilderApp.scaling,
and read-only runtime.versionConfiguration, plus compact example JSON. Switching view
retains the selected configuration stage and pauses playback.

Scope: variables are confirmed in current main. App-level scaling follows the aligned
scaling feature contract (Q:/embr-final-pr1634); current main does not yet include that
feature. Do not invent a public appSettings object, include unsettled compute sizing,
claim autoscaling is live telemetry, or include scale-to-zero. Auth/identity/automation
may be labeled as other app-owned settings but are not simulated update flows.

Local hypothesis: a single shared, deterministic configuration story can demonstrate
that version activation changes the frozen configuration but never rewinds app policy.
Tests will disconfirm this if editing desired values changes v1, policy changes create
versions, or restoring v1 resets the policy. Both views must project the same state.

Implementation: add a focused configuration model and shared story component/styles;
integrate with existing playback and view navigation; reuse current model and App tests.
Update the existing docs only. Preserve and verify the pending map-fit changes.

Verification: focused lifecycle and interaction tests, full demo tests, build/lint,
laptop map-fit checks, desktop/mobile screenshots, keyboard/reduced-motion and axe checks,
then deploy the existing demo branch to amahmoud11 and verify both views live.

Verified locally: all seven configuration stages in both views; exact technical JSON;
separate configuration and deployment progress; capture and policy payload motion;
keyboard navigation; reduced motion; zero axe violations with the inspector open at
390px and 1366px. No clipping at 320, 390, 820, 1280, and 1366px. The deployment map fits
1280x720, 1366x768, and 1440x900, supports manual zoom across steps, and still opens nodes.

<details>
<summary>Contract provenance</summary>

- Current main inspected: `6ae2394c698b1b3098bc3e0d6172d7517526be63`.
  `src/Embr.Contracts/Global/Models/AppVersionConfiguration.cs` defines non-secret
  build/runtime variables and a defensive snapshot; `BuilderApp.cs` stores desired
  configuration, while `AppRuntime.cs` reports the active version configuration.
- Aligned scaling feature inspected: `4fe3d43bc7ec017ff7476a1db0318821f36cd162`.
  `src/Embr.Contracts/Global/Models/AppScaling.cs` defines app-owned, per-component
  min/max replica and CPU/memory targets; `BuilderApp.cs` stores them as `scaling`,
  separately from `versionConfiguration`. The example uses valid 1-2 and 2-5 ranges.

</details>

Alternative: inline configuration badges on every deployment node are smaller, but do
not demonstrate what editing, capture, and rollback do. A separate static reference
table is easy to scan but would lose the interactive lifecycle story.

## Unified Overview

User-directed redesign, 2026-09-24: Overview must be one cohesive canvas, with no
Deployment / Configuration menu. Keep the separate detailed walkthrough in Technical.

Overview has one deployment scenario selector and shared playback. Three unframed
areas show release inputs, build/delivery, and the running app. Desired version
configuration is captured alongside source and visibly travels with the release.
The running app shows its active version and frozen values. A compact app-policy
path connects scaling directly to the runtime rather than through an AppVersion.
One inline scaling command demonstrates pending/applying policy without advancing
the deployment, creating a version, or rebuilding. Applied policy survives scenario
changes and version activation. The preview and illustrative-data boundary remains.

Keep the OCI/ACR/ADC handoffs, health gate, static output route, customer traffic,
and cleanup visible with short labels. Reduce repeated headings, prose, controls,
and navigation. The current operation has one concise caption. Laptop-first fit
and responsive vertical flow remain required, as do keyboard and reduced-motion support.

Old Overview configuration links resolve to the unified Overview, not a hidden
second page. Technical configuration links remain supported. Switching away from
Overview cancels deployment animation; policy application remains app-owned.

Local check: projection tests must prove that configuration is captured before
build, the active value changes only with route cutover, retained-version activation
does not copy desired edits, and app-policy updates do not change deployment progress.
Browser checks must show both configuration scopes and the release flow together
without clipping at laptop sizes, with no Overview story selector.

Implemented checks: all five scenarios at 320, 390, 768, 1024, 1280, and 1440px;
inline scaling leaves the release stationary and persists through retained-version
activation; old Overview configuration links resolve to the combined canvas.
Keyboard navigation, payload motion, reduced motion, and Overview axe audits pass.
Technical map fit and its dedicated configuration walkthrough remain functional.