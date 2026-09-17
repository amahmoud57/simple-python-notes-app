// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { getScenario } from './model'

afterEach(cleanup)

describe('Deployment Explorer', () => {
  it('explains each transfer without covering the system stage', () => {
    const { container } = render(<App />)

    expect(screen.getByText('What happens now')).toBeInTheDocument()
    expect(screen.getByText('State after this step')).toBeInTheDocument()
    expect(screen.getByLabelText('Execution surface: ARM API')).toBeInTheDocument()
    expect(screen.getByText(/customer explicitly asks Builder Apps/)).toBeInTheDocument()
    expect(container.querySelector('.transfer-route')).toHaveTextContent('Builder CLI')
    expect(container.querySelector('.transfer-route')).toHaveTextContent('ARM API')
    expect(screen.getByText('Builder App already exists')).toBeInTheDocument()
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
    expect(screen.getByText('API boundary').parentElement).toHaveTextContent('ARM API')

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
    expect(screen.getByLabelText('0 of 20 steps complete')).toBeInTheDocument()
    expect(previous).toBeDisabled()
  })

  it('jumps directly to any deployment sequence step', () => {
    const { container } = render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Run flow' }))
    expect(container.querySelector('.run-status')).toHaveTextContent('Reading pause')

    fireEvent.click(screen.getByRole('button', { name: 'Go to step 18: Generate the app URL and create its YARP route' }))
    expect(container.querySelector('.run-status')).toHaveTextContent('Ready')
    expect(screen.getByRole('heading', { name: 'Generate the app URL and create its YARP route' })).toBeInTheDocument()
    expect(screen.getByLabelText('17 of 20 steps complete')).toBeInTheDocument()
    expect(container.querySelector('.candidate-health-gate')).toHaveAttribute('data-health-state', 'passed')
    expect(container.querySelector('.traffic-routing')).toHaveAttribute('data-route-target', 'none')

    fireEvent.click(screen.getByRole('button', { name: 'Go to step 6: Resolve the configured branch to one commit' }))
    expect(screen.getByRole('heading', { name: 'Resolve the configured branch to one commit' })).toBeInTheDocument()
    expect(screen.getByLabelText('5 of 20 steps complete')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Inspect AppVersion' })).toHaveTextContent('ID reserved')
    expect(container.querySelector('.candidate-health-gate')).toHaveAttribute('data-health-state', 'absent')
    expect(container.querySelector('.traffic-routing')).toHaveAttribute('data-route-target', 'none')
  })

  it('switches to a retained-version flow without GitHub build steps', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('tab', { name: 'Redeploy' }))

    expect(screen.getByRole('heading', { name: 'Request a retained-version redeploy' })).toBeInTheDocument()
    expect(screen.queryByText('Resolve main to an exact commit')).not.toBeInTheDocument()
    expect(screen.getByText('Validate retained AppVersion ver_17')).toBeInTheDocument()
  })

  it('creates or switches one YARP backend route after the candidate passes health', () => {
    const { container } = render(<App />)

    expect(container.querySelector('.traffic-routing')).toHaveAttribute('data-route-target', 'none')
    expect(screen.getByRole('button', { name: 'Inspect Customer URL' })).toHaveTextContent('No route yet')
    expect(container.querySelector('.yarp-backend-route')).not.toBeInTheDocument()
    expect(container.querySelector('.candidate-health-gate')).toHaveAttribute('data-health-state', 'absent')
    expect(screen.queryByRole('button', { name: 'Inspect Direct health check' })).not.toBeInTheDocument()

    const next = screen.getByRole('button', { name: 'Next step' })
    for (let index = 0; index < 17; index += 1) fireEvent.click(next)
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
