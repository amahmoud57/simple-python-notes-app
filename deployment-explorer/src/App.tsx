import { startTransition, useEffect, useState } from 'react'
import {
  Activity,
  Gauge,
  LayoutDashboard,
  Network,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  StepBack,
  StepForward,
  Workflow,
} from 'lucide-react'
import './App.css'
import { DetailDrawer } from './components/DetailDrawer'
import { ConfigurationStory } from './components/ConfigurationStory'
import { Overview } from './components/Overview'
import { StepRail } from './components/StepRail'
import { SystemStage } from './components/SystemStage'
import {
  getCutoverState,
  getScenario,
  scenarios,
  type NodeId,
  type Scenario,
} from './model'
import { getOverviewState } from './overview'
import { configurationSteps, getConfigurationState } from './configuration'

const transferDurationMs = 2500
const readingPauseMs = 1200
type ExplorerView = 'overview' | 'technical'
type ExplorerStory = 'deployment' | 'configuration'
const readView = (): ExplorerView => window.location.hash.split('/')[0] === '#technical' ? 'technical' : 'overview'
const readStory = (): ExplorerStory => window.location.hash.split('/')[1] === 'configuration' ? 'configuration' : 'deployment'
const storyHash = (view: ExplorerView, story: ExplorerStory) => `#${view}${story === 'configuration' ? '/configuration' : ''}`

