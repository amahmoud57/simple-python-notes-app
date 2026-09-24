import { completionLabel, getCutoverState, type Scenario } from './model'
import { currentApiHost, legacyApiHost, versionHost } from './configuration'

export type OverviewMilestoneId =
  | 'select'
  | 'build'
  | 'publish'
  | 'artifact'
  | 'candidate'
  | 'check'
  | 'release'
  | 'verify'
  | 'cleanup'

/** Builder CLI timeline phases; deploy and activate share them, activation marks Build as reused. */
export type TimelinePhase = 'queue' | 'build' | 'provision' | 'verify' | 'route' | 'cleanup'

export const timelinePhaseLabels: Record<TimelinePhase, string> = {
  queue: 'Queue',
  build: 'Build',
  provision: 'Provision',
  verify: 'Verify',
  route: 'Route',
  cleanup: 'Cleanup',
}

export interface OverviewMilestone {
  id: OverviewMilestoneId
  phase: TimelinePhase
  label: string
  title: string
  description: string
  start: number
  end: number
}

type MilestoneCopy = Omit<OverviewMilestone, 'start' | 'end'>

const version = (label: string | null) => label?.replace(/-[ab]$/, '') ?? null

function withBoundaries(scenario: Scenario, boundaries: number[], milestones: MilestoneCopy[]): OverviewMilestone[] {
  if (boundaries.some((boundary, index) => index > 0 && boundary <= boundaries[index - 1])) {
    throw new Error(`Scenario ${scenario.id} does not contain an ordered overview journey`)
  }
  return milestones.map((milestone, index) => ({ ...milestone, start: boundaries[index], end: boundaries[index + 1] }))
}

export function getOverviewMilestones(scenario: Scenario): OverviewMilestone[] {
  const builds = scenario.steps.some((step) => step.phase === 'building')
  const operationIndex = scenario.steps.findIndex((step) => step.target === 'deployment')
  const webReadyEnd = scenario.steps.findIndex((step) => step.id === 'publish-static') + 1
  const artifactIndex = scenario.steps.findIndex((step) => step.target === 'artifact')
  const candidateIndex = scenario.steps.findIndex((step) => step.cutoverDuring === 'candidate')
  const nativeReadyEnd = scenario.steps.findIndex((step) => step.cutoverAfter === 'nativeReady') + 1
  const healthyEnd = scenario.steps.findIndex((step) => step.cutoverAfter === 'healthy') + 1
  const routeEnd = scenario.steps.findIndex((step) => step.cutoverAfter === 'switched') + 1
  const releaseEnd = scenario.steps.findIndex((step) => step.phase === 'succeeded') + 1
  const boundaries = [0, operationIndex + 1, ...(builds ? [webReadyEnd] : []), artifactIndex, candidateIndex, nativeReadyEnd, healthyEnd, routeEnd, releaseEnd, scenario.steps.length]
  const next = version(scenario.newVersion)!
  const old = version(scenario.oldVersion)
  const host = versionHost(next)

  const select: MilestoneCopy = scenario.id === 'redeploy'
    ? { id: 'select', phase: 'queue', label: `Pick ${next}`, title: `Redeploy starts from the active version, ${next}.`, description: 'No source and no build. A new Deployment puts the same code and config on a fresh Artifact App.' }
    : scenario.id === 'activate'
      ? { id: 'select', phase: 'queue', label: `Pick ${next}`, title: `Activate starts from a built version, ${next}.`, description: `No source and no build. ${next} brings its own frozen API_URL=${host}. A new Deployment tracks the rollout.` }
      : { id: 'select', phase: 'queue', label: `Create ${next}`, title: `Deploy starts from source: create ${next}.`, description: `Main resolves to a commit. Its builder.yaml and API_URL=${host} are frozen into AppVersion ${next}, and a Deployment starts tracking the rollout.` }

  return withBoundaries(scenario, boundaries, [
    select,
    ...(builds ? [{ id: 'build' as const, phase: 'build' as const, label: 'Build web', title: `Build ${next}'s web files.`, description: `web builds first, in its own temporary ADC sandbox with ${next}'s variables. Its files go to Embr Blob.` }] : []),
    builds
      ? { id: 'publish', phase: 'build', label: 'Build api', title: `Build ${next}'s api image.`, description: 'api builds next, in a fresh sandbox. An ACR Task pushes its image to Embr ACR.' }
      : { id: 'publish', phase: 'build', label: 'Reused', title: `Reuse ${next}'s build.`, description: `${next}'s image is still in Embr ACR and its files in Embr Blob. No build, no push.` },
    { id: 'artifact', phase: 'provision', label: 'Import', title: 'ADC pulls the image.', description: 'Embr creates an ADC Artifact for the image digest. That is what makes ADC pull it from Embr ACR.' },
    { id: 'candidate', phase: 'provision', label: 'Start', title: old ? `Start ${next} next to ${old}.` : `Start ${next}.`, description: `Variables come from ${next}. Scaling comes from the app.` },
    { id: 'check', phase: 'verify', label: 'Health check', title: `Health-check ${next}.`, description: old ? `Embr probes ${next} directly. Customers stay on ${old}.` : `Embr probes ${next} directly before any traffic.` },
    { id: 'release', phase: 'route', label: 'Switch', title: `Route customers to ${next}.`, description: old ? `Embr YARP moves traffic from ${old} to ${next}.` : `Embr YARP creates the app URL and routes it to ${next}.` },
    { id: 'verify', phase: 'route', label: 'URL check', title: `Check ${next} at the app URL.`, description: `Embr confirms ${next} answers through the public URL.` },
    old
      ? { id: 'cleanup', phase: 'cleanup', label: 'Clean up', title: `Retire ${old}'s Artifact App.`, description: `The unrouted app is deleted. AppVersion ${old} stays available to activate.` }
      : { id: 'cleanup', phase: 'cleanup', label: 'Clean up', title: 'Apply version retention.', description: 'Background retention runs. There is no previous app to delete.' },
  ])
}

