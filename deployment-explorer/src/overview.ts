import { getCutoverState, type Scenario } from './model'
import { versionConfiguration } from './configuration'

export interface OverviewMilestone {
  id: 'select' | 'build' | 'publish' | 'artifact' | 'candidate' | 'check' | 'release' | 'verify' | 'cleanup'
  label: string
  station: string
  context: string
  handoff: string
  payload: string
  title: string
  description: string
  result: string
  start: number
  end: number
}

export const overviewStories: Record<Scenario['id'], { title: string }> = {
  manual: {
    title: 'From source to a running app.',
  },
  latest: {
    title: 'Ship what is next. Keep serving.',
  },
  commit: {
    title: 'Choose exactly what goes live.',
  },
  redeploy: {
    title: 'Fresh runtime. Same version.',
  },
  activate: {
    title: 'Return to a known version.',
  },
}

export function getOverviewMilestones(scenario: Scenario): OverviewMilestone[] {
  const builds = scenario.steps.some((step) => step.phase === 'building')
  const operationIndex = scenario.steps.findIndex((step) => step.target === 'deployment')
  const builtEnd = scenario.steps.findIndex((step) => step.id === 'build-components') + 1
  const artifactIndex = scenario.steps.findIndex((step) => step.target === 'artifact')
  const candidateIndex = scenario.steps.findIndex((step) => step.cutoverDuring === 'candidate')
  const nativeReadyEnd = scenario.steps.findIndex((step) => step.cutoverAfter === 'nativeReady') + 1
  const healthyEnd = scenario.steps.findIndex((step) => step.cutoverAfter === 'healthy') + 1
  const routeEnd = scenario.steps.findIndex((step) => step.cutoverAfter === 'switched') + 1
  const releaseEnd = scenario.steps.findIndex((step) => step.phase === 'succeeded') + 1
  const boundaries = [0, operationIndex, ...(builds ? [builtEnd] : []), artifactIndex, candidateIndex, nativeReadyEnd, healthyEnd, routeEnd, releaseEnd, scenario.steps.length]

  if (boundaries.some((boundary, index) => index > 0 && boundary <= boundaries[index - 1])) {
    throw new Error(`Scenario ${scenario.id} does not contain an ordered overview journey`)
  }

  const milestones: Omit<OverviewMilestone, 'start' | 'end'>[] = [
    {
      id: 'select',
      label: builds || scenario.id === 'commit' ? 'Choose source' : 'Choose version',
      station: builds || scenario.id === 'commit' ? 'Customer GitHub' : 'Embr AppVersion',
      context: builds || scenario.id === 'commit' ? 'Customer-owned source' : 'Retained build record',
      handoff: builds || scenario.id === 'commit' ? 'Pin commit' : 'Select version',
      payload: builds || scenario.id === 'commit' ? 'Pinned commit' : 'Retained version',
      title: builds || scenario.id === 'commit' ? 'Pin the source.' : 'Select a retained version.',
      description: builds ? 'Embr pins the customer repo commit, manifest, and configuration in an AppVersion.' : 'Embr selects retained outputs and the version\'s frozen configuration.',
      result: 'Source and configuration selected.',
    },
    ...(builds ? [{
      id: 'build' as const,
      label: 'Build',
      station: 'ADC build sandbox',
      context: 'Embr-managed build job',
      handoff: 'Check out commit',
      payload: 'Source code',
      title: 'Build the frontend and API.',
      description: 'Embr checks out the customer commit and builds its components in a temporary ADC sandbox.',
      result: 'Component builds complete.',
    }] : []),
    {
      id: 'publish',
      label: builds ? 'Package & publish' : 'Reuse outputs',
      station: 'Embr ACR',
      context: 'Embr-owned image registry',
      handoff: builds ? 'Publish OCI image' : 'Reuse image digest',
      payload: builds ? 'OCI image' : 'Retained OCI image',
      title: builds ? 'Package the build into Embr ACR.' : 'Reuse the image in Embr ACR.',
      description: builds ? 'Embr packages the API as an OCI image in its ACR. Static files go to Embr Blob Storage.' : 'Use the saved digest in Embr ACR and retained static files. No build or push.',
      result: 'Immutable build outputs ready.',
    },
    {
      id: 'artifact',
      label: 'Import artifact',
      station: 'ADC Artifact',
      context: 'Embr pull identity + AcrPull',
      handoff: 'ADC pulls OCI',
      payload: 'Image digest',
      title: 'ADC pulls from Embr ACR.',
      description: 'ADC imports the pinned OCI image as an Artifact Version using Embr\'s managed identity with AcrPull.',
      result: 'ADC Artifact ready.',
    },
    {
      id: 'candidate',
      label: 'Create app',
      station: 'ADC Artifact App',
      context: 'Runs the Artifact Version',
      handoff: 'Start version',
      payload: 'Artifact version',
      title: 'Start an app from the imported version.',
      description: 'Embr asks ADC to run the ready Artifact Version. The app does not pull directly from ACR.',
      result: 'Artifact App running; native readiness passed.',
    },
    {
      id: 'check',
      label: 'Check health',
      station: 'Embr health check',
      context: 'Direct ADC app endpoint',
      handoff: 'HTTPS probe',
      payload: 'Candidate endpoint',
      title: 'Check the candidate over HTTPS.',
      description: 'After ADC readiness, Embr requires HTTP 200 from the candidate\'s direct endpoint. No traffic yet.',
      result: 'Candidate healthy; traffic has not moved.',
    },
    {
      id: 'release',
      label: 'Route traffic',
      station: 'Embr YARP',
      context: 'Static + compute routing',
      handoff: 'Switch route',
      payload: 'Healthy candidate',
      title: 'Route customers to the new version.',
      description: 'Embr YARP routes API requests to the ADC Artifact App and static requests to Embr Blob Storage.',
      result: 'Traffic switched; release verification is next.',
    },
    {
      id: 'verify',
      label: 'Verify release',
      station: 'App URL',
      context: 'Embr-issued hostname',
      handoff: 'Public probe',
      payload: 'Customer traffic',
      title: 'Verify the live release.',
      description: 'Embr confirms the expected version through the public URL, then marks the release successful.',
      result: 'Deployment succeeded.',
    },
    {
      id: 'cleanup',
      label: 'After release',
      station: 'Cleanup',
      context: 'Embr background worker',
      handoff: 'Retire old runtime',
      payload: 'Previous runtime',
      title: scenario.hasExistingRuntime ? 'Retire the previous runtime.' : 'Apply version retention.',
      description: scenario.hasExistingRuntime ? 'Delete the unrouted Artifact App in the background. Keep retained versions for recovery.' : 'Apply version retention in the background. There is no previous Artifact App to delete.',
      result: 'The new version is serving. Background cleanup is complete.',
    },
  ]

  return milestones.map((milestone, index) => ({
    ...milestone,
    start: boundaries[index],
    end: boundaries[index + 1],
  }))
}

