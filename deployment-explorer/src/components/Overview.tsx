import { useEffect, useRef, type CSSProperties } from 'react'
import {
  ArrowRight,
  Check,
  CircleCheck,
  Container,
  Database,
  Files,
  GitBranch,
  GitCommitHorizontal,
  Globe,
  Hammer,
  PackageCheck,
  PackageOpen,
  RefreshCw,
  Rocket,
  Route,
  Server,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react'
import { scenarios, type Scenario } from '../model'
import { getOverviewState, overviewStories } from '../overview'
import './Overview.css'

const scenarioIcons = { manual: Rocket, latest: GitBranch, commit: GitCommitHorizontal, redeploy: RefreshCw, activate: PackageCheck }
const stationIcons = { select: GitBranch, build: Hammer, publish: Container, artifact: PackageOpen, candidate: Server, check: ShieldCheck, release: Route, verify: Globe, cleanup: Trash2 }

interface OverviewProps {
  scenario: Scenario
  completedCount: number
  isAnimating: boolean
  motionDurationMs: number
  onScenarioChange: (scenario: Scenario) => void
  onMilestoneSelect: (index: number) => void
  onTechnicalView: () => void
}

export function Overview({ scenario, completedCount, isAnimating, motionDurationMs, onScenarioChange, onMilestoneSelect, onTechnicalView }: OverviewProps) {
  const root = useRef<HTMLDivElement>(null)
  const state = getOverviewState(scenario, completedCount)
  const story = overviewStories[scenario.id]
  const builds = scenario.steps.some((step) => step.phase === 'building')
  const stations = state.milestones.filter((milestone) => milestone.id !== 'cleanup')
  const cleanup = state.milestones.at(-1)!
  const assetsStored = !builds || scenario.steps.slice(0, completedCount).some((step) => step.id === 'publish-static')
  const trafficTarget = state.candidateServing ? 'candidate' : scenario.hasExistingRuntime ? 'existing' : 'none'

  useEffect(() => {
    if (!isAnimating || !window.matchMedia?.('(max-width: 760px)').matches) return
    root.current?.querySelector('[aria-current="step"]')?.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    })
  }, [isAnimating, state.milestone.id])

  return (
    <div ref={root} id="overview-panel" className="overview" role="tabpanel" aria-labelledby="overview-tab">
      <div className="overview-heading">
        <div><p className="overview-eyebrow">Source to production</p><h2>{story.title}</h2></div>
        <button type="button" className="overview-detail-link" onClick={onTechnicalView}>Technical detail <ArrowRight size={16} aria-hidden="true" /></button>
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
            ><Icon size={19} aria-hidden="true" />{item.label}</button>
          )
        })}
      </div>

      <section id="overview-journey" role="tabpanel" aria-labelledby={`overview-scenario-${scenario.id}`}>
        <div className="flow-caption" role="status" aria-label="Current stage">
          <span className="flow-counter">{String(state.milestoneIndex + 1).padStart(2, '0')}<small>/ {String(state.milestones.length).padStart(2, '0')}</small></span>
          <div>
            <h3>{state.complete ? `${state.newVersion} is live.` : state.milestone.title}</h3>
            <p>{state.complete ? state.milestone.result : state.milestone.description}</p>
          </div>
          <span className="flow-payload"><Container size={16} aria-hidden="true" />{state.complete ? 'Release complete' : state.milestone.payload}</span>
        </div>

        <div className={`flow-map${isAnimating ? ' is-running' : ''}`} data-current-stage={state.complete ? 'complete' : state.milestone.id} style={{ '--flow-duration': `${motionDurationMs}ms` } as CSSProperties}>
          <ol className="flow-track" aria-label="Deployment flow">
            {stations.map((milestone, index) => {
              const done = completedCount >= milestone.end
              const active = !state.complete && index === state.milestoneIndex
              const Icon = stationIcons[milestone.id]
              const direction = index === 4 ? 'turn' : index > 4 ? 'reverse' : 'forward'
              return (
                <li key={milestone.id} data-station={milestone.id} className={`flow-stop ${done ? 'is-done' : active ? 'is-current' : 'is-upcoming'}`} style={{ '--column': index < 4 ? index + 1 : 8 - index, '--row': index < 4 ? 1 : 2 } as CSSProperties}>
                  {index > 0 && (
                    <span className={`flow-connector direction-${direction}`}>
                      <span className="flow-handoff" id={`flow-handoff-${milestone.id}`}>{milestone.handoff}</span>
                      {active && isAnimating && <span key={`${milestone.id}-${motionDurationMs}`} className="flow-packet" data-payload={milestone.payload} aria-hidden="true"><Container size={16} /></span>}
                    </span>
                  )}
                  <button type="button" className="flow-station" aria-label={`Go to stage ${index + 1}: ${milestone.label}`} aria-describedby={`flow-context-${milestone.id}${index > 0 ? ` flow-handoff-${milestone.id}` : ''}`} aria-current={active ? 'step' : undefined} onClick={() => onMilestoneSelect(milestone.start)} title={milestone.description}>
                    <span className="flow-symbol"><Icon size={32} strokeWidth={1.6} aria-hidden="true" /><span className="flow-number" aria-hidden="true">{done ? <Check size={12} /> : index + 1}</span></span>
                    <strong>{milestone.station}</strong>
                    <span className="flow-action" id={`flow-context-${milestone.id}`}>{milestone.context}</span>
                    <span className="flow-state">{done ? <><Check size={12} aria-hidden="true" />{milestone.id === 'check' ? 'Endpoint healthy' : 'Done'}</> : active ? isAnimating ? 'In progress' : 'You are here' : 'Up next'}</span>
                  </button>
                </li>
              )
            })}
          </ol>
          {!builds && <p className="flow-reuse-note"><RefreshCw size={15} aria-hidden="true" />{scenario.id === 'commit' ? 'Exact retained match shown. Otherwise build.' : 'Retained version. Build skipped.'}</p>}
          <div className={`flow-static-path${assetsStored ? ' outputs-ready' : ''}`} role="group" aria-label="Static asset path" data-assets-stored={assetsStored}>
            <span><Files size={19} aria-hidden="true" />Static frontend</span>
            <ArrowRight size={20} aria-hidden="true" />
            <span><Database size={19} aria-hidden="true" />Embr Blob Storage</span>
            <ArrowRight size={20} aria-hidden="true" />
            <span><Route size={19} aria-hidden="true" />Embr YARP serves files</span>
            <small>{!builds ? 'Retained files' : assetsStored ? 'Files published' : 'Awaiting publish'}</small>
          </div>
        </div>

        <div className="release-visual" data-route-target={trafficTarget}>
          <div className={`customer-traffic${state.servingVersion ? ' is-serving' : ''}`} role="group" aria-label="Customer traffic">
            <span><Users size={23} aria-hidden="true" />Customers</span>
            <span className="traffic-wire" aria-hidden="true" />
            <span><Route size={22} aria-hidden="true" />Embr YARP</span>
            <span className="traffic-wire" aria-hidden="true" />
            <span key={trafficTarget} className="traffic-destination"><Server size={25} aria-hidden="true" /><span>{state.servingVersion ? `Artifact App ${state.servingVersion}` : 'No active app'}<small>{state.candidateServing ? 'New ADC runtime' : state.servingVersion ? 'Current ADC runtime' : 'Not live yet'}</small></span></span>
          </div>
          <div className="release-outcome" role="status" aria-label="Release status">
            {state.released ? <CircleCheck size={18} aria-hidden="true" /> : <ShieldCheck size={18} aria-hidden="true" />}
            <div><strong>{state.released ? 'Deployment succeeded' : state.candidateServing ? 'Verifying release' : scenario.hasExistingRuntime ? 'Current version stays live' : 'Waiting for first release'}</strong><span>{state.servingVersion ? `${state.servingVersion} is serving customers` : 'No live version yet'}</span></div>
          </div>
          <button
            type="button"
            className={`flow-cleanup${state.milestone.id === 'cleanup' ? ' is-current' : ''}${state.complete ? ' is-done' : ''}`}
            onClick={() => onMilestoneSelect(cleanup.start)}
            aria-label={`Go to stage ${state.milestones.length}: After release`}
            aria-current={!state.complete && state.milestone.id === 'cleanup' ? 'step' : undefined}
          ><Trash2 size={18} aria-hidden="true" /><span>After release<small>{state.complete ? 'Cleanup complete' : state.released ? 'Background cleanup' : 'Cleanup queued'}</small></span></button>
        </div>
      </section>
    </div>
  )
}