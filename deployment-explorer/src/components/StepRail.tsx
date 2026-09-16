import { Check, Circle, GitBranch, History, RefreshCw, Rocket } from 'lucide-react'
import { phaseLabels, type Scenario } from '../model'

interface StepRailProps {
  scenarios: Scenario[]
  scenario: Scenario
  completedCount: number
  onScenarioChange: (scenario: Scenario) => void
}

const scenarioIcons = {
  manual: Rocket,
  update: GitBranch,
  redeploy: RefreshCw,
  rollback: History,
}

export function StepRail({ scenarios, scenario, completedCount, onScenarioChange }: StepRailProps) {
  return (
    <aside className="step-rail" aria-label="Deployment scenarios and steps">
      <div className="scenario-list" role="tablist" aria-label="Deployment scenario">
        {scenarios.map((item) => {
          const Icon = scenarioIcons[item.id]
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === scenario.id}
              onClick={() => onScenarioChange(item)}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>

      <div className="rail-heading">
        <span>Deployment sequence</span>
        <strong>{scenario.steps.length} steps</strong>
      </div>

      <ol className="step-list">
        {scenario.steps.map((item, index) => {
          const complete = index < completedCount
          const current = index === completedCount
          return (
            <li key={item.id} className={complete ? 'is-complete' : current ? 'is-current' : ''}>
              <span className="step-marker" aria-hidden="true">
                {complete ? <Check size={12} strokeWidth={3} /> : <Circle size={9} fill={current ? 'currentColor' : 'none'} />}
              </span>
              <div>
                <span>{phaseLabels[item.phase]}</span>
                <strong>{item.title}</strong>
              </div>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
