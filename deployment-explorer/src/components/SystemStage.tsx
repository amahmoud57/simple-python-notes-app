import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
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
  Scan,
  Server,
  ServerOff,
  TerminalSquare,
  Workflow,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react'
import {
  completionLabel,
  executionSurfaceLabels,
  getNodeLabel,
  nodes,
  operationName,
  phaseLabels,
  type CutoverState,
  type FlowStep,
  type NodeId,
  type PayloadKind,
  type Scenario,
} from '../model'
import { baseScaling, formatScaling } from '../configuration'

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

const baseStageWidth = 1080
const stageHeight = 680
const mapPadding = 12
const maxMapZoom = 1.5

const point = (id: NodeId, stageWidth = baseStageWidth) => {
  const node = nodes.find((item) => item.id === id) ?? nodes[0]
  return {
    x: (node.x + 68) * (stageWidth / baseStageWidth),
    y: node.y + 34,
  }
}

const machineSize: Partial<Record<NodeId, { width: number; height: number }>> = {
  manifest: { width: 88, height: 82 },
  version: { width: 136, height: 68 },
  blob: { width: 136, height: 66 },
}

type RouteTarget = 'none' | 'existing' | 'candidate'

function getRouteTarget(cutover: CutoverState, scenario: Scenario): RouteTarget {
  if (['switched', 'verified', 'active', 'cleanupPending', 'deleting', 'deleted'].includes(cutover)) {
    return 'candidate'
  }

  return scenario.hasExistingRuntime ? 'existing' : 'none'
}

