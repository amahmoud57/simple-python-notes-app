import { useEffect, useRef, type CSSProperties } from 'react'
import {
  ArrowRight,
  Check,
  CircleCheck,
  Container,
  Database,
  Files,
  Gauge,
  GitBranch,
  Globe,
  Hammer,
  LockKeyhole,
  PackageOpen,
  RefreshCw,
  RotateCcw,
  Route,
  Server,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react'
import { type Scenario } from '../model'
import { getAppPolicyExample, type AppPolicyPhase } from '../configuration'
import { getOverviewReleaseConfiguration, getOverviewState, type OverviewMilestone } from '../overview'
import './Overview.css'

const stationIcons = { select: GitBranch, build: Hammer, publish: Container, artifact: PackageOpen, candidate: Server, check: ShieldCheck, release: Route, verify: Globe, cleanup: Trash2 }

interface OverviewProps {
  scenario: Scenario
  completedCount: number
  isAnimating: boolean
  motionDurationMs: number
  appPolicyPhase: AppPolicyPhase
  onApplyPolicy: () => void
  onResetPolicy: () => void
  onMilestoneSelect: (index: number) => void
  onTechnicalView: () => void
}

export function Overview({ scenario, completedCount, isAnimating, motionDurationMs, appPolicyPhase, onApplyPolicy, onResetPolicy, onMilestoneSelect, onTechnicalView }: OverviewProps) {
  const root = useRef<HTMLDivElement>(null)
  const state = getOverviewState(scenario, completedCount)
  const configuration = getOverviewReleaseConfiguration(scenario, completedCount)
  const policy = getAppPolicyExample(appPolicyPhase)
  const effectiveScale = policy.effective.components[0]
  const builds = scenario.steps.some((step) => step.phase === 'building')
  const stations = state.milestones.filter((milestone) => !['select', 'verify', 'cleanup'].includes(milestone.id))
  const source = state.milestones[0]
  const verification = state.milestones.find((milestone) => milestone.id === 'verify')!
  const cleanup = state.milestones.at(-1)!
  const assetsStored = !builds || scenario.steps.slice(0, completedCount).some((step) => step.id === 'publish-static')
  const trafficTarget = state.candidateServing ? 'candidate' : scenario.hasExistingRuntime ? 'existing' : 'none'
  const releaseCurrency = configuration.release.variables[0].value
  const activeCurrency = configuration.active?.variables[0].value

  useEffect(() => {
    if (!isAnimating || !window.matchMedia?.('(max-width: 720px)').matches) return
    root.current?.querySelector('[aria-current="step"]')?.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    })
  }, [isAnimating, state.milestone.id])

  const stationClass = (milestone: OverviewMilestone) => completedCount >= milestone.end ? 'is-done' : milestone.id === state.milestone.id ? 'is-current' : 'is-upcoming'
  const stationButton = (milestone: OverviewMilestone) => {
    const done = completedCount >= milestone.end
    const active = !state.complete && state.milestone.id === milestone.id
    const index = state.milestones.indexOf(milestone)
    const Icon = stationIcons[milestone.id]
    return (
      <button type="button" className="flow-station" aria-label={`Go to stage ${index + 1}: ${milestone.label}`} aria-describedby={`flow-context-${milestone.id}`} aria-current={active ? 'step' : undefined} onClick={() => onMilestoneSelect(milestone.start)} title={milestone.description}>
        <span className="flow-symbol"><Icon size={26} strokeWidth={1.7} aria-hidden="true" /><span className="flow-number" aria-hidden="true">{done ? <Check size={11} /> : index + 1}</span></span>
        <strong>{milestone.station}</strong>
        <span className="flow-action" id={`flow-context-${milestone.id}`}>{milestone.context}</span>
        <span className="flow-state">{done ? <><Check size={11} aria-hidden="true" />{milestone.id === 'check' ? 'Endpoint healthy' : 'Done'}</> : active ? isAnimating ? 'In progress' : 'You are here' : 'Up next'}</span>
      </button>
    )
  }

  return (
    <div ref={root} id="overview-panel" className="overview" role="tabpanel" aria-labelledby="overview-tab">
      <div className="flow-caption" role="status" aria-label="Current stage">
        <span className="flow-counter">{String(state.milestoneIndex + 1).padStart(2, '0')}<small>/ {String(state.milestones.length).padStart(2, '0')}</small></span>
        <div><h2>{state.complete ? `${state.newVersion} is live.` : state.milestone.title}</h2><p>{state.complete ? state.milestone.result : state.milestone.description}</p></div>
        <button type="button" className="overview-detail-link" onClick={onTechnicalView}>Technical detail <ArrowRight size={16} aria-hidden="true" /></button>
      </div>

      <div className={`flow-map overview-canvas${isAnimating ? ' is-running' : ''}`} data-current-stage={state.complete ? 'complete' : state.milestone.id} style={{ '--flow-duration': `${motionDurationMs}ms` } as CSSProperties}>
        <section className="release-inputs" aria-labelledby="release-inputs-title">
          <h3 id="release-inputs-title" className="canvas-zone-title">Release inputs</h3>
          <div className={`flow-stop ${stationClass(source)}`} data-station="select">{stationButton(source)}</div>
          <div className="release-version-config" role="group" aria-label="Desired version configuration">
            <span>Version configuration</span><code>CURRENCY={configuration.desired.variables[0].value}</code><small>{configuration.retained ? 'Desired edits are not used' : 'Captured with source + manifest'}</small>
          </div>
          <div className={`release-snapshot${configuration.captured ? ' is-frozen' : ''}`} role="group" aria-label="Release version snapshot" data-captured={configuration.captured}>
            <LockKeyhole size={20} aria-hidden="true" />
            <div><strong>{state.newVersion} {configuration.captured ? 'snapshot' : 'next snapshot'}</strong><code>CURRENCY={releaseCurrency}</code></div>
            <span>{configuration.captured ? 'Frozen' : 'On creation'}</span>
          </div>
          <p className="version-ownership"><LockKeyhole size={13} aria-hidden="true" />Travels with this version</p>
        </section>

        <section className="release-delivery" aria-labelledby="release-delivery-title">
          <div className="canvas-zone-heading"><h3 id="release-delivery-title" className="canvas-zone-title">Build and delivery</h3>{!builds && <span className="flow-reuse-note"><RefreshCw size={13} aria-hidden="true" />{scenario.id === 'commit' ? 'Exact match reused' : 'Build skipped'}</span>}</div>
          <ol className="flow-track" aria-label="Deployment flow">
            {stations.map((milestone, index) => {
              const active = !state.complete && milestone.id === state.milestone.id
              const direction = index === 0 ? 'inlet' : index === 3 ? 'turn' : index > 3 ? 'reverse' : 'forward'
              return (
                <li key={milestone.id} data-station={milestone.id} className={`flow-stop ${stationClass(milestone)}`} style={{ '--column': index < 3 ? index + 1 : 6 - index, '--row': index < 3 ? 1 : 2 } as CSSProperties}>
                  <span className={`flow-connector direction-${direction}`}>
                    <span className="flow-handoff">{milestone.handoff}</span>
                    {active && isAnimating && <span key={`${milestone.id}-${motionDurationMs}`} className="flow-packet" data-payload={milestone.payload} aria-hidden="true"><Container size={14} /></span>}
                  </span>
                  {stationButton(milestone)}
                </li>
              )
            })}
          </ol>
          <div className={`flow-static-path${assetsStored ? ' outputs-ready' : ''}`} role="group" aria-label="Static asset path" data-assets-stored={assetsStored}>
            <span><Files size={16} aria-hidden="true" />Static files</span><ArrowRight size={15} aria-hidden="true" /><span><Database size={16} aria-hidden="true" />Embr Blob Storage</span><ArrowRight size={15} aria-hidden="true" /><span><Route size={16} aria-hidden="true" />YARP</span>
          </div>
        </section>

        <section className="release-visual" data-route-target={trafficTarget} aria-labelledby="running-app-title">
          <h3 id="running-app-title" className="canvas-zone-title">Running app</h3>
          <div className={`flow-stop ${stationClass(verification)}`} data-station="verify">{stationButton(verification)}</div>
          <div className="active-release" role="group" aria-label="Active version configuration" data-active-version={state.servingVersion ?? 'none'}>
            <div className="customer-traffic" role="group" aria-label="Customer traffic"><Users size={16} aria-hidden="true" /><span>Customers</span><ArrowRight size={14} aria-hidden="true" /><span>Embr YARP</span></div>
            <div className="active-release-version"><Server size={28} aria-hidden="true" /><strong>{state.servingVersion ?? 'Not live yet'}</strong></div>
            <code>{activeCurrency ? `CURRENCY=${activeCurrency}` : 'No active configuration'}</code>
            <span className="active-config-source"><LockKeyhole size={12} aria-hidden="true" />{state.servingVersion ? `From the ${state.servingVersion} snapshot` : 'Waiting for the first release'}</span>
          </div>
          {!state.candidateServing && <p className="incoming-release">Incoming <strong>{state.newVersion}</strong><span>{releaseCurrency}</span></p>}
          <div className="runtime-policy" role="group" aria-label="Effective runtime scaling policy"><Gauge size={16} aria-hidden="true" /><span>{effectiveScale.minReplicas}-{effectiveScale.maxReplicas} replicas <small>CPU target {effectiveScale.cpuUtilizationPercent}%</small></span></div>
        </section>

        <section className={`overview-app-policy${policy.pending ? ' is-applying' : ''}`} aria-labelledby="overview-policy-title">
          <div className="app-policy-heading"><Settings2 size={23} aria-hidden="true" /><div><h3 id="overview-policy-title">App-wide settings</h3><span>Stay current across version changes</span></div></div>
          <div className="app-policy-current" role="group" aria-label="Desired app scaling policy"><strong>{policy.desired.components[0].minReplicas}-{policy.desired.components[0].maxReplicas} replicas</strong><span>CPU target {policy.desired.components[0].cpuUtilizationPercent}%</span></div>
          <div className="app-policy-path"><span>No build. No new version.</span><i aria-hidden="true"><ArrowRight size={17} />{policy.pending && <b><Settings2 size={12} /></b>}</i></div>
          <div className="app-policy-command"><button type="button" onClick={onApplyPolicy} disabled={!state.servingVersion || isAnimating || appPolicyPhase !== 'baseline'}><Gauge size={16} aria-hidden="true" />{appPolicyPhase === 'updated' ? 'Policy applied' : policy.pending ? 'Applying policy' : 'Apply 2-5 replicas'}</button><span role="status" aria-label="Policy application">{policy.pending ? 'Pending application' : appPolicyPhase === 'updated' ? 'Applied without redeploying' : 'Scaling preview'}</span></div>
          {appPolicyPhase === 'updated' && <button type="button" className="policy-reset" aria-label="Reset app policy" title="Reset app policy" onClick={onResetPolicy}><RotateCcw size={15} aria-hidden="true" /></button>}
        </section>
      </div>

      <div className="overview-footer">
        <div className="release-outcome" role="status" aria-label="Release status">{state.released ? <CircleCheck size={18} aria-hidden="true" /> : <ShieldCheck size={18} aria-hidden="true" />}<strong>{state.released ? 'Deployment succeeded' : state.candidateServing ? 'Verifying release' : scenario.hasExistingRuntime ? 'Current version stays live' : 'Waiting for first release'}</strong><span>{state.servingVersion ? `${state.servingVersion} is serving customers` : 'No live version yet'}</span></div>
        <button type="button" className={`flow-cleanup${state.milestone.id === 'cleanup' ? ' is-current' : ''}`} onClick={() => onMilestoneSelect(cleanup.start)} aria-label={`Go to stage ${state.milestones.length}: After release`} aria-current={!state.complete && state.milestone.id === 'cleanup' ? 'step' : undefined}><Trash2 size={15} aria-hidden="true" />{state.complete ? 'Cleanup complete' : state.released ? 'Background cleanup' : 'After release'}</button>
      </div>
    </div>
  )
}