const completion: Record<Scenario['id'], string> = {
  manual: `Code and API_URL=${currentApiHost} from v1. Scaling from the app.`,
  latest: `v17 brought API_URL=${currentApiHost}. v16 stays available to activate.`,
  redeploy: 'Same version and frozen config in a fresh Artifact App.',
  activate: `v16's own API_URL=${legacyApiHost} came back. Scaling stayed current.`,
}

const completionTitle = (scenario: Scenario, live: string) =>
  `${completionLabel(scenario)}. ${live} is live${scenario.id === 'activate' ? ' again' : ''}.`

export function getOverviewState(scenario: Scenario, completedCount: number) {
  const milestones = getOverviewMilestones(scenario)
  const oldVersion = version(scenario.oldVersion)
  const newVersion = version(scenario.newVersion)!
  const complete = completedCount >= scenario.steps.length
  const milestoneIndex = complete
    ? milestones.length - 1
    : milestones.findIndex((milestone) => completedCount < milestone.end)
  const cutover = getCutoverState(scenario, completedCount)
  const candidateServing = ['switched', 'verified', 'active', 'cleanupPending', 'deleting', 'deleted'].includes(cutover)
  const reached = (id: OverviewMilestoneId) => {
    const milestone = milestones.find((item) => item.id === id)
    return milestone !== undefined && completedCount >= milestone.end
  }

  return {
    milestones,
    milestoneIndex,
    milestone: milestones[milestoneIndex],
    complete,
    completion: { title: completionTitle(scenario, newVersion), description: completion[scenario.id] },
    cutover,
    candidateServing,
    oldVersion,
    newVersion,
    servingVersion: candidateServing ? newVersion : oldVersion,
    released: reached('verify'),
    healthy: reached('check'),
    reached,
    nextCount: milestones[milestoneIndex].end,
    previousCount: milestones.map((milestone) => milestone.start).findLast((start) => start < completedCount) ?? 0,
  }
}
