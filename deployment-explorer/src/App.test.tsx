// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { getScenario, scenarios } from './model'
import { getOverviewMilestones } from './overview'
import { configurationSteps } from './configuration'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Configuration story', () => {
  const showStage = (index: number) => fireEvent.click(screen.getByRole('button', { name: `Show configuration stage ${index + 1}: ${configurationSteps[index].label}` }))

  it('keeps the detailed snapshot and policy walkthrough in Technical', () => {
    window.history.replaceState(null, '', '#technical/configuration')
    render(<App />)
    expect(screen.getByRole('tab', { name: 'Configuration' })).toHaveAttribute('aria-selected', 'true')
    const desired = screen.getByRole('group', { name: 'Desired version configuration' })
    const active = screen.getByRole('group', { name: 'Active version configuration' })
    const policy = screen.getByRole('group', { name: 'Effective runtime scaling policy' })
    showStage(1)
    expect(desired).toHaveTextContent('EUR')
    expect(active).toHaveTextContent('CURRENCY=USD')
    expect(screen.getByRole('article', { name: 'v2 snapshot' })).toHaveAttribute('data-created', 'false')
    showStage(2)
    expect(screen.getByRole('article', { name: 'v2 snapshot' })).toHaveTextContent('CURRENCY=EUR')
    expect(active).toHaveAttribute('data-active-version', 'v1')
    showStage(3)
    expect(active).toHaveAttribute('data-active-version', 'v2')
    expect(active).toHaveTextContent('CURRENCY=EUR')
    showStage(4)
    expect(screen.getByRole('status', { name: 'Policy application' })).toHaveTextContent('New policy pending')
    expect(policy).toHaveTextContent('CPU target 70%')
    showStage(5)
    expect(policy).toHaveTextContent('CPU target 60%')
    expect(screen.getByRole('status', { name: 'Configuration outcome' })).toHaveTextContent('2 AppVersions')
    showStage(6)
    expect(active).toHaveAttribute('data-active-version', 'v1')
    expect(active).toHaveTextContent('CURRENCY=USD')
    expect(desired).toHaveTextContent('EUR')
    expect(policy).toHaveTextContent('CPU target 60%')
    expect(screen.getByRole('status', { name: 'Configuration outcome' })).toHaveTextContent('v1 config restored. App policy unchanged.')
    expect(screen.getByRole('button', { name: 'Next stage' })).toBeDisabled()
  })

  it('retains the Technical walkthrough while Overview is always one combined canvas', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Go to stage 3: Package & publish' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Technical' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Configuration' }))
    showStage(5)
    expect(window.location.hash).toBe('#technical/configuration')
    expect(screen.getByRole('group', { name: 'Effective runtime scaling policy' })).toHaveTextContent('CPU target 60%')
    expect(screen.getByText('BuilderApp.versionConfiguration')).toBeInTheDocument()
    expect(screen.getByText('BuilderApp.scaling')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }))
    expect(screen.queryByRole('tab', { name: 'Configuration' })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Release version snapshot' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'App-wide settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go to stage 3: Package & publish' })).toHaveAttribute('aria-current', 'step')
    expect(window.location.hash).toBe('#overview')
    fireEvent.click(screen.getByRole('tab', { name: 'Technical' }))
    expect(screen.getByRole('status', { name: 'Configuration stage' })).toHaveTextContent('New policy. Same AppVersion.')
  })

  it('plays to retained-version activation and resets without changing deployment state', () => {
    vi.useFakeTimers()
    window.history.replaceState(null, '', '#technical/configuration')
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Run flow' }))
    for (let index = 0; index < configurationSteps.length - 1; index += 1) {
      act(() => vi.advanceTimersByTime(2000))
      act(() => vi.advanceTimersByTime(4500))
    }
    expect(screen.getByRole('button', { name: 'Run flow' })).toBeDisabled()
    expect(screen.getByRole('group', { name: 'Active version configuration' })).toHaveAttribute('data-active-version', 'v1')
    expect(screen.getByRole('group', { name: 'Effective runtime scaling policy' })).toHaveTextContent('CPU target 60%')
    fireEvent.click(screen.getByRole('button', { name: 'Previous stage' }))
    expect(screen.getByRole('group', { name: 'Active version configuration' })).toHaveAttribute('data-active-version', 'v2')
    fireEvent.click(screen.getByRole('button', { name: 'Reset configuration story' }))
    expect(screen.getByRole('button', { name: 'Previous stage' })).toBeDisabled()
    expect(screen.getByRole('article', { name: 'v2 snapshot' })).toHaveAttribute('data-created', 'false')
  })

  it('cancels a pending configuration advance when changing views, stories, or history', () => {
    vi.useFakeTimers()
    window.history.replaceState(null, '', '#technical/configuration')
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Run flow' }))
    act(() => vi.advanceTimersByTime(200))
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }))
    act(() => vi.advanceTimersByTime(10000))
    expect(screen.getByRole('button', { name: 'Previous stage' })).toBeDisabled()
    fireEvent.click(screen.getByRole('tab', { name: 'Technical' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run flow' }))
    act(() => vi.advanceTimersByTime(200))
    fireEvent.click(screen.getByRole('tab', { name: 'Deployment flow' }))
    act(() => vi.advanceTimersByTime(10000))
    expect(screen.getByRole('heading', { name: 'Request a deployment through ARM' })).toBeInTheDocument()
    act(() => {
      window.history.replaceState(null, '', '#overview/configuration')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(screen.getByRole('button', { name: 'Previous stage' })).toBeDisabled()
    expect(screen.queryByRole('tab', { name: 'Configuration' })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Deployment scenario' })).toBeInTheDocument()
  })

  it('exposes technical field ownership without putting scaling in version JSON', () => {
    window.history.replaceState(null, '', '#technical/configuration')
    const { container } = render(<App />)
    showStage(6)
    const details = container.querySelector('details')!
    details.open = true
    fireEvent.click(screen.getByRole('tab', { name: 'AppVersion v1' }))
    const frozen = JSON.parse(container.querySelector('.config-contract code')!.textContent!)
    expect(frozen.configuration.variables[0].value).toBe('USD')
    expect(frozen.configuration).not.toHaveProperty('scaling')
    fireEvent.click(screen.getByRole('tab', { name: 'BuilderApp' }))
    const app = JSON.parse(container.querySelector('.config-contract code')!.textContent!)
    expect(app.versionConfiguration.variables[0].value).toBe('EUR')
    expect(app.runtime.versionConfiguration.variables[0].value).toBe('USD')
    expect(app.scaling.components[0].maxReplicas).toBe(5)
  })
})

describe('Deployment Overview', () => {
  const selectScenario = (id: string) => fireEvent.change(screen.getByRole('combobox', { name: 'Deployment scenario' }), { target: { value: id } })

  it('opens with a visual deployment path and no detail paragraphs or API diagram', () => {
    const { container } = render(<App />)
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('tabpanel', { name: 'Overview' }))
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('button', { name: 'Next stage' }))
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'Pin the source.' })).toBeInTheDocument()
    expect(screen.queryByRole('tablist', { name: 'Explorer story' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Configuration' })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Deployment scenario' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Release version snapshot' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Effective runtime scaling policy' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Go to stage/ })).toHaveLength(9)
    expect(screen.getByRole('list', { name: 'Deployment flow' })).toBeInTheDocument()
    expect(container.querySelector('.milestone-details')).not.toBeInTheDocument()
    expect(container.querySelector('.overview-capabilities')).not.toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Release status' })).toHaveTextContent('No live version yet')
    expect(screen.queryByRole('button', { name: 'Inspect ARM API' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous stage' })).toBeDisabled()
  })

  it.each(scenarios)('advances $label through the actual registry, artifact, runtime, and route stations', (scenario) => {
    const { container } = render(<App />)
    selectScenario(scenario.id)
    const milestones = getOverviewMilestones(scenario)
    expect(screen.getAllByRole('button', { name: /Go to stage/ })).toHaveLength(milestones.length)
    expect(screen.getByRole('group', { name: 'Static asset path' })).toHaveTextContent('Embr Blob Storage')
    expect(container.querySelector('[data-station="publish"]')).toHaveTextContent('Embr ACR')
    expect(container.querySelector('[data-station="publish"] .flow-handoff')).toHaveTextContent(scenario.id === 'manual' || scenario.id === 'latest' ? 'Publish OCI image' : 'Reuse image digest')
    expect(container.querySelector('[data-station="artifact"]')).toHaveTextContent('ADC pulls OCI')
    expect(container.querySelector('[data-station="artifact"]')).toHaveTextContent('Embr pull identity + AcrPull')
    expect(container.querySelector('[data-station="candidate"]')).toHaveTextContent('ADC Artifact App')
    expect(container.querySelector('[data-station="candidate"]')).toHaveTextContent('Runs the Artifact Version')
    expect(screen.getByRole('group', { name: 'Customer traffic' })).toHaveTextContent('Embr YARP')
    expect(container.querySelectorAll('.flow-connector')).toHaveLength(milestones.length - 3)
    for (const [index, milestone] of milestones.entries()) {
      const station = screen.getByRole('button', { name: `Go to stage ${index + 1}: ${milestone.label}` })
      expect(station).toHaveAttribute('aria-current', 'step')
      expect(screen.getByRole('status', { name: 'Current stage' })).toHaveTextContent(milestone.title)
      expect(container.querySelector('.flow-map')).toHaveAttribute('data-current-stage', milestone.id)
      fireEvent.click(screen.getByRole('button', { name: 'Next stage' }))
    }
    if (scenario.id === 'manual' || scenario.id === 'latest') {
      expect(container.querySelector('[data-station="build"]')).toBeInTheDocument()
    } else {
      expect(container.querySelector('[data-station="build"]')).not.toBeInTheDocument()
      expect(container.querySelector('.flow-reuse-note')).toBeInTheDocument()
    }
  })

  it.each(scenarios)('shows $label health, serving traffic, and cleanup in the right order', (scenario) => {
    const { container } = render(<App />)
    const newVersion = scenario.id === 'redeploy' ? 'v17' : scenario.newVersion
    selectScenario(scenario.id)
    const next = screen.getByRole('button', { name: 'Next stage' })
    const release = screen.getByRole('status', { name: 'Release status' })
    const milestones = getOverviewMilestones(scenario)
    const routeIndex = milestones.findIndex((milestone) => milestone.id === 'release')
    fireEvent.click(screen.getByRole('button', { name: `Go to stage ${routeIndex + 1}: Route traffic` }))
    expect(screen.getByText('Endpoint healthy')).toBeInTheDocument()
    expect(container.querySelector('.release-visual')).toHaveAttribute('data-route-target', scenario.hasExistingRuntime ? 'existing' : 'none')
    expect(release).not.toHaveTextContent('Deployment succeeded')
    fireEvent.click(next)
    expect(container.querySelector('.release-visual')).toHaveAttribute('data-route-target', 'candidate')
    expect(release).not.toHaveTextContent('Deployment succeeded')
    fireEvent.click(next)
    expect(release).toHaveTextContent('Deployment succeeded')
    expect(release).toHaveTextContent(`${newVersion} is serving customers`)
    expect(screen.getByRole('button', { name: `Go to stage ${milestones.length}: After release` })).toHaveAttribute('aria-current', 'step')
    expect(next).toBeEnabled()
    fireEvent.click(next)
    expect(next).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Run flow' })).toBeDisabled()
    expect(screen.getByRole('heading', { name: `${newVersion} is live.` })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reset deployment flow' }))
    expect(screen.getByRole('button', { name: 'Previous stage' })).toBeDisabled()
    expect(release).not.toHaveTextContent('Deployment succeeded')
  })

  it('preserves progress across views, including entry in the middle of a milestone', () => {
    render(<App />)
    selectScenario('latest')
    fireEvent.click(screen.getByRole('button', { name: 'Next stage' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Technical' }))
    const scenario = getScenario('latest')
    const count = getOverviewMilestones(scenario)[0].end
    expect(screen.getByRole('heading', { name: scenario.steps[count].title })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }))
    expect(screen.getByRole('button', { name: 'Go to stage 2: Build' })).toHaveAttribute('aria-current', 'step')
    fireEvent.click(screen.getByRole('button', { name: 'Previous stage' }))
    fireEvent.click(screen.getByRole('button', { name: 'Technical detail' }))
    expect(screen.getByRole('heading', { name: scenario.steps[count].title })).toBeInTheDocument()
    expect(window.location.hash).toBe('#technical')
  })

  it('pauses an in-flight overview stage without a delayed advance', () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Run flow' }))
    act(() => vi.advanceTimersByTime(200))
    expect(screen.getByRole('button', { name: 'Next stage' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    act(() => vi.advanceTimersByTime(10000))
    expect(screen.getByRole('button', { name: 'Go to stage 1: Choose source' })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: 'Next stage' })).toBeEnabled()
  })

  it('plays every visual station and stops automatically', () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Run flow' }))
    for (let index = 0; index < getOverviewMilestones(getScenario('manual')).length; index += 1) {
      act(() => vi.advanceTimersByTime(2000))
      act(() => vi.advanceTimersByTime(4500))
    }
    expect(screen.getByRole('heading', { name: 'v1 is live.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run flow' })).toBeDisabled()
  })

  it('moves the OCI payload toward ACR during packaging and removes it on pause', () => {
    vi.useFakeTimers()
    const { container } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Go to stage 3: Package & publish' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run flow' }))
    act(() => vi.advanceTimersByTime(1800))
    expect(container.querySelectorAll('.flow-packet')).toHaveLength(1)
    expect(container.querySelector('[data-station="publish"] .flow-packet')).toHaveAttribute('data-payload', 'OCI image')
    expect(container.querySelector('.flow-map')).toHaveClass('is-running')
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    act(() => vi.advanceTimersByTime(10000))
    expect(container.querySelector('.flow-packet')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go to stage 3: Package & publish' })).toHaveAttribute('aria-current', 'step')
  })

  it('cancels playback when a scenario or view changes', () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Run flow' }))
    act(() => vi.advanceTimersByTime(200))
    selectScenario('redeploy')
    act(() => vi.advanceTimersByTime(10000))
    expect(screen.getByRole('button', { name: 'Go to stage 1: Choose version' })).toHaveAttribute('aria-current', 'step')
    fireEvent.click(screen.getByRole('button', { name: 'Run flow' }))
    act(() => vi.advanceTimersByTime(200))
    fireEvent.click(screen.getByRole('tab', { name: 'Technical' }))
    act(() => vi.advanceTimersByTime(10000))
    expect(screen.getByRole('heading', { name: 'Request a retained-version redeploy' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run flow' })).toBeEnabled()
  })

  it('supports keyboard tab navigation and browser history changes', () => {
    render(<App />)
    const overviewTab = screen.getByRole('tab', { name: 'Overview' })
    fireEvent.keyDown(overviewTab, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Technical' })).toHaveFocus()
    act(() => {
      window.history.replaceState(null, '', '#overview')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(overviewTab).toHaveAttribute('aria-selected', 'true')
    selectScenario('activate')
    expect(screen.getByRole('combobox', { name: 'Deployment scenario' })).toHaveValue('activate')
    expect(screen.getByRole('button', { name: 'Go to stage 1: Choose version' })).toHaveAttribute('aria-current', 'step')
  })

  it('opens old Overview configuration links as the unified canvas, without a second menu', () => {
    window.history.replaceState(null, '', '#overview/configuration')
    render(<App />)
    expect(screen.queryByRole('tablist', { name: 'Explorer story' })).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Configuration lifecycle stages' })).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Deployment flow' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Desired version configuration' })).toHaveTextContent('CURRENCY=EUR')
    expect(screen.getByRole('group', { name: 'Effective runtime scaling policy' })).toBeInTheDocument()
  })

  it('applies app-wide scaling without advancing a release and retains it when restoring an old version', () => {
    vi.useFakeTimers()
    render(<App />)
    selectScenario('latest')
    fireEvent.click(screen.getByRole('button', { name: 'Go to stage 3: Package & publish' }))
    const captured = screen.getByRole('group', { name: 'Release version snapshot' }).textContent
    fireEvent.click(screen.getByRole('button', { name: 'Apply 2-5 replicas' }))
    expect(screen.getByRole('status', { name: 'Policy application' })).toHaveTextContent('Pending application')
    expect(screen.getByRole('group', { name: 'Effective runtime scaling policy' })).toHaveTextContent('1-2 replicas')
    act(() => vi.advanceTimersByTime(1600))
    expect(screen.getByRole('group', { name: 'Effective runtime scaling policy' })).toHaveTextContent('2-5 replicas')
    expect(screen.getByRole('group', { name: 'Release version snapshot' }).textContent).toBe(captured)
    expect(screen.getByRole('button', { name: 'Go to stage 3: Package & publish' })).toHaveAttribute('aria-current', 'step')
    selectScenario('activate')
    const number = getOverviewMilestones(getScenario('activate')).findIndex((item) => item.id === 'release') + 1
    fireEvent.click(screen.getByRole('button', { name: `Go to stage ${number}: Route traffic` }))
    fireEvent.click(screen.getByRole('button', { name: 'Next stage' }))
    expect(screen.getByRole('group', { name: 'Active version configuration' })).toHaveTextContent('CURRENCY=USD')
    expect(screen.getByRole('group', { name: 'Desired version configuration' })).toHaveTextContent('CURRENCY=EUR')
    expect(screen.getByRole('group', { name: 'Effective runtime scaling policy' })).toHaveTextContent('2-5 replicas')
    fireEvent.click(screen.getByRole('button', { name: 'Reset deployment flow' }))
    expect(screen.getByRole('group', { name: 'Effective runtime scaling policy' })).toHaveTextContent('2-5 replicas')
    fireEvent.click(screen.getByRole('button', { name: 'Reset app policy' }))
    expect(screen.getByRole('group', { name: 'Effective runtime scaling policy' })).toHaveTextContent('1-2 replicas')
  })

  it('pauses playback while demonstrating an app-policy change in place', () => {
    vi.useFakeTimers()
    render(<App />)
    selectScenario('latest')
    fireEvent.click(screen.getByRole('button', { name: 'Run flow' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply 2-5 replicas' }))
    act(() => vi.advanceTimersByTime(10000))
    expect(screen.getByRole('button', { name: 'Go to stage 1: Choose source' })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: 'Run flow' })).toBeEnabled()
    expect(screen.getByRole('group', { name: 'Effective runtime scaling policy' })).toHaveTextContent('2-5 replicas')
    expect(screen.getByRole('group', { name: 'Release version snapshot' })).toHaveAttribute('data-captured', 'false')
  })
})

describe('Deployment Explorer', () => {
  beforeEach(() => window.history.replaceState(null, '', '#technical'))

  it.each([{ width: 1094, height: 281 }, { width: 1008, height: 233 }, { width: 1168, height: 429 }])('fits the whole technical map into a $width by $height laptop pane', ({ width, height }) => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(height)
    const { container } = render(<App />)
    const frame = container.querySelector<HTMLElement>('.stage-frame')!
    const map = container.querySelector<HTMLElement>('.system-stage')!
    const expectedZoom = Math.min(1, (width - 24) / 1080, (height - 24) / 680)

    expect(screen.getByLabelText('Map zoom')).toHaveTextContent(`${Math.round(expectedZoom * 100)}%`)
    expect(frame).toHaveAttribute('data-zoom-mode', 'fit')
    expect(Number.parseFloat(frame.style.width)).toBeLessThanOrEqual(width - 24)
    expect(Number.parseFloat(frame.style.height)).toBeLessThanOrEqual(height - 24)
    expect(map).toHaveStyle({ transform: `scale(${expectedZoom})` })
    expect(container.querySelector('.stage-lines')).toHaveAttribute('viewBox', '0 0 1080 680')
    expect(screen.getByRole('button', { name: 'Fit map to view' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('zooms only the map and refits when its viewport changes', () => {
    let viewportHeight = 364
    vi.stubGlobal('ResizeObserver', undefined)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1104)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => viewportHeight)
    const { container } = render(<App />)
    expect(screen.getByLabelText('Map zoom')).toHaveTextContent('50%')

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in map' }))
    expect(screen.getByLabelText('Map zoom')).toHaveTextContent('60%')
    expect(container.querySelector('.stage-frame')).toHaveAttribute('data-zoom-mode', 'manual')
    expect(container.querySelector('.transfer-brief')).not.toHaveAttribute('style')
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    expect(screen.getByRole('heading', { name: 'Forward the authenticated ARM identity' })).toBeInTheDocument()
    expect(screen.getByLabelText('Map zoom')).toHaveTextContent('60%')

    viewportHeight = 568
    fireEvent(window, new Event('resize'))
    expect(screen.getByLabelText('Map zoom')).toHaveTextContent('60%')
    fireEvent.click(screen.getByRole('button', { name: 'Fit map to view' }))
    expect(screen.getByLabelText('Map zoom')).toHaveTextContent('80%')
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out map' }))
    expect(screen.getByLabelText('Map zoom')).toHaveTextContent('70%')
    fireEvent.click(screen.getByRole('button', { name: 'Fit map to view' }))
    viewportHeight = 432
    fireEvent(window, new Event('resize'))
    expect(screen.getByLabelText('Map zoom')).toHaveTextContent('60%')
    expect(screen.getByRole('button', { name: 'Fit map to view' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('explains each transfer without covering the system stage', () => {
    const { container } = render(<App />)

    expect(screen.getByText('What happens now')).toBeInTheDocument()
    expect(screen.getByText('State after this step')).toBeInTheDocument()
    expect(screen.getByLabelText('Execution surface: ARM API')).toBeInTheDocument()
    expect(screen.getByText(/customer explicitly asks Builder Apps/)).toBeInTheDocument()
    expect(container.querySelector('.transfer-route')).toHaveTextContent('Builder CLI')
    expect(container.querySelector('.transfer-route')).toHaveTextContent('ARM API')
    expect(screen.getByText('Builder App already exists')).toBeInTheDocument()
    expect(screen.getByText('GitHub source configured + authorized')).toBeInTheDocument()
    expect(screen.getByText('Easy Auth optional · BYO Entra')).toBeInTheDocument()
    expect(screen.getByText('No active AppVersion')).toBeInTheDocument()
    expect(screen.getByText('No YARP backend assigned')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'First deploy' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Inspect Deployment operation' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Inspect No active provider' })).toBeInTheDocument()
    expect(screen.getByText('POST /deploy + request ID')).toBeInTheDocument()
    expect(screen.getByText('202 Accepted + Azure-AsyncOperation URL')).toBeInTheDocument()
    expect(container.querySelector('.destination-note')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.transfer-brief > div')).toHaveLength(2)
    expect(container.querySelector('.system-stage > .cutover-status')).not.toBeInTheDocument()
    expect(container.querySelector('.stage-panel > .cutover-status')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    expect(screen.getByRole('heading', { name: 'Forward the authenticated ARM identity' })).toBeInTheDocument()
    expect(screen.getByLabelText('Execution surface: NON-ARM API')).toBeInTheDocument()
    expect(screen.getByText('Microsoft Entra tenant ID + object ID + request ID demo-842')).toBeInTheDocument()
    expect(screen.getByText(/Entra identity \{ tenantId, objectId \}/)).toBeInTheDocument()
    expect(container.querySelector('.travel-payload')).not.toBeInTheDocument()
  })

  it('opens an evolving example and API details for AppVersion', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Deployment Explorer' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Request a deployment through ARM' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Inspect AppVersion' }))

    expect(screen.getByRole('heading', { name: 'AppVersion' })).toBeInTheDocument()
    expect(screen.getByText('AppVersion before creation')).toBeInTheDocument()
    expect(screen.getByText(/not created yet/)).toBeInTheDocument()
    expect(screen.getByText('Current step API').parentElement).toHaveTextContent('ARM API')

    fireEvent.click(screen.getByRole('tab', { name: 'API' }))
    expect(screen.getByText(/CreatePendingFromReferenceAsync/)).toBeInTheDocument()
  })

  it('steps backward immediately without moving before the first step', () => {
    render(<App />)

    const previous = screen.getByRole('button', { name: 'Previous step' })
    const next = screen.getByRole('button', { name: 'Next step' })
    expect(previous).toBeDisabled()

    fireEvent.click(next)
    expect(screen.getByRole('heading', { name: 'Forward the authenticated ARM identity' })).toBeInTheDocument()
    expect(previous).toBeEnabled()

    fireEvent.click(previous)
    expect(screen.getByRole('heading', { name: 'Request a deployment through ARM' })).toBeInTheDocument()
    expect(screen.getByLabelText(`0 of ${getScenario('manual').steps.length} steps complete`)).toBeInTheDocument()
    expect(previous).toBeDisabled()
  })

  it('jumps directly to any deployment sequence step', () => {
    const { container } = render(<App />)
    const scenario = getScenario('manual')
    const routeIndex = scenario.steps.findIndex((step) => step.id === 'activate-route')
    const resolveIndex = scenario.steps.findIndex((step) => step.id === 'resolve-revision')

    fireEvent.click(screen.getByRole('button', { name: 'Run flow' }))
    expect(container.querySelector('.run-status')).toHaveTextContent('Reading pause')

    fireEvent.click(screen.getByRole('button', { name: `Go to step ${routeIndex + 1}: Generate the app URL and create its YARP route` }))
    expect(container.querySelector('.run-status')).toHaveTextContent('Ready')
    expect(screen.getByRole('heading', { name: 'Generate the app URL and create its YARP route' })).toBeInTheDocument()
    expect(screen.getByLabelText(`${routeIndex} of ${scenario.steps.length} steps complete`)).toBeInTheDocument()
    expect(container.querySelector('.candidate-health-gate')).toHaveAttribute('data-native-readiness-state', 'passed')
    expect(container.querySelector('.candidate-health-gate')).toHaveAttribute('data-health-state', 'passed')
    expect(container.querySelector('.traffic-routing')).toHaveAttribute('data-route-target', 'none')

    fireEvent.click(screen.getByRole('button', { name: `Go to step ${resolveIndex + 1}: Resolve the configured branch to one commit` }))
    expect(screen.getByRole('heading', { name: 'Resolve the configured branch to one commit' })).toBeInTheDocument()
    expect(screen.getByLabelText(`${resolveIndex} of ${scenario.steps.length} steps complete`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Inspect AppVersion' })).toHaveTextContent('Not created')
    expect(container.querySelector('.candidate-health-gate')).toHaveAttribute('data-health-state', 'absent')
    expect(container.querySelector('.traffic-routing')).toHaveAttribute('data-route-target', 'none')
  })

  it('switches to a retained-version flow without GitHub build steps', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('tab', { name: 'Redeploy' }))

    expect(screen.getByRole('heading', { name: 'Request a retained-version redeploy' })).toBeInTheDocument()
    expect(screen.queryByText('Resolve main to an exact commit')).not.toBeInTheDocument()
    expect(screen.getByText('Select a reusable ready AppVersion')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Rollback' })).not.toBeInTheDocument()
  })

  it('shows exact-commit deploy and explicit version activation as distinct actions', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('tab', { name: 'Deploy commit' }))
    expect(screen.getByRole('heading', { name: 'Request deployment of one exact commit' })).toBeInTheDocument()
    expect(screen.getByText('Find an exact ready AppVersion match')).toBeInTheDocument()
    const commitScenario = getScenario('commit')
    const selectionIndex = commitScenario.steps.findIndex((step) => step.id === 'commit-select-version')
    fireEvent.click(screen.getByRole('button', { name: `Go to step ${selectionIndex + 1}: Find an exact ready AppVersion match` }))
    expect(screen.getByText(/same lifecycle, source identity, root directory, commit/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Activate version' }))
    expect(screen.getByRole('heading', { name: 'Request one frozen AppVersion explicitly' })).toBeInTheDocument()
    expect(screen.getByText('Validate the selected retained AppVersion')).toBeInTheDocument()
    expect(screen.queryByText('Revalidate the persisted GitHub source authorization')).not.toBeInTheDocument()

    const scenario = getScenario('activate')
    const prepareIndex = scenario.steps.findIndex((step) => step.id === 'activate-prepare')
    fireEvent.click(screen.getByRole('button', { name: `Go to step ${prepareIndex + 1}: Prepare the retained version for fresh runtime resources` }))
    expect(screen.getByRole('button', { name: 'Inspect Deployment operation' })).toHaveTextContent('Pending')

    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    expect(screen.getByRole('button', { name: 'Inspect Deployment operation' })).toHaveTextContent('Provisioning')
  })

  it('creates or switches one YARP backend route after the candidate passes health', () => {
    const { container } = render(<App />)

    expect(container.querySelector('.traffic-routing')).toHaveAttribute('data-route-target', 'none')
    expect(screen.getByRole('button', { name: 'Inspect Customer URL' })).toHaveTextContent('No route yet')
    expect(container.querySelector('.yarp-backend-route')).not.toBeInTheDocument()
    expect(container.querySelector('.candidate-health-gate')).toHaveAttribute('data-health-state', 'absent')
    expect(screen.queryByRole('button', { name: 'Inspect Direct health check' })).not.toBeInTheDocument()

    const next = screen.getByRole('button', { name: 'Next step' })
    const firstActivationIndex = getScenario('manual').steps.findIndex((step) => step.id === 'activate-route')
    for (let index = 0; index < firstActivationIndex; index += 1) fireEvent.click(next)
    expect(container.querySelector('.candidate-health-gate')).toHaveAttribute('data-native-readiness-state', 'passed')
    expect(container.querySelector('.traffic-routing')).toHaveAttribute('data-route-target', 'none')
    expect(container.querySelector('.candidate-health-gate')).toHaveAttribute('data-health-state', 'passed')

    fireEvent.click(next)
    expect(container.querySelector('.traffic-routing')).toHaveAttribute('data-route-target', 'candidate')
    expect(container.querySelectorAll('.yarp-backend-route')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Inspect Customer URL' })).toHaveTextContent('Route created')

    fireEvent.click(next)
    expect(screen.getByRole('button', { name: 'Inspect Customer URL' })).toHaveTextContent('Public route verified')

    fireEvent.click(screen.getByRole('tab', { name: 'Deploy latest' }))
    expect(container.querySelector('.traffic-routing')).toHaveAttribute('data-route-target', 'existing')
    expect(container.querySelectorAll('.yarp-backend-route')).toHaveLength(1)

    const latestScenario = getScenario('latest')
    const activationIndex = latestScenario.steps.findIndex((step) => step.id === 'activate-route')
    for (let index = 0; index < activationIndex; index += 1) fireEvent.click(next)
    expect(container.querySelector('.candidate-health-gate')).toHaveAttribute('data-health-state', 'passed')
    expect(container.querySelector('.traffic-routing')).toHaveAttribute('data-route-target', 'existing')

    fireEvent.click(next)
    expect(container.querySelector('.traffic-routing')).toHaveAttribute('data-route-target', 'candidate')
    expect(container.querySelectorAll('.yarp-backend-route')).toHaveLength(1)
  })
})
