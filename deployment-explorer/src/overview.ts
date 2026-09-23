import { getCutoverState, type Scenario } from './model'

export interface OverviewMilestone {
  id: 'select' | 'build' | 'publish' | 'artifact' | 'candidate' | 'check' | 'release' | 'verify' | 'cleanup'
  label: string
  station: string
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
      station: builds || scenario.id === 'commit' ? 'GitHub source' : 'AppVersion',
      payload: builds || scenario.id === 'commit' ? 'Pinned commit' : 'Retained version',
      title: builds || scenario.id === 'commit' ? 'Pin the source.' : 'Select a retained version.',
      description: builds ? 'Freeze the commit, component manifest, and configuration into an AppVersion.' : 'Select available outputs with the version\'s original configuration.',
      result: 'Source and configuration selected.',
    },
    ...(builds ? [{
      id: 'build' as const,
      label: 'Build',
      station: 'Build sandbox',
      payload: 'Source code',
      title: 'Build the frontend and API.',
      description: 'An ADC build sandbox checks out the pinned commit and runs each component build.',
      result: 'Component builds complete.',
    }] : []),
    {
      id: 'publish',
      label: builds ? 'Package & publish' : 'Reuse outputs',
      station: 'ACR',
      payload: builds ? 'OCI image' : 'Retained OCI image',
      title: builds ? 'Package the build. Publish to ACR.' : 'Reuse the image already in ACR.',
      description: builds ? 'Publish an OCI image to Azure Container Registry and static files to Blob Storage.' : 'Reuse the pinned OCI image and static files. No build or image push.',
      result: 'Immutable build outputs ready.',
    },
    {
      id: 'artifact',
      label: 'Import artifact',
      station: 'ADC Artifact',
      payload: 'Image digest',
      title: 'Import the image into ADC.',
      description: 'Create a deployment-owned ADC Artifact from the exact OCI image digest.',
      result: 'ADC Artifact ready.',
    },
    {
      id: 'candidate',
      label: 'Create app',
      station: 'Artifact App',
      payload: 'Artifact version',
      title: 'Create the candidate Artifact App.',
      description: 'Start fresh runtime resources and wait for ADC replica readiness. Traffic has not moved.',
      result: 'Artifact App running; native readiness passed.',
    },
    {
      id: 'check',
      label: 'Check health',
      station: 'Health check',
      payload: 'Candidate endpoint',
      title: 'Check the candidate over HTTPS.',
      description: 'Require HTTP 200 from the direct endpoint before the candidate can receive traffic.',
      result: 'Candidate healthy; traffic has not moved.',
    },
    {
      id: 'release',
      label: 'Route traffic',
      station: 'YARP route',
      payload: 'Healthy candidate',
      title: 'Route customers to the new version.',
      description: 'Switch the Artifact App backend and static paths together. The app URL stays the same.',
      result: 'Traffic switched; release verification is next.',
    },
    {
      id: 'verify',
      label: 'Verify release',
      station: 'Customer URL',
      payload: 'Customer traffic',
      title: 'Verify the live release.',
      description: 'Confirm the expected version through the customer URL, then mark the deployment successful.',
      result: 'Deployment succeeded.',
    },
    {
      id: 'cleanup',
      label: 'After release',
      station: 'Cleanup',
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