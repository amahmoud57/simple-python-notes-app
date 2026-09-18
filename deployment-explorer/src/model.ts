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
  | 'existing'
  | 'route'
  | 'customer'

export type Phase =
  | 'pending'
  | 'preparing'
  | 'building'
  | 'provisioning'
  | 'healthChecking'
  | 'activating'
  | 'postCleanup'
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

export type ExecutionSurface =
  | 'armApi'
  | 'nonArmApi'
  | 'internal'
  | 'command'

export type CutoverState =
  | 'empty'
  | 'existing'
  | 'candidate'
  | 'nativeReady'
  | 'healthy'
  | 'switched'
  | 'verified'
  | 'active'
  | 'cleanupPending'
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
  executionSurface: ExecutionSurface
  cutoverDuring?: CutoverState
  cutoverAfter?: CutoverState
}

export interface Scenario {
  id: 'manual' | 'latest' | 'redeploy'
  label: string
  title: string
  summary: string
  hasExistingRuntime: boolean
  oldVersion: string | null
  newVersion: string
  appVersionId: string
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
  preparing: 'Preparing source',
  building: 'Building',
  provisioning: 'Provisioning',
  healthChecking: 'Health check',
  activating: 'Activating',
  postCleanup: 'Background cleanup',
  succeeded: 'Succeeded',
}

export const executionSurfaceLabels: Record<ExecutionSurface, string> = {
  armApi: 'ARM API',
  nonArmApi: 'NON-ARM API',
  internal: 'NON-ARM · INTERNAL',
  command: 'NON-ARM · COMMAND',
}

export const nodes: SystemNode[] = [
  { id: 'client', label: 'Builder CLI', eyebrow: 'Customer client', x: 20, y: 38, group: 'control' },
  { id: 'arm', label: 'ARM API', eyebrow: 'Microsoft.Web', x: 184, y: 38, group: 'control' },
  { id: 'regional', label: 'Regional API', eyebrow: 'Orchestrator', x: 348, y: 38, group: 'control' },
  { id: 'app', label: 'Builder App', eyebrow: 'ARM resource', x: 512, y: 38, group: 'control' },
  { id: 'deployment', label: 'Deployment operation', eyebrow: 'Build + release workflow', x: 676, y: 38, group: 'control' },
  { id: 'version', label: 'AppVersion', eyebrow: 'Immutable build record', x: 840, y: 38, group: 'control' },
  { id: 'github', label: 'GitHub', eyebrow: 'Source provider', x: 48, y: 226, group: 'source' },
  { id: 'manifest', label: 'builder.yaml', eyebrow: 'Component manifest', x: 230, y: 205, group: 'source' },
  { id: 'build', label: 'ADC build sandbox', eyebrow: 'Ephemeral build', x: 382, y: 248, group: 'build' },
  { id: 'blob', label: 'Blob Storage', eyebrow: 'Static output', x: 390, y: 350, group: 'build' },
  { id: 'acr', label: 'Azure Container Registry', eyebrow: 'Compute output', x: 555, y: 260, group: 'build' },
  { id: 'artifact', label: 'ADC Artifact', eyebrow: 'Runtime image import', x: 810, y: 238, group: 'runtime' },
  { id: 'candidate', label: 'Artifact App candidate', eyebrow: 'New provider', x: 880, y: 380, group: 'runtime' },
  { id: 'existing', label: 'Existing Artifact App', eyebrow: 'Current provider', x: 690, y: 510, group: 'runtime' },
  { id: 'route', label: 'YARP route', eyebrow: 'Active backend pointer', x: 320, y: 530, group: 'traffic' },
  { id: 'customer', label: 'Customer URL', eyebrow: 'Embr-generated hostname', x: 54, y: 530, group: 'traffic' },
]

type FlowStepDefinition = Omit<FlowStep, 'executionSurface'> & {
  executionSurface?: ExecutionSurface
}

const step = (value: FlowStepDefinition): FlowStep => ({
  ...value,
  executionSurface: value.executionSurface ?? 'internal',
})

const demoCustomerHostname = 'deployment-explorer-demo-c25af3b6.app.westus2.amahmoud11.embr-test.windows-int.net'
const demoCustomerUrl = `https://${demoCustomerHostname}`

const createDeploymentStep = (deploymentId: string, appVersionId: string): FlowStep => step({
  id: 'create-deployment',
  phase: 'building',
  title: 'Persist the operation for the new AppVersion',
  source: 'version',
  target: 'deployment',
  payload: `${appVersionId} + runtime settings snapshot + previous provider`,
  payloadKind: 'resource',
  reason: 'The AppVersion now exists. Regional snapshots current settings, variables, linked services, and the previous provider into a durable Building operation that references it.',
  result: `Operation ${deploymentId}: building; appVersionId: ${appVersionId}; execution signaled`,
  api: 'IBuilderAppDeploymentRepository.CreateAsync(deployment with { AppVersionId = versionId })',
})

