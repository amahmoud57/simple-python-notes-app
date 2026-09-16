export type NodeId =
  | 'client'
  | 'arm'
  | 'regional'
  | 'deployment'
  | 'app'
  | 'github'
  | 'manifest'
  | 'version'
  | 'build'
  | 'blob'
  | 'acr'
  | 'artifact'
  | 'candidate'
  | 'health'
  | 'existing'
  | 'route'
  | 'customer'

export type Phase =
  | 'pending'
  | 'building'
  | 'provisioning'
  | 'healthChecking'
  | 'activating'
  | 'cleaningUp'
  | 'succeeded'

export type PayloadKind =
  | 'request'
  | 'file'
  | 'revision'
  | 'build'
  | 'static'
  | 'image'
  | 'resource'
  | 'health'
  | 'route'
  | 'timer'
  | 'delete'

export type CutoverState =
  | 'existing'
  | 'candidate'
  | 'healthy'
  | 'switched'
  | 'verified'
  | 'draining'
  | 'deleting'
  | 'deleted'

export interface SystemNode {
  id: NodeId
  label: string
  eyebrow: string
  x: number
  y: number
  group: 'control' | 'source' | 'build' | 'runtime' | 'traffic'
}

export interface FlowStep {
  id: string
  phase: Phase
  title: string
  source: NodeId
  target: NodeId
  payload: string
  payloadKind: PayloadKind
  reason: string
  result: string
  api: string
  cutoverDuring?: CutoverState
  cutoverAfter?: CutoverState
}

export interface Scenario {
  id: 'manual' | 'push' | 'redeploy' | 'rollback'
  label: string
  title: string
  summary: string
  oldVersion: string
  newVersion: string
  steps: FlowStep[]
  nodeLabels?: Partial<Record<NodeId, string>>
}

export interface ExampleDocument {
  title: string
  format: string
  body: string
}

export const phaseLabels: Record<Phase, string> = {
  pending: 'Pending',
  building: 'Building',
  provisioning: 'Provisioning',
  healthChecking: 'Health check',
  activating: 'Activating',
  cleaningUp: 'Cleanup',
  succeeded: 'Succeeded',
}

export const nodes: SystemNode[] = [
  { id: 'client', label: 'Builder CLI', eyebrow: 'Customer client', x: 34, y: 40, group: 'control' },
  { id: 'arm', label: 'ARM API', eyebrow: 'Microsoft.Web', x: 202, y: 34, group: 'control' },
  { id: 'regional', label: 'Regional API', eyebrow: 'Orchestrator', x: 382, y: 46, group: 'control' },
  { id: 'deployment', label: 'Deployment', eyebrow: 'Durable operation', x: 578, y: 30, group: 'control' },
  { id: 'app', label: 'Builder App', eyebrow: 'ARM resource', x: 824, y: 42, group: 'control' },
  { id: 'github', label: 'GitHub', eyebrow: 'Source provider', x: 48, y: 222, group: 'source' },
  { id: 'manifest', label: 'builder.yaml', eyebrow: 'Component manifest', x: 220, y: 196, group: 'source' },
  { id: 'version', label: 'AppVersion', eyebrow: 'Immutable record', x: 458, y: 184, group: 'build' },
  { id: 'build', label: 'ADC build sandbox', eyebrow: 'Ephemeral build', x: 350, y: 360, group: 'build' },
  { id: 'blob', label: 'Blob Storage', eyebrow: 'Static output', x: 602, y: 338, group: 'build' },
  { id: 'acr', label: 'Azure Container Registry', eyebrow: 'Compute output', x: 786, y: 220, group: 'build' },
  { id: 'artifact', label: 'ADC Artifact', eyebrow: 'Image import', x: 920, y: 358, group: 'runtime' },
  { id: 'candidate', label: 'Artifact App candidate', eyebrow: 'New provider', x: 844, y: 516, group: 'runtime' },
  { id: 'health', label: 'Direct health check', eyebrow: 'Readiness gate', x: 670, y: 520, group: 'runtime' },
  { id: 'existing', label: 'Existing Artifact App', eyebrow: 'Current provider', x: 492, y: 516, group: 'traffic' },
  { id: 'route', label: 'YARP route', eyebrow: 'Atomic route', x: 286, y: 538, group: 'traffic' },
  { id: 'customer', label: 'Customer URL', eyebrow: 'Public route', x: 50, y: 532, group: 'traffic' },
]

