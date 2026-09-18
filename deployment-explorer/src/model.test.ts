import { describe, expect, it } from 'vitest'
import {
  executionSurfaceLabels,
  getCutoverState,
  getNodeApi,
  getNodeExample,
  getScenario,
  nodes,
  scenarios,
} from './model'

describe('deployment model', () => {
  it('gives every scenario complete, directional step details', () => {
    for (const scenario of scenarios) {
      expect(scenario.steps.length).toBeGreaterThan(0)
      for (const step of scenario.steps) {
        expect(step.title).not.toBe('')
        expect(step.source).not.toBe(step.target)
        expect(step.payload).not.toBe('')
        expect(step.reason).not.toBe('')
        expect(step.result).not.toBe('')
        expect(step.api).not.toBe('')
        expect(executionSurfaceLabels[step.executionSurface]).toMatch(/^(ARM|NON-ARM)/)
        expect(`${step.title} ${step.payload} ${step.reason} ${step.result}`).not.toMatch(/\badapter\b/i)
      }
    }
  })

  it('classifies ARM, non-ARM, internal, and command execution surfaces', () => {
    const scenario = getScenario('manual')
    const surface = (id: string) => scenario.steps.find((step) => step.id === id)?.executionSurface

    expect(surface('arm-request')).toBe('armApi')
    expect(surface('regional-request')).toBe('nonArmApi')
    expect(surface('create-deployment')).toBe('internal')
    expect(surface('resolve-revision')).toBe('nonArmApi')
    expect(surface('checkout-source')).toBe('command')
    expect(surface('publish-static')).toBe('command')
    expect(surface('publish-image')).toBe('armApi')
    expect(surface('import-artifact')).toBe('armApi')
    expect(surface('direct-health')).toBe('nonArmApi')
    expect(surface('activate-route')).toBe('nonArmApi')
  })

  it('explains where public ARM ends and the private Regional API begins', () => {
    expect(getNodeApi('arm')).toContain('PUBLIC ARM API')
    expect(getNodeApi('arm')).toContain('202 + Azure-AsyncOperation')
    expect(getNodeApi('regional')).toContain('PRIVATE NON-ARM SERVICE API')
    expect(getNodeApi('regional')).toContain('ClusterIP only')
    expect(getNodeApi('regional')).toContain('workload identity token + mTLS')
    expect(getNodeApi('regional')).toContain('TriggerAsync (admit, resolve, persist + signal)')
    expect(getNodeApi('regional')).toContain('ResumeAsync (claim + execute)')
    expect(getNodeApi('regional')).toContain('AppPostDeploymentCleanupReconciler')
  })

  it('explains the AppVersion ready gate as concrete build and runtime settings', () => {
    const readyStep = getScenario('manual').steps.find((step) => step.id === 'finish-version-build')

    expect(readyStep?.title).toContain('build recipe and output')
    expect(readyStep?.reason).toContain('platform, commands, output directory, role, port, and health path')
    expect(readyStep?.reason).toContain('at least one immutable output')
  })

  it('defines AppVersion building as immutable output production, not runtime deployment', () => {
    const buildStep = getScenario('manual').steps.find((step) => step.id === 'start-version-build')

    expect(buildStep?.title).toBe('Begin producing deployable outputs')
    expect(buildStep?.reason).toContain('versioned Blob assets for static components')
    expect(buildStep?.reason).toContain('digest-pinned OCI image for compute')
    expect(buildStep?.reason).toContain('does not create runtime resources or move traffic')
    expect(buildStep?.result).toContain('runtime remains unchanged')
  })

  it('tracks native readiness, direct health, route switch, and background cleanup', () => {
    const scenario = getScenario('latest')
    const countAfter = (id: string) => scenario.steps.findIndex((step) => step.id === id) + 1

    expect(getCutoverState(scenario, 0)).toBe('existing')
    expect(getCutoverState(scenario, countAfter('create-candidate'))).toBe('nativeReady')
    expect(getCutoverState(scenario, countAfter('direct-health'))).toBe('healthy')
    expect(getCutoverState(scenario, countAfter('activate-route'))).toBe('switched')
    expect(getCutoverState(scenario, countAfter('promote-runtime'))).toBe('cleanupPending')
    expect(getCutoverState(scenario, scenario.steps.length - 1, scenario.steps.at(-1))).toBe('deleting')
    expect(getCutoverState(scenario, scenario.steps.length)).toBe('deleted')
  })

  it('shows the active ARM update path instead of gated webhook auto-deploy', () => {
    expect(scenarios.map((scenario) => scenario.id)).not.toContain('push')
    expect(scenarios.map((scenario) => scenario.label)).not.toContain('GitHub push')

    const latest = getScenario('latest')
    expect(latest.label).toBe('Deploy latest')
    expect(latest.summary).toContain('not a configuration update')
    expect(latest.steps[0].id).toBe('arm-request')
    expect(latest.steps[0].title).toBe('Request deployment of the latest source revision')
    expect(latest.steps[0].reason).toContain('not a configuration change')
    expect(latest.steps[0].executionSurface).toBe('armApi')
    expect(latest.steps.some((step) => step.id === 'resolve-revision')).toBe(true)
  })

  it('models ADC native readiness before one exact direct HTTP 200', () => {
    expect(nodes.map((node) => String(node.id))).not.toContain('health')
    expect(nodes.find((node) => node.id === 'version')?.group).toBe('control')
    expect(nodes.find((node) => node.id === 'existing')?.group).toBe('runtime')

    for (const scenario of scenarios) {
      const healthStep = scenario.steps.find((step) => step.id === 'direct-health' || step.id.endsWith('-health'))
      expect(healthStep?.target).toBe('candidate')

      const verificationStep = scenario.steps.find((step) => step.id === 'verify-customer-route' || step.id.endsWith('-verify'))
      expect(verificationStep?.source).toBe('customer')
      expect(verificationStep?.target).toBe('route')
    }

    const scenario = getScenario('manual')
    const nativeReady = getNodeExample('candidate', scenario, 0, 'nativeReady').body
    expect(nativeReady).toContain('"readinessProbe"')
    expect(nativeReady).toContain('"retainedByAdc": true')
    expect(nativeReady).toContain('"replicasReady": true')
    expect(nativeReady).toContain('"state": "checking"')

    const healthy = getNodeExample('candidate', scenario, 0, 'healthy').body
    expect(healthy).toContain('"expectedStatus": 200')
    expect(healthy).toContain('"state": "passed"')
    expect(healthy).not.toContain('successfulResponses')
  })

  it('keeps Blob Storage and its label above the customer traffic divider', () => {
    const blob = nodes.find((node) => node.id === 'blob')
    const trafficDividerY = 680 - 18 - 180

    expect(blob).toBeDefined()
    expect((blob?.y ?? 0) + 110).toBeLessThan(trafficDividerY)
  })

  it('models first deploy from an empty runtime without predecessor deletion', () => {
    const scenario = getScenario('manual')
    const countAfter = (id: string) => scenario.steps.findIndex((step) => step.id === id) + 1

    expect(scenario.label).toBe('First deploy')
    expect(scenario.hasExistingRuntime).toBe(false)
    expect(scenario.steps.some((step) => step.phase === 'postCleanup' && step.target === 'existing')).toBe(false)
    expect(scenario.steps.some((step) => step.id === 'post-deployment-cleanup')).toBe(true)
    expect(getCutoverState(scenario, 0)).toBe('empty')
    expect(getCutoverState(scenario, countAfter('activate-route'))).toBe('switched')
    expect(getCutoverState(scenario, scenario.steps.length)).toBe('active')
    expect(getNodeExample('existing', scenario, 0, 'empty').body).toContain('no Artifact App exists yet')
    expect(getNodeExample('route', scenario, 0, 'empty').body).toContain('"state": "not created"')
  })

  it('generates the customer hostname at route activation and persists it after verification', () => {
    const scenario = getScenario('manual')
    const activateIndex = scenario.steps.findIndex((step) => step.id === 'activate-route')
    const promoteIndex = scenario.steps.findIndex((step) => step.id === 'promote-runtime')
    const hostname = 'deployment-explorer-demo-c25af3b6.app.westus2.amahmoud11.embr-test.windows-int.net'

    const beforeRoute = getNodeExample('customer', scenario, 0, 'empty').body
    expect(beforeRoute).toContain('"generatedBy": "SubdomainHelper.ComputeAppSubdomain"')
    expect(beforeRoute).toContain('"appIdSuffix": "c25af3b6"')
    expect(beforeRoute).toContain('"routeState": "not created yet"')

    const route = getNodeExample('route', scenario, activateIndex + 1, 'switched').body
    expect(route).toContain(`"subdomain": "${hostname}"`)

    const operation = getNodeExample('deployment', scenario, activateIndex + 1, 'switched').body
    expect(operation).toContain(`"publicUrl": "https://${hostname}"`)

    const beforePromotion = getNodeExample('app', scenario, promoteIndex, 'verified').body
    expect(beforePromotion).toContain('"runtime": null')

    const promoted = getNodeExample('app', scenario, promoteIndex + 1, 'active').body
    expect(promoted).toContain(`"url": "https://${hostname}"`)
  })

  it('evolves AppVersion from absent to manifest-backed to ready outputs', () => {
    const scenario = getScenario('manual')
    const createIndex = scenario.steps.findIndex((step) => step.id === 'create-version')
    const buildIndex = scenario.steps.findIndex((step) => step.id === 'start-version-build')
    const readyIndex = scenario.steps.findIndex((step) => step.id === 'finish-version-build')

    expect(getNodeExample('version', scenario, createIndex, 'empty').body).toContain('not created yet')

    const created = getNodeExample('version', scenario, createIndex + 1, 'empty').body
    expect(created).toContain('builder.yaml')
    expect(created).toContain('9f42c1e4a77')
    expect(created).toContain('"status": "pending"')

    const building = getNodeExample('version', scenario, buildIndex + 1, 'empty').body
    expect(building).toContain('"status": "building"')

    const ready = getNodeExample('version', scenario, readyIndex + 1, 'empty').body
    expect(ready).toContain('"status": "ready"')
    expect(ready).toContain('static-assets/app_shop/ver_demo/web/site')
    expect(ready).toContain('@sha256:71ab42d9c508')
  })

  it('reserves the app and creates its AppVersion before persisting the operation', () => {
    const scenario = getScenario('manual')
    const ids = scenario.steps.map((step) => step.id)
    const reserveIndex = ids.indexOf('reserve-app')
    const versionIndex = ids.indexOf('create-version')
    const deploymentIndex = ids.indexOf('create-deployment')
    const resolveIndex = ids.indexOf('resolve-revision')
    const buildIndex = ids.indexOf('start-version-build')
    const readyIndex = ids.indexOf('finish-version-build')
    const provisionIndex = ids.indexOf('import-artifact')

    expect(reserveIndex).toBeGreaterThan(-1)
    expect(reserveIndex).toBeLessThan(resolveIndex)
    expect(resolveIndex).toBeLessThan(versionIndex)
    expect(versionIndex).toBeLessThan(deploymentIndex)
    expect(deploymentIndex).toBeLessThan(buildIndex)
    expect(versionIndex).toBeLessThan(buildIndex)
    expect(buildIndex).toBeLessThan(readyIndex)
    expect(readyIndex).toBeLessThan(provisionIndex)

    const initialApp = getNodeExample('app', scenario, 0, 'empty').body
    expect(initialApp).toContain('"sourceIntegrationState": "Configured"')
    expect(initialApp).toContain('"pendingDeploymentId": null')

    const reservedApp = getNodeExample('app', scenario, reserveIndex + 1, 'empty').body
    expect(reservedApp).toContain('"pendingDeploymentId": "adp_demo"')

    const beforeDeployment = getNodeExample('deployment', scenario, deploymentIndex, 'empty').body
    expect(beforeDeployment).toContain('"state": "not created yet"')

    const deployment = getNodeExample('deployment', scenario, deploymentIndex + 1, 'empty').body
    expect(deployment).toContain('"appVersionId": "ver_demo"')
    expect(deployment).toContain('"status": "building"')

    const versionBeforeDeployment = getNodeExample('version', scenario, deploymentIndex, 'empty').body
    expect(versionBeforeDeployment).toContain('"status": "pending"')
    expect(versionBeforeDeployment).not.toContain('not created yet')
  })

  it('distinguishes the durable operation from runtime deployment', () => {
    expect(nodes.find((node) => node.id === 'deployment')?.label).toBe('Deployment operation')

    const operationStep = getScenario('manual').steps.find((step) => step.id === 'create-deployment')
    expect(operationStep?.title).toBe('Persist the operation for the new AppVersion')
    expect(operationStep?.source).toBe('version')
    expect(operationStep?.reason).toContain('The AppVersion now exists')
    expect(operationStep?.result).toContain('appVersionId: ver_demo')
  })

  it('names the authenticated ARM identity fields instead of using an ambiguous caller label', () => {
    const scenario = getScenario('manual')
    const identityStep = scenario.steps.find((step) => step.id === 'regional-request')

    expect(identityStep?.title).toBe('Forward the authenticated ARM identity')
    expect(identityStep?.payload).toContain('Microsoft Entra tenant ID + object ID')
    expect(identityStep?.result).toContain('Entra identity { tenantId, objectId }')
    expect(`${identityStep?.title} ${identityStep?.payload}`).not.toMatch(/\bcaller\b/i)

    const request = getNodeExample('regional', scenario, 2, 'empty').body
    expect(request).toContain('"armCaller"')
    expect(request).toContain('"tenantId": "72f988bf-86f1-41af-91ab-2d7cd011db47"')
    expect(request).toContain('"objectId": "093b6f15-6e26-4906-b372-10c4fe0c3eb0"')
  })

  it('keeps retained-version flows free of GitHub and build sandbox steps', () => {
    const scenario = getScenario('redeploy')
    expect(scenario.steps.some((step) => step.source === 'github' || step.target === 'github')).toBe(false)
    expect(scenario.steps.some((step) => step.source === 'build' || step.target === 'build')).toBe(false)
    expect(scenarios.map((item) => item.id)).not.toContain('rollback')
  })

  it('marks deployment success before independently retried cleanup', () => {
    const scenario = getScenario('latest')
    const promoteIndex = scenario.steps.findIndex((step) => step.id === 'promote-runtime')
    const cleanup = scenario.steps.find((step) => step.id === 'post-deployment-cleanup')

    const promoted = getNodeExample('deployment', scenario, promoteIndex + 1, 'cleanupPending').body
    expect(promoted).toContain('"status": "succeeded"')
    expect(promoted).toContain('"postDeploymentCleanupStatus": "pending"')
    expect(cleanup?.phase).toBe('postCleanup')
    expect(cleanup?.reason).toContain('active AppVersion plus five distinct successful historical AppVersions')

    const cleaned = getNodeExample('deployment', scenario, scenario.steps.length, 'deleted').body
    expect(cleaned).toContain('"postDeploymentCleanupStatus": "completed"')
  })

  it('uses lifecycle ownership fields without invented route epoch fields', () => {
    const scenario = getScenario('latest')
    const route = getNodeExample('route', scenario, scenario.steps.length, 'deleted').body

    expect(route).toContain('"ownerId": "app_shop"')
    expect(route).toContain('"appLifecycleId": "alc_31"')
    expect(route).toContain('"appVersionId": "ver_latest"')
    expect(route).not.toContain('routeMutationFence')
    expect(route).not.toContain('routeEpoch')
    expect(route).not.toContain('executionEpoch')
  })

  it('documents that required authentication skips public route probing', () => {
    for (const scenario of scenarios) {
      const verificationStep = scenario.steps.find((step) => step.id === 'verify-customer-route' || step.id.endsWith('-verify'))
      expect(verificationStep?.reason).toContain('Required')
      expect(verificationStep?.reason).toContain('skip')
    }
  })
})