const sourceBuildSteps = (
  includeBranchResolution: boolean,
  deploymentId: string,
  appVersionId: string,
  versionLabel: string,
  hasExistingRuntime: boolean,
): FlowStep[] => [
  ...(includeBranchResolution
    ? [
        step({
          id: 'resolve-revision',
          phase: 'preparing',
          title: 'Resolve the configured branch to one commit',
          source: 'regional',
          target: 'github',
          payload: 'branch: main',
          payloadKind: 'request',
          reason: 'Regional asks GitHub for the current SHA of branch main. The build must use one immutable commit, not a moving branch name.',
          result: 'Source revision fixed at commit 9f42c1e4a77b...',
          api: 'GetBranchShaAsync(installationId, owner, repository, "main")',
          executionSurface: 'nonArmApi',
        }),
      ]
    : []),
  step({
    id: 'read-manifest',
    phase: 'preparing',
    title: 'Read and validate builder.yaml',
    source: 'github',
    target: 'manifest',
    payload: 'builder.yaml @ 9f42c1e',
    payloadKind: 'file',
    reason: 'Regional downloads builder.yaml at that exact commit and validates its components, routes, output directories, and health path.',
    result: 'Manifest accepted: web static component + API compute component',
    api: 'GET /repos/contoso/shop/contents/builder.yaml?ref=9f42c1e...',
    executionSurface: 'nonArmApi',
  }),
  step({
    id: 'create-version',
    phase: 'preparing',
    title: 'Create the pending AppVersion',
    source: 'manifest',
    target: 'version',
    payload: 'builder.yaml + commit SHA',
    payloadKind: 'file',
    reason: 'Regional creates the AppVersion document from the resolved commit and validated manifest. Every component starts pending with no outputs.',
    result: `AppVersion ${appVersionId}: pending; source and manifest are now immutable`,
    api: 'IAppVersionService.CreatePendingFromReferenceAsync(appId, versionId)',
  }),
  createDeploymentStep(deploymentId, appVersionId),
  step({
    id: 'start-version-build',
    phase: 'building',
    title: 'Begin producing deployable outputs',
    source: 'deployment',
    target: 'version',
    payload: 'exact source + builder.yaml component plan',
    payloadKind: 'build',
    reason: 'Building an AppVersion turns its pinned source into immutable outputs for every component: versioned Blob assets for static components and a digest-pinned OCI image for compute. It does not create runtime resources or move traffic.',
    result: `Operation ${deploymentId}: building; AppVersion ${appVersionId}: building; runtime remains unchanged`,
    api: 'Status = AppDeploymentStatus.Building -> EnsureVersionReadyAsync -> TryAcquireAsync',
  }),
  step({
    id: 'checkout-source',
    phase: 'building',
    title: 'Check out the exact revision',
    source: 'github',
    target: 'build',
    payload: 'source @ 9f42c1e',
    payloadKind: 'revision',
    reason: 'The temporary ADC sandbox checks out the exact commit recorded on the AppVersion, so every component sees the same source tree.',
    result: 'Commit 9f42c1e checked out at /app in the build sandbox',
    api: 'Sandboxes.ExecuteShellCommandAsync: git fetch --depth 1 $EMBR_CLONE_URL $EMBR_REVISION',
    executionSurface: 'command',
  }),
  step({
    id: 'build-components',
    phase: 'building',
    title: 'Run each component build',
    source: 'version',
    target: 'build',
    payload: 'component build plan',
    payloadKind: 'build',
    reason: 'Embr runs the selected build recipe for each component, such as a Vite static build or Python compute build, and captures what it produced.',
    result: 'Web build produced static files; API build produced a runnable Python output',
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
    reason: 'The web component files are uploaded under an immutable versioned Blob prefix that YARP can serve directly.',
    result: `Static output recorded at static-assets/app_shop/${appVersionId}/web/site`,
    api: 'azcopy copy /tmp/embr-static/* $EMBR_STATIC_SAS_URL --recursive --put-md5',
    executionSurface: 'command',
  }),
  step({
    id: 'publish-image',
    phase: 'building',
    title: 'Publish the compute image',
    source: 'build',
    target: 'acr',
    payload: 'OCI build context',
    payloadKind: 'image',
    reason: 'The API component output and entrypoint are packaged as an OCI image and pushed to ACR by digest.',
    result: 'Compute output recorded as api@sha256:71ab42d9c508...',
    api: 'POST {registryResourceId}/scheduleRun?api-version=2019-04-01',
    executionSurface: 'armApi',
  }),
  step({
    id: 'finish-version-build',
    phase: 'building',
    title: 'Confirm every component has a build recipe and output',
    source: 'build',
    target: 'version',
    payload: 'recorded build settings + immutable output references',
    payloadKind: 'resource',
    reason: 'For every component, Embr has recorded how to build and run it: platform, commands, output directory, role, port, and health path. Each component must also have at least one immutable output.',
    result: `AppVersion ${appVersionId}: ready; the operation may now provision runtime resources`,
    api: 'AppVersionBuildExecutionService.CompleteReadyAsync -> build.status = ready',
  }),
  step({
    id: 'import-artifact',
    phase: 'provisioning',
    title: 'Import the OCI image as an ADC Artifact',
    source: 'acr',
    target: 'artifact',
    payload: 'digest-pinned image',
    payloadKind: 'image',
    reason: 'The operation reads the ready AppVersion compute digest and imports that image into ADC for runtime provisioning.',
    result: 'ADC Artifact Version created from the recorded OCI digest: ready',
    api: 'PUT .../providers/Microsoft.App/artifacts/embr-{deploymentHash}',
    executionSurface: 'armApi',
  }),
  step({
    id: 'create-candidate',
    phase: 'provisioning',
    title: 'Create the candidate and wait for ADC native readiness',
    source: 'artifact',
    target: 'candidate',
    payload: 'Artifact Version + runtime settings + HTTP Readiness probe',
    payloadKind: 'resource',
    reason: hasExistingRuntime
      ? 'The active provider is never modified in place. Embr creates an isolated candidate with an ADC HTTP Readiness probe, confirms ADC retained that probe, then waits for every configured replica and app container to report Running, Started, and Ready.'
      : 'Embr creates the first provider with an ADC HTTP Readiness probe, confirms ADC retained that probe, then waits for every configured replica and app container to report Running, Started, and Ready.',
    result: 'ADC native readiness passed; candidate remains outside YARP traffic',
    api: 'ArtifactAppRuntimeProvider.CreateCandidateAsync -> WaitForReplicaReadinessAsync',
    executionSurface: 'armApi',
    cutoverDuring: 'candidate',
    cutoverAfter: 'nativeReady',
  }),
  step({
    id: 'direct-health',
    phase: 'healthChecking',
    title: 'Verify the candidate through its direct HTTPS endpoint',
    source: 'regional',
    target: 'candidate',
    payload: 'GET /api/health',
    payloadKind: 'health',
    reason: hasExistingRuntime
      ? 'Native readiness proves ADC can run the container, but not that direct ingress works. Embr requires one exact HTTP 200 from the allowlisted candidate FQDN while customer traffic stays on the old provider.'
      : 'Native readiness proves ADC can run the container, but not that direct ingress works. Embr requires one exact HTTP 200 from the allowlisted candidate FQDN before creating a public route.',
    result: hasExistingRuntime
      ? 'Direct HTTPS returned HTTP 200; candidate remains at 0%'
      : 'Direct HTTPS returned HTTP 200; public route remains unassigned',
    api: 'GET https://{candidateFqdn}/api/health',
    executionSurface: 'nonArmApi',
    cutoverAfter: 'healthy',
  }),
  step({
    id: 'activate-route',
    phase: 'activating',
    title: hasExistingRuntime
      ? 'Atomically switch YARP to the new version'
      : 'Generate the app URL and create its YARP route',
    source: 'regional',
    target: 'route',
    payload: hasExistingRuntime
      ? 'existing hostname + replacement route document'
      : 'app name + app ID suffix + routing domain + route document',
    payloadKind: 'route',
    reason: hasExistingRuntime
      ? 'The Builder App keeps its stable Embr hostname. YARP atomically replaces that hostname route so static paths, compute mounts, auth, and AppVersion identity all move together.'
      : 'Embr derives a stable hostname from the Builder App name, the last eight characters of its app ID, and the stamp routing domain, then creates the first YARP route for it.',
    result: hasExistingRuntime
      ? `${demoCustomerHostname} now routes to ${versionLabel}; the previous provider is unrouted and retained for verification`
      : `YARP route created: ${demoCustomerHostname} → ${versionLabel}`,
    api: 'IYarpClient.ActivateAppRouteAsync(new ActivateAppRouteRequest { OwnerId, AppLifecycleId, AppVersionId, Subdomain, Vms, BackendPrefixes, StaticRouting, Auth, AuthRevision })',
    executionSurface: 'nonArmApi',
    cutoverAfter: 'switched',
  }),
  step({
    id: 'verify-customer-route',
    phase: 'activating',
    title: 'Verify the new version through the customer URL',
    source: 'customer',
    target: 'route',
    payload: 'GET /api/health',
    payloadKind: 'health',
    reason: 'For this sample route, authentication is not Required, so Embr calls the generated hostname through YARP and requires HTTP 200 plus the expected AppVersion header. Required-auth routes skip this public probe.',
    result: `HTTP 200 + X-Embr-App-Version: ${appVersionId}`,
    api: `GET ${demoCustomerUrl}/api/health`,
    executionSurface: 'nonArmApi',
    cutoverAfter: 'verified',
  }),
  ...(hasExistingRuntime
    ? [
        step({
          id: 'promote-runtime',
          phase: 'succeeded',
          title: 'Promote runtime and mark the operation succeeded',
          source: 'customer',
          target: 'app',
          payload: `activeDeploymentId: ${deploymentId}`,
          payloadKind: 'route',
          reason: 'After route verification, Embr persists the new runtime, marks the operation Succeeded, releases the app slot, and records postDeploymentCleanupStatus=pending.',
          result: `${versionLabel} active; operation succeeded; previous provider is unrouted; background cleanup pending`,
          api: `IBuilderAppRepository.UpdateWithRetryAsync(runtime.activeDeploymentId = ${deploymentId})`,
          cutoverAfter: 'cleanupPending',
        }),
        step({
          id: 'post-deployment-cleanup',
          phase: 'postCleanup',
          title: 'Run durable post-deployment cleanup',
          source: 'regional',
          target: 'existing',
          payload: 'postDeploymentCleanupStatus: pending',
          payloadKind: 'delete',
          reason: 'A background reconciler processes successful operations independently. It deletes the previous Artifact App, keeps the active AppVersion plus five distinct successful historical AppVersions, and removes older Blob and ACR outputs. Failures leave cleanup pending for retry without changing deployment success.',
          result: 'previous Artifact App deleted; retention applied; postDeploymentCleanupStatus: completed',
          api: 'AppPostDeploymentCleanupReconciler -> AppPostDeploymentCleanupService.CleanupAsync',
          cutoverDuring: 'deleting',
          cutoverAfter: 'deleted',
        }),
      ]
    : [
        step({
          id: 'promote-runtime',
          phase: 'succeeded',
          title: 'Promote the first verified Deployment',
          source: 'customer',
          target: 'app',
          payload: `activeDeploymentId: ${deploymentId}`,
          payloadKind: 'route',
          reason: 'Only after the generated hostname succeeds through YARP does Embr create BuilderApp.runtime, mark the operation Succeeded, release the app slot, and queue post-deployment retention cleanup.',
          result: `BuilderApp.runtime.url saved; ${versionLabel} active; operation succeeded; background cleanup pending`,
          api: `IBuilderAppRepository.UpdateWithRetryAsync(runtime.activeDeploymentId = ${deploymentId})`,
          cutoverAfter: 'active',
        }),
        step({
          id: 'post-deployment-cleanup',
          phase: 'postCleanup',
          title: 'Complete background artifact retention cleanup',
          source: 'regional',
          target: 'deployment',
          payload: 'postDeploymentCleanupStatus: pending',
          payloadKind: 'delete',
          reason: 'The background reconciler applies the active-plus-five-history retention policy and marks cleanup complete. There is no previous Artifact App on a first deployment.',
          result: 'retention applied; postDeploymentCleanupStatus: completed',
          api: 'AppPostDeploymentCleanupReconciler -> AppArtifactRetentionService.CleanupAsync',
          cutoverAfter: 'active',
        }),
      ]),
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
    executionSurface: 'armApi',
  }),
  step({
    id: 'regional-request',
    phase: 'pending',
    title: 'Forward the authenticated ARM identity',
    source: 'arm',
    target: 'regional',
    payload: 'Microsoft Entra tenant ID + object ID + request ID demo-842',
    payloadKind: 'request',
    reason: 'Embr.Arm.Api has finished the public ARM protocol work. Its typed client now calls Regional over a private non-ARM API using the ARM service identity and mTLS.',
    result: 'ARM semantics end; Regional receives AppId, trigger metadata, and trusted Entra identity { tenantId, objectId }',
    api: 'StartAppDeploymentRequest { AppId, Trigger, ArmCaller }',
    executionSurface: 'nonArmApi',
  }),
  step({
    id: 'validate-app',
    phase: 'pending',
    title: 'Load and validate the Builder App configuration',
    source: 'regional',
    target: 'app',
    payload: 'Builder App ID: app_shop',
    payloadKind: 'resource',
    reason: 'Regional loads the existing Builder App and checks that source configuration, source authorization, managed identity, and the runtime provider are available.',
    result: 'Builder App configuration is valid; deployment ID adp_demo and AppVersion ID ver_demo are reserved',
    api: 'GetByIdAsync -> ValidateAppConfiguration -> runtimeProvider.IsConfigured',
  }),
  step({
    id: 'reserve-app',
    phase: 'pending',
    title: 'Reserve the Builder App for this operation',
    source: 'regional',
    target: 'app',
    payload: 'pendingDeploymentId: adp_demo',
    payloadKind: 'resource',
    reason: 'TriggerAsync admits one non-terminal operation at a time by atomically claiming the Builder App pendingDeploymentId slot before resolving source.',
    result: 'BuilderApp.pendingDeploymentId = adp_demo; no deployment operation document exists yet',
    api: 'TriggerInternalAsync -> AdmitAsync -> TryAdmitDeploymentAsync',
  }),
  ...sourceBuildSteps(true, 'adp_demo', 'ver_demo', 'v1', false),
]