const step = (value: FlowStep): FlowStep => value

const sourceBuildSteps = (includeBranchResolution: boolean): FlowStep[] => [
  ...(includeBranchResolution
    ? [
        step({
          id: 'resolve-revision',
          phase: 'building',
          title: 'Resolve main to an exact commit',
          source: 'regional',
          target: 'github',
          payload: 'branch: main',
          payloadKind: 'request',
          reason: 'A branch moves. The AppVersion must be pinned to one immutable revision.',
          result: 'commit 9f42c1e4a77b...',
          api: 'GetBranchShaAsync(installationId, owner, repository, "main")',
        }),
      ]
    : []),
  step({
    id: 'read-manifest',
    phase: 'building',
    title: 'Read and validate builder.yaml',
    source: 'github',
    target: 'manifest',
    payload: 'builder.yaml @ 9f42c1e',
    payloadKind: 'file',
    reason: 'The manifest defines components, output directories, routes, and the health path.',
    result: '2 validated components',
    api: 'GET /repos/contoso/shop/contents/builder.yaml?ref=9f42c1e...',
  }),
  step({
    id: 'create-version',
    phase: 'building',
    title: 'Create the immutable AppVersion',
    source: 'manifest',
    target: 'version',
    payload: 'builder.yaml + commit SHA',
    payloadKind: 'file',
    reason: 'Source identity and the parsed component plan become one durable version record.',
    result: 'AppVersion avp_17: building',
    api: 'IAppVersionService.CreatePendingFromReferenceAsync(appId, lifecycleId, versionId, environment)',
  }),
  step({
    id: 'checkout-source',
    phase: 'building',
    title: 'Check out the exact revision',
    source: 'github',
    target: 'build',
    payload: 'source @ 9f42c1e',
    payloadKind: 'revision',
    reason: 'Each component is built from the same detached revision in temporary ADC compute.',
    result: 'source available at /app',
    api: 'Sandboxes.ExecuteShellCommandAsync: git fetch --depth 1 $EMBR_CLONE_URL $EMBR_REVISION',
  }),
  step({
    id: 'build-components',
    phase: 'building',
    title: 'Build the static and compute components',
    source: 'version',
    target: 'build',
    payload: 'component build plan',
    payloadKind: 'build',
    reason: 'Oryx executes the validated build adapters and discovers publishable outputs.',
    result: 'static files + Python /output',
    api: 'ComponentBuildOrchestrator.ExecuteAsync -> ExecuteOryxBuildAsync -> DiscoverOutputsAsync',
  }),
  step({
    id: 'publish-static',
    phase: 'building',
    title: 'Publish immutable static assets',
    source: 'build',
    target: 'blob',
    payload: '146 files + route manifest',
    payloadKind: 'static',
    reason: 'YARP serves static paths from a versioned Blob prefix, not from the runtime container.',
    result: 'static-assets/app_shop/avp_17/web/site',
    api: 'azcopy copy /tmp/embr-static/* $EMBR_STATIC_SAS_URL --recursive --put-md5',
  }),
  step({
    id: 'publish-image',
    phase: 'building',
    title: 'Publish the compute image',
    source: 'build',
    target: 'acr',
    payload: 'OCI build context',
    payloadKind: 'image',
    reason: 'The Oryx output and entrypoint become a deployment-specific container image.',
    result: 'api@sha256:71ab42d9c508...',
    api: 'POST {registryResourceId}/scheduleRun?api-version=2019-04-01',
  }),
  step({
    id: 'seal-version',
    phase: 'building',
    title: 'Seal the AppVersion as ready',
    source: 'acr',
    target: 'version',
    payload: 'static reference + OCI digest',
    payloadKind: 'resource',
    reason: 'Only a complete immutable deployment plan may be activated or retained for rollback.',
    result: 'AppVersion avp_17: ready',
    api: 'IBuilderAppVersionRepository.UpdateWithRetryAsync(build.status = ready, outputs = [...])',
  }),
  step({
    id: 'import-artifact',
    phase: 'provisioning',
    title: 'Import the OCI image as an ADC Artifact',
    source: 'acr',
    target: 'artifact',
    payload: 'digest-pinned image',
    payloadKind: 'image',
    reason: 'ADC needs a Ready Artifact Version before it can create the new runtime candidate.',
    result: 'ADC Artifact Version 17: Ready',
    api: 'PUT .../providers/Microsoft.App/artifacts/embr-{deploymentHash}',
  }),
  step({
    id: 'create-candidate',
    phase: 'provisioning',
    title: 'Create a fresh Artifact App candidate',
    source: 'artifact',
    target: 'candidate',
    payload: 'Artifact Version + runtime settings',
    payloadKind: 'resource',
    reason: 'The active provider is never modified in place. A new isolated provider starts beside it.',
    result: 'candidate provisioned at 0% traffic',
    api: 'PUT .../providers/Microsoft.App/artifactApps/embr-{deploymentHash}',
    cutoverAfter: 'candidate',
  }),
  step({
    id: 'direct-health',
    phase: 'healthChecking',
    title: 'Prove the candidate healthy in isolation',
    source: 'regional',
    target: 'health',
    payload: 'GET /api/health',
    payloadKind: 'health',
    reason: 'Customer traffic stays on the old provider until the new candidate passes direct health.',
    result: 'HTTP 200 twice; candidate remains at 0%',
    api: 'GET https://{candidateFqdn}/api/health',
    cutoverAfter: 'healthy',
  }),
  step({
    id: 'activate-route',
    phase: 'activating',
    title: 'Atomically switch YARP to the new version',
    source: 'regional',
    target: 'route',
    payload: 'complete route document',
    payloadKind: 'route',
    reason: 'Static paths, compute mounts, auth, and AppVersion identity must change together.',
    result: 'YARP targets v17; v16 is still retained',
    api: 'IYarpClient.ActivateAppRouteAsync(routeMutationFence, staticRouting, vms, backendPrefixes)',
    cutoverAfter: 'switched',
  }),
  step({
    id: 'verify-customer-route',
    phase: 'activating',
    title: 'Verify the new version through the customer URL',
    source: 'route',
    target: 'customer',
    payload: 'GET /api/health',
    payloadKind: 'health',
    reason: 'Direct health is insufficient. Embr must prove that the public route converged.',
    result: 'X-Embr-App-Version: avp_17',
    api: 'GET https://shop.embr.example/api/health',
    cutoverAfter: 'verified',
  }),
  step({
    id: 'promote-runtime',
    phase: 'cleaningUp',
    title: 'Promote the verified Deployment',
    source: 'customer',
    target: 'app',
    payload: 'activeDeploymentId: adp_demo',
    payloadKind: 'route',
    reason: 'Builder App changes its active runtime only after public verification succeeds.',
    result: 'v17 active; v16 drains for a 5 minute grace period',
    api: 'IBuilderAppRepository.UpdateWithRetryAsync(runtime.activeDeploymentId = adp_demo)',
    cutoverAfter: 'draining',
  }),
  step({
    id: 'delete-predecessor',
    phase: 'succeeded',
    title: 'Delete the old provider after the grace period',
    source: 'regional',
    target: 'existing',
    payload: 'cleanup deadline elapsed',
    payloadKind: 'delete',
    reason: 'The old Artifact App is retained until route convergence and connection draining are safe.',
    result: 'old Artifact App and ADC Artifact deleted',
    api: 'DELETE .../artifactApps/{old}; DELETE .../artifacts/{old}',
    cutoverDuring: 'deleting',
    cutoverAfter: 'deleted',
  }),
]

