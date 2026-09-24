import type { Scenario } from './model'

// The example variable is baked into both the build and the runtime, so a version is only correct
// with the value it was built and tested with.
export const configVariable = 'API_URL'
export const legacyApiHost = 'legacy.contoso.com'
export const currentApiHost = 'api.contoso.com'

export interface ScalingPolicy {
  minReplicas: number
  maxReplicas: number
  cpuUtilizationPercent: number
}

export const baseScaling: ScalingPolicy = { minReplicas: 1, maxReplicas: 3, cpuUtilizationPercent: 70 }
export const updatedScaling: ScalingPolicy = { minReplicas: 2, maxReplicas: 6, cpuUtilizationPercent: 60 }

export type DesiredConfigurationUse = 'captured' | 'matched' | 'unused' | 'saved' | 'idle'

/** The API_URL that each illustrative AppVersion froze when it was created. */
export function versionHost(version: string | null): string | null {
  if (version === null) return null
  return version.replace(/-[ab]$/, '') === 'v16' ? legacyApiHost : currentApiHost
}

export function versionConfiguration(host: string) {
  return {
    variables: [{ name: configVariable, value: `https://${host}` }],
    components: [{ name: 'web' }, { name: 'api' }],
  }
}

export function scalingDocument(policy: ScalingPolicy) {
  return { components: [{ name: 'api', ...policy }] }
}

/** The scale block Embr sends to ADC for the api compute component. */
export function artifactAppScale(policy: ScalingPolicy) {
  return {
    minReplicas: policy.minReplicas,
    maxReplicas: policy.maxReplicas,
    rules: [{ name: 'cpu', type: 'cpu', metadata: { type: 'Utilization', value: String(policy.cpuUtilizationPercent) } }],
  }
}

export function formatScaling(policy: ScalingPolicy) {
  return `${policy.minReplicas}–${policy.maxReplicas} replicas · CPU ${policy.cpuUtilizationPercent}%`
}

export function getConfigurationState(scenario: Scenario, completedCount: number) {
  const done = new Set(scenario.steps.slice(0, completedCount).map((step) => step.id))
  const configSaved = scenario.kind === 'config' && done.has('config-persist')
  const scalingSaved = scenario.kind === 'scale' && done.has('scale-persist')
  const desiredUse: DesiredConfigurationUse = scenario.kind === 'config'
    ? 'saved'
    : scenario.kind === 'scale'
      ? 'idle'
      : scenario.id === 'redeploy' || scenario.id === 'activate'
        ? 'unused'
        : scenario.id === 'commit' ? 'matched' : 'captured'

  return {
    desiredHost: scenario.kind === 'config' && !configSaved ? legacyApiHost : currentApiHost,
    previousDesiredHost: configSaved ? legacyApiHost : null,
    desiredUse,
    scaling: scalingSaved ? updatedScaling : baseScaling,
    previousScaling: scalingSaved ? baseScaling : null,
    liveScaling: scenario.kind === 'scale' && done.has('scale-apply') ? updatedScaling : baseScaling,
    liveHost: versionHost(scenario.oldVersion),
    nextHost: scenario.kind === 'deployment' ? versionHost(scenario.newVersion) : null,
  }
}