const latestRevisionSteps: FlowStep[] = [
  step({
    id: 'arm-request',
    phase: 'pending',
    title: 'Request deployment of the latest source revision',
    source: 'client',
    target: 'arm',
    payload: 'POST /deploy + request ID',
    payloadKind: 'request',
    reason: 'This is a source deployment, not a configuration change. The customer asks Builder Apps to resolve and build the current head of its configured branch, then replace the active version.',
    result: '202 Accepted + Azure-AsyncOperation URL',
    api: 'POST .../Microsoft.Web/builderApps/shop/deploy?api-version=2026-08-01',
    executionSurface: 'armApi',
  }),
  step({
    id: 'regional-request',
    phase: 'pending',
    title: 'Forward the authenticated ARM identity',
    source: 'arm',
    target: 'regional',
    payload: 'Microsoft Entra tenant ID + object ID + request ID deploy-842',
    payloadKind: 'request',
    reason: 'Embr.Arm.Api has finished the public ARM protocol work. Its typed client now calls Regional over a private non-ARM API using the ARM service identity and mTLS.',
    result: 'ARM semantics end; Regional receives AppId, trigger metadata, and trusted Entra identity { tenantId, objectId }',
    api: 'StartAppDeploymentRequest { AppId, Trigger, ArmCaller }',
    executionSurface: 'nonArmApi',
  }),
  step({
    id: 'validate-app',
    phase: 'pending',
    title: 'Load and validate the Builder App configuration',
    source: 'regional',
    target: 'app',
    payload: 'Builder App ID: app_shop',
    payloadKind: 'resource',
    reason: 'Regional validates the existing Builder App, including its source authorization and active v16 runtime.',
    result: 'Builder App configuration valid; deployment ID adp_latest and AppVersion ID ver_latest are reserved',
    api: 'GetByIdAsync -> ValidateAppConfiguration -> runtimeProvider.IsConfigured',
  }),
  step({
    id: 'reserve-app',
    phase: 'pending',
    title: 'Reserve the Builder App for this operation',
    source: 'regional',
    target: 'app',
    payload: 'pendingDeploymentId: adp_latest',
    payloadKind: 'resource',
    reason: 'TriggerAsync claims the pendingDeploymentId slot before resolving the latest branch head, so two manual deployments cannot start concurrently.',
    result: 'BuilderApp.pendingDeploymentId = adp_latest; no deployment operation document exists yet',
    api: 'TriggerInternalAsync -> AdmitAsync -> TryAdmitDeploymentAsync',
  }),
  ...sourceBuildSteps(true, 'adp_latest', 'ver_latest', 'v17', true),
]