const manualSteps: FlowStep[] = [
  step({
    id: 'arm-request',
    phase: 'pending',
    title: 'Request a deployment through ARM',
    source: 'client',
    target: 'arm',
    payload: 'POST /deploy + request ID',
    payloadKind: 'request',
    reason: 'The customer explicitly asks Builder Apps to deploy its configured source.',
    result: '202 Accepted + Azure-AsyncOperation URL',
    api: 'POST .../Microsoft.Web/builderApps/shop/deploy?api-version=2026-08-01',
  }),
  step({
    id: 'regional-request',
    phase: 'pending',
    title: 'Forward the trusted ARM caller',
    source: 'arm',
    target: 'regional',
    payload: 'validated caller + arm:build-842',
    payloadKind: 'request',
    reason: 'Regional receives identity from the trusted ARM adapter, not from customer JSON.',
    result: 'caller accepted for app_shop',
    api: 'POST /internal/regional/v1/builder-apps/deploy',
  }),
  step({
    id: 'admit-deployment',
    phase: 'building',
    title: 'Reserve the app and create the Deployment',
    source: 'regional',
    target: 'deployment',
    payload: 'adp_demo + execution lease',
    payloadKind: 'resource',
    reason: 'One durable record owns the pending slot and checkpoints all later side effects.',
    result: 'Deployment adp_demo: building',
    api: 'TryAdmitDeploymentAsync -> IBuilderAppDeploymentRepository.CreateAsync',
  }),
  ...sourceBuildSteps(true),
]

