import { Fragment, useState } from 'react'
import { Braces, PlugZap, X } from 'lucide-react'
import {
  completionLabel,
  executionSurfaceLabels,
  getInspectMeta,
  getNodeApi,
  getNodeExample,
  type CutoverState,
  type InspectId,
  type Scenario,
} from '../model'

interface DetailDrawerProps {
  nodeId: InspectId
  scenario: Scenario
  completedCount: number
  cutover: CutoverState
  onClose: () => void
}

export function DetailDrawer({
  nodeId,
  scenario,
  completedCount,
  cutover,
  onClose,
}: DetailDrawerProps) {
  const [view, setView] = useState<'example' | 'api'>('example')
  const meta = getInspectMeta(nodeId, scenario)
  const example = getNodeExample(nodeId, scenario, completedCount, cutover)
  const related = view === 'example' ? example.related ?? [] : []
  const currentStep = scenario.steps[completedCount]

  return (
    <aside className={`detail-drawer${related.length > 0 ? ' has-related' : ''}`} aria-labelledby="detail-title">
      <header>
        <div>
          <span>Component detail</span>
          <h2 id="detail-title">{meta.label}</h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close component details" title="Close">
          <X size={19} />
        </button>
      </header>

      <dl className="detail-facts">
        <div><dt>Role</dt><dd>{meta.eyebrow}</dd></div>
        <div><dt>Flow state</dt><dd>{completedCount === scenario.steps.length ? completionLabel(scenario) : `${completedCount} of ${scenario.steps.length} steps complete`}</dd></div>
        <div><dt>Current step API</dt><dd>{currentStep ? executionSurfaceLabels[currentStep.executionSurface] : 'No active call'}</dd></div>
      </dl>

      <div className="detail-tabs" role="tablist" aria-label="Component detail view">
        <button type="button" role="tab" aria-selected={view === 'example'} onClick={() => setView('example')}>
          <Braces size={15} /> Example
        </button>
        <button type="button" role="tab" aria-selected={view === 'api'} onClick={() => setView('api')}>
          <PlugZap size={15} /> API
        </button>
      </div>

      <div className="detail-code-heading">
        <span>{view === 'example' ? example.title : 'API and service surface'}</span>
        <b>{view === 'example' ? example.format : 'API'}</b>
      </div>
      <pre className="detail-code" tabIndex={0} aria-label={view === 'example' ? example.title : 'API and service surface'}><code>{view === 'example' ? example.body : getNodeApi(nodeId)}</code></pre>
      {related.map((document) => (
        <Fragment key={document.title}>
          <div className="detail-code-heading">
            <span>{document.title}</span>
            <b>{document.format}</b>
          </div>
          <pre className="detail-code" tabIndex={0} aria-label={document.title}><code>{document.body}</code></pre>
        </Fragment>
      ))}

      <section className="detail-context">
        <span>Current scenario</span>
        <strong>{scenario.title}</strong>
        <p>{scenario.summary}</p>
      </section>
    </aside>
  )
}