const redeploySteps: FlowStep[] = [
    step({
      id: 'redeploy-request',
      phase: 'pending',
      title: 'Request a retained-version redeploy',
      source: 'client',
      target: 'arm',
      payload: 'POST /redeploy',
      payloadKind: 'request',
      reason: 'The customer asks for fresh runtime resources without resolving GitHub or rebuilding source.',
      result: '202 Accepted + operation URL',
      api: 'POST .../Microsoft.Web/builderApps/shop/redeploy',
      executionSurface: 'armApi',
    }),
    step({
      id: 'redeploy-regional',
      phase: 'pending',
      title: 'Forward the authenticated redeploy request',
      source: 'arm',
      target: 'regional',
      payload: 'Microsoft Entra tenant ID + object ID + redeploy request ID',
      payloadKind: 'request',
      reason: 'ARM forwards identity from the authenticated Microsoft Entra principal together with the action metadata.',
      result: 'Regional receives AppId, trigger metadata, and Entra identity { tenantId, objectId }',
      api: 'AppDeploymentService.TriggerRedeployAsync',
      executionSurface: 'nonArmApi',
    }),
    step({
      id: 'redeploy-reserve-app',
      phase: 'pending',
      title: 'Validate and reserve the existing Builder App',
      source: 'regional',
      target: 'app',
      payload: 'app_shop + adp_redeploy',
      payloadKind: 'resource',
      reason: 'The Builder App already exists. Regional claims its one pending deployment slot.',
      result: 'BuilderApp.PendingDeploymentId = adp_redeploy',
      api: 'GetByIdAsync -> TryAdmitDeploymentAsync',
    }),
    step({
      id: 'redeploy-select-version',
      phase: 'provisioning',
      title: 'Select a reusable ready AppVersion',
      source: 'app',
      target: 'version',
      payload: 'active version, else newest successful ready version',
      payloadKind: 'resource',
      reason: 'Regional first tries the active deployment AppVersion. If there is no active runtime, it scans the current lifecycle for the newest successful deployment whose AppVersion is Ready and still has complete outputs.',
      result: 'ver_17 selected with retained immutable outputs; no source resolution or build required',
      api: 'ResolveReusableVersionAsync -> RequireReusableVersion',
    }),
    step({
      id: 'redeploy-create-deployment',
      phase: 'provisioning',
      title: 'Create an operation for the retained AppVersion',
      source: 'version',
      target: 'deployment',
      payload: 'ver_17 + current runtime settings snapshot',
      payloadKind: 'resource',
      reason: 'The retained AppVersion already exists and is ready, so the new operation can apply it without rebuilding source.',
      result: 'Operation adp_redeploy: provisioning, action: redeploy, appVersionId: ver_17',
      api: 'IBuilderAppDeploymentRepository.CreateAsync(deployment with { AppVersionId = retainedVersionId })',
    }),
    step({
      id: 'redeploy-artifact',
      phase: 'provisioning',
      title: 'Recreate the deployment-owned ADC Artifact',
      source: 'version',
      target: 'artifact',
      payload: 'retained OCI digest',
      payloadKind: 'image',
      reason: 'The new operation imports the retained image under its own deterministic resource ID.',
      result: 'new ADC Artifact Version: Ready',
      api: 'PUT .../providers/Microsoft.App/artifacts/embr-{newDeploymentHash}',
      executionSurface: 'armApi',
    }),
    step({
      id: 'redeploy-candidate',
      phase: 'provisioning',
      title: 'Create the candidate and wait for ADC native readiness',
      source: 'artifact',
      target: 'candidate',
      payload: 'ver_17 outputs + current settings + HTTP Readiness probe',
      payloadKind: 'resource',
      reason: 'Redeploy is still blue-green: Embr creates a fresh provider, confirms ADC retained the configured Readiness probe, and waits for every configured replica and app container to report Running, Started, and Ready.',
      result: 'ADC native readiness passed; new candidate remains outside YARP traffic',
      api: 'ArtifactAppRuntimeProvider.CreateCandidateAsync -> WaitForReplicaReadinessAsync',
      executionSurface: 'armApi',
      cutoverDuring: 'candidate',
      cutoverAfter: 'nativeReady',
    }),
    step({
      id: 'redeploy-health',
      phase: 'healthChecking',
      title: 'Verify the candidate through its direct HTTPS endpoint',
      source: 'regional',
      target: 'candidate',
      payload: 'GET /api/health',
      payloadKind: 'health',
      reason: 'Native readiness does not prove direct ingress. Embr requires one exact HTTP 200 while the current provider keeps serving.',
      result: 'Direct HTTPS returned HTTP 200; candidate remains at 0%',
      api: 'GET https://{candidateFqdn}/api/health',
      executionSurface: 'nonArmApi',
      cutoverAfter: 'healthy',
    }),
    step({
      id: 'redeploy-route',
      phase: 'activating',
      title: 'Atomically switch YARP to ver_17',
      source: 'regional',
      target: 'route',
      payload: 'retained static + compute route',
      payloadKind: 'route',
      reason: 'Static and compute destinations move to the selected version together.',
      result: 'YARP targets ver_17; old provider is now unrouted',
      api: 'IYarpClient.ActivateAppRouteAsync',
      executionSurface: 'nonArmApi',
      cutoverAfter: 'switched',
    }),
    step({
      id: 'redeploy-verify',
      phase: 'activating',
      title: 'Verify the selected version through the customer URL',
      source: 'customer',
      target: 'route',
      payload: 'GET /api/health',
      payloadKind: 'health',
      reason: 'For this sample route, authentication is not Required, so the public response must return HTTP 200 and identify the selected retained AppVersion. Required-auth routes skip this probe.',
      result: 'HTTP 200 + X-Embr-App-Version: ver_17',
      api: `GET ${demoCustomerUrl}/api/health`,
      executionSurface: 'nonArmApi',
      cutoverAfter: 'verified',
    }),
    step({
      id: 'redeploy-promote',
      phase: 'succeeded',
      title: 'Promote ver_17 and mark the operation succeeded',
      source: 'customer',
      target: 'app',
      payload: 'activeDeploymentId: adp_redeploy',
      payloadKind: 'route',
      reason: 'After route verification, Embr persists the new runtime, marks the operation Succeeded, releases the app slot, and records postDeploymentCleanupStatus=pending.',
      result: 'new provider active; operation succeeded; previous provider is unrouted; background cleanup pending',
      api: 'IBuilderAppRepository.UpdateWithRetryAsync(runtime.activeDeploymentId)',
      cutoverAfter: 'cleanupPending',
    }),
    step({
      id: 'redeploy-post-deployment-cleanup',
      phase: 'postCleanup',
      title: 'Run durable post-deployment cleanup',
      source: 'regional',
      target: 'existing',
      payload: 'postDeploymentCleanupStatus: pending',
      payloadKind: 'delete',
      reason: 'A background reconciler deletes the previous Artifact App, protects the active plus five successful historical AppVersions, removes older Blob/ACR outputs, and retries independently if cleanup fails.',
      result: 'previous Artifact App deleted; retention applied; postDeploymentCleanupStatus: completed',
      api: 'AppPostDeploymentCleanupReconciler -> AppPostDeploymentCleanupService.CleanupAsync',
      cutoverDuring: 'deleting',
      cutoverAfter: 'deleted',
    }),
]