const pushSteps: FlowStep[] = [
  step({
    id: 'signed-push',
    phase: 'pending',
    title: 'Receive a signed GitHub push',
    source: 'client',
    target: 'arm',
    payload: 'push event + exact after SHA',
    payloadKind: 'request',
    reason: 'The webhook provides the exact revision and replaces the manual ARM trigger.',
    result: 'HMAC verified for delivery gh-921',
    api: 'POST /webhooks/github with X-Hub-Signature-256',
  }),
  step({
    id: 'fanout-push',
    phase: 'pending',
    title: 'Match repository, branch, and auto-deploy',
    source: 'arm',
    target: 'regional',
    payload: 'repository 84721 + main + 9f42c1e',
    payloadKind: 'revision',
    reason: 'Only Builder Apps bound to this repository and branch with auto-deploy enabled qualify.',
    result: 'one eligible Builder App',
    api: 'ListBySourceAsync(github, repositoryId) -> TriggerAsync(sourceRevision)',
  }),
  step({
    id: 'admit-push',
    phase: 'building',
    title: 'Create one deterministic push Deployment',
    source: 'regional',
    target: 'deployment',
    payload: 'github:84721:9f42c1e',
    payloadKind: 'resource',
    reason: 'Webhook retries for the same repository and SHA converge on one Deployment.',
    result: 'Deployment adp_push: building',
    api: 'AppDeploymentId.ForTrigger(appId, repositoryId, exactSha)',
  }),
  ...sourceBuildSteps(false),
]

