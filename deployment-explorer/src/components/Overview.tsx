import {
  ArrowRight,
  Box,
  Check,
  Circle,
  CircleCheck,
  GitBranch,
  GitCommitHorizontal,
  Globe,
  Layers,
  PackageCheck,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { scenarios, type Scenario } from '../model'
import { getOverviewState, overviewStories } from '../overview'
import './Overview.css'

const scenarioIcons = {
  manual: Rocket,
  latest: GitBranch,
  commit: GitCommitHorizontal,
  redeploy: RefreshCw,
  activate: PackageCheck,
}

const capabilities = [
  { icon: Layers, title: 'Frontend + API', detail: 'Static and compute components move together in one release.' },
  { icon: GitCommitHorizontal, title: 'Reproducible versions', detail: 'Source, outputs, and version configuration stay together.' },
  { icon: ShieldCheck, title: 'Health-gated releases', detail: 'A candidate must pass health checks before traffic moves.' },
  { icon: PackageCheck, title: 'Retained-version recovery', detail: 'Bring back an available version without rebuilding its code.' },
]

interface OverviewProps {
  scenario: Scenario
  completedCount: number
  isAnimating: boolean
  onScenarioChange: (scenario: Scenario) => void
  onMilestoneSelect: (index: number) => void
  onTechnicalView: () => void
}

export function Overview({ scenario, completedCount, isAnimating, onScenarioChange, onMilestoneSelect, onTechnicalView }: OverviewProps) {
  const state = getOverviewState(scenario, completedCount)
  const story = overviewStories[scenario.id]
  const builds = scenario.steps.some((step) => step.phase === 'building')
  const nativeReady = ['nativeReady', 'healthy', 'switched', 'verified', 'active', 'cleanupPending', 'deleting', 'deleted'].includes(state.cutover)
  const incomingStatus = state.candidateServing
    ? state.released ? 'Serving customers' : 'Verifying the release'
    : state.healthy
      ? 'Healthy, ready for traffic'
      : state.prepared
        ? isAnimating ? 'Checking runtime health' : 'Ready for health checks'
        : completedCount > 0 ? builds ? 'Preparing a new build' : 'Preparing retained outputs' : 'Awaiting selection'
  const currentStatus = !scenario.hasExistingRuntime
    ? 'No customer traffic yet'
    : state.complete ? 'Previous runtime retired' : state.candidateServing ? 'Unrouted, awaiting cleanup' : 'Serving customers'
  const trafficStatus = state.servingVersion
    ? `${state.servingVersion} is serving customers${scenario.id === 'redeploy' ? state.candidateServing ? ' on the fresh runtime' : ' on the current runtime' : ''}`
    : 'No live version yet'

  return (
    <div id="overview-panel" className="overview" role="tabpanel" aria-labelledby="overview-tab">
      <div className="overview-heading">
        <div>
          <p className="overview-eyebrow">Source to production</p>
          <h2>{story.title}</h2>
          <p className="overview-summary">{story.summary}</p>
        </div>
        <dl className="overview-input">
          <div><dt>Starting point</dt><dd>{story.source}</dd></div>
          <div><dt>Build strategy</dt><dd>{builds ? 'Build new outputs' : 'Reuse retained outputs'}</dd></div>
        </dl>
      </div>

      <div className="overview-scenarios" role="tablist" aria-label="Deployment scenario">
        {scenarios.map((item, index) => {
          const Icon = scenarioIcons[item.id]
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`overview-scenario-${item.id}`}
              aria-selected={scenario.id === item.id}
              aria-controls="overview-journey"
              tabIndex={scenario.id === item.id ? 0 : -1}
              onClick={() => onScenarioChange(item)}
              onKeyDown={(event) => {
                const nextIndex = event.key === 'ArrowRight' ? (index + 1) % scenarios.length
                  : event.key === 'ArrowLeft' ? (index + scenarios.length - 1) % scenarios.length
                    : event.key === 'Home' ? 0 : event.key === 'End' ? scenarios.length - 1 : null
                if (nextIndex === null) return
                event.preventDefault()
                onScenarioChange(scenarios[nextIndex])
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex].focus()
              }}
            >
              <Icon size={19} aria-hidden="true" />
              {item.label}
            </button>
          )
        })}
      </div>

      <section id="overview-journey" role="tabpanel" aria-labelledby={`overview-scenario-${scenario.id}`}>
        <ol className="overview-milestones" aria-label="Release milestones">
          {state.milestones.map((milestone, index) => {
            const done = completedCount >= milestone.end
            const active = !state.complete && index === state.milestoneIndex
            return (
              <li key={milestone.id} className={done ? 'is-done' : active ? 'is-active' : ''}>
                <button
                  type="button"
                  onClick={() => onMilestoneSelect(milestone.start)}
                  aria-label={`Go to stage ${index + 1}: ${milestone.label}`}
                  aria-current={active ? 'step' : undefined}
                >
                  <span className="milestone-number" aria-hidden="true">{done ? <Check size={17} /> : `0${index + 1}`}</span>
                  <span>{milestone.label}</span>
                  <span className="sr-only">{done ? 'Completed' : active ? 'Current stage' : 'Upcoming'}</span>
                </button>
              </li>
            )
          })}
        </ol>

        <div className={`overview-stage${isAnimating ? ' is-running' : ''}`}>
          <div className="overview-narrative">
            <p className="overview-eyebrow">{state.complete ? 'Journey complete' : `Stage 0${state.milestoneIndex + 1} / 05`}</p>
            <h3>{state.complete ? `${state.newVersion} is live.` : state.milestone.title}</h3>
            <p className="milestone-description">{state.complete ? state.milestone.result : state.milestone.description}</p>
            <div className={`release-outcome${state.released ? ' is-live' : ''}`} role="status" aria-label="Release status">
              {state.released ? <CircleCheck size={21} aria-hidden="true" /> : <ShieldCheck size={21} aria-hidden="true" />}
              <div>
                <span>{state.released ? 'Deployment succeeded' : scenario.hasExistingRuntime ? 'Current service' : 'Before first launch'}</span>
                <strong>{trafficStatus}</strong>
              </div>
            </div>
            <button type="button" className="overview-detail-link" onClick={onTechnicalView}>
              Technical detail <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="release-visual" aria-label="Customer traffic and app versions" data-route-target={state.candidateServing ? 'candidate' : scenario.hasExistingRuntime ? 'existing' : 'none'}>
            <div className="release-visual-heading">
              <span><Globe size={16} aria-hidden="true" /> One app URL</span>
              <span className="release-visual-label">Illustrative app</span>
            </div>
            <div className="release-diagram">
              <div className="release-customers">
                <span className="customer-symbol"><Users size={30} strokeWidth={1.6} aria-hidden="true" /></span>
                <strong>Customers</strong>
                <span>{state.servingVersion ? 'App is serving' : 'Not live yet'}</span>
              </div>
              <div className={`traffic-fork${state.servingVersion ? ' is-connected' : ''}`} aria-hidden="true">
                <span className="traffic-trunk" />
                <span className={`traffic-branch to-current${scenario.hasExistingRuntime && !state.candidateServing ? ' is-serving' : ''}`} />
                <span className={`traffic-branch to-incoming${state.candidateServing ? ' is-serving' : ''}`} />
              </div>
              <div className="release-versions">
                <article className={`release-version current-version${scenario.hasExistingRuntime && !state.candidateServing ? ' is-serving' : ''}${!scenario.hasExistingRuntime ? ' is-empty' : ''}`}>
                  <div className="version-heading"><span>{state.candidateServing ? 'Previous runtime' : 'Current runtime'}</span><Box size={18} aria-hidden="true" /></div>
                  <strong className="version-name">{state.oldVersion ?? 'No version yet'}</strong>
                  <span className="version-status">{scenario.hasExistingRuntime && !state.candidateServing ? <CircleCheck size={14} aria-hidden="true" /> : <Circle size={12} aria-hidden="true" />}{currentStatus}</span>
                </article>
                <article className={`release-version incoming-version${state.candidateServing ? ' is-serving' : ''}${state.healthy ? ' is-healthy' : ''}`}>
                  <div className="version-heading"><span>{state.candidateServing ? 'New live runtime' : 'Incoming runtime'}</span><Layers size={18} aria-hidden="true" /></div>
                  <strong className="version-name">{state.newVersion}</strong>
                  <span className="version-status">{state.healthy ? <CircleCheck size={14} aria-hidden="true" /> : <Circle size={12} aria-hidden="true" />}{incomingStatus}</span>
                </article>
              </div>
            </div>
            <div className="overview-health" aria-label="Candidate health checks">
              <span className={nativeReady ? 'is-passed' : ''}>{nativeReady ? <CircleCheck size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}{nativeReady ? 'Runtime ready' : 'Runtime readiness pending'}</span>
              <span className={state.healthy ? 'is-passed' : ''}>{state.healthy ? <CircleCheck size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}{state.healthy ? 'Endpoint healthy' : 'Endpoint health pending'}</span>
            </div>
          </div>
        </div>

        <p className="overview-distinction"><span>{scenario.label}</span>{story.distinction}</p>
      </section>

      <section className="overview-capabilities" aria-labelledby="capabilities-title">
        <div className="capabilities-heading"><h3 id="capabilities-title">Built into the release</h3><span>Across these deployment flows</span></div>
        <ul>
          {capabilities.map(({ icon: Icon, title, detail }) => (
            <li key={title}><Icon size={22} strokeWidth={1.7} aria-hidden="true" /><div><h4>{title}</h4><p>{detail}</p></div></li>
          ))}
        </ul>
      </section>
    </div>
  )
}