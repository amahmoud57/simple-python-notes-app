import type { CSSProperties } from 'react'
import {
  AppWindow,
  ArrowRight,
  Boxes,
  CircleCheck,
  ClipboardList,
  CloudCog,
  Container,
  Database,
  FileCode2,
  GitBranch,
  Globe2,
  Hammer,
  HeartPulse,
  PackageCheck,
  Route as RouteIcon,
  Server,
  ServerOff,
  TerminalSquare,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import {
  executionSurfaceLabels,
  getNodeLabel,
  nodes,
  phaseLabels,
  type CutoverState,
  type FlowStep,
  type NodeId,
  type PayloadKind,
  type Scenario,
} from '../model'

interface SystemStageProps {
  scenario: Scenario
  step: FlowStep | undefined
  stepIndex: number
  isAnimating: boolean
  travelStarted: boolean
  motionDurationMs: number
  cutover: CutoverState
  selectedNode: NodeId | null
  onSelectNode: (id: NodeId) => void
}

const iconByNode: Record<NodeId, LucideIcon> = {
  client: TerminalSquare,
  arm: CloudCog,
  regional: Workflow,
  deployment: ClipboardList,
  app: AppWindow,
  github: GitBranch,
  manifest: FileCode2,
  version: PackageCheck,
  build: Hammer,
  blob: Database,
  acr: Container,
  artifact: Boxes,
  candidate: Server,
  existing: Server,
  route: RouteIcon,
  customer: Globe2,
}

const payloadIcon: Record<PayloadKind, LucideIcon> = {
  request: CloudCog,
  file: FileCode2,
  revision: GitBranch,
  build: Hammer,
  static: Database,
  image: Container,
  resource: Boxes,
  health: HeartPulse,
  route: RouteIcon,
  timer: CircleCheck,
  delete: Boxes,
}

const point = (id: NodeId) => {
  const node = nodes.find((item) => item.id === id) ?? nodes[0]
  return { x: node.x + 68, y: node.y + 34 }
}

const machineSize: Partial<Record<NodeId, { width: number; height: number }>> = {
  manifest: { width: 88, height: 82 },
  version: { width: 136, height: 68 },
  blob: { width: 136, height: 66 },
}

type RouteTarget = 'none' | 'existing' | 'candidate'

function getRouteTarget(cutover: CutoverState, scenario: Scenario): RouteTarget {
  if (['switched', 'verified', 'active', 'draining', 'deleting', 'deleted'].includes(cutover)) {
    return 'candidate'
  }

  return scenario.hasExistingRuntime ? 'existing' : 'none'
}

function edgePoint(id: NodeId, toward: { x: number; y: number }) {
  const center = point(id)
  const size = machineSize[id] ?? { width: 136, height: 58 }
  const deltaX = toward.x - center.x
  const deltaY = toward.y - center.y
  const length = Math.hypot(deltaX, deltaY) || 1
  const unitX = deltaX / length
  const unitY = deltaY / length
  const horizontalDistance = Math.abs(unitX) < 0.001
    ? Number.POSITIVE_INFINITY
    : size.width / 2 / Math.abs(unitX)
  const verticalDistance = Math.abs(unitY) < 0.001
    ? Number.POSITIVE_INFINITY
    : size.height / 2 / Math.abs(unitY)
  const distance = Math.min(horizontalDistance, verticalDistance) + 14
  return {
    x: center.x + unitX * distance,
    y: center.y + unitY * distance,
  }
}

function transferGeometry(source: NodeId, target: NodeId) {
  const sourceCenter = point(source)
  const targetCenter = point(target)
  const start = edgePoint(source, targetCenter)
  const end = edgePoint(target, sourceCenter)
  const bend = Math.max(58, Math.abs(end.x - start.x) * 0.42)
  const direction = end.x >= start.x ? 1 : -1
  return {
    start,
    end,
    path: `M ${start.x} ${start.y} C ${start.x + direction * bend} ${start.y}, ${end.x - direction * bend} ${end.y}, ${end.x} ${end.y}`,
  }
}

function providerState(cutover: CutoverState, scenario: Scenario) {
  const old = scenario.oldVersion ?? 'previous version'
  const next = scenario.newVersion
  if (!scenario.hasExistingRuntime) {
    switch (cutover) {
      case 'candidate':
        return { old: 'No provider', next: `Isolated - ${next}`, oldTone: 'empty', nextTone: 'idle', target: 'No backend assigned', note: `${next} exists in isolation; the customer route is still unassigned.` }
      case 'healthy':
        return { old: 'No provider', next: `Healthy - ${next}`, oldTone: 'empty', nextTone: 'ready', target: 'No backend assigned', note: `${next} passed direct health and can now become the first YARP backend.` }
      case 'switched':
        return { old: 'No predecessor', next: `Serving - ${next}`, oldTone: 'empty', nextTone: 'serving', target: `YARP targets ${next}`, note: 'The first route is assigned. Customer traffic now reaches the new provider.' }
      case 'verified':
        return { old: 'No predecessor', next: `Verified - ${next}`, oldTone: 'empty', nextTone: 'serving', target: `${next} verified`, note: `The customer URL returned ${next}; there is no predecessor to retain.` }
      case 'active':
        return { old: 'No predecessor', next: `Active - ${next}`, oldTone: 'empty', nextTone: 'serving', target: `${next} is active`, note: 'The first Deployment is active. No drain or deletion phase is required.' }
      default:
        return { old: 'No provider', next: `Not created - ${next}`, oldTone: 'empty', nextTone: 'idle', target: 'No backend assigned', note: 'The Builder App exists, but no Artifact App or YARP backend exists yet.' }
    }
  }

  switch (cutover) {
    case 'candidate':
      return { old: `Serving 100% - ${old}`, next: `Isolated - ${next}`, oldTone: 'serving', nextTone: 'idle', target: `${old} stays live`, note: `${next} exists but receives no customer traffic.` }
    case 'healthy':
      return { old: `Serving 100% - ${old}`, next: `Healthy 0% - ${next}`, oldTone: 'serving', nextTone: 'ready', target: `${old} stays live`, note: `${next} passed direct health and is ready for activation.` }
    case 'switched':
      return { old: `Retained - ${old}`, next: `Serving 100% - ${next}`, oldTone: 'draining', nextTone: 'serving', target: `YARP targets ${next}`, note: `${old} remains available until public verification succeeds.` }
    case 'verified':
      return { old: `Retained - ${old}`, next: `Verified 100% - ${next}`, oldTone: 'draining', nextTone: 'serving', target: `${next} verified`, note: `The customer URL returned ${next}; ${old} is still the rollback safety net.` }
    case 'draining':
      return { old: `Draining 5 min - ${old}`, next: `Active 100% - ${next}`, oldTone: 'draining', nextTone: 'serving', target: `${next} is active`, note: `${old} remains through the route convergence and connection-drain grace period.` }
    case 'deleting':
      return { old: `Deleting - ${old}`, next: `Active 100% - ${next}`, oldTone: 'deleting', nextTone: 'serving', target: `${next} is active`, note: `The grace deadline passed. Embr is deleting the old Artifact App and ADC Artifact.` }
    case 'deleted':
      return { old: `Deleted - ${old}`, next: `Active 100% - ${next}`, oldTone: 'deleted', nextTone: 'serving', target: `${next} is active`, note: `${old} is gone. Only the active provider remains.` }
    default:
      return { old: `Serving 100% - ${old}`, next: `Not created - ${next}`, oldTone: 'serving', nextTone: 'idle', target: `${old} is active`, note: 'The existing Artifact App serves all traffic while the replacement is prepared.' }
  }
}

function NodeButton({
  id,
  scenario,
  step,
  completedCount,
  selected,
  cutover,
  onSelect,
}: {
  id: NodeId
  scenario: Scenario
  step: FlowStep | undefined
  completedCount: number
  selected: boolean
  cutover: CutoverState
  onSelect: (id: NodeId) => void
}) {
  const node = nodes.find((item) => item.id === id) ?? nodes[0]
  const Icon = id === 'existing' && !scenario.hasExistingRuntime ? ServerOff : iconByNode[id]
  const eyebrow = id === 'existing' && !scenario.hasExistingRuntime ? 'Runtime starts empty' : node.eyebrow
  const active = step?.source === id || step?.target === id
  const context = id === 'app' || id === 'existing' || id === 'candidate' || id === 'route' || id === 'customer'
  const dimmed = Boolean(step && !active && !context && !selected)
  const provider = providerState(cutover, scenario)
  const completedIds = new Set(scenario.steps.slice(0, completedCount).map((item) => item.id))
  const retainedVersion = scenario.id === 'redeploy' || scenario.id === 'rollback'
  const versionCreated = retainedVersion || completedIds.has('create-version')
  const deploymentCreated = completedIds.has('create-deployment')
    || [...completedIds].some((item) => item.endsWith('-create-deployment'))
  const versionBuilding = retainedVersion || completedIds.has('start-version-build')
  const versionReady = retainedVersion || completedIds.has('finish-version-build')
  const deploymentComplete = completedCount >= scenario.steps.length
  const deploymentStatus = deploymentComplete
    ? { text: 'Succeeded', tone: 'serving' }
    : cutover === 'draining' || cutover === 'deleting'
      ? { text: 'Cleaning up', tone: 'draining' }
      : ['switched', 'verified', 'active'].includes(cutover)
        ? { text: 'Activating', tone: 'existing' }
        : versionReady
          ? { text: 'Provisioning', tone: 'ready' }
          : versionBuilding
            ? { text: 'Building', tone: 'building' }
            : { text: 'Pending', tone: 'pending' }
  const lifecycleStatus = id === 'app'
    ? { text: 'Exists before deploy', tone: 'existing' }
    : id === 'version'
      ? versionReady
        ? { text: 'Ready', tone: 'serving' }
        : versionBuilding
          ? { text: 'Building', tone: 'building' }
        : versionCreated
          ? { text: 'Pending', tone: 'ready' }
          : deploymentCreated
            ? { text: 'ID reserved', tone: 'reserved' }
          : { text: 'Not created', tone: 'idle' }
      : id === 'deployment'
        ? deploymentCreated
          ? deploymentStatus
          : { text: 'Not created', tone: 'idle' }
        : id === 'customer'
          ? !scenario.hasExistingRuntime && !['switched', 'verified', 'active'].includes(cutover)
            ? { text: 'No route yet', tone: 'idle' }
            : cutover === 'verified' || cutover === 'active' || cutover === 'draining'
              ? { text: 'Public route verified', tone: 'serving' }
              : { text: scenario.hasExistingRuntime ? 'Stable app URL' : 'Route created', tone: 'existing' }
        : undefined
  const status = id === 'existing'
    ? provider.old
    : id === 'candidate'
      ? provider.next
      : lifecycleStatus?.text
  const statusTone = id === 'existing'
    ? provider.oldTone
    : id === 'candidate'
      ? provider.nextTone
      : lifecycleStatus?.tone
  const classes = [
    'system-node',
    `node-${node.group}`,
    `shape-${id}`,
    active ? 'is-step-node' : '',
    step?.source === id ? 'is-sending' : '',
    step?.target === id ? 'is-receiving' : '',
    selected ? 'is-selected' : '',
    dimmed ? 'is-dimmed' : '',
    id === 'existing' && cutover === 'deleting' ? 'is-deleting' : '',
    id === 'existing' && cutover === 'deleted' ? 'is-deleted' : '',
    id === 'existing' && !scenario.hasExistingRuntime ? 'is-empty-runtime' : '',
  ].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      className={classes}
      style={{ left: node.x, top: node.y }}
      aria-label={`Inspect ${getNodeLabel(node, scenario)}`}
      aria-pressed={selected}
      onClick={() => onSelect(id)}
    >
      <span className="node-machine" aria-hidden="true">
        <Icon size={22} strokeWidth={1.8} />
        <span>{getNodeLabel(node, scenario)}</span>
      </span>
      <span className="node-copy">
        <span className="node-eyebrow">{eyebrow}</span>
        <strong>{getNodeLabel(node, scenario)}</strong>
        {status ? <span className={`provider-status tone-${statusTone}`}>{status}</span> : null}
      </span>
    </button>
  )
}

