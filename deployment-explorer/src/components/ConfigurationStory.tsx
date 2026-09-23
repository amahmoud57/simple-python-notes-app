import { useState, type CSSProperties } from 'react'
import {
  ArrowRight,
  Braces,
  Camera,
  Check,
  CircleCheck,
  Clock3,
  Gauge,
  Layers,
  LockKeyhole,
  Pencil,
  RotateCcw,
  Server,
  Settings2,
  ShieldCheck,
} from 'lucide-react'
import { configurationSteps, getConfigurationDocuments, getConfigurationState, type ScalingPolicy } from '../configuration'
import './ConfigurationStory.css'

const stepIcons = [Layers, Pencil, Camera, Server, Gauge, CircleCheck, RotateCcw]

function PolicyValue({ policy }: { policy: ScalingPolicy }) {
  const component = policy.components[0]
  return (
    <div className="config-policy-value">
      <strong>{component.minReplicas}<span>-</span>{component.maxReplicas}</strong>
      <span>replicas<br /><b>CPU target {component.cpuUtilizationPercent}%</b></span>
    </div>
  )
}

export function ConfigurationStory({
  view,
  position,
  isAnimating,
  motionDurationMs,
  onStepSelect,
}: {
  view: 'overview' | 'technical'
  position: number
  isAnimating: boolean
  motionDurationMs: number
  onStepSelect: (index: number) => void
}) {
  const state = getConfigurationState(position)
  const technical = view === 'technical'
  const [selectedDocument, setSelectedDocument] = useState<'app' | 'v1' | 'v2'>('app')
  const documentId = selectedDocument === 'v2' && state.versions.length < 2 ? 'app' : selectedDocument
  const documents = getConfigurationDocuments(position)
  const document = documentId === 'app' ? documents.app : documents.versions.find((version) => version.id === documentId)
  const snapshotActive = ['capture', 'activate', 'restore'].includes(state.step.focus)
  const policyActive = ['policy', 'apply'].includes(state.step.focus)

  return (
    <div id={`${view}-panel`} className={`configuration-story config-view-${view}${isAnimating ? ' is-playing' : ''}`} role="tabpanel" aria-labelledby={`${view}-tab`} data-config-step={state.step.id} style={{ '--config-duration': `${motionDurationMs}ms` } as CSSProperties}>
      <div className="config-heading">
        <div><p className="config-eyebrow">Configuration lifecycles</p><h2>Version-bound. App-wide.</h2></div>
        <div className="config-key"><span><LockKeyhole size={15} aria-hidden="true" />Frozen per version</span><span><Settings2 size={15} aria-hidden="true" />Current for the app</span></div>
      </div>

      <ol className="config-timeline" aria-label="Configuration lifecycle stages">
        {configurationSteps.map((step, index) => {
          const Icon = stepIcons[index]
          return (
            <li key={step.id} className={index === state.index ? 'is-current' : index < state.index ? 'is-done' : ''}>
              <button type="button" aria-label={`Show configuration stage ${index + 1}: ${step.label}`} aria-current={index === state.index ? 'step' : undefined} onClick={() => onStepSelect(index)}>
                <span className="config-step-icon">{index < state.index ? <Check size={16} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}</span>
                <span>{step.label}</span>
              </button>
            </li>
          )
        })}
      </ol>

      <div className="config-caption" role="status" aria-label="Configuration stage">
        <span>{String(state.index + 1).padStart(2, '0')}<small>/ 07</small></span>
        <div><h3>{state.step.title}</h3><p>{state.step.summary}</p></div>
      </div>

      <div className="config-diagram">
        <section className="config-version-lane" aria-labelledby="version-config-heading">
          <div className="config-lane-heading"><h3 id="version-config-heading"><LockKeyhole size={18} aria-hidden="true" />Version configuration</h3><span>Captured when an AppVersion is created</span></div>
          <div className="config-version-flow">
            <div className={`config-desired${state.step.focus === 'desired' ? ' is-highlighted' : ''}`} role="group" aria-label="Desired version configuration">
              <span className="config-node-label">{technical ? 'BuilderApp.versionConfiguration' : 'Next version settings'}</span>
              <span className="config-field">CURRENCY</span>
              <strong className="config-value" key={state.desired.variables[0].value}>{state.desired.variables[0].value}</strong>
              <span className="config-value-note">{state.desiredDiffers ? 'Desired only, not the live value' : 'Matches the active version'}</span>
            </div>

            <div className={`config-connection${state.step.focus === 'capture' ? ' is-highlighted' : ''}`} aria-label="Capture on AppVersion creation">
              <span>Capture</span><i aria-hidden="true"><ArrowRight size={16} />{isAnimating && state.step.focus === 'capture' && <b className="config-moving-token"><LockKeyhole size={12} /></b>}</i>
            </div>

            <div className={`config-snapshots${snapshotActive ? ' is-highlighted' : ''}`} role="group" aria-label="Immutable AppVersion snapshots">
              <span className="config-node-label">{technical ? 'AppVersion.configuration' : 'Frozen snapshots'}</span>
              <div className="config-version-pair">
                {(['v1', 'v2'] as const).map((id) => {
                  const version = state.versions.find((item) => item.id === id)
                  return (
                    <article key={id} className={`config-version${state.activeVersion.id === id ? ' is-active' : ''}${!version ? ' is-absent' : ''}`} aria-label={`${id} snapshot`} data-created={Boolean(version)} data-active={state.activeVersion.id === id}>
                      <div><strong>{id}</strong>{version ? <LockKeyhole size={16} aria-label="Immutable snapshot" /> : <Clock3 size={16} aria-hidden="true" />}</div>
                      <code>{version ? `CURRENCY=${version.configuration.variables[0].value}` : 'Not created'}</code>
                      <span>{!version ? 'No snapshot yet' : state.activeVersion.id === id ? 'Active version' : 'Retained version'}</span>
                    </article>
                  )
                })}
              </div>
            </div>

            <div className={`config-connection${['activate', 'restore'].includes(state.step.focus) ? ' is-highlighted' : ''}`} aria-label="Activate the selected version snapshot">
              <span>Activate</span><i aria-hidden="true"><ArrowRight size={16} />{isAnimating && ['activate', 'restore'].includes(state.step.focus) && <b className="config-moving-token"><LockKeyhole size={12} /></b>}</i>
            </div>

            <div className="config-runtime" role="group" aria-label="Active version configuration" data-active-version={state.activeVersion.id}>
              <span className="config-node-label">{technical ? 'runtime.versionConfiguration' : 'Active runtime'}</span>
              <strong><Server size={24} aria-hidden="true" />{state.activeVersion.id}</strong>
              <code>CURRENCY={state.activeVersion.configuration.variables[0].value}</code>
              <span className="config-value-note">From the {state.activeVersion.id} snapshot</span>
            </div>
          </div>
          <div className="config-lane-foot"><span>Plain variables: build + runtime</span><span><LockKeyhole size={13} aria-hidden="true" />Activation restores the selected version's values</span></div>
        </section>

        <section className={`config-policy-lane${policyActive ? ' is-highlighted' : ''}`} aria-labelledby="app-settings-heading">
          <div className="config-lane-heading"><h3 id="app-settings-heading"><Settings2 size={18} aria-hidden="true" />App settings</h3><span>Independent of AppVersion activation</span></div>
          <div className="config-policy-flow">
            <div role="group" aria-label="Desired app scaling policy" className="config-policy-source">
              <span className="config-node-label">{technical ? 'BuilderApp.scaling' : 'App-wide scaling policy'}</span>
              <PolicyValue policy={state.scaling} />
            </div>
            <div className={`config-policy-connection${policyActive ? ' is-highlighted' : ''}`} aria-label="Apply current app policy without creating an AppVersion">
              <span>{state.policyPending ? 'Applying current policy' : state.index === 6 ? 'Current policy stays in effect' : 'Applies to whichever version is active'}</span>
              <i aria-hidden="true"><ArrowRight size={18} />{isAnimating && policyActive && <b className="config-moving-token"><Settings2 size={13} /></b>}</i>
              <small>No new AppVersion. No rebuild.</small>
            </div>
            <div role="group" aria-label="Effective runtime scaling policy" className="config-policy-effective">
              <span className="config-node-label">{technical ? 'ADC runtime policy' : 'Effective runtime policy'}</span>
              <PolicyValue policy={state.appliedScaling} />
              <span className={`config-policy-status${state.policyPending ? ' is-pending' : ''}`} role="status" aria-label="Policy application">{state.policyPending ? <Clock3 size={14} aria-hidden="true" /> : <CircleCheck size={14} aria-hidden="true" />}{state.policyPending ? 'New policy pending' : 'Policy applied'}</span>
            </div>
          </div>
          <div className="config-lane-foot"><span>API component: scaling range + CPU target</span><span>Also app-owned: Easy Auth, identity, automation</span></div>
        </section>
      </div>

      <div className="config-outcome" role="status" aria-label="Configuration outcome">
        <ShieldCheck size={18} aria-hidden="true" />
        <strong>{state.index === 6 ? 'v1 config restored. App policy unchanged.' : state.policyPending ? 'Desired policy changed. Active version unchanged.' : state.index === 5 ? 'New scaling policy. Same v2 and same build.' : state.desiredDiffers ? 'Desired edits do not mutate a frozen version.' : 'Active version configuration + current app policy.'}</strong>
        <span>{state.versions.length} AppVersion{state.versions.length === 1 ? '' : 's'}<span aria-hidden="true"> | </span>{state.versions.length} build{state.versions.length === 1 ? '' : 's'}</span>
      </div>

      {technical && (
        <details className="config-contract">
          <summary><Braces size={17} aria-hidden="true" />Inspect persisted fields</summary>
          <div className="config-document-tabs" role="tablist" aria-label="Configuration document">
            {(['app', 'v1', 'v2'] as const).map((id, index) => (
              <button key={id} type="button" role="tab" id={`config-document-${id}`} aria-controls="config-document-panel" aria-selected={documentId === id} disabled={id === 'v2' && state.versions.length < 2} tabIndex={documentId === id ? 0 : -1} onClick={() => setSelectedDocument(id)} onKeyDown={(event) => {
                const available = state.versions.length + 1
                const next = event.key === 'ArrowRight' ? (index + 1) % available : event.key === 'ArrowLeft' ? (index + available - 1) % available : event.key === 'Home' ? 0 : event.key === 'End' ? available - 1 : null
                if (next === null) return
                event.preventDefault()
                setSelectedDocument((['app', 'v1', 'v2'] as const)[next])
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next].focus()
              }}>{id === 'app' ? 'BuilderApp' : `AppVersion ${id}`}</button>
            ))}
          </div>
          <div id="config-document-panel" role="tabpanel" aria-labelledby={`config-document-${documentId}`}><pre tabIndex={0} role="region" aria-label="Configuration JSON"><code>{JSON.stringify(document, null, 2)}</code></pre></div>
        </details>
      )}
      <p className="config-scope">Illustrative values. Scaling uses the preview feature contract; no live settings are changed.</p>
    </div>
  )
}