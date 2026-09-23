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

Group each scenario into a small sequence of customer-facing milestones: select
source or retained version, build or reuse outputs, prepare and check the candidate,
switch the stable app URL, and confirm the release. Background cleanup remains
distinct from deployment success.

The main visual shows the current and incoming versions and which one serves
customers. A short outcome statement and compact capability summaries cover exact
source selection, static and compute outputs, health-gated activation, retained
versions, and stable URLs. Do not imply global availability, guaranteed zero
downtime, instant rollback, or unmodeled platform features.

Playback supports run, pause, previous, next, reset, and direct milestone selection.
Switching views preserves the selected scenario and progress while stopping playback.
The existing detailed explorer remains available unchanged in meaning.

### Component Structure

- App: shared scenario/progress state, view navigation, and playback integration.
- Overview component and scoped styles: milestones, release visual, outcomes, and
  capability summaries using the existing typography, brand, and Lucide icons.
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

- 60 Vitest tests pass, including all existing technical-view tests.
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