export const scenarios: Scenario[] = [
  {
    id: 'manual',
    label: 'First deploy',
    title: 'Build and activate version 1',
    summary: 'Regional reserves the app, resolves source, creates AppVersion v1, then persists a Building operation. Runtime provisioning begins only after the AppVersion is ready.',
    hasExistingRuntime: false,
    oldVersion: null,
    newVersion: 'v1',
    appVersionId: 'ver_demo',
    nodeLabels: { existing: 'No active provider', candidate: 'First Artifact App' },
    steps: manualSteps,
  },
  {
    id: 'latest',
    label: 'Deploy latest',
    title: 'Build the latest source revision and replace v16',
    summary: 'This is not a configuration update. The ARM deploy action resolves the current configured branch head, builds a new AppVersion, and keeps v16 live until v17 passes health and YARP switches.',
    hasExistingRuntime: true,
    oldVersion: 'v16',
    newVersion: 'v17',
    appVersionId: 'ver_latest',
    steps: latestRevisionSteps,
  },
  {
    id: 'redeploy',
    label: 'Redeploy',
    title: 'Re-provision retained version v17',
    summary: 'No GitHub call and no build. A ready AppVersion creates a fresh provider and moves traffic with the same health gates.',
    hasExistingRuntime: true,
    oldVersion: 'v17-a',
    newVersion: 'v17-b',
    appVersionId: 'ver_17',
    steps: redeploySteps,
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
  let state: CutoverState = scenario.hasExistingRuntime ? 'existing' : 'empty'
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
  arm: 'PUBLIC ARM API · Microsoft.Web protocol adapter\n\nPOST /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/builderApps/{name}/deploy?api-version=...\n\nValidates ARM caller + subscription access + idempotency key\nReturns 202 + Azure-AsyncOperation + Retry-After\nCalls Regional through RegionalApiClient',
  regional: 'PRIVATE NON-ARM SERVICE API · ClusterIP only\nCaller: Embr.Arm.Api through RegionalApiClient\nAuth: ARM workload identity token + mTLS + service object-ID pin\n\nPOST /internal/regional/v1/builder-apps/deploy\n  -> AppDeploymentService.TriggerAsync (admit, resolve, persist + signal)\n\nBackground dispatcher/reconciler\n  -> AppDeploymentService.ResumeAsync (claim + execute)\n  -> AppPostDeploymentCleanupReconciler (retry cleanup)',
  deployment: 'IBuilderAppDeploymentRepository.CreateAsync\nTryClaimExecutionAsync\nUpdateWithRetryAsync\nReleaseDeploymentAsync',
  app: 'PUT | GET | PATCH | DELETE .../Microsoft.Web/builderApps/{name}\nTryAdmitDeploymentAsync',
  github: 'CreateInstallationToken\nGetBranchShaAsync\nGetFileContentAsync\nGetCloneUrlAsync',
  manifest: 'GET /repos/{owner}/{repo}/contents/builder.yaml?ref={sha}\nAppManifestDeserializer.Parse + Validate',
  version: 'GET .../builderApps/{app}/versions/{versionId}\nIAppVersionService.CreatePendingFromReferenceAsync',
  build: 'IBuildSandboxProvisioner.ProvisionAsync\nExecuteOryxBuildAsync\nSafeDeleteSandboxAsync',
  blob: 'GetStaticAssetsContainerSasUrlAsync\nazcopy copy --recursive --put-md5\nMarkStaticAssetsCompleteAsync',
  acr: 'POST {registry}/scheduleRun?api-version=2019-04-01\nGET {registry}/runs/{runId}',
  artifact: 'PUT | GET | DELETE .../providers/Microsoft.App/artifacts/{name}',
  candidate: 'PUT | GET | DELETE .../providers/Microsoft.App/artifactApps/{name}\nWaitForReplicaReadinessAsync (probe retained + replicas/containers Running, Started, Ready)\nGET https://{candidateFqdn}/{run.healthCheckPath}\nAppEndpointProbe.WaitForHealthyAsync (one exact HTTP 200)',
  existing: 'Previous Artifact App becomes unrouted at activation\nAppPostDeploymentCleanupReconciler deletes it after deployment success',
  route: 'IYarpClient.ActivateAppRouteAsync(ActivateAppRouteRequest)\nFields: ownerId, appLifecycleId, appVersionId, subdomain, vms, backendPrefixes, staticRouting, auth, authRevision\nLifecycle ownership prevents an older app incarnation from taking over the route.',
  customer: 'SubdomainHelper.ComputeAppSubdomain(app.Name, app.Id, routingDomain)\n  -> {sanitized-name}-{last-8-of-app-id}.{routingDomain}\n\nAppRouteActivator.ActivateAsync\n  -> IYarpClient.ActivateAppRouteAsync(request)\n\nUnless auth mode is Required:\nGET https://{generated-hostname}/{healthCheckPath}\n  -> expect HTTP 200 + X-Embr-App-Version\n\nAfter verification: BuilderApp.runtime.url = https://{generated-hostname}',
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
  const deploymentId = scenario.id === 'manual'
    ? 'adp_demo'
    : scenario.id === 'latest'
      ? 'adp_latest'
      : `adp_${scenario.id}`
  const versionId = scenario.appVersionId
  const versionCreated = scenario.id === 'redeploy' || completedIds.has('create-version')
  const deploymentCreated = completedIds.has('create-deployment')
    || [...completedIds].some((item) => item.endsWith('-create-deployment'))
  const appReserved = completedIds.has('reserve-app')
    || [...completedIds].some((item) => item.endsWith('-reserve-app'))
  const staticPublished = scenario.id === 'redeploy' || completedIds.has('publish-static')
  const imagePublished = scenario.id === 'redeploy' || completedIds.has('publish-image')
  const versionBuilding = scenario.id === 'redeploy' || completedIds.has('start-version-build')
  const versionReady = scenario.id === 'redeploy' || completedIds.has('finish-version-build')
  const candidateCreated = ['candidate', 'nativeReady', 'healthy', 'switched', 'verified', 'active', 'cleanupPending', 'deleting', 'deleted'].includes(cutover)
  const candidateNativeReady = ['nativeReady', 'healthy', 'switched', 'verified', 'active', 'cleanupPending', 'deleting', 'deleted'].includes(cutover)
  const candidateHealthy = ['healthy', 'switched', 'verified', 'active', 'cleanupPending', 'deleting', 'deleted'].includes(cutover)
  const switched = ['switched', 'verified', 'active', 'cleanupPending', 'deleting', 'deleted'].includes(cutover)
  const promoted = ['active', 'cleanupPending', 'deleting', 'deleted'].includes(cutover)
  const cleanupCompleted = [...completedIds].some((item) => item.endsWith('post-deployment-cleanup'))
  const deploymentStatus = promoted
    ? 'succeeded'
    : switched
      ? 'activating'
      : candidateCreated
        ? 'provisioning'
        : versionReady
          ? 'provisioning'
          : versionBuilding
            ? 'building'
            : deploymentCreated
              ? scenario.id === 'redeploy' ? 'provisioning' : 'building'
              : 'pending'
  const image = `embr.azurecr.io/builder/app_shop/api@sha256:71ab42d9c508...`
  const candidateName = `embr-${deploymentId.replace('adp_', '')}-7c2f`
  const candidateFqdn = `${candidateName}.westus3.azurecontainerapps.io`
  const staticReference = `static-assets/app_shop/${versionId}/web/site`

  switch (id) {
    case 'client':
      return {
        title: 'Builder CLI command',
        format: 'CLI',
        body: `builder app deploy deployment-explorer-demo\n  --subscription 64fc8655-6859-4b06-96d2-df698d5808cc\n  --resource-group rg-builder-cli-demo-amahmoud11\n  --request-id demo-842`,
      }
    case 'arm':
      return {
        title: 'ARM action response',
        format: 'HTTP',
        body: `POST .../Microsoft.Web/builderApps/deployment-explorer-demo/${scenario.id === 'manual' || scenario.id === 'latest' ? 'deploy' : scenario.id}\n\n202 Accepted\nAzure-AsyncOperation: .../operationStatuses/${deploymentId}\nRetry-After: 5`,
      }
    case 'regional':
      return {
        title: 'Internal StartAppDeploymentRequest',
        format: 'JSON',
        body: json({
          appId: 'app_shop',
          trigger: {
            kind: 'manual',
            idempotencyKey: `${scenario.id}:demo-842`,
            requestedBy: '093b6f15-6e26-4906-b372-10c4fe0c3eb0',
          },
          armCaller: {
            tenantId: '72f988bf-86f1-41af-91ab-2d7cd011db47',
            objectId: '093b6f15-6e26-4906-b372-10c4fe0c3eb0',
          },
        }),
      }
    case 'deployment':
      if (!deploymentCreated) return { title: 'Deployment before creation', format: 'JSON', body: json({ id: deploymentId, state: 'not created yet', waitingFor: 'validated Builder App configuration and trigger metadata' }) }
      return { title: 'BuilderAppDeployment operation document', format: 'JSON', body: json({ id: deploymentId, appId: 'app_shop', appVersionId: versionId, status: deploymentStatus, action: scenario.id === 'manual' || scenario.id === 'latest' ? 'deploy' : scenario.id, candidateFqdn: candidateCreated ? candidateFqdn : undefined, publicUrl: switched ? demoCustomerUrl : undefined, previousDeploymentId: scenario.hasExistingRuntime ? 'adp_previous' : undefined, postDeploymentCleanupStatus: promoted ? cleanupCompleted ? 'completed' : 'pending' : undefined, completedAt: promoted ? '2026-09-16T18:42:31Z' : undefined }) }
    case 'app':
      return { title: 'Pre-existing Microsoft.Web/builderApps resource', format: 'JSON', body: json({ name: 'deployment-explorer-demo', type: 'Microsoft.Web/builderApps', properties: { lifecycleId: 'alc_31', sourceIntegrationState: 'Configured', pendingDeploymentId: appReserved && !promoted ? deploymentId : null, runtime: promoted ? { activeDeploymentId: deploymentId, activeAppVersionId: versionId, url: demoCustomerUrl } : scenario.hasExistingRuntime ? { activeDeploymentId: 'adp_previous', activeAppVersionId: scenario.oldVersion, url: demoCustomerUrl } : null } }) }
    case 'github':
      return { title: 'GitHub source identity', format: 'JSON', body: json({ provider: 'github', id: '1211637325', displayName: 'amahmoud57/simple-python-notes-app', reference: 'demo/builder-deployment-explorer', revision: '9f42c1e4a77b81f6d49d3c2a...' }) }
    case 'manifest':
      return { title: 'builder.yaml', format: 'YAML', body: 'components:\n  - name: web\n    rootDirectory: frontend\n    path: /\n  - name: api\n    rootDirectory: backend\n    path: /api\n    run:\n      healthCheckPath: /health\n\n# web produces static output\n# api produces compute output' }
    case 'version':
      if (!versionCreated) return { title: 'AppVersion before creation', format: 'JSON', body: json({ id: versionId, state: 'not created yet', waitingFor: ['exact GitHub revision', 'validated builder.yaml'] }) }
      return {
        title: 'Evolving BuilderAppVersion document',
        format: 'JSON',
        body: json({
          id: versionId,
          appId: 'app_shop',
          source: { provider: 'github', id: '1211637325', reference: 'demo/builder-deployment-explorer', revision: '9f42c1e4a77...' },
          manifest: { file: 'builder.yaml', components: [{ name: 'web', type: 'static', path: '/' }, { name: 'api', type: 'compute', path: '/api' }] },
          build: {
            status: versionReady ? 'ready' : versionBuilding ? 'building' : 'pending',
            components: [
              {
                stepId: 'build:web',
                name: 'web',
                status: staticPublished ? 'ready' : versionBuilding ? 'building' : 'pending',
                outputs: staticPublished ? [{ id: 'site', kind: 'static', reference: staticReference }] : [],
              },
              {
                stepId: 'build:api',
                name: 'api',
                status: imagePublished ? 'ready' : staticPublished ? 'building' : 'pending',
                outputs: imagePublished ? [{ id: 'runtime', kind: 'compute', reference: image }] : [],
              },
            ],
            completedAt: versionReady ? '2026-09-16T18:41:52Z' : undefined,
          },
        }),
      }
    case 'build':
      return { title: 'Temporary ADC build sandbox', format: 'SHELL', body: `sandboxId: sbx_build_${versionId}\nstate: ${versionReady ? 'deleted after publication' : versionBuilding ? 'building' : 'not created'}\n\ngit fetch --depth 1 "$EMBR_CLONE_URL" "$EMBR_REVISION"\nnpm ci\nnpm run build` }
    case 'blob':
      return { title: 'Static output', format: 'JSON', body: json({ reference: staticReference, state: staticPublished ? 'complete' : 'not published', completionMarker: staticPublished, routes: staticPublished ? { exact: ['/index.html', '/assets/index.js'], spaFallback: '/index.html' } : undefined }) }
    case 'acr':
      return { title: 'ACR Task output', format: 'JSON', body: json({ runId: 'ca_01J8A4M2Z7', status: imagePublished ? 'Succeeded' : 'NotStarted', image: imagePublished ? image : `embr.azurecr.io/builder/app_shop/api:${versionId}`, digest: imagePublished ? 'sha256:71ab42d9c508...' : null }) }
    case 'artifact':
      return { title: 'Microsoft.App/artifacts resource', format: 'JSON', body: json({ id: `/subscriptions/runtime-sub/resourceGroups/runtime-rg/providers/Microsoft.App/artifacts/${candidateName}`, type: 'Microsoft.App/artifacts', properties: { provisioningState: candidateCreated ? 'Succeeded' : 'NotCreated', source: { kind: 'registry', imageUrl: image }, latestVersionState: candidateCreated ? 'Ready' : null } }) }
    case 'candidate':
      return { title: 'Microsoft.App/artifactApps candidate', format: 'JSON', body: json({ id: `/subscriptions/runtime-sub/resourceGroups/runtime-rg/providers/Microsoft.App/artifactApps/${candidateName}`, type: 'Microsoft.App/artifactApps', properties: { provisioningState: candidateCreated ? 'Succeeded' : 'NotCreated', ingress: { external: true, targetPort: 8000, fqdn: candidateCreated ? candidateFqdn : null }, scale: { minReplicas: 1, maxReplicas: 1 }, readinessProbe: candidateCreated ? { type: 'Http', path: '/api/health', port: 8000, retainedByAdc: candidateNativeReady, replicasReady: candidateNativeReady } : null, directHealthGate: candidateCreated ? { endpoint: `https://${candidateFqdn}/api/health`, expectedStatus: 200, state: candidateHealthy ? 'passed' : candidateNativeReady ? 'checking' : 'waitingForNativeReadiness' } : null } }) }
    case 'existing':
      if (!scenario.hasExistingRuntime) return { title: 'Runtime before first deployment', format: 'JSON', body: json({ resourceId: null, appVersionId: null, state: 'no Artifact App exists yet', servingCustomerTraffic: false }) }
      return { title: 'Existing Artifact App', format: 'JSON', body: json({ appVersionId: scenario.oldVersion, resourceId: '/subscriptions/runtime-sub/resourceGroups/runtime-rg/providers/Microsoft.App/artifactApps/embr-existing', servingCustomerTraffic: !switched, state: cutover === 'deleted' ? 'deleted' : cutover === 'deleting' ? 'deleting' : promoted ? 'unroutedCleanupPending' : switched ? 'unroutedRetainedForVerification' : 'serving' }) }
    case 'route':
      return { title: 'YARP route document', format: 'JSON', body: json({ ownerId: 'app_shop', appLifecycleId: switched || scenario.hasExistingRuntime ? 'alc_31' : null, state: switched || scenario.hasExistingRuntime ? 'assigned' : 'not created', hostnameGeneratedBy: 'SubdomainHelper.ComputeAppSubdomain(appName, appId, routingDomain)', subdomain: switched || scenario.hasExistingRuntime ? demoCustomerHostname : null, appVersionId: switched ? versionId : scenario.oldVersion, vms: switched ? [`https://${candidateFqdn}/`] : scenario.hasExistingRuntime ? ['https://embr-existing.westus3.azurecontainerapps.io/'] : [], backendPrefixes: switched || scenario.hasExistingRuntime ? ['/api/'] : [], staticRouting: switched ? { reference: staticReference } : scenario.hasExistingRuntime ? { reference: 'static-assets/app_shop/ver_previous/web/site' } : null }) }
    case 'customer':
      if (!scenario.hasExistingRuntime && !switched) return { title: 'Generated hostname before route activation', format: 'JSON', body: json({ generatedBy: 'SubdomainHelper.ComputeAppSubdomain', inputs: { appName: 'deployment-explorer-demo', appIdSuffix: 'c25af3b6', routingDomain: 'app.westus2.amahmoud11.embr-test.windows-int.net' }, hostname: demoCustomerHostname, routeState: 'not created yet', reachable: false }) }
      return { title: 'Customer route response', format: 'HTTP', body: `GET ${demoCustomerUrl}/api/health\n\nHTTP/1.1 200 OK\nX-Embr-App-Version: ${switched ? versionId : scenario.oldVersion}` }
  }
}