const retainedSteps = (action: 'redeploy' | 'rollback'): FlowStep[] => {
  const targetVersion = action === 'rollback' ? 'avp_15' : 'avp_17'
  return [
    step({
      id: `${action}-request`,
      phase: 'pending',
      title: action === 'rollback' ? 'Request rollback to AppVersion v15' : 'Request a retained-version redeploy',
      source: 'client',
      target: 'arm',
      payload: action === 'rollback' ? 'POST /rollback + avp_15' : 'POST /redeploy',
      payloadKind: 'request',
      reason: action === 'rollback' ? 'The customer selects a historical immutable version.' : 'The customer asks for fresh runtime resources without rebuilding source.',
      result: '202 Accepted + operation URL',
      api: `POST .../Microsoft.Web/builderApps/shop/${action}`,
    }),
    step({
      id: `${action}-admit`,
      phase: 'pending',
      title: `Admit a new ${action} Deployment`,
      source: 'arm',
      target: 'deployment',
      payload: `${action} action + idempotency key`,
      payloadKind: 'request',
      reason: 'A new durable operation applies retained content with a fresh runtime settings snapshot.',
      result: `Deployment adp_${action}: provisioning`,
      api: `AppDeploymentService.Trigger${action === 'rollback' ? 'Rollback' : 'Redeploy'}Async`,
    }),
    step({
      id: `${action}-select-version`,
      phase: 'provisioning',
      title: `Validate retained AppVersion ${targetVersion}`,
      source: 'app',
      target: 'version',
      payload: `AppVersion ${targetVersion}`,
      payloadKind: 'resource',
      reason: 'The version must be Ready, lifecycle-scoped, complete, and still available.',
      result: `${targetVersion}: ready with retained outputs`,
      api: 'IBuilderAppVersionRepository.GetByIdAsync -> CanActivateRetainedVersionAsync',
    }),
    step({
      id: `${action}-artifact`,
      phase: 'provisioning',
      title: 'Recreate the deployment-owned ADC Artifact',
      source: 'version',
      target: 'artifact',
      payload: 'retained OCI digest',
      payloadKind: 'image',
      reason: 'The new Deployment imports the retained image under its own deterministic resource ID.',
      result: 'new ADC Artifact Version: Ready',
      api: 'PUT .../providers/Microsoft.App/artifacts/embr-{newDeploymentHash}',
    }),
    step({
      id: `${action}-candidate`,
      phase: 'provisioning',
      title: 'Create a fresh Artifact App candidate',
      source: 'artifact',
      target: 'candidate',
      payload: `${targetVersion} outputs + current settings`,
      payloadKind: 'resource',
      reason: 'Redeploy and rollback are still blue-green; an old provider is never revived in place.',
      result: 'new candidate at 0% traffic',
      api: 'PUT .../providers/Microsoft.App/artifactApps/embr-{newDeploymentHash}',
      cutoverAfter: 'candidate',
    }),
    step({
      id: `${action}-health`,
      phase: 'healthChecking',
      title: 'Health-check the isolated candidate',
      source: 'regional',
      target: 'health',
      payload: 'GET /api/health',
      payloadKind: 'health',
      reason: 'The current provider keeps serving until the replacement proves healthy.',
      result: 'HTTP 200 twice; candidate remains at 0%',
      api: 'GET https://{candidateFqdn}/api/health',
      cutoverAfter: 'healthy',
    }),
    step({
      id: `${action}-route`,
      phase: 'activating',
      title: `Atomically switch YARP to ${targetVersion}`,
      source: 'regional',
      target: 'route',
      payload: 'retained static + compute route',
      payloadKind: 'route',
      reason: 'Static and compute destinations move to the selected version together.',
      result: `YARP targets ${targetVersion}; old provider retained`,
      api: 'IYarpClient.ActivateAppRouteAsync',
      cutoverAfter: 'switched',
    }),
    step({
      id: `${action}-verify`,
      phase: 'activating',
      title: 'Verify the selected version through the customer URL',
      source: 'route',
      target: 'customer',
      payload: 'GET /api/health',
      payloadKind: 'health',
      reason: 'The public response must identify the selected retained AppVersion.',
      result: `X-Embr-App-Version: ${targetVersion}`,
      api: 'GET https://shop.embr.example/api/health',
      cutoverAfter: 'verified',
    }),
    step({
      id: `${action}-promote`,
      phase: 'cleaningUp',
      title: `Promote ${targetVersion} and drain the old provider`,
      source: 'customer',
      target: 'app',
      payload: `activeAppVersionId: ${targetVersion}`,
      payloadKind: 'route',
      reason: 'The selected version becomes active only after public verification.',
      result: 'new provider active; old provider enters grace period',
      api: 'IBuilderAppRepository.UpdateWithRetryAsync(runtime.activeDeploymentId)',
      cutoverAfter: 'draining',
    }),
    step({
      id: `${action}-delete`,
      phase: 'succeeded',
      title: 'Delete the old provider after the grace period',
      source: 'regional',
      target: 'existing',
      payload: 'cleanup deadline elapsed',
      payloadKind: 'delete',
      reason: 'The previous resources remain available until route convergence and draining are safe.',
      result: 'old Artifact App and ADC Artifact deleted',
      api: 'DELETE .../artifactApps/{old}; DELETE .../artifacts/{old}',
      cutoverDuring: 'deleting',
      cutoverAfter: 'deleted',
    }),
  ]
}

export const scenarios: Scenario[] = [
  {
    id: 'manual',
    label: 'Manual deploy',
    title: 'Build and activate a new revision',
    summary: 'ARM admission, GitHub source, immutable outputs, a fresh candidate, public verification, then delayed predecessor cleanup.',
    oldVersion: 'v16',
    newVersion: 'v17',
    steps: manualSteps,
  },
  {
    id: 'push',
    label: 'GitHub push',
    title: 'Auto-deploy an exact push revision',
    summary: 'A signed push replaces manual admission and branch resolution; the same AppVersion and activation pipeline follows.',
    oldVersion: 'v16',
    newVersion: 'v17',
    nodeLabels: { client: 'GitHub push', arm: 'Webhook API' },
    steps: pushSteps,
  },
  {
    id: 'redeploy',
    label: 'Redeploy',
    title: 'Re-provision retained version v17',
    summary: 'No GitHub call and no build. A ready AppVersion creates a fresh provider and moves traffic with the same health gates.',
    oldVersion: 'v17-a',
    newVersion: 'v17-b',
    steps: retainedSteps('redeploy'),
  },
  {
    id: 'rollback',
    label: 'Rollback',
    title: 'Activate retained AppVersion v15',
    summary: 'A historical ready version receives fresh runtime resources, public verification, and an atomic route switch.',
    oldVersion: 'v17',
    newVersion: 'v15',
    steps: retainedSteps('rollback'),
  },
]

export function getScenario(id: Scenario['id']): Scenario {
  return scenarios.find((scenario) => scenario.id === id) ?? scenarios[0]
}

