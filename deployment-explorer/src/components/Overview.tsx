import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  ArrowRight,
  Check,
  Container,
  Database,
  Files,
  GitBranch,
  Hammer,
  HeartPulse,
  LockKeyhole,
  PackageOpen,
  Route,
  Server,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { operationName, type Scenario } from '../model'
import { formatScaling, getConfigurationState, type ScalingPolicy } from '../configuration'
import { getOverviewState, timelinePhaseLabels, type OverviewMilestone, type OverviewMilestoneId, type TimelinePhase } from '../overview'
import './Overview.css'

const canvasWidth = 1180
const canvasHeight = 410
const stackedBelow = 860
const maxScale = 1.15

type NodeKey = 'source' | 'version' | 'build' | 'acr' | 'blob' | 'artifact' | 'yarp' | 'customers'
type PathKey = 'source-version' | 'drop-version' | 'version-build' | 'build-acr' | 'build-blob' | 'acr-artifact' | 'artifact-runtime' | 'drop-scaling-new' | 'drop-scaling-live' | 'blob-yarp' | 'customers-yarp' | 'yarp-new' | 'yarp-live'
type ElementState = 'current' | 'done' | 'upcoming' | 'skipped' | 'unused' | 'idle'
type SlotState = 'absent' | 'starting' | 'running' | 'healthy' | 'live' | 'old' | 'removing' | 'removed' | 'empty' | 'none'

const nodePoint: Record<NodeKey, { x: number; y: number }> = {
  source: { x: 80, y: 158 },
  version: { x: 228, y: 158 },
  build: { x: 376, y: 158 },
  acr: { x: 524, y: 158 },
  artifact: { x: 672, y: 158 },
  blob: { x: 376, y: 338 },
  yarp: { x: 922, y: 338 },
  customers: { x: 1110, y: 338 },
}

const nodeIcon: Record<NodeKey, LucideIcon> = {
  source: GitBranch,
  version: LockKeyhole,
  build: Hammer,
  acr: Container,
  blob: Database,
  artifact: PackageOpen,
  yarp: Route,
  customers: Users,
}

const paths: Record<PathKey, { d: string; tone: 'version' | 'scaling' | 'traffic'; icon: LucideIcon; label?: { x: number; y: number; anchor?: 'start' | 'middle' } }> = {
  'source-version': { d: 'M 116 158 H 186', tone: 'version', icon: GitBranch, label: { x: 151, y: 148 } },
  'drop-version': { d: 'M 228 76 V 129', tone: 'version', icon: LockKeyhole, label: { x: 237, y: 107, anchor: 'start' } },
  'version-build': { d: 'M 270 158 H 340', tone: 'version', icon: LockKeyhole, label: { x: 305, y: 148 } },
  'build-acr': { d: 'M 412 158 H 488', tone: 'version', icon: Container, label: { x: 450, y: 148 } },
  'build-blob': { d: 'M 376 226 V 309', tone: 'version', icon: Files, label: { x: 385, y: 274, anchor: 'start' } },
  'acr-artifact': { d: 'M 560 158 H 636', tone: 'version', icon: Container, label: { x: 598, y: 148 } },
  'artifact-runtime': { d: 'M 708 158 H 775', tone: 'version', icon: Server, label: { x: 741, y: 148 } },
  'drop-scaling-new': { d: 'M 849 76 V 130', tone: 'scaling', icon: SlidersHorizontal, label: { x: 858, y: 101, anchor: 'start' } },
  'drop-scaling-live': { d: 'M 995 76 V 130', tone: 'scaling', icon: SlidersHorizontal, label: { x: 1004, y: 101, anchor: 'start' } },
  'blob-yarp': { d: 'M 412 338 H 886', tone: 'traffic', icon: Files },
  'customers-yarp': { d: 'M 1074 338 H 958', tone: 'traffic', icon: Users, label: { x: 1016, y: 328 } },
  'yarp-new': { d: 'M 910 311 C 910 290 849 288 849 259', tone: 'traffic', icon: Route },
  'yarp-live': { d: 'M 934 311 C 934 290 995 288 995 259', tone: 'traffic', icon: Route },
}

interface OverviewProps {
  scenario: Scenario
  completedCount: number
  isAnimating: boolean
  motionDurationMs: number
  onMilestoneSelect: (index: number) => void
  onTechnicalView: () => void
}

