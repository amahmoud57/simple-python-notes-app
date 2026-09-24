// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { getScenario, scenarios } from './model'
import { getOverviewMilestones, getOverviewState } from './overview'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Deployment Overview', () => {
  const selectScenario = (id: string) => fireEvent.change(screen.getByRole('combobox', { name: 'Scenario' }), { target: { value: id } })
  const slot = (container: HTMLElement, role: 'new' | 'live') => container.querySelector<HTMLElement>(`[data-slot="${role}"]`)!
  const chip = (name: 'version configuration' | 'scaling policy' | 'builder.yaml') => screen.getByRole('button', { name: `Inspect ${name}` })
  const path = (container: HTMLElement, key: string) => container.querySelector(`[data-path="${key}"]`)
  const packets = (container: HTMLElement) => [...container.querySelectorAll('.ov-packet')].map((item) => item.getAttribute('data-packet'))

  it('opens one canvas where version config and scaling feed the release flow', () => {
    const { container } = render(<App />)
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('tabpanel', { name: 'Overview' }))
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('tablist', { name: 'Explorer story' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Configuration' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Deploy starts from source: create v1.' })).toBeInTheDocument()
    expect(chip('version configuration')).toHaveTextContent('API_URL = api.contoso.com')
    expect(chip('version configuration')).toHaveTextContent('Frozen into each new AppVersion')
    expect(chip('scaling policy')).toHaveTextContent('1–3 replicas · CPU 70%')
    expect(chip('scaling policy')).toHaveTextContent('Always current · applied live')
    expect(chip('builder.yaml')).toHaveTextContent('Read at the commit')
    expect(chip('builder.yaml')).toHaveClass('state-current')
    expect(path(container, 'yaml-version')).toHaveClass('state-current')
    expect(path(container, 'drop-version')).toHaveTextContent('frozen into v1')
    expect(path(container, 'drop-scaling-new')).toHaveTextContent('applied to v1')
    expect(path(container, 'acr-artifact')).toHaveTextContent('pull · AcrPull')
    expect(screen.getByRole('button', { name: 'Inspect Embr ACR: OCI image registry' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Inspect No live Artifact App yet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Inspect Customers: no app yet' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Go to stage/ })).toHaveLength(9)
    expect(screen.getByRole('button', { name: 'Go to stage 1: Create v1' })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('combobox', { name: 'Scenario' }).querySelectorAll('optgroup')).toHaveLength(2)
    expect(container.textContent).not.toMatch(/CURRENCY|RELEASE_CHANNEL|EUR|USD/)
    expect(screen.queryByRole('button', { name: 'Inspect ARM API' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous stage' })).toBeDisabled()
  })

  it('freezes API_URL into v17 and combines it with current scaling in the new Artifact App', () => {
    const { container } = render(<App />)
    selectScenario('latest')
    expect(container.querySelector('.ov-version-card')).toHaveAttribute('data-frozen', 'false')
    expect(slot(container, 'live')).toHaveTextContent('v16')
    expect(slot(container, 'live')).toHaveTextContent('legacy.contoso.com')
    fireEvent.click(screen.getByRole('button', { name: 'Next stage' }))
    expect(container.querySelector('.ov-version-card')).toHaveAttribute('data-frozen', 'true')
    expect(container.querySelector('.ov-version-card')).toHaveTextContent('v17')
    fireEvent.click(screen.getByRole('button', { name: 'Go to stage 5: Start' }))
    expect(slot(container, 'new')).toHaveAttribute('data-slot-state', 'starting')
    expect(screen.getByRole('status', { name: 'Current stage' })).toHaveTextContent('Variables come from v17. Scaling comes from the app.')
    fireEvent.click(screen.getByRole('button', { name: 'Next stage' }))
    expect(slot(container, 'new')).toHaveTextContent('api.contoso.com')
    expect(slot(container, 'new')).toHaveTextContent('1–3')
    expect(slot(container, 'live')).toHaveTextContent('legacy.contoso.com')
    expect(container.querySelector('.ov-canvas')).toHaveAttribute('data-route-target', 'live')
  })

  it.each(scenarios)('moves $label traffic only after health and retires the old app last', (scenario) => {
    const { container } = render(<App />)
    selectScenario(scenario.id)
    const milestones = getOverviewMilestones(scenario)
    const next = screen.getByRole('button', { name: 'Next stage' })
    expect(screen.getAllByRole('button', { name: /Go to stage/ })).toHaveLength(milestones.length)
    for (const [index, milestone] of milestones.entries()) {
      expect(screen.getByRole('button', { name: `Go to stage ${index + 1}: ${milestone.label}` })).toHaveAttribute('aria-current', 'step')
      expect(screen.getByRole('status', { name: 'Current stage' })).toHaveTextContent(milestone.title)
      expect(container.querySelector('.ov-canvas')).toHaveAttribute('data-current-stage', milestone.id)
      if (milestone.id === 'release') {
        expect(slot(container, 'new')).toHaveAttribute('data-slot-state', 'healthy')
        expect(container.querySelector('.ov-canvas')).toHaveAttribute('data-route-target', scenario.hasExistingRuntime ? 'live' : 'none')
      }
      fireEvent.click(next)
    }
    expect(next).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Run flow' })).toBeDisabled()
    expect(container.querySelector('.ov-canvas')).toHaveAttribute('data-route-target', 'new')
    expect(slot(container, 'new')).toHaveAttribute('data-slot-state', 'live')
    expect(slot(container, 'live')).toHaveAttribute('data-slot-state', scenario.hasExistingRuntime ? 'removed' : 'empty')
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(getOverviewState(scenario, scenario.steps.length).completion.title)
    expect(container.querySelector('[data-node="build"]')).toHaveClass(milestones.some((item) => item.id === 'build') ? 'state-done' : 'state-skipped')
    fireEvent.click(screen.getByRole('button', { name: 'Reset flow' }))
    expect(screen.getByRole('button', { name: 'Previous stage' })).toBeDisabled()
    expect(container.querySelector('.ov-canvas')).toHaveAttribute('data-current-stage', 'select')
  })

  it('shows retained versions bringing their own config while the desired value is not used', () => {
    const { container } = render(<App />)
    selectScenario('activate')
    expect(chip('version configuration')).toHaveClass('state-unused')
    expect(chip('version configuration')).toHaveTextContent('Not used · v16 keeps its own')
    expect(chip('builder.yaml')).toHaveClass('state-skipped')
    expect(chip('builder.yaml')).toHaveTextContent('Kept in v16')
    expect(path(container, 'drop-version')).toHaveClass('state-unused')
    expect(container.querySelector('[data-node="source"]')).toHaveClass('state-skipped')
    expect(container.querySelector('[data-node="build"]')).toHaveClass('state-skipped')
    fireEvent.click(screen.getByRole('button', { name: 'Go to stage 5: Health check' }))
    expect(slot(container, 'new')).toHaveTextContent('v16')
    expect(slot(container, 'new')).toHaveTextContent('legacy.contoso.com')
    expect(slot(container, 'new')).toHaveTextContent('1–3')
    expect(slot(container, 'live')).toHaveTextContent('v17')
    expect(slot(container, 'live')).toHaveTextContent('api.contoso.com')
  })

  it('names each scenario by the command customers run and the Deployment it creates', () => {
    render(<App />)
    const command = () => screen.getByRole('group', { name: 'Command' })
    const phases = () => screen.getAllByRole('list').filter((list) => list.parentElement?.classList.contains('stage-phase')).map((list) => list.getAttribute('aria-labelledby'))
    const phaseStages = (phase: string) => [...screen.getByRole('list', { name: phase }).querySelectorAll('button')].map((button) => button.getAttribute('aria-label'))
    expect(command()).toHaveTextContent('CLIbuilder app deploy <name>')
    expect(command()).toHaveTextContent('New Deployment (action: deploy) · builds v1')
    expect(screen.getByRole('list', { name: 'Deployment timeline' })).toBeInTheDocument()
    expect(phases()).toEqual(['stage-phase-queue', 'stage-phase-build', 'stage-phase-provision', 'stage-phase-verify', 'stage-phase-route', 'stage-phase-cleanup'])
    expect(phaseStages('Build')).toEqual(['Go to stage 2: Build web', 'Go to stage 3: Build api'])

    selectScenario('activate')
    expect(command()).toHaveTextContent('CLIbuilder app version activate <name> --previous')
    expect(command()).toHaveTextContent('New Deployment (action: activate) · reuses v16 · no build')
    expect(screen.getByRole('list', { name: 'Activation timeline' })).toBeInTheDocument()
    expect(phases()).toEqual(['stage-phase-queue', 'stage-phase-build', 'stage-phase-provision', 'stage-phase-verify', 'stage-phase-route', 'stage-phase-cleanup'])
    expect(phaseStages('Build')).toEqual(['Go to stage 2: Reused'])
    expect(screen.getByRole('heading', { name: 'Activate starts from a built version, v16.' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Go to stage 8: Clean up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next stage' }))
    expect(screen.getByRole('heading', { name: 'Activation completed. v16 is live again.' })).toBeInTheDocument()

    selectScenario('redeploy')
    expect(command()).toHaveTextContent('ARMPOST …/builderApps/<name>/redeploy')
    expect(command()).toHaveTextContent('no CLI command')
    expect(screen.getByRole('list', { name: 'Redeploy timeline' })).toBeInTheDocument()

    const groups = [...screen.getByRole('combobox', { name: 'Scenario' }).querySelectorAll('optgroup')].map((group) => [group.label, [...group.querySelectorAll('option')].map((option) => option.textContent)])
    expect(groups).toEqual([
      ['Deploy from source', ['First deploy', 'Deploy']],
      ['Reuse a built version', ['Activate previous version', 'Redeploy']],
    ])
  })

  it('opens JSON for the Builder App, builder.yaml, settings, map elements, and the Deployment without leaving the Overview', () => {
    const { container } = render(<App />)
    const drawer = () => screen.getByRole('complementary', { name: /./ })
    const codeBlocks = () => [...container.querySelectorAll('.detail-code code')].map((block) => block.textContent ?? '')
    const headings = () => [...container.querySelectorAll('.detail-code-heading span')].map((heading) => heading.textContent)

    fireEvent.click(screen.getByRole('button', { name: 'Inspect Deployment: Creating' }))
    expect(JSON.parse(codeBlocks()[0])).toMatchObject({ id: 'adp_demo', state: 'not created yet' })

    fireEvent.click(chip('builder.yaml'))
    expect(drawer()).toHaveTextContent('builder.yaml')
    expect(chip('builder.yaml')).toHaveAttribute('aria-pressed', 'true')
    expect(headings()).toEqual(['builder.yaml', 'Parsed manifest the AppVersion will store'])
    expect(codeBlocks()[0]).toContain('components:')
    expect(JSON.parse(codeBlocks()[1]).components.map((component: { name: string }) => component.name)).toEqual(['web', 'api'])

    fireEvent.click(screen.getByRole('button', { name: 'Next stage' }))
    expect(headings()[1]).toBe('Parsed manifest stored as AppVersion ver_demo.manifest')

    fireEvent.click(chip('version configuration'))
    expect(screen.getByRole('heading', { name: 'Version configuration', level: 2 })).toBeInTheDocument()
    expect(JSON.parse(codeBlocks()[0]).versionConfiguration.variables).toEqual([{ name: 'API_URL', value: 'https://api.contoso.com' }])
    expect(headings()[1]).toBe('Frozen copy in AppVersion ver_demo.configuration')

    fireEvent.click(chip('scaling policy'))
    expect(JSON.parse(codeBlocks()[0]).scaling.components[0]).toMatchObject({ name: 'api', minReplicas: 1, maxReplicas: 3 })

    fireEvent.click(screen.getByRole('button', { name: /^Inspect AppVersion/ }))
    expect(JSON.parse(codeBlocks()[0]).manifest.name).toBe('shop')
    fireEvent.click(screen.getByRole('button', { name: 'Inspect Builder App: no runtime yet, deploying v1' }))
    expect(JSON.parse(codeBlocks()[0])).toMatchObject({ type: 'Microsoft.Web/builderApps', properties: { versionConfiguration: { variables: [{ name: 'API_URL' }] } } })
    expect(headings()[1]).toBe('Regional BuilderApp persistence document')
    fireEvent.click(screen.getByRole('button', { name: 'Inspect Deployment: Building' }))
    expect(JSON.parse(codeBlocks()[0])).toMatchObject({ id: 'adp_demo', status: 'building', action: 'deploy' })
    fireEvent.click(screen.getByRole('button', { name: /^Inspect v1 Artifact App/ }))
    expect(codeBlocks()[0]).toContain('Microsoft.App/artifactApps')

    fireEvent.click(screen.getByRole('button', { name: 'Close component details' }))
    expect(container.querySelector('.detail-drawer')).not.toBeInTheDocument()
    expect(screen.getByRole('tabpanel', { name: 'Overview' })).toBeInTheDocument()
  })

  it('shows the Deployment status and the Builder App runtime as stages advance', () => {
    render(<App />)
    const label = (prefix: string) => screen.getByRole('button', { name: new RegExp(`^Inspect ${prefix}: `) }).getAttribute('aria-label')!.replace(`Inspect ${prefix}: `, '')
    const statuses = ['Creating', 'Building', 'Building', 'Provisioning', 'Provisioning', 'Health check', 'Routing', 'Routing', 'Succeeded'].map((_, index) => {
      if (index > 0) fireEvent.click(screen.getByRole('button', { name: 'Next stage' }))
      if (index === 0) expect(label('Builder App')).toBe('no runtime yet, deploying v1')
      return label('Deployment')
    })
    expect(statuses).toEqual(['Creating', 'Building', 'Building', 'Provisioning', 'Provisioning', 'Health check', 'Routing', 'Routing', 'Succeeded'])
    expect(label('Builder App')).toBe('v1 live')
  })

  it('keeps stepping stages while the Deployment inspector stays open', () => {
    const { container } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Inspect Deployment: Creating' }))
    expect(container.querySelector('.app-shell')).toHaveClass('has-inspector')
    fireEvent.click(screen.getByRole('button', { name: 'Next stage' }))
    expect(screen.getByRole('complementary', { name: 'Deployment' })).toBeInTheDocument()
    expect(JSON.parse(container.querySelector('.detail-code code')?.textContent ?? '{}')).toMatchObject({ status: 'building' })
  })

  it('carries the commit and frozen config into the AppVersion, then image and scaling into the new app', () => {
    vi.useFakeTimers()
    const { container } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Run flow' }))
    act(() => vi.advanceTimersByTime(200))
    expect(packets(container)).toEqual(['source-version', 'yaml-version', 'drop-version'])
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    fireEvent.click(screen.getByRole('button', { name: 'Go to stage 5: Start' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run flow' }))
    act(() => vi.advanceTimersByTime(1800))
    expect(packets(container)).toEqual(['artifact-runtime', 'drop-scaling-new'])
    expect(container.querySelector('.ov-canvas')).toHaveClass('is-running')
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    act(() => vi.advanceTimersByTime(10000))
    expect(container.querySelector('.ov-packet')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go to stage 5: Start' })).toHaveAttribute('aria-current', 'step')
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
    expect(screen.getByRole('button', { name: 'Go to stage 2: Build web' })).toHaveAttribute('aria-current', 'step')
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
    expect(screen.getByRole('button', { name: 'Go to stage 1: Create v1' })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: 'Next stage' })).toBeEnabled()
  })

  it.each([{ id: 'manual', title: 'Deployment completed. v1 is live.' }, { id: 'activate', title: 'Activation completed. v16 is live again.' }])('plays every $id stage and stops automatically', ({ id, title }) => {
    vi.useFakeTimers()
    render(<App />)
    selectScenario(id)
    fireEvent.click(screen.getByRole('button', { name: 'Run flow' }))
    for (let index = 0; index < getOverviewMilestones(getScenario(id as 'manual' | 'activate')).length; index += 1) {
      act(() => vi.advanceTimersByTime(2000))
      act(() => vi.advanceTimersByTime(4500))
    }
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run flow' })).toBeDisabled()
  })

  it('cancels playback when a scenario or view changes', () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Run flow' }))
    act(() => vi.advanceTimersByTime(200))
    selectScenario('redeploy')
    act(() => vi.advanceTimersByTime(10000))
    expect(screen.getByRole('button', { name: 'Go to stage 1: Pick v17' })).toHaveAttribute('aria-current', 'step')
    fireEvent.click(screen.getByRole('button', { name: 'Run flow' }))
    act(() => vi.advanceTimersByTime(200))
    fireEvent.click(screen.getByRole('tab', { name: 'Technical' }))
    act(() => vi.advanceTimersByTime(10000))
    expect(screen.getByRole('heading', { name: 'Request a redeploy of the active version' })).toBeInTheDocument()
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
    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveValue('activate')
    expect(screen.getByRole('button', { name: 'Go to stage 1: Pick v16' })).toHaveAttribute('aria-current', 'step')
  })

  it('opens old configuration links as the single Overview or the Technical flow', () => {
    window.history.replaceState(null, '', '#overview/configuration')
    const { unmount } = render(<App />)
    expect(screen.queryByRole('tablist', { name: 'Explorer story' })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Deployment map' })).toBeInTheDocument()
    expect(chip('version configuration')).toHaveTextContent('API_URL = api.contoso.com')
    unmount()
    window.history.replaceState(null, '', '#technical/configuration')
    render(<App />)
    expect(screen.getByRole('tab', { name: 'Technical' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('tab', { name: 'Configuration' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Request a deployment through ARM' })).toBeInTheDocument()
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
    expect(screen.getByText('versionConfiguration: API_URL=api.contoso.com')).toBeInTheDocument()
    expect(screen.getByText('scaling: api 1–3 replicas · CPU 70%')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'First deploy' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Inspect Deployment' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Inspect No active provider' })).toBeInTheDocument()
    expect(screen.getByText('POST /deploy + request ID')).toBeInTheDocument()
    expect(screen.getByText('202 Accepted + Azure-AsyncOperation URL, once Regional has created the Deployment')).toBeInTheDocument()
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

    expect(screen.getByRole('heading', { name: 'Request a redeploy of the active version' })).toBeInTheDocument()
    expect(screen.queryByText('Resolve main to an exact commit')).not.toBeInTheDocument()
    expect(screen.getByText('Select a reusable ready AppVersion')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Rollback' })).not.toBeInTheDocument()
  })

  it('shows version activation as a distinct no-build action', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('tab', { name: 'Activate previous version' }))
    expect(screen.getByRole('heading', { name: 'Activate one built AppVersion by ID' })).toBeInTheDocument()
    expect(screen.getByText('builder app version activate <name> --previous', { selector: '.scenario-command' })).toBeInTheDocument()
    expect(screen.getByText('Activation sequence')).toBeInTheDocument()
    expect(screen.getByText('Validate the selected retained AppVersion')).toBeInTheDocument()
    expect(screen.queryByText('Revalidate the persisted GitHub source authorization')).not.toBeInTheDocument()

    const scenario = getScenario('activate')
    const prepareIndex = scenario.steps.findIndex((step) => step.id === 'activate-prepare')
    fireEvent.click(screen.getByRole('button', { name: `Go to step ${prepareIndex + 1}: Prepare the retained version for fresh runtime resources` }))
    expect(screen.getByRole('button', { name: 'Inspect Deployment' })).toHaveTextContent('Pending')

    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    expect(screen.getByRole('button', { name: 'Inspect Deployment' })).toHaveTextContent('Provisioning')
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

    fireEvent.click(screen.getByRole('tab', { name: 'Deploy' }))
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
