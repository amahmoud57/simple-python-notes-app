// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

afterEach(cleanup)

describe('Deployment Explorer', () => {
  it('explains each transfer without covering the system stage', () => {
    const { container } = render(<App />)

    expect(screen.getByText('What happens now')).toBeInTheDocument()
    expect(screen.getByText('State after this step')).toBeInTheDocument()
    expect(screen.getByText(/customer explicitly asks Builder Apps/)).toBeInTheDocument()
    expect(container.querySelector('.transfer-route')).toHaveTextContent('Builder CLI')
    expect(container.querySelector('.transfer-route')).toHaveTextContent('ARM API')
    expect(screen.getByText('Builder App already exists')).toBeInTheDocument()
    expect(screen.getByText('No active AppVersion')).toBeInTheDocument()
    expect(screen.getByText('No YARP backend assigned')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'First deploy' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Inspect No active provider' })).toBeInTheDocument()
    expect(screen.getByText('POST /deploy + request ID')).toBeInTheDocument()
    expect(screen.getByText('202 Accepted + Azure-AsyncOperation URL')).toBeInTheDocument()
    expect(container.querySelector('.destination-note')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.transfer-brief > div')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    expect(screen.getByRole('heading', { name: 'Forward the authenticated ARM identity' })).toBeInTheDocument()
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

    fireEvent.click(screen.getByRole('tab', { name: 'API' }))
    expect(screen.getByText(/CreatePendingFromReferenceAsync/)).toBeInTheDocument()
  })

  it('switches to a retained-version flow without GitHub build steps', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('tab', { name: 'Redeploy' }))

    expect(screen.getByRole('heading', { name: 'Request a retained-version redeploy' })).toBeInTheDocument()
    expect(screen.queryByText('Resolve main to an exact commit')).not.toBeInTheDocument()
    expect(screen.getByText('Validate retained AppVersion ver_17')).toBeInTheDocument()
  })
})