export function Overview({ scenario, completedCount, isAnimating, motionDurationMs, onMilestoneSelect, onTechnicalView }: OverviewProps) {
  const frame = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<{ mode: 'canvas' | 'stacked'; scale: number }>({ mode: 'canvas', scale: 1 })
  const state = getOverviewState(scenario, completedCount)
  const settings = getConfigurationState(scenario, completedCount)
  const deploy = scenario.kind === 'deployment'
  const builds = state.milestones.some((milestone) => milestone.id === 'build')
  const sourceUsed = builds || scenario.id === 'commit'
  const current = state.complete ? null : state.milestone.id
  const has = (id: OverviewMilestoneId) => state.milestones.some((milestone) => milestone.id === id)

  useLayoutEffect(() => {
    const element = frame.current
    if (!element) return
    const update = () => {
      const width = element.clientWidth
      if (width <= 0) return
      const next = width < stackedBelow
        ? { mode: 'stacked' as const, scale: 1 }
        : { mode: 'canvas' as const, scale: Math.min(maxScale, width / canvasWidth) }
      setLayout((previous) => previous.mode === next.mode && Math.abs(previous.scale - next.scale) < 0.001 ? previous : next)
    }
    update()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isAnimating || layout.mode !== 'stacked') return
    frame.current?.querySelector('.state-current')?.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    })
  }, [isAnimating, layout.mode, current])

  const stateOf = (owners: OverviewMilestoneId[] | undefined): ElementState => {
    const present = (owners ?? []).filter(has)
    if (present.length === 0) return deploy ? 'skipped' : 'idle'
    if (current !== null && present.includes(current)) return 'current'
    return state.reached(present[0]) ? 'done' : 'upcoming'
  }

  const versionChipState: ElementState = settings.desiredUse === 'unused'
    ? 'unused'
    : settings.desiredUse === 'idle' ? 'idle' : stateOf(deploy ? ['select'] : ['save'])
  const scalingChipState = scenario.kind === 'config' ? 'idle' : stateOf(deploy ? ['candidate'] : ['save', 'apply'])
  const nodeState: Record<NodeKey, ElementState> = {
    source: sourceUsed ? stateOf(['select']) : deploy ? 'skipped' : 'idle',
    version: stateOf(deploy ? builds ? ['select', 'build', 'publish'] : ['select'] : scenario.kind === 'config' ? ['save'] : undefined),
    build: stateOf(builds ? ['build', 'publish'] : ['build']),
    acr: stateOf(['publish', 'artifact']),
    blob: stateOf(builds ? ['build'] : ['publish']),
    artifact: stateOf(['artifact', 'candidate']),
    yarp: deploy ? stateOf(['release', 'verify']) : 'done',
    customers: deploy ? stateOf(['verify']) : 'done',
  }

  const newSlot: SlotState = !deploy
    ? 'none'
    : state.reached('release') ? 'live'
      : state.reached('check') ? 'healthy'
        : state.reached('candidate') ? 'running'
          : current === 'candidate' ? 'starting' : 'absent'
  const liveSlot: SlotState = !scenario.hasExistingRuntime
    ? 'empty'
    : !deploy || !state.reached('release') ? 'live'
      : state.complete ? 'removed'
        : current === 'cleanup' ? 'removing' : 'old'
  const routeTarget = newSlot === 'live' ? 'new' : liveSlot === 'live' ? 'live' : 'none'
  const health = state.reached('check') ? 'passed' : current === 'check' ? 'probing' : 'waiting'

  const pathState: Record<PathKey, ElementState> = {
    'source-version': sourceUsed ? stateOf(['select']) : deploy ? 'skipped' : 'idle',
    'drop-version': versionChipState === 'unused' || versionChipState === 'idle' ? versionChipState : stateOf(deploy ? ['select'] : ['save']),
    'version-build': stateOf(builds ? ['build', 'publish'] : ['build']),
    'build-acr': builds ? stateOf(['publish']) : deploy ? 'skipped' : 'idle',
    'build-blob': builds ? stateOf(['build']) : deploy ? 'skipped' : 'idle',
    'acr-artifact': stateOf(['artifact']),
    'artifact-runtime': stateOf(['candidate']),
    'drop-scaling-new': stateOf(['candidate']),
    'drop-scaling-live': stateOf(['apply']),
    'blob-yarp': routeTarget === 'none' ? 'idle' : current === 'release' ? 'current' : 'done',
    'customers-yarp': routeTarget === 'none' ? 'idle' : current === 'verify' ? 'current' : 'done',
    'yarp-new': routeTarget === 'new' || current === 'release' || current === 'verify' ? stateOf(['release', 'verify']) : 'idle',
    'yarp-live': routeTarget === 'live' && current !== 'release' ? 'done' : 'idle',
  }
  const visiblePaths = (Object.keys(paths) as PathKey[]).filter((key) =>
    key === 'drop-scaling-live' ? scenario.kind === 'scale'
      : key === 'drop-scaling-new' ? deploy
        : key === 'yarp-new' || key === 'yarp-live' ? pathState[key] !== 'idle'
          : true)
  const pathLabel: Partial<Record<PathKey, string>> = {
    'source-version': sourceUsed ? scenario.id === 'commit' ? 'commit 71ab42d' : 'commit' : undefined,
    'drop-version': settings.desiredUse === 'captured' ? `frozen into ${state.newVersion}` : settings.desiredUse === 'matched' ? 'must match' : settings.desiredUse === 'unused' ? 'not used' : settings.desiredUse === 'saved' ? 'waits for next version' : undefined,
    'version-build': builds ? 'code + vars' : undefined,
    'build-acr': builds ? 'api image' : undefined,
    'build-blob': builds ? 'web files' : undefined,
    'acr-artifact': deploy ? 'pull · AcrPull' : undefined,
    'artifact-runtime': deploy ? 'runs' : undefined,
    'drop-scaling-new': `applied to ${state.newVersion}`,
    'drop-scaling-live': `applied live to ${state.oldVersion}`,
    'customers-yarp': 'requests',
  }
  const packets = isAnimating ? visiblePaths.filter((key) => pathState[key] === 'current') : []

  const nodeCopy: Record<NodeKey, { name: string; context: string }> = {
    source: { name: 'GitHub', context: !sourceUsed ? deploy ? 'not needed' : 'your repo' : scenario.id === 'commit' ? 'exact commit' : 'your repo · commit' },
    version: {
      name: 'AppVersion',
      context: scenario.kind === 'config' ? 'next deploy captures it'
        : scenario.kind === 'scale' ? 'unchanged'
          : scenario.id === 'commit' ? 'commit + config matched'
            : scenario.id === 'redeploy' ? 'reused · active version'
              : scenario.id === 'activate' ? 'reused · own config' : 'commit + yaml + config',
    },
    build: { name: 'ADC build sandbox', context: builds ? 'one per component' : deploy ? 'not needed · reused' : 'not used' },
    acr: { name: 'Embr ACR', context: builds ? 'OCI image registry' : 'reused image' },
    blob: { name: 'Embr Blob', context: builds ? 'static files' : 'reused files' },
    artifact: { name: 'ADC Artifact', context: 'imported image' },
    yarp: { name: 'Embr YARP', context: 'app URL · routing' },
    customers: {
      name: 'Customers',
      context: routeTarget === 'none' ? 'no app yet' : state.released ? `${state.newVersion} verified` : `reach ${routeTarget === 'new' ? state.newVersion : state.oldVersion}`,
    },
  }

  const versionCard = scenario.kind === 'config'
    ? { label: 'next', frozen: false }
    : scenario.kind === 'scale' ? { label: state.oldVersion ?? '', frozen: true }
      : { label: state.newVersion, frozen: !builds || state.reached('select') }

  const node = (key: NodeKey, group: 'build' | 'traffic', extra?: ReactNode) => {
    const Icon = nodeIcon[key]
    const point = nodePoint[key]
    return (
      <div
        key={key}
        className={`ov-node node-${key} group-${group} state-${nodeState[key]}`}
        data-node={key}
        role="group"
        aria-label={`${nodeCopy[key].name}: ${nodeCopy[key].context}`}
        style={{ '--x': point.x, '--y': point.y } as CSSProperties}
      >
        {key === 'version' ? (
          <span className={`ov-version-card${versionCard.frozen ? ' is-frozen' : ''}`} data-frozen={versionCard.frozen}>
            {versionCard.frozen && <LockKeyhole size={14} aria-hidden="true" />}
            <b>{versionCard.label}</b>
          </span>
        ) : (
          <span className="ov-icon"><Icon size={22} strokeWidth={1.8} aria-hidden="true" /></span>
        )}
        <strong>{nodeCopy[key].name}</strong>
        <span className="ov-context">{nodeCopy[key].context}</span>
        {extra}
      </div>
    )
  }

  const slot = (role: 'new' | 'live', slotState: SlotState, version: string | null, host: string | null, scaling: ScalingPolicy | null) => {
    const tag: Record<SlotState, string> = {
      absent: 'next', starting: 'starting', running: 'no traffic', healthy: 'healthy · no traffic', live: 'live', old: 'old · no traffic',
      removing: 'removing', removed: 'removed', empty: 'nothing live', none: 'not needed',
    }
    const filled = !['absent', 'empty', 'none', 'removed'].includes(slotState)
    const name = slotState === 'none' ? 'No new Artifact App' : slotState === 'empty' ? 'No live Artifact App yet' : `${version} Artifact App: ${tag[slotState]}`
    return (
      <div className={`ov-slot slot-${role} slot-state-${slotState}${role === 'live' && current === 'apply' ? ' state-current' : ''}${role === 'new' && ['candidate', 'check'].includes(current ?? '') ? ' state-current' : ''}`} role="group" aria-label={name} data-slot={role} data-slot-state={slotState} data-version={version ?? 'none'}>
        <span className="ov-slot-tag">{tag[slotState]}</span>
        <strong>{slotState === 'empty' || slotState === 'none' ? '—' : version}</strong>
        {filled && host && <span className="ov-slot-config" title={`API_URL=https://${host}`}><LockKeyhole size={12} aria-hidden="true" />{host}</span>}
        {filled && scaling && (
          <span className="ov-slot-scale" title={formatScaling(scaling)}>
            <SlidersHorizontal size={12} aria-hidden="true" />{scaling.minReplicas}–{scaling.maxReplicas}
            <i aria-hidden="true">{Array.from({ length: scaling.maxReplicas }, (_, index) => <b key={index} className={index < scaling.minReplicas ? 'is-on' : undefined} />)}</i>
          </span>
        )}
        {role === 'new' && deploy && filled && (
          <span className={`ov-health health-${health}`} role="img" aria-label={`Health check ${health}`}><HeartPulse size={13} aria-hidden="true" /></span>
        )}
      </div>
    )
  }

  const stageCount = state.milestones.length
  const caption = state.complete ? state.completion : state.milestone
  const phaseGroups = state.milestones.reduce<{ phase: TimelinePhase; milestones: { milestone: OverviewMilestone; index: number }[] }[]>((groups, milestone, index) => {
    const last = groups.at(-1)
    if (last?.phase === milestone.phase) last.milestones.push({ milestone, index })
    else groups.push({ phase: milestone.phase, milestones: [{ milestone, index }] })
    return groups
  }, [])

  return (
    <div id="overview-panel" className="overview" role="tabpanel" aria-labelledby="overview-tab" data-kind={scenario.kind}>
      <div className="flow-caption">
        <div className="flow-caption-status" role="status" aria-label="Current stage">
          <span className="flow-counter">{String(state.milestoneIndex + 1).padStart(2, '0')}<small>/ {String(stageCount).padStart(2, '0')}</small></span>
          <div><h2>{caption.title}</h2><p>{caption.description}</p></div>
        </div>
        <button type="button" className="overview-detail-link" onClick={onTechnicalView}>Technical detail <ArrowRight size={16} aria-hidden="true" /></button>
      </div>

      <ol className="stage-stepper" aria-label={`${operationName(scenario)} timeline`}>
        {phaseGroups.map((group) => (
          <li key={group.phase} className={`stage-phase phase-${group.phase}${group.milestones.some(({ milestone }) => milestone.id === current) ? ' is-current-phase' : ''}`} style={{ flexGrow: group.milestones.length }}>
            <span className="stage-phase-label" id={`stage-phase-${group.phase}`}>{timelinePhaseLabels[group.phase]}</span>
            <ol aria-labelledby={`stage-phase-${group.phase}`}>
              {group.milestones.map(({ milestone, index }) => {
                const done = completedCount >= milestone.end
                const active = milestone.id === current
                return (
                  <li key={milestone.id} className={done ? 'is-done' : active ? 'is-current' : undefined}>
                    <button type="button" aria-label={`Go to stage ${index + 1}: ${milestone.label}`} aria-current={active ? 'step' : undefined} onClick={() => onMilestoneSelect(milestone.start)}>
                      <span className="stage-dot" aria-hidden="true">{done ? <Check size={11} strokeWidth={3} /> : index + 1}</span>
                      <span>{milestone.label}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </li>
        ))}
      </ol>

      <div ref={frame} className="ov-frame" data-layout={layout.mode} style={layout.mode === 'canvas' ? { height: canvasHeight * layout.scale } : undefined}>
        <div
          className={`ov-canvas kind-${scenario.kind}${isAnimating ? ' is-running' : ''}`}
          data-current-stage={current ?? 'complete'}
          data-route-target={routeTarget}
          role="group"
          aria-label="Deployment map"
          style={{ '--flow-duration': `${motionDurationMs}ms`, ...(layout.mode === 'canvas' ? { width: canvasWidth, height: canvasHeight, left: `calc(50% - ${(canvasWidth * layout.scale) / 2}px)`, transform: `scale(${layout.scale})` } : {}) } as CSSProperties}
        >
          <svg className="ov-lines" viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} aria-hidden="true">
            <defs>
              {(['version', 'scaling', 'traffic', 'idle'] as const).map((tone) => (
                <marker key={tone} id={`ov-arrow-${tone}`} className={`ov-arrow tone-${tone}`} markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" /></marker>
              ))}
            </defs>
            {visiblePaths.map((key) => {
              const path = paths[key]
              const lineState = pathState[key]
              const tone = ['skipped', 'unused', 'idle', 'upcoming'].includes(lineState) ? 'idle' : path.tone
              return (
                <g key={key} className={`ov-line tone-${path.tone} state-${lineState}`} data-path={key}>
                  <path d={path.d} markerEnd={key === 'blob-yarp' ? undefined : `url(#ov-arrow-${tone})`} />
                  {path.label && pathLabel[key] && <text x={path.label.x} y={path.label.y} textAnchor={path.label.anchor ?? 'middle'}>{pathLabel[key]}</text>}
                </g>
              )
            })}
          </svg>

          <section className="ov-settings" aria-label="Builder App settings">
            <span className="ov-settings-title">Builder App settings</span>
            <div className={`ov-chip chip-version state-${versionChipState}`} role="group" aria-label="Version configuration" data-use={settings.desiredUse}>
              <span className="ov-chip-eyebrow"><LockKeyhole size={13} aria-hidden="true" />Version config</span>
              <code>API_URL = {settings.desiredHost}</code>
              <span className="ov-chip-rule">{settings.previousDesiredHost ? `Saved · was ${settings.previousDesiredHost}` : settings.desiredUse === 'unused' ? `Not used · ${state.newVersion} keeps its own` : 'Frozen into each new AppVersion'}</span>
            </div>
            <div className={`ov-chip chip-scaling state-${scalingChipState}`} role="group" aria-label="Scaling policy">
              <span className="ov-chip-eyebrow"><SlidersHorizontal size={13} aria-hidden="true" />Scaling</span>
              <code>{formatScaling(settings.scaling)}</code>
              <span className="ov-chip-rule">{settings.previousScaling ? `Saved · was ${formatScaling(settings.previousScaling)}` : 'Always current · applied live'}</span>
            </div>
          </section>

          <span className="ov-lane-title lane-release" aria-hidden="true">Pipeline</span>
          <span className="ov-lane-title lane-traffic" aria-hidden="true">Live traffic</span>

          {node('source', 'build')}
          {node('version', 'build')}
          {node('build', 'build')}
          {node('acr', 'build')}
          {node('blob', 'build')}
          {node('artifact', 'build')}

          <div className={`ov-runtime state-${deploy ? stateOf(['candidate', 'check', 'release', 'verify', 'cleanup']) : stateOf(['apply'])}`} role="group" aria-label="ADC Artifact Apps">
            <span className="ov-runtime-title">ADC Artifact Apps</span>
            {slot('new', newSlot, deploy ? state.newVersion : null, settings.nextHost, deploy ? settings.scaling : null)}
            {slot('live', liveSlot, state.oldVersion, settings.liveHost, settings.liveScaling)}
          </div>

          {node('yarp', 'traffic')}
          {node('customers', 'traffic')}

          {packets.map((key) => {
            const Icon = paths[key].icon
            return (
              <span key={`${key}-${current}`} className={`ov-packet tone-${paths[key].tone}`} data-packet={key} style={{ offsetPath: `path('${paths[key].d}')` }} aria-hidden="true">
                <Icon size={13} strokeWidth={2.2} />
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}