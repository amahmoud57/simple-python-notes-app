export interface VersionConfiguration {
  variables: { name: string; value: string }[]
  components: { name: string }[]
}

export interface ScalingPolicy {
  components: {
    name: string
    minReplicas: number
    maxReplicas: number
    cpuUtilizationPercent: number
  }[]
}

export const configurationSteps = [
  { id: 'live', label: 'v1 is live', title: 'Two configurations. Different lifecycles.', summary: 'The version owns its frozen values. The app owns its current operating policy.', focus: 'both' },
  { id: 'edit', label: 'Edit version config', title: 'Change the next version, not the running one.', summary: 'Save CURRENCY=EUR on the app. The live v1 snapshot still says USD.', focus: 'desired' },
  { id: 'capture', label: 'Capture v2', title: 'A new AppVersion captures the edit.', summary: 'v2 freezes EUR with its source and manifest, then builds new outputs. v1 keeps serving.', focus: 'capture' },
  { id: 'activate', label: 'Deploy v2', title: 'v2 brings its own configuration.', summary: 'The release activates v2 and EUR. The app-wide scaling policy stays current.', focus: 'activate' },
  { id: 'policy', label: 'Change scaling', title: 'Change how the app runs.', summary: 'Save a new replica range and CPU target. Policy application is pending; no new version is created.', focus: 'policy' },
  { id: 'apply', label: 'Apply policy', title: 'New policy. Same AppVersion.', summary: 'Apply scaling to the active runtime without rebuilding or changing the frozen version values.', focus: 'apply' },
  { id: 'restore', label: 'Activate v1', title: 'Restore the version, not old app settings.', summary: 'A new deployment reuses v1 and USD. The current scaling policy stays in effect.', focus: 'restore' },
] as const

function versionConfiguration(currency: string): VersionConfiguration {
  return { variables: [{ name: 'CURRENCY', value: currency }], components: [{ name: 'api' }] }
}

function scalingPolicy(updated: boolean): ScalingPolicy {
  return { components: [{ name: 'api', minReplicas: updated ? 2 : 1, maxReplicas: updated ? 5 : 2, cpuUtilizationPercent: updated ? 60 : 70 }] }
}

export function getConfigurationState(position: number) {
  const index = Number.isFinite(position) ? Math.max(0, Math.min(Math.trunc(position), configurationSteps.length - 1)) : 0
  const desired = versionConfiguration(index >= 1 ? 'EUR' : 'USD')
  const versions = [
    { id: 'v1', configuration: versionConfiguration('USD') },
    ...(index >= 2 ? [{ id: 'v2', configuration: versionConfiguration('EUR') }] : []),
  ]
  const activeVersion = index >= 3 && index < 6 ? versions[1] : versions[0]
  const scaling = scalingPolicy(index >= 4)
  const appliedScaling = scalingPolicy(index >= 5)

  return {
    index,
    step: configurationSteps[index],
    complete: index === configurationSteps.length - 1,
    desired,
    versions,
    activeVersion,
    scaling,
    appliedScaling,
    policyPending: index === 4,
    desiredDiffers: desired.variables[0].value !== activeVersion.configuration.variables[0].value,
    deploymentId: index >= 6 ? 'adp_restore_v1' : index >= 3 ? 'adp_v2' : 'adp_v1',
  }
}

export function getConfigurationDocuments(position: number) {
  const state = getConfigurationState(position)
  return {
    app: {
      id: 'app_shop',
      versionConfiguration: state.desired,
      scaling: state.scaling,
      runtime: {
        activeDeploymentId: state.deploymentId,
        activeAppVersionId: state.activeVersion.id,
        versionConfiguration: state.activeVersion.configuration,
      },
    },
    versions: state.versions.map((version) => ({ id: version.id, configuration: version.configuration })),
  }
}