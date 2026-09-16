import type { CSSProperties } from 'react'
import {
  AppWindow,
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
  TerminalSquare,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import {
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
  health: HeartPulse,
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
  health: { width: 72, height: 72 },
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
  const old = scenario.oldVersion
  const next = scenario.newVersion
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
  selected,
  cutover,
  onSelect,
}: {
  id: NodeId
  scenario: Scenario
  step: FlowStep | undefined
  selected: boolean
  cutover: CutoverState
  onSelect: (id: NodeId) => void
}) {
  const node = nodes.find((item) => item.id === id) ?? nodes[0]
  const Icon = iconByNode[id]
  const active = step?.source === id || step?.target === id
  const context = id === 'existing' || id === 'candidate' || id === 'route' || id === 'customer'
  const dimmed = Boolean(step && !active && !context && !selected)
  const provider = providerState(cutover, scenario)
  const status = id === 'existing' ? provider.old : id === 'candidate' ? provider.next : undefined
  const statusTone = id === 'existing' ? provider.oldTone : id === 'candidate' ? provider.nextTone : undefined
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
        <span className="node-eyebrow">{node.eyebrow}</span>
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
          </div>
          <h2 id="active-step-title">{step?.title ?? 'Deployment complete'}</h2>
        </div>
        <div className="step-progress" aria-label={`${stepIndex} of ${scenario.steps.length} steps complete`}>
          <span style={{ width: `${(stepIndex / scenario.steps.length) * 100}%` }} />
        </div>
      </header>

      <div className="transfer-brief" aria-live="polite">
        <div>
          <span>{isAnimating ? 'Moving now' : 'Moving'}</span>
          <strong>{step?.payload ?? 'Active Deployment reference'}</strong>
        </div>
        <div>
          <span>After this step</span>
          <strong>{step?.result ?? 'The previous provider has been removed.'}</strong>
        </div>
      </div>

      <div className="stage-scroll">
        <div className="system-stage">
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
            </defs>
            <path className="customer-line" d="M 185 566 C 220 566, 250 572, 286 572" markerEnd="url(#green-arrow)" />
            <path className={`provider-line old tone-${provider.oldTone}`} d="M 422 572 C 448 572, 466 552, 492 552" markerEnd="url(#green-arrow)" />
            <path className={`provider-line next tone-${provider.nextTone}`} d="M 422 572 C 550 450, 720 450, 844 552" markerEnd="url(#green-arrow)" />
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
              selected={selectedNode === node.id}
              cutover={cutover}
              onSelect={onSelectNode}
            />
          ))}

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