export function getCutoverState(
  scenario: Scenario,
  completedCount: number,
  activeStep?: FlowStep,
): CutoverState {
  if (activeStep?.cutoverDuring) return activeStep.cutoverDuring
  let state: CutoverState = 'existing'
  for (const item of scenario.steps.slice(0, completedCount)) {
    if (item.cutoverAfter) state = item.cutoverAfter
  }
  return state
}

export function getNodeLabel(node: SystemNode, scenario: Scenario): string {
  return scenario.nodeLabels?.[node.id] ?? node.label
}

const apiByNode: Record<NodeId, string> = {
  client: 'POST .../Microsoft.Web/builderApps/{name}/deploy\nGET {Azure-AsyncOperation}\nGET .../builderApps/{app}/deployments/{id}',
  arm: 'POST .../builderApps/{name}/deploy | redeploy | rollback\nGET .../operationStatuses/{deploymentId}',
  regional: 'POST /internal/regional/v1/builder-apps/deploy\nAppDeploymentService.TriggerAsync\nAppDeploymentService.ResumeAsync',
  deployment: 'IBuilderAppDeploymentRepository.CreateAsync\nTryClaimExecutionAsync\nUpdateWithRetryAsync\nReleaseDeploymentAsync',
  app: 'PUT | GET | PATCH | DELETE .../Microsoft.Web/builderApps/{name}\nTryAdmitDeploymentAsync',
  github: 'CreateInstallationToken\nGetBranchShaAsync\nGetFileContentAsync\nGetCloneUrlAsync',
  manifest: 'GET /repos/{owner}/{repo}/contents/builder.yaml?ref={sha}\nAppManifestDeserializer.Parse + Validate',
  version: 'GET .../builderApps/{app}/versions/{versionId}\nIAppVersionService.CreatePendingFromReferenceAsync',
  build: 'IBuildSandboxProvisioner.ProvisionAsync\nExecuteOryxBuildAsync\nSafeDeleteSandboxAsync',
  blob: 'GetStaticAssetsContainerSasUrlAsync\nazcopy copy --recursive --put-md5\nMarkStaticAssetsCompleteAsync',
  acr: 'POST {registry}/scheduleRun?api-version=2019-04-01\nGET {registry}/runs/{runId}',
  artifact: 'PUT | GET | DELETE .../providers/Microsoft.App/artifacts/{name}',
  candidate: 'PUT | GET | DELETE .../providers/Microsoft.App/artifactApps/{name}',
  health: 'GET https://{candidateFqdn}/{run.healthCheckPath}\nAppEndpointProbe.WaitForHealthyAsync',
  existing: 'IAppRouteActivator.ActivateAsync(previousVersion)\nDELETE old artifactApps + artifacts after grace',
  route: 'IYarpClient.ActivateAppRouteAsync\nIYarpClient.GetAppAsync\nCosmos ReplaceItemAsync(IfMatchEtag)',
  customer: 'GET https://{app-subdomain}/{run.healthCheckPath}\nExpect X-Embr-App-Version',
}