export function SystemStage({
  scenario,
  step,
  stepIndex,
  isAnimating,
  travelStarted,
  motionDurationMs,
  cutover,
  selectedNode,
  onSelectNode,
}: SystemStageProps) {
  const geometry = step
    ? transferGeometry(step.source, step.target)
    : transferGeometry('client', 'arm')
  const PayloadIcon = step ? payloadIcon[step.payloadKind] : CloudCog
  const provider = providerState(cutover, scenario)
  const routeTarget = getRouteTarget(cutover, scenario)
  const routeLive = routeTarget !== 'none'
  const customerRoute = transferGeometry('customer', 'route')
  const backendRoute = routeTarget === 'none' ? null : transferGeometry('route', routeTarget)
  const routePoint = point('route')
  const candidateExists = ['candidate', 'healthy', 'switched', 'verified', 'active', 'draining', 'deleting', 'deleted'].includes(cutover)
  const candidateHealthy = ['healthy', 'switched', 'verified', 'active', 'draining', 'deleting', 'deleted'].includes(cutover)
  const healthStepActive = step?.id === 'direct-health' || step?.id.endsWith('-health')
  const healthState = candidateHealthy
    ? 'passed'
    : healthStepActive && isAnimating
      ? 'probing'
      : candidateExists
        ? healthStepActive
          ? 'next'
          : 'waiting'
        : 'absent'
  const healthResult = healthState === 'passed'
    ? 'Passed · 2 × HTTP 200'
    : healthState === 'probing'
      ? 'Probing candidate FQDN'
      : healthState === 'next'
        ? 'Next · direct candidate probe'
        : healthState === 'waiting'
          ? 'Waiting for direct probe'
          : 'Waiting for candidate'
  const sourceLabel = step
    ? getNodeLabel(nodes.find((node) => node.id === step.source) ?? nodes[0], scenario)
    : null
  const targetLabel = step
    ? getNodeLabel(nodes.find((node) => node.id === step.target) ?? nodes[0], scenario)
    : null
  const travelStyle = {
    '--start-x': `${geometry.start.x}px`,
    '--start-y': `${geometry.start.y}px`,
    '--end-x': `${geometry.end.x}px`,
    '--end-y': `${geometry.end.y}px`,
    '--travel-duration': `${motionDurationMs}ms`,
  } as CSSProperties

  return (
    <section className="stage-panel" aria-labelledby="active-step-title">
      <header className={`active-step phase-${step?.phase ?? 'succeeded'}`}>
        <div className="step-number">
          {step ? String(stepIndex + 1).padStart(2, '0') : String(scenario.steps.length).padStart(2, '0')}
          <span>/ {scenario.steps.length}</span>
        </div>
        <div className="step-summary">
          <div className="step-overline">
            <span>{isAnimating ? 'In progress' : step ? 'Up next' : 'Complete'}</span>
            <span>{step ? phaseLabels[step.phase] : phaseLabels.succeeded}</span>
            {step ? (
              <span
                className={`execution-surface surface-${step.executionSurface}`}
                aria-label={`Execution surface: ${executionSurfaceLabels[step.executionSurface]}`}
                title={step.api}
              >
                {executionSurfaceLabels[step.executionSurface]}
              </span>
            ) : null}
          </div>
          <h2 id="active-step-title">{step?.title ?? 'Deployment complete'}</h2>
        </div>
        <div className="step-progress" aria-label={`${stepIndex} of ${scenario.steps.length} steps complete`}>
          <span style={{ width: `${(stepIndex / scenario.steps.length) * 100}%` }} />
        </div>
      </header>

      <div className="starting-state" aria-label="State before this deployment">
        <span>Before this flow</span>
        <strong>Builder App already exists</strong>
        <i>GitHub source configured</i>
        <i>{scenario.hasExistingRuntime ? `${scenario.oldVersion} currently active` : 'No active AppVersion'}</i>
        {!scenario.hasExistingRuntime ? <i>No YARP backend assigned</i> : null}
      </div>

      <div className="transfer-brief" aria-live="polite">
        <div>
          <span>{isAnimating ? 'Happening now' : 'What happens now'}</span>
          <strong>{step?.reason ?? 'All deployment work has completed.'}</strong>
          {step ? (
            <p className="transfer-route">
              <b>{sourceLabel}</b>
              <ArrowRight size={14} aria-hidden="true" />
              <b>{targetLabel}</b>
              <code>{step.payload}</code>
            </p>
          ) : null}
        </div>
        <div>
          <span>State after this step</span>
          <strong>{step?.result ?? 'Deployment succeeded and cleanup is complete.'}</strong>
        </div>
      </div>

      <div className="stage-scroll">
        <div className={`system-stage ${scenario.hasExistingRuntime ? '' : 'is-first-deploy'} ${cutover === 'active' ? 'is-first-live' : ''}`}>
          <div className="stage-zone zone-control"><span>Control plane</span></div>
          <div className="stage-zone zone-source"><span>GitHub source</span></div>
          <div className="stage-zone zone-build"><span>Build and outputs</span></div>
          <div className="stage-zone zone-runtime"><span>Artifact Apps runtime</span></div>
          <div className="stage-zone zone-traffic"><span>Customer traffic</span></div>

          <svg className="stage-lines" viewBox="0 0 1080 680" aria-hidden="true">
            <defs>
              <marker id="flow-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0 0 L8 4 L0 8 Z" />
              </marker>
              <marker id="green-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0 0 L8 4 L0 8 Z" />
              </marker>
              <marker id="idle-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0 0 L8 4 L0 8 Z" />
              </marker>
            </defs>
            <g className={`traffic-routing target-${routeTarget}`} data-route-target={routeTarget}>
              <circle className={`route-halo ${routeLive ? 'is-live' : ''}`} cx={routePoint.x} cy={routePoint.y} r="48" />
              <path className={`customer-line tone-${routeLive ? 'serving' : 'empty'}`} d={customerRoute.path} markerEnd={routeLive ? 'url(#green-arrow)' : 'url(#idle-arrow)'} />
              {backendRoute ? (
                <g key={`${scenario.id}-${routeTarget}`}>
                  <path
                    className={`yarp-backend-route target-${routeTarget}`}
                    d={backendRoute.path}
                    pathLength="1"
                    markerEnd="url(#green-arrow)"
                  />
                  <circle className="traffic-packet" r="5">
                    <animateMotion dur="1.45s" repeatCount="indefinite" path={backendRoute.path} />
                  </circle>
                  <text
                    className="route-target-label"
                    x={(backendRoute.start.x + backendRoute.end.x) / 2}
                    y={(backendRoute.start.y + backendRoute.end.y) / 2 - 13}
                    textAnchor="middle"
                  >
                    ACTIVE → {routeTarget === 'existing' ? scenario.oldVersion : scenario.newVersion}
                  </text>
                </g>
              ) : (
                <g className="unassigned-backend">
                  <path d={`M ${routePoint.x + 70} ${routePoint.y} h 72`} />
                  <text x={routePoint.x + 106} y={routePoint.y - 10} textAnchor="middle">NO BACKEND</text>
                </g>
              )}
            </g>
            {step ? (
              <path
                key={`${scenario.id}-${step.id}`}
                className={`active-transfer ${isAnimating ? 'is-moving' : ''}`}
                d={geometry.path}
                markerEnd="url(#flow-arrow)"
              />
            ) : null}
          </svg>

          {nodes.map((node) => (
            <NodeButton
              key={node.id}
              id={node.id}
              scenario={scenario}
              step={step}
              completedCount={stepIndex}
              selected={selectedNode === node.id}
              cutover={cutover}
              onSelect={onSelectNode}
            />
          ))}

          <div className={`candidate-health-gate state-${healthState}`} data-health-state={healthState} aria-live="polite">
            <span className="health-gate-icon" aria-hidden="true"><HeartPulse size={17} /></span>
            <div>
              <span>Direct health gate</span>
              <strong>{healthResult}</strong>
            </div>
          </div>

          {step && isAnimating ? (
            <div
              className={`travel-payload kind-${step.payloadKind} ${travelStarted ? 'is-traveling' : ''}`}
              style={travelStyle}
              aria-hidden="true"
            >
              <PayloadIcon size={16} />
            </div>
          ) : null}

          <div className={`cutover-status state-${cutover}`}>
            <ActivityIcon />
            <div>
              <span>YARP backend</span>
              <strong>{provider.target}</strong>
            </div>
            <p>{provider.note}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function ActivityIcon() {
  return <span className="cutover-dot" aria-hidden="true" />
}
