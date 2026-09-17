import { startTransition, useEffect, useState } from 'react'
import {
  Activity,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  StepBack,
  StepForward,
} from 'lucide-react'
import './App.css'
import { DetailDrawer } from './components/DetailDrawer'
import { StepRail } from './components/StepRail'
import { SystemStage } from './components/SystemStage'
import {
  getCutoverState,
  getScenario,
  scenarios,
  type NodeId,
  type Scenario,
} from './model'

const transferDurationMs = 2500
const readingPauseMs = 1200

function App() {
  const [scenarioId, setScenarioId] = useState<Scenario['id']>('manual')
  const [completedCount, setCompletedCount] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [travelStarted, setTravelStarted] = useState(false)
  const [speed, setSpeed] = useState(0.75)
  const [selectedNode, setSelectedNode] = useState<NodeId | null>(null)
  const scenario = getScenario(scenarioId)
  const activeStep = scenario.steps[completedCount]
  const complete = completedCount >= scenario.steps.length
  const cutover = getCutoverState(scenario, completedCount, isAnimating ? activeStep : undefined)

  useEffect(() => {
    if (!isAnimating) return
    const startTimer = window.setTimeout(() => setTravelStarted(true), 40)
    const completionTimer = window.setTimeout(() => {
      setCompletedCount((current) => {
        const next = Math.min(current + 1, scenario.steps.length)
        if (next >= scenario.steps.length) setIsPlaying(false)
        return next
      })
      setIsAnimating(false)
      setTravelStarted(false)
    }, transferDurationMs / speed)

    return () => {
      window.clearTimeout(startTimer)
      window.clearTimeout(completionTimer)
    }
  }, [isAnimating, scenario.id, scenario.steps.length, speed])

  useEffect(() => {
    if (!isPlaying || isAnimating || complete) return
    const timer = window.setTimeout(
      () => setIsAnimating(true),
      completedCount === 0 ? 180 : readingPauseMs / speed,
    )
    return () => window.clearTimeout(timer)
  }, [complete, completedCount, isAnimating, isPlaying, scenario.id, speed])

  const reset = () => {
    setIsPlaying(false)
    setIsAnimating(false)
    setTravelStarted(false)
    setCompletedCount(0)
    setSelectedNode(null)
  }

  const selectScenario = (next: Scenario) => {
    startTransition(() => {
      setScenarioId(next.id)
      reset()
    })
  }

  const stepOnce = () => {
    if (isAnimating || complete) return
    setIsPlaying(false)
    setTravelStarted(false)
    setCompletedCount((current) => Math.min(current + 1, scenario.steps.length))
  }

  const stepBack = () => {
    if (isAnimating || completedCount === 0) return
    setIsPlaying(false)
    setTravelStarted(false)
    setCompletedCount((current) => Math.max(current - 1, 0))
  }

  const selectStep = (index: number) => {
    setIsPlaying(false)
    setIsAnimating(false)
    setTravelStarted(false)
    setSelectedNode(null)
    setCompletedCount(Math.max(0, Math.min(index, scenario.steps.length - 1)))
  }

  const run = () => {
    if (complete) return
    setIsPlaying(true)
  }

  const status = complete
    ? 'Complete'
    : isAnimating
      ? 'Transfer in progress'
      : isPlaying
        ? 'Reading pause'
        : 'Ready'

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <div>
            <span>Embr Builder Apps</span>
            <h1>Deployment Explorer</h1>
          </div>
        </div>
        <div className="header-status">
          <div className="environment-chip"><Activity size={14} /> amahmoud11 / westus2</div>
          <div className={`run-status state-${complete ? 'complete' : isPlaying || isAnimating ? 'running' : 'ready'}`} aria-live="polite">
            <span aria-hidden="true" /> {status}
          </div>
        </div>
      </header>

      <div className="command-bar">
        <div className="scenario-title">
          <span>{scenario.label}</span>
          <strong>{scenario.title}</strong>
        </div>
        <div className="playback-controls">
          <button type="button" className="icon-button" onClick={reset} aria-label="Reset deployment flow" title="Reset">
            <RotateCcw size={18} />
          </button>
          <button type="button" onClick={stepBack} disabled={isAnimating || completedCount === 0}>
            <StepBack size={17} /> Previous step
          </button>
          <button type="button" onClick={stepOnce} disabled={isAnimating || complete}>
            <StepForward size={17} /> Next step
          </button>
          {isPlaying ? (
            <button type="button" className="primary" onClick={() => setIsPlaying(false)}>
              <Pause size={17} /> Pause
            </button>
          ) : (
            <button type="button" className="primary" onClick={run} disabled={complete}>
              <Play size={17} /> Run flow
            </button>
          )}
          <label className="speed-control">
            <Gauge size={16} />
            <span className="sr-only">Playback speed</span>
            <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} aria-label="Playback speed">
              <option value={0.5}>0.5x</option>
              <option value={0.75}>0.75x</option>
              <option value={1}>1x</option>
              <option value={1.5}>1.5x</option>
            </select>
          </label>
        </div>
      </div>

      <main className="workspace">
        <StepRail
          scenarios={scenarios}
          scenario={scenario}
          completedCount={completedCount}
          onScenarioChange={selectScenario}
          onStepSelect={selectStep}
        />
        <SystemStage
          scenario={scenario}
          step={activeStep}
          stepIndex={completedCount}
          isAnimating={isAnimating}
          travelStarted={travelStarted}
          motionDurationMs={transferDurationMs / speed}
          cutover={cutover}
          selectedNode={selectedNode}
          onSelectNode={setSelectedNode}
        />
      </main>

      {selectedNode ? (
        <DetailDrawer
          key={`${scenario.id}-${selectedNode}`}
          nodeId={selectedNode}
          scenario={scenario}
          completedCount={completedCount}
          cutover={cutover}
          onClose={() => setSelectedNode(null)}
        />
      ) : null}
    </div>
  )
}

export default App