export function getNodeApi(id: NodeId): string {
  return apiByNode[id]
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export function getNodeExample(
  id: NodeId,
  scenario: Scenario,
  completedCount: number,
  cutover: CutoverState,
): ExampleDocument {
  const completedIds = new Set(scenario.steps.slice(0, completedCount).map((item) => item.id))
  const deploymentId = scenario.id === 'push' ? 'adp_push_9f42' : `adp_${scenario.id}`
  const versionId = scenario.id === 'rollback' ? 'avp_15' : 'avp_17'
  const versionCreated = scenario.id === 'redeploy' || scenario.id === 'rollback' || completedIds.has('create-version')
  const staticPublished = scenario.id === 'redeploy' || scenario.id === 'rollback' || completedIds.has('publish-static')
  const imagePublished = scenario.id === 'redeploy' || scenario.id === 'rollback' || completedIds.has('publish-image')
  const versionReady = scenario.id === 'redeploy' || scenario.id === 'rollback' || completedIds.has('seal-version')
  const candidateCreated = ['candidate', 'healthy', 'switched', 'verified', 'draining', 'deleting', 'deleted'].includes(cutover)
  const switched = ['switched', 'verified', 'draining', 'deleting', 'deleted'].includes(cutover)
  const promoted = ['draining', 'deleting', 'deleted'].includes(cutover)
  const image = 'embr.azurecr.io/builder/app_shop/api@sha256:71ab42d9c508...'
  const candidateName = `embr-${deploymentId.replace('adp_', '')}-7c2f`
  const candidateFqdn = `${candidateName}.westus3.azurecontainerapps.io`
  const staticReference = `static-assets/app_shop/${versionId}/web/site`

  switch (id) {
    case 'client':
      return {
        title: scenario.id === 'push' ? 'Signed GitHub push' : 'Builder CLI command',
        format: scenario.id === 'push' ? 'HTTP' : 'CLI',
        body: scenario.id === 'push'
          ? 'POST /webhooks/github\nX-GitHub-Event: push\nX-GitHub-Delivery: gh-921\nX-Hub-Signature-256: sha256=<verified-hmac>\n\n{ "after": "9f42c1e4a77...", "ref": "refs/heads/main" }'
          : `builder app deploy deployment-explorer-demo\n  --subscription 64fc8655-6859-4b06-96d2-df698d5808cc\n  --resource-group rg-builder-cli-demo-amahmoud11\n  --request-id demo-842`,
      }
    case 'arm':
      return {
        title: scenario.id === 'push' ? 'Webhook request' : 'ARM action response',
        format: 'HTTP',
        body: scenario.id === 'push'
          ? 'POST /webhooks/github\nX-GitHub-Event: push\n\n202 Accepted\n{ "received": true, "deploymentId": "adp_push_9f42" }'
          : `POST .../Microsoft.Web/builderApps/deployment-explorer-demo/${scenario.id === 'manual' ? 'deploy' : scenario.id}\n\n202 Accepted\nAzure-AsyncOperation: .../operationStatuses/${deploymentId}\nRetry-After: 5`,
      }
    case 'regional':
      return { title: 'StartAppDeploymentRequest', format: 'JSON', body: json({ appId: 'app_shop', deploymentId, action: scenario.id === 'manual' || scenario.id === 'push' ? 'deploy' : scenario.id, idempotencyKey: scenario.id === 'push' ? 'github:84721:9f42c1e...' : `${scenario.id}:demo-842`, sourceRevision: scenario.id === 'push' ? '9f42c1e4a77...' : undefined }) }
    case 'deployment':
      return { title: 'BuilderAppDeployment document', format: 'JSON', body: json({ id: deploymentId, appId: 'app_shop', appVersionId: versionId, status: completedCount === scenario.steps.length ? 'succeeded' : scenario.steps[completedCount]?.phase ?? 'pending', action: scenario.id === 'manual' || scenario.id === 'push' ? 'deploy' : scenario.id, candidateFqdn: candidateCreated ? candidateFqdn : undefined, publicUrl: switched ? 'https://deployment-explorer-demo.example' : undefined, previousDeploymentId: 'adp_previous', completedAt: completedCount === scenario.steps.length ? '2026-09-16T18:42:31Z' : undefined }) }
    case 'app':
      return { title: 'Microsoft.Web/builderApps resource', format: 'JSON', body: json({ name: 'deployment-explorer-demo', type: 'Microsoft.Web/builderApps', properties: { lifecycleId: 'alc_31', pendingDeploymentId: promoted ? null : deploymentId, runtime: { activeDeploymentId: promoted ? deploymentId : 'adp_previous', activeAppVersionId: promoted ? versionId : scenario.oldVersion, url: 'https://deployment-explorer-demo.example' } } }) }
    case 'github':
      return { title: 'GitHub source identity', format: 'JSON', body: json({ provider: 'github', id: '1211637325', displayName: 'amahmoud57/simple-python-notes-app', reference: 'demo/builder-deployment-explorer', revision: '9f42c1e4a77b81f6d49d3c2a...' }) }
    case 'manifest':
      return { title: 'builder.yaml', format: 'YAML', body: 'components:\n  - name: web\n    rootDirectory: deployment-explorer\n    path: /\n\n# Vite is detected from package.json\n# dist/ becomes immutable static output' }
    case 'version':
      if (!versionCreated) return { title: 'AppVersion before creation', format: 'JSON', body: json({ id: versionId, state: 'not created yet', createdFrom: ['exact GitHub revision', 'validated builder.yaml'] }) }
      return { title: 'Evolving BuilderAppVersion document', format: 'JSON', body: json({ id: versionId, appId: 'app_shop', source: { provider: 'github', id: '1211637325', reference: 'demo/builder-deployment-explorer', revision: '9f42c1e4a77...' }, manifest: { file: 'builder.yaml', components: [{ name: 'web', type: 'static', rootDirectory: 'deployment-explorer', path: '/' }] }, build: { status: versionReady ? 'ready' : 'building' }, outputs: [staticPublished ? { id: 'site', kind: 'static', reference: staticReference } : undefined, imagePublished ? { id: 'runtime', kind: 'compute', reference: image } : undefined].filter(Boolean) }) }
    case 'build':
      return { title: 'Temporary ADC build sandbox', format: 'SHELL', body: `sandboxId: sbx_build_${versionId}\nstate: ${versionReady ? 'deleted after publication' : versionCreated ? 'building' : 'not created'}\n\ngit fetch --depth 1 "$EMBR_CLONE_URL" "$EMBR_REVISION"\nnpm ci\nnpm run build` }
    case 'blob':
      return { title: 'Static output', format: 'JSON', body: json({ reference: staticReference, state: staticPublished ? 'complete' : 'not published', completionMarker: staticPublished, routes: staticPublished ? { exact: ['/index.html', '/assets/index.js'], spaFallback: '/index.html' } : undefined }) }
    case 'acr':
      return { title: 'ACR Task output', format: 'JSON', body: json({ runId: 'ca_01J8A4M2Z7', status: imagePublished ? 'Succeeded' : 'NotStarted', image: imagePublished ? image : 'embr.azurecr.io/builder/app_shop/api:avp_17', digest: imagePublished ? 'sha256:71ab42d9c508...' : null }) }
    case 'artifact':
      return { title: 'Microsoft.App/artifacts resource', format: 'JSON', body: json({ id: `/subscriptions/runtime-sub/resourceGroups/runtime-rg/providers/Microsoft.App/artifacts/${candidateName}`, type: 'Microsoft.App/artifacts', properties: { provisioningState: candidateCreated ? 'Succeeded' : 'NotCreated', source: { kind: 'registry', imageUrl: image }, latestVersionState: candidateCreated ? 'Ready' : null } }) }
    case 'candidate':
      return { title: 'Microsoft.App/artifactApps candidate', format: 'JSON', body: json({ id: `/subscriptions/runtime-sub/resourceGroups/runtime-rg/providers/Microsoft.App/artifactApps/${candidateName}`, type: 'Microsoft.App/artifactApps', properties: { provisioningState: candidateCreated ? 'Succeeded' : 'NotCreated', ingress: { external: true, targetPort: 8000, fqdn: candidateCreated ? candidateFqdn : null }, scale: { minReplicas: 1, maxReplicas: 1 } } }) }
    case 'health':
      return { title: 'Direct health response', format: 'HTTP', body: `GET https://${candidateFqdn}/api/health\n\nHTTP/1.1 ${cutover === 'healthy' || switched ? '200 OK' : '503 Starting'}\nContent-Type: application/json\n\n{ "status": "${cutover === 'healthy' || switched ? 'healthy' : 'starting'}" }` }
    case 'existing':
      return { title: 'Existing Artifact App', format: 'JSON', body: json({ appVersionId: scenario.oldVersion, resourceId: '/subscriptions/runtime-sub/resourceGroups/runtime-rg/providers/Microsoft.App/artifactApps/embr-existing', servingCustomerTraffic: !switched, state: cutover === 'deleted' ? 'deleted' : cutover === 'deleting' ? 'deleting' : promoted ? 'draining' : 'serving' }) }
    case 'route':
      return { title: 'YARP route document', format: 'JSON', body: json({ ownerId: 'app_shop', appVersionId: switched ? versionId : scenario.oldVersion, subdomain: 'deployment-explorer-demo.example', vms: [switched ? `https://${candidateFqdn}/` : 'https://embr-existing.westus3.azurecontainerapps.io/'], backendPrefixes: ['/api/'], staticRouting: { reference: switched ? staticReference : 'static-assets/app_shop/avp_previous/web/site' }, routeMutationFence: { routeEpoch: 24, executionEpoch: switched ? 3 : 2, step: 1 } }) }
    case 'customer':
      return { title: 'Customer route response', format: 'HTTP', body: `GET https://deployment-explorer-demo.example/api/health\n\nHTTP/1.1 200 OK\nX-Embr-App-Version: ${switched ? versionId : scenario.oldVersion}` }
  }
}
