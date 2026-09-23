import { getCutoverState, type Scenario } from './model'

export interface OverviewMilestone {
  id: 'select' | 'prepare' | 'check' | 'release' | 'cleanup'
  label: string
  title: string
  description: string
  result: string
  start: number
  end: number
}

export const overviewStories: Record<Scenario['id'], {
  title: string
  summary: string
  source: string
  selection: string
  distinction: string
}> = {
  manual: {
    title: 'From source to a running app.',
    summary: 'One deployment brings your frontend and API online, behind one app URL.',
    source: 'GitHub branch',
    selection: 'Resolve the configured branch to an exact commit and capture its app configuration.',
    distinction: 'First launch: the app URL starts serving only after the new runtime passes health checks.',
  },
  latest: {
    title: 'Ship what is next. Keep serving.',
    summary: 'Build the latest code alongside the current version, then move customers to the new release.',
    source: 'Latest branch commit',
    selection: 'Resolve the latest commit on the configured branch and capture the desired app configuration.',
    distinction: 'This is an explicit source deployment. The current version serves while its replacement is prepared.',
  },
  commit: {
    title: 'Choose exactly what goes live.',
    summary: 'Pin a commit. Reuse a matching retained build, or build that revision when no exact match is available.',
    source: 'Pinned commit',
    selection: 'Select the exact commit and check for a retained version with the same source and complete configuration.',
    distinction: 'An exact retained match is shown here. A different configuration or missing outputs requires a new build.',
  },
  redeploy: {
    title: 'Fresh runtime. Same version.',
    summary: 'Replace running resources using the retained app version, without fetching source or rebuilding.',
    source: 'Reusable app version',
    selection: 'Use the active app version, or the newest successful reusable version when no runtime is active.',
    distinction: 'Reuses the selected version and its frozen configuration, not new edits to the app settings.',
  },
  activate: {
    title: 'Return to a known version.',
    summary: 'Choose a retained version and bring it back through the same health-checked release process.',
    source: 'Selected retained version',
    selection: 'Select a specific retained version and verify that its outputs are still available.',
    distinction: 'Recovery reuses retained outputs and frozen configuration. It creates fresh runtime resources; it is not an instant traffic toggle.',
  },
}

export function getOverviewMilestones(scenario: Scenario): OverviewMilestone[] {
  const builds = scenario.steps.some((step) => step.phase === 'building')
  const operationIndex = scenario.steps.findIndex((step) => step.target === 'deployment')
  const candidateIndex = scenario.steps.findIndex((step) => step.cutoverDuring === 'candidate')
  const healthyEnd = scenario.steps.findIndex((step) => step.cutoverAfter === 'healthy') + 1
  const releaseEnd = scenario.steps.findIndex((step) => step.phase === 'succeeded') + 1
  const boundaries = [0, operationIndex, candidateIndex, healthyEnd, releaseEnd, scenario.steps.length]

  if (boundaries.some((boundary, index) => index > 0 && boundary <= boundaries[index - 1])) {
    throw new Error(`Scenario ${scenario.id} does not contain an ordered overview journey`)
  }

  const milestones: Omit<OverviewMilestone, 'start' | 'end'>[] = [
    {
      id: 'select',
      label: builds || scenario.id === 'commit' ? 'Choose source' : 'Choose version',
      title: builds || scenario.id === 'commit' ? 'A precise starting point.' : 'A version you already have.',
      description: overviewStories[scenario.id].selection,
      result: `${scenario.newVersion} selected with a fixed source and configuration.`,
    },
    {
      id: 'prepare',
      label: builds ? 'Build & package' : 'Reuse outputs',
      title: builds ? 'One version. Every component.' : 'No rebuild required.',
      description: builds
        ? 'Build the static frontend and compute API into immutable, versioned outputs. Customer traffic does not change.'
        : 'Reuse the retained static and compute outputs with their original configuration. Prepare fresh runtime resources.',
      result: builds ? 'Versioned frontend and API outputs are ready.' : 'Retained outputs are ready for a fresh runtime.',
    },
    {
      id: 'check',
      label: 'Check health',
      title: 'Ready before customers arrive.',
      description: scenario.hasExistingRuntime
        ? 'Start an isolated candidate and verify runtime readiness and direct endpoint health. The current version keeps serving.'
        : 'Start the first runtime and verify readiness and direct endpoint health before assigning customer traffic.',
      result: 'The candidate is healthy. Customer traffic has not moved yet.',
    },
    {
      id: 'release',
      label: 'Go live',
      title: scenario.hasExistingRuntime ? 'Same URL. New release.' : 'Your app is live.',
      description: 'Activate the frontend and API together, verify the customer route, then mark the deployment successful.',
      result: `${scenario.newVersion} is serving customers. The deployment has succeeded.`,
    },
    {
      id: 'cleanup',
      label: 'After release',
      title: 'The release is already successful.',
      description: scenario.hasExistingRuntime
        ? 'Retire the previous runtime in the background. Keep the active version plus five successful historical versions; retry cleanup independently.'
        : 'Apply version retention in the background. There is no previous runtime to retire on a first deployment.',
      result: 'Background cleanup is complete. Retained versions remain available within the retention policy.',
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
    released: completedCount >= milestones[3].end,
    prepared: completedCount >= milestones[1].end,
    healthy: completedCount >= milestones[2].end,
    nextCount: milestones[milestoneIndex].end,
    previousCount: milestones.map((milestone) => milestone.start).findLast((start) => start < completedCount) ?? 0,
  }
}