import { describe, expect, it } from 'vitest'
import {
  getCutoverState,
  getNodeExample,
  getScenario,
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
      }
    }
  })

  it('tracks the old provider through candidate, switch, drain, and deletion', () => {
    const scenario = getScenario('push')
    const countAfter = (id: string) => scenario.steps.findIndex((step) => step.id === id) + 1

    expect(getCutoverState(scenario, 0)).toBe('existing')
    expect(getCutoverState(scenario, countAfter('create-candidate'))).toBe('candidate')
    expect(getCutoverState(scenario, countAfter('direct-health'))).toBe('healthy')
    expect(getCutoverState(scenario, countAfter('activate-route'))).toBe('switched')
    expect(getCutoverState(scenario, countAfter('promote-runtime'))).toBe('draining')
    expect(getCutoverState(scenario, scenario.steps.length - 1, scenario.steps.at(-1))).toBe('deleting')
    expect(getCutoverState(scenario, scenario.steps.length)).toBe('deleted')
  })

  it('models first deploy from an empty runtime without predecessor cleanup', () => {
    const scenario = getScenario('manual')
    const countAfter = (id: string) => scenario.steps.findIndex((step) => step.id === id) + 1

    expect(scenario.label).toBe('First deploy')
    expect(scenario.hasExistingRuntime).toBe(false)
    expect(scenario.steps.some((step) => step.id === 'delete-predecessor')).toBe(false)
    expect(getCutoverState(scenario, 0)).toBe('empty')
    expect(getCutoverState(scenario, countAfter('activate-route'))).toBe('switched')
    expect(getCutoverState(scenario, scenario.steps.length)).toBe('active')
    expect(getNodeExample('existing', scenario, 0, 'empty').body).toContain('no Artifact App exists yet')
    expect(getNodeExample('route', scenario, 0, 'empty').body).toContain('"state": "unassigned"')
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

  it('creates the pending Deployment before admitting the app and creating its AppVersion', () => {
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
    expect(deploymentIndex).toBeLessThan(reserveIndex)
    expect(reserveIndex).toBeLessThan(versionIndex)
    expect(reserveIndex).toBeLessThan(resolveIndex)
    expect(resolveIndex).toBeLessThan(versionIndex)
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
    expect(deployment).toContain('"status": "pending"')

    const reservedVersion = getNodeExample('version', scenario, deploymentIndex + 1, 'empty').body
    expect(reservedVersion).toContain('ID reserved by the pending Deployment')
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
    for (const id of ['redeploy', 'rollback'] as const) {
      const scenario = getScenario(id)
      expect(scenario.steps.some((step) => step.source === 'github' || step.target === 'github')).toBe(false)
      expect(scenario.steps.some((step) => step.source === 'build' || step.target === 'build')).toBe(false)
    }
  })
})