export function getOverviewState(scenario: Scenario, completedCount: number) {
  const milestones = getOverviewMilestones(scenario)
  const oldVersion = scenario.id === 'redeploy' ? 'v17' : scenario.oldVersion
  const newVersion = scenario.id === 'redeploy' ? 'v17' : scenario.newVersion
  const complete = completedCount >= scenario.steps.length
  const milestoneIndex = complete
    ? milestones.length - 1
    : milestones.findIndex((milestone) => completedCount < milestone.end)
  const cutover = getCutoverState(scenario, completedCount)
  const candidateServing = ['switched', 'verified', 'active', 'cleanupPending', 'deleting', 'deleted'].includes(cutover)

  return {
    milestones,
    milestoneIndex,
    milestone: milestones[milestoneIndex],
    complete,
    cutover,
    candidateServing,
    oldVersion,
    newVersion,
    servingVersion: candidateServing ? newVersion : oldVersion,
    released: completedCount >= milestones.find((milestone) => milestone.id === 'verify')!.end,
    prepared: completedCount >= milestones.find((milestone) => milestone.id === 'publish')!.end,
    healthy: completedCount >= milestones.find((milestone) => milestone.id === 'check')!.end,
    nextCount: milestones[milestoneIndex].end,
    previousCount: milestones.map((milestone) => milestone.start).findLast((start) => start < completedCount) ?? 0,
  }
}

export function getOverviewReleaseConfiguration(scenario: Scenario, completedCount: number) {
  const state = getOverviewState(scenario, completedCount)
  const retained = !scenario.steps.some((step) => step.phase === 'building')
  const captured = retained || scenario.steps.slice(0, completedCount).some((step) => step.id === 'create-version')
  const releaseCurrency = scenario.id === 'activate' ? 'USD' : 'EUR'
  const previousCurrency = scenario.id === 'latest' ? 'USD' : 'EUR'

  return {
    retained,
    captured,
    desired: versionConfiguration('EUR'),
    release: versionConfiguration(releaseCurrency),
    active: state.candidateServing
      ? versionConfiguration(releaseCurrency)
      : scenario.hasExistingRuntime ? versionConfiguration(previousCurrency) : null,
  }
}