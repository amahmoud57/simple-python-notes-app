import { getCutoverState, type Scenario } from './model'
import { currentApiHost, formatScaling, legacyApiHost, updatedScaling, versionHost } from './configuration'

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
  | 'save'
  | 'apply'

export interface OverviewMilestone {
  id: OverviewMilestoneId
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

function settingsMilestones(scenario: Scenario): OverviewMilestone[] {
  const step = (id: string) => scenario.steps.findIndex((item) => item.id === id) + 1
  if (scenario.kind === 'config') {
    return withBoundaries(scenario, [0, step('config-persist')], [{
      id: 'save',
      label: 'Save',
      title: 'Save API_URL for the next version.',
      description: `The running v16 keeps ${legacyApiHost}. Nothing is rebuilt or redeployed.`,
    }])
  }

  return withBoundaries(scenario, [0, step('scale-persist'), step('scale-apply')], [
    {
      id: 'save',
      label: 'Save',
      title: 'Save the new scaling.',
      description: `${formatScaling(updatedScaling)}, stored on the Builder App, not in any AppVersion.`,
    },
    {
      id: 'apply',
      label: 'Apply live',
      title: 'Apply it to the running app.',
      description: 'Embr updates v17 in place: same version, same variables, new scale.',
    },
  ])
}

export function getOverviewMilestones(scenario: Scenario): OverviewMilestone[] {
  if (scenario.kind !== 'deploy') return settingsMilestones(scenario)

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
  const next = version(scenario.newVersion)!
  const old = version(scenario.oldVersion)
  const host = versionHost(next)

  const select: MilestoneCopy = scenario.id === 'commit'
    ? { id: 'select', label: 'Match', title: `Reuse ${next}: same commit, same config.`, description: `Commit 71ab42d with API_URL=${host} already built ${next}. No build needed.` }
    : scenario.id === 'redeploy'
      ? { id: 'select', label: 'Select', title: `Reuse ${next} as it is.`, description: 'Same code and frozen config. Only the runtime will be new.' }
      : scenario.id === 'activate'
        ? { id: 'select', label: 'Select', title: `Pick ${next} and its own config.`, description: `${next} froze API_URL=${host}. The app's current config is not used.` }
        : { id: 'select', label: 'Pin', title: `Freeze code and config into ${next}.`, description: `The commit, builder.yaml, and API_URL=${host} become AppVersion ${next}.` }

  return withBoundaries(scenario, boundaries, [
    select,
    ...(builds ? [{ id: 'build' as const, label: 'Build', title: `Build ${next}.`, description: `A temporary ADC sandbox builds the commit with ${next}'s variables.` }] : []),
    builds
      ? { id: 'publish', label: 'Package', title: 'Package the outputs.', description: 'The API becomes an OCI image in Embr ACR. Static files go to Embr Blob.' }
      : { id: 'publish', label: 'Reuse', title: 'Reuse the built outputs.', description: `${next}'s image is still in Embr ACR and its files in Embr Blob. No build, no push.` },
    { id: 'artifact', label: 'Import', title: 'ADC pulls the image.', description: 'ADC imports it from Embr ACR using Embr\'s pull identity with AcrPull.' },
    { id: 'candidate', label: 'Start', title: old ? `Start ${next} next to ${old}.` : `Start ${next}.`, description: `Variables come from ${next}. Scaling comes from the app.` },
    { id: 'check', label: 'Health', title: `Check ${next}'s health.`, description: old ? `Embr probes ${next} directly. Customers stay on ${old}.` : `Embr probes ${next} directly before any traffic.` },
    { id: 'release', label: 'Switch', title: `Route customers to ${next}.`, description: old ? `Embr YARP moves traffic from ${old} to ${next}.` : `Embr YARP creates the app URL and routes it to ${next}.` },
    { id: 'verify', label: 'Verify', title: 'Verify through the app URL.', description: `Embr confirms ${next} answers at the public URL.` },
    old
      ? { id: 'cleanup', label: 'Clean up', title: `Retire ${old}'s Artifact App.`, description: `The unrouted app is deleted. AppVersion ${old} stays retained for rollback.` }
      : { id: 'cleanup', label: 'Clean up', title: 'Apply version retention.', description: 'Background retention runs. There is no previous app to delete.' },
  ])
}

const completion: Record<Scenario['id'], { title: string; description: string }> = {
  manual: { title: 'v1 is live.', description: `Code and API_URL=${currentApiHost} from v1. Scaling from the app.` },
  latest: { title: 'v17 is live.', description: `v17 brought API_URL=${currentApiHost}. v16 is retained for rollback.` },
  commit: { title: 'v18 is live.', description: 'Reused without a build: same commit, same config.' },
  redeploy: { title: 'v17 is live on a fresh runtime.', description: 'Same version and frozen config in a new Artifact App.' },
  activate: { title: 'v16 is live again.', description: `Its own API_URL=${legacyApiHost} came back. Scaling stayed current.` },
  config: { title: 'Saved for the next version.', description: `v16 still runs ${legacyApiHost}. The next deploy captures ${currentApiHost}.` },
  scale: { title: 'v17 now scales 2–6.', description: 'No build, no new version, no traffic switch.' },
}

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
    completion: completion[scenario.id],
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