function App() {
  const [view, setView] = useState<ExplorerView>(readView)
  const [story, setStory] = useState<ExplorerStory>(readStory)
  const [configurationPosition, setConfigurationPosition] = useState(0)
  const [scenarioId, setScenarioId] = useState<Scenario['id']>('manual')
  const [completedCount, setCompletedCount] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [travelStarted, setTravelStarted] = useState(false)
  const [speed, setSpeed] = useState(0.75)
  const [selectedNode, setSelectedNode] = useState<NodeId | null>(null)
  const scenario = getScenario(scenarioId)
  const configuration = getConfigurationState(configurationPosition)
  const isConfiguration = story === 'configuration'
  const position = isConfiguration ? configurationPosition : completedCount
  const usesStages = isConfiguration || view === 'overview'
  const activeStep = scenario.steps[completedCount]
  const complete = isConfiguration ? configuration.complete : completedCount >= scenario.steps.length
  const cutover = getCutoverState(scenario, completedCount, isAnimating ? activeStep : undefined)
  const overview = getOverviewState(scenario, completedCount)
  const motionDurationMs = (usesStages ? 3200 : transferDurationMs) / speed

  useEffect(() => {
    const onLocationChange = () => {
      setView(readView())
      setStory(readStory())
      setIsPlaying(false)
      setIsAnimating(false)
      setTravelStarted(false)
      setSelectedNode(null)
    }
    window.addEventListener('hashchange', onLocationChange)
    window.addEventListener('popstate', onLocationChange)
    return () => {
      window.removeEventListener('hashchange', onLocationChange)
      window.removeEventListener('popstate', onLocationChange)
    }
  }, [])

  useEffect(() => {
    if (!isAnimating) return
    const startTimer = window.setTimeout(() => setTravelStarted(true), 40)
    const completionTimer = window.setTimeout(() => {
      if (isConfiguration) {
        const next = Math.min(configurationPosition + 1, configurationSteps.length - 1)
        setConfigurationPosition(next)
        if (next === configurationSteps.length - 1) setIsPlaying(false)
      } else {
        const next = view === 'overview'
          ? getOverviewState(scenario, completedCount).nextCount
          : Math.min(completedCount + 1, scenario.steps.length)
        setCompletedCount(next)
        if (next >= scenario.steps.length) setIsPlaying(false)
      }
      setIsAnimating(false)
      setTravelStarted(false)
    }, motionDurationMs)

    return () => {
      window.clearTimeout(startTimer)
      window.clearTimeout(completionTimer)
    }
  }, [completedCount, configurationPosition, isAnimating, isConfiguration, motionDurationMs, scenario, view])

  useEffect(() => {
    if (!isPlaying || isAnimating || complete) return
    const timer = window.setTimeout(
      () => setIsAnimating(true),
      position === 0 ? 180 : readingPauseMs / speed,
    )
    return () => window.clearTimeout(timer)
  }, [complete, position, isAnimating, isPlaying, scenario.id, speed, story])

  const reset = () => {
    setIsPlaying(false)
    setIsAnimating(false)
    setTravelStarted(false)
    if (isConfiguration) setConfigurationPosition(0)
    else setCompletedCount(0)
    setSelectedNode(null)
  }

  const pause = () => {
    setIsPlaying(false)
    setIsAnimating(false)
    setTravelStarted(false)
  }

  const selectView = (next: ExplorerView) => {
    pause()
    setSelectedNode(null)
    setView(next)
    if (window.location.hash !== storyHash(next, story)) window.history.pushState(null, '', storyHash(next, story))
  }

  const selectStory = (next: ExplorerStory) => {
    pause()
    setSelectedNode(null)
    setStory(next)
    if (window.location.hash !== storyHash(view, next)) window.history.pushState(null, '', storyHash(view, next))
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
    if (isConfiguration) setConfigurationPosition((current) => Math.min(current + 1, configurationSteps.length - 1))
    else setCompletedCount(view === 'overview' ? overview.nextCount : Math.min(completedCount + 1, scenario.steps.length))
  }

  const stepBack = () => {
    if (isAnimating || position === 0) return
    setIsPlaying(false)
    setTravelStarted(false)
    if (isConfiguration) setConfigurationPosition((current) => Math.max(current - 1, 0))
    else setCompletedCount(view === 'overview' ? overview.previousCount : Math.max(completedCount - 1, 0))
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
      ? usesStages ? 'In progress' : 'Transfer in progress'
      : isPlaying
        ? usesStages ? 'Playing' : 'Reading pause'
        : 'Ready'

  return (
    <div className={`app-shell view-${view} story-${story}`}>
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <div>
            <span>Embr Builder Apps</span>
            <h1>Deployment Explorer</h1>
          </div>
        </div>
        <div className="story-switcher" role="tablist" aria-label="Explorer story">
          {(['deployment', 'configuration'] as const).map((item, index) => (
            <button key={item} type="button" role="tab" id={`${item}-tab`} aria-controls={`${item}-story`} aria-selected={story === item} tabIndex={story === item ? 0 : -1} onClick={() => selectStory(item)} onKeyDown={(event) => {
              const target = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : event.key === 'ArrowRight' || event.key === 'ArrowLeft' ? 1 - index : null
              if (target === null) return
              event.preventDefault()
              selectStory(target === 0 ? 'deployment' : 'configuration')
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[target].focus()
            }}>{item === 'deployment' ? <Workflow size={16} aria-hidden="true" /> : <Settings2 size={16} aria-hidden="true" />}{item === 'deployment' ? 'Deployment flow' : 'Configuration'}</button>
          ))}
        </div>
        <div className="view-switcher" role="tablist" aria-label="Explorer view">
          {(['overview', 'technical'] as const).map((item, index) => (
            <button
              key={item}
              type="button"
              role="tab"
              id={`${item}-tab`}
              aria-controls={`${item}-panel`}
              aria-selected={view === item}
              tabIndex={view === item ? 0 : -1}
              onClick={() => selectView(item)}
              onKeyDown={(event) => {
                const target = event.key === 'Home' ? 0 : event.key === 'End' ? 1
                  : event.key === 'ArrowRight' || event.key === 'ArrowLeft' ? 1 - index : null
                if (target === null) return
                event.preventDefault()
                selectView(target === 0 ? 'overview' : 'technical')
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[target].focus()
              }}
            >
              {item === 'overview' ? <LayoutDashboard size={16} aria-hidden="true" /> : <Network size={16} aria-hidden="true" />}
              {item === 'overview' ? 'Overview' : 'Technical'}
            </button>
          ))}
        </div>
        <div className="header-status">
          <span className="demo-context">Illustrative scenarios</span>
          <div className="environment-chip"><Activity size={14} /> amahmoud11 / westus2</div>
          <div className={`run-status state-${complete ? 'complete' : isPlaying || isAnimating ? 'running' : 'ready'}`} aria-live="polite">
            <span aria-hidden="true" /> {status}
          </div>
        </div>
      </header>

      <main className="explorer-main">
      <div className="command-bar">
        <div className="scenario-title">
          <span>{isConfiguration ? 'Configuration lifecycle' : view === 'overview' ? 'Selected flow' : scenario.label}</span>
          <strong>{isConfiguration ? configuration.step.label : view === 'overview' ? scenario.label : scenario.title}</strong>
        </div>
        <div className="playback-controls">
          <button type="button" className="icon-button" onClick={reset} aria-label={isConfiguration ? 'Reset configuration story' : 'Reset deployment flow'} title="Reset">
            <RotateCcw size={18} />
          </button>
          <button type="button" onClick={stepBack} disabled={isAnimating || position === 0}>
            <StepBack size={17} /> {usesStages ? 'Previous stage' : 'Previous step'}
          </button>
          <button type="button" onClick={stepOnce} disabled={isAnimating || complete}>
            <StepForward size={17} /> {usesStages ? 'Next stage' : 'Next step'}
          </button>
          {isPlaying ? (
            <button type="button" className="primary" onClick={pause}>
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

      <div id={`${story}-story`} className="story-content" role="tabpanel" aria-labelledby={`${story}-tab`}>
      {isConfiguration ? (
        <ConfigurationStory view={view} position={configurationPosition} isAnimating={isAnimating} motionDurationMs={motionDurationMs} onStepSelect={(index) => { pause(); setConfigurationPosition(index) }} />
      ) : view === 'overview' ? (
        <Overview
          scenario={scenario}
          completedCount={completedCount}
          isAnimating={isAnimating}
          motionDurationMs={motionDurationMs}
          onScenarioChange={selectScenario}
          onMilestoneSelect={selectStep}
          onTechnicalView={() => selectView('technical')}
        />
      ) : (
      <div id="technical-panel" className="workspace" role="tabpanel" aria-labelledby="technical-tab">
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
      </div>
      )}
      </div>
      </main>

      {!isConfiguration && view === 'technical' && selectedNode ? (
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