function edgePoint(id: NodeId, toward: { x: number; y: number }, stageWidth: number) {
  const center = point(id, stageWidth)
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

function transferGeometry(source: NodeId, target: NodeId, stageWidth: number) {
  const sourceCenter = point(source, stageWidth)
  const targetCenter = point(target, stageWidth)
  const start = edgePoint(source, targetCenter, stageWidth)
  const end = edgePoint(target, sourceCenter, stageWidth)
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
  if (scenario.kind !== 'deployment') {
    return {
      old: `Serving 100% - ${old}`,
      next: 'Not needed',
      oldTone: 'serving',
      nextTone: 'empty',
      target: `${old} stays live`,
      note: scenario.kind === 'scale'
        ? `Scaling updates the running ${old} Artifact App in place. No candidate, Deployment, or route change.`
        : `The running ${old} Artifact App is untouched. The next AppVersion captures the saved value.`,
    }
  }
  if (!scenario.hasExistingRuntime) {
    switch (cutover) {
      case 'candidate':
        return { old: 'No provider', next: `Starting - ${next}`, oldTone: 'empty', nextTone: 'idle', target: 'No backend assigned', note: `${next} is isolated while ADC checks its configured replicas and containers.` }
      case 'nativeReady':
        return { old: 'No provider', next: `Native ready - ${next}`, oldTone: 'empty', nextTone: 'ready', target: 'No backend assigned', note: `${next} passed ADC readiness. Direct HTTPS still has to return one exact HTTP 200.` }
      case 'healthy':
        return { old: 'No provider', next: `Healthy - ${next}`, oldTone: 'empty', nextTone: 'ready', target: 'No backend assigned', note: `${next} passed direct health and can now become the first YARP backend.` }
      case 'switched':
        return { old: 'No predecessor', next: `Serving - ${next}`, oldTone: 'empty', nextTone: 'serving', target: `YARP targets ${next}`, note: 'The first route is assigned. Customer traffic now reaches the new provider.' }
      case 'verified':
        return { old: 'No predecessor', next: `Verified - ${next}`, oldTone: 'empty', nextTone: 'serving', target: `${next} verified`, note: `The customer URL returned ${next}; there is no predecessor to retain.` }
      case 'active':
        return { old: 'No predecessor', next: `Active - ${next}`, oldTone: 'empty', nextTone: 'serving', target: `${next} is active`, note: 'The Deployment has succeeded. Background retention cleanup is independent; there is no predecessor to delete.' }
      default:
        return { old: 'No provider', next: `Not created - ${next}`, oldTone: 'empty', nextTone: 'idle', target: 'No backend assigned', note: 'The Builder App exists, but no Artifact App or YARP backend exists yet.' }
    }
  }

  switch (cutover) {
    case 'candidate':
      return { old: `Serving 100% - ${old}`, next: `Starting - ${next}`, oldTone: 'serving', nextTone: 'idle', target: `${old} stays live`, note: `${next} receives no customer traffic while ADC checks replica and container readiness.` }
    case 'nativeReady':
      return { old: `Serving 100% - ${old}`, next: `Native ready 0% - ${next}`, oldTone: 'serving', nextTone: 'ready', target: `${old} stays live`, note: `${next} passed ADC readiness. Its direct HTTPS endpoint must still return one exact HTTP 200.` }
    case 'healthy':
      return { old: `Serving 100% - ${old}`, next: `Healthy 0% - ${next}`, oldTone: 'serving', nextTone: 'ready', target: `${old} stays live`, note: `${next} passed direct health and is ready for activation.` }
    case 'switched':
      return { old: `Unrouted - ${old}`, next: `Serving 100% - ${next}`, oldTone: 'pending', nextTone: 'serving', target: `YARP targets ${next}`, note: `${old} is retained while Embr verifies the customer URL, but YARP no longer sends it traffic.` }
    case 'verified':
      return { old: `Unrouted - ${old}`, next: `Verified 100% - ${next}`, oldTone: 'pending', nextTone: 'serving', target: `${next} verified`, note: `The customer URL returned ${next}. Promotion can now complete; ${old} remains unrouted.` }
    case 'cleanupPending':
      return { old: `Cleanup pending - ${old}`, next: `Active 100% - ${next}`, oldTone: 'pending', nextTone: 'serving', target: `${next} is active`, note: 'The Deployment has already succeeded. A background reconciler will delete the previous provider and apply retention.' }
    case 'deleting':
      return { old: `Deleting - ${old}`, next: `Active 100% - ${next}`, oldTone: 'deleting', nextTone: 'serving', target: `${next} is active`, note: 'The background reconciler is deleting the previous Artifact App and applying artifact retention.' }
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
  stageWidth,
  selected,
  cutover,
  onSelect,
}: {
  id: NodeId
  scenario: Scenario
  step: FlowStep | undefined
  completedCount: number
  stageWidth: number
  selected: boolean
  cutover: CutoverState
  onSelect: (id: NodeId) => void
}) {
  const node = nodes.find((item) => item.id === id) ?? nodes[0]
  const center = point(id, stageWidth)
  const Icon = id === 'existing' && !scenario.hasExistingRuntime ? ServerOff : iconByNode[id]
  const eyebrow = id === 'existing' && !scenario.hasExistingRuntime ? 'Runtime starts empty' : node.eyebrow
  const active = step?.source === id || step?.target === id
  const context = id === 'app' || id === 'existing' || id === 'candidate' || id === 'route' || id === 'customer'
  const dimmed = Boolean(step && !active && !context && !selected)
  const provider = providerState(cutover, scenario)
  const completedIds = new Set(scenario.steps.slice(0, completedCount).map((item) => item.id))
  const retainedVersion = scenario.kind !== 'deployment' || scenario.id === 'commit' || scenario.id === 'redeploy' || scenario.id === 'activate'
  const versionCreated = retainedVersion || completedIds.has('create-version')
  const deploymentCreated = completedIds.has('create-deployment')
    || [...completedIds].some((item) => item.endsWith('-create-deployment'))
  const versionBuilding = retainedVersion || completedIds.has('start-version-build')
  const versionReady = retainedVersion || completedIds.has('finish-version-build')
  const activationPending = scenario.id === 'activate'
    && deploymentCreated
    && !completedIds.has('activate-prepare')
  const deploymentSucceeded = completedIds.has('promote-runtime')
    || [...completedIds].some((item) => item.endsWith('-promote'))
  const deploymentStatus = deploymentSucceeded
    ? { text: 'Succeeded', tone: 'serving' }
    : ['healthy', 'switched', 'verified', 'active'].includes(cutover)
      ? { text: 'Routing', tone: 'existing' }
      : cutover === 'nativeReady'
        ? { text: 'Health check', tone: 'ready' }
        : activationPending
          ? { text: 'Pending', tone: 'pending' }
          : versionReady
            ? { text: 'Provisioning', tone: 'ready' }
            : { text: 'Building', tone: 'building' }
  const lifecycleStatus = id === 'app'
    ? { text: 'Exists before deploy', tone: 'existing' }
    : id === 'version'
      ? versionReady
        ? { text: 'Ready', tone: 'serving' }
        : versionBuilding
          ? { text: 'Building', tone: 'building' }
        : versionCreated
          ? { text: 'Pending', tone: 'ready' }
          : { text: 'Not created', tone: 'idle' }
      : id === 'deployment'
        ? scenario.kind !== 'deployment'
          ? { text: 'Not needed', tone: 'empty' }
          : deploymentCreated
            ? deploymentStatus
            : { text: 'Not created', tone: 'idle' }
        : id === 'customer'
          ? !scenario.hasExistingRuntime && !['switched', 'verified', 'active', 'cleanupPending', 'deleting', 'deleted'].includes(cutover)
            ? { text: 'No route yet', tone: 'idle' }
            : ['verified', 'active', 'cleanupPending', 'deleting', 'deleted'].includes(cutover)
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
      style={{ left: center.x - 68, top: node.y }}
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
  const viewportRef = useRef<HTMLDivElement>(null)
  const [fitZoom, setFitZoom] = useState(1)
  const [manualZoom, setManualZoom] = useState<number | null>(null)
  const stageWidth = baseStageWidth
  const mapZoom = manualZoom ?? fitZoom
  const minMapZoom = Math.min(0.25, fitZoom)

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const updateFit = () => {
      const width = viewport.clientWidth - mapPadding * 2
      const height = viewport.clientHeight - mapPadding * 2
      if (width <= 0 || height <= 0) return
      const next = Math.min(1, width / baseStageWidth, height / stageHeight)
      setFitZoom((current) => Math.abs(current - next) < 0.0001 ? current : next)
    }

    updateFit()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateFit)
      return () => window.removeEventListener('resize', updateFit)
    }

    const observer = new ResizeObserver(updateFit)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  const geometry = step
    ? transferGeometry(step.source, step.target, stageWidth)
    : transferGeometry('client', 'arm', stageWidth)
  const PayloadIcon = step ? payloadIcon[step.payloadKind] : CloudCog
  const provider = providerState(cutover, scenario)
  const routeTarget = getRouteTarget(cutover, scenario)
  const routeLive = routeTarget !== 'none'
  const customerRoute = transferGeometry('customer', 'route', stageWidth)
  const backendRoute = routeTarget === 'none' ? null : transferGeometry('route', routeTarget, stageWidth)
  const routePoint = point('route', stageWidth)
  const candidatePoint = point('candidate', stageWidth)
  const candidateExists = ['candidate', 'nativeReady', 'healthy', 'switched', 'verified', 'active', 'cleanupPending', 'deleting', 'deleted'].includes(cutover)
  const candidateNativeReady = ['nativeReady', 'healthy', 'switched', 'verified', 'active', 'cleanupPending', 'deleting', 'deleted'].includes(cutover)
  const candidateHealthy = ['healthy', 'switched', 'verified', 'active', 'cleanupPending', 'deleting', 'deleted'].includes(cutover)
  const nativeReadinessStepActive = step?.id === 'create-candidate' || step?.id.endsWith('-candidate')
  const healthStepActive = step?.id === 'direct-health' || step?.id.endsWith('-health')
  const nativeReadinessState = candidateNativeReady
    ? 'passed'
    : nativeReadinessStepActive && isAnimating
      ? 'checking'
      : candidateExists
        ? 'next'
        : 'absent'
  const directHealthState = candidateHealthy
    ? 'passed'
    : healthStepActive && isAnimating
      ? 'probing'
      : candidateNativeReady
        ? healthStepActive
          ? 'next'
          : 'waiting'
        : candidateExists
          ? 'blocked'
          : 'absent'
  const nativeReadinessResult = nativeReadinessState === 'passed'
    ? 'Passed · all replicas ready'
    : nativeReadinessState === 'checking'
      ? 'Checking replicas and containers'
      : nativeReadinessState === 'next'
        ? 'Next · wait for ADC readiness'
        : 'Waiting for candidate'
  const directHealthResult = directHealthState === 'passed'
    ? 'Passed · one HTTP 200'
    : directHealthState === 'probing'
      ? 'Probing candidate FQDN'
      : directHealthState === 'next'
        ? 'Next · direct candidate probe'
        : directHealthState === 'waiting'
          ? 'Waiting for direct probe'
          : directHealthState === 'blocked'
            ? 'Blocked by native readiness'
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
          <h2 id="active-step-title">{step?.title ?? completionLabel(scenario)}</h2>
        </div>
        <div className="step-progress" aria-label={`${stepIndex} of ${scenario.steps.length} steps complete`}>
          <span style={{ width: `${(stepIndex / scenario.steps.length) * 100}%` }} />
        </div>
      </header>

      <div className="starting-state" aria-label="State before this flow">
        <span>Before this flow</span>
        <strong>Builder App already exists</strong>
        <i>GitHub source configured + authorized</i>
        <i>Easy Auth optional · BYO Entra</i>
        <i>{scenario.hasExistingRuntime ? `${scenario.oldVersion} currently active` : 'No active AppVersion'}</i>
        {!scenario.hasExistingRuntime ? <i>No YARP backend assigned</i> : null}
        <i className="config-fact version-fact">versionConfiguration: API_URL={scenario.kind === 'config' ? 'legacy.contoso.com' : 'api.contoso.com'}</i>
        <i className="config-fact scaling-fact">scaling: api {formatScaling(baseScaling)}</i>
      </div>

      <div className="transfer-brief" aria-live="polite">
        <div>
          <span>{isAnimating ? 'Happening now' : 'What happens now'}</span>
          <strong>{step?.reason ?? `All ${operationName(scenario).toLowerCase()} work has completed.`}</strong>
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
          <strong>{step?.result ?? (scenario.kind === 'deployment' ? `${operationName(scenario)} succeeded and cleanup is complete.` : scenario.kind === 'scale' ? 'Scaling saved and applied to the running app; no version changed.' : 'Desired configuration saved for the next AppVersion; the running app is unchanged.')}</strong>
        </div>
      </div>

      <div className="map-toolbar" role="group" aria-label="Map zoom controls">
        <span>Deployment map</span>
        <button type="button" className="icon-button" aria-label="Zoom out map" title="Zoom out map" aria-controls="technical-map" disabled={mapZoom <= minMapZoom} onClick={() => setManualZoom(Math.max(minMapZoom, mapZoom - 0.1))}><ZoomOut size={17} aria-hidden="true" /></button>
        <output aria-label="Map zoom">{Math.round(mapZoom * 100)}%</output>
        <button type="button" className="icon-button" aria-label="Zoom in map" title="Zoom in map" aria-controls="technical-map" disabled={mapZoom >= maxMapZoom} onClick={() => setManualZoom(Math.min(maxMapZoom, mapZoom + 0.1))}><ZoomIn size={17} aria-hidden="true" /></button>
        <button type="button" className="icon-button" aria-label="Fit map to view" title="Fit map to view" aria-controls="technical-map" aria-pressed={manualZoom === null} onClick={() => setManualZoom(null)}><Scan size={17} aria-hidden="true" /></button>
      </div>
      <div ref={viewportRef} className="stage-scroll" role="region" aria-label="Technical deployment map" tabIndex={0} style={{ padding: mapPadding }}>
        <div className="stage-frame" data-zoom-mode={manualZoom === null ? 'fit' : 'manual'} style={{ width: stageWidth * mapZoom, height: stageHeight * mapZoom }}>
        <div id="technical-map" className={`system-stage ${scenario.hasExistingRuntime ? '' : 'is-first-deploy'} ${cutover === 'active' ? 'is-first-live' : ''}`} style={{ width: stageWidth, height: stageHeight, transform: `scale(${mapZoom})` }}>
          <div className="stage-zone zone-control"><span>Control plane</span></div>
          <div className="stage-zone zone-source"><span>GitHub source</span></div>
          <div className="stage-zone zone-build"><span>Build and outputs</span></div>
          <div className="stage-zone zone-runtime"><span>Artifact Apps runtime</span></div>
          <div className="stage-zone zone-traffic"><span>Customer traffic</span></div>

          <svg className="stage-lines" viewBox={`0 0 ${stageWidth} ${stageHeight}`} aria-hidden="true">
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
              stageWidth={stageWidth}
              selected={selectedNode === node.id}
              cutover={cutover}
              onSelect={onSelectNode}
            />
          ))}

          <div
            className={`candidate-health-gate state-${directHealthState}`}
            style={{ left: candidatePoint.x - 96 }}
            data-native-readiness-state={nativeReadinessState}
            data-health-state={directHealthState}
            aria-live="polite"
          >
            <span className="health-gate-icon" aria-hidden="true"><HeartPulse size={17} /></span>
            <div className="health-gate-checks">
              <div className={`health-gate-check state-${nativeReadinessState}`}>
                <span>1 · ADC native readiness</span>
                <strong>{nativeReadinessResult}</strong>
              </div>
              <div className={`health-gate-check state-${directHealthState}`}>
                <span>2 · Direct HTTPS health</span>
                <strong>{directHealthResult}</strong>
              </div>
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
        </div>
        </div>
      </div>

      <div className={`cutover-status state-${cutover}`}>
        <ActivityIcon />
        <div>
          <span>YARP backend</span>
          <strong>{provider.target}</strong>
        </div>
        <p>{provider.note}</p>
      </div>
    </section>
  )
}

function ActivityIcon() {
  return <span className="cutover-dot" aria-hidden="true" />
}
