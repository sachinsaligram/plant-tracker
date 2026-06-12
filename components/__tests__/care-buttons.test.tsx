/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CareButtons } from '../care-buttons'

global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any

describe('CareButtons', () => {
  it('renders water, repot, and fertilize buttons', () => {
    render(<CareButtons plantId="p1" onLogged={jest.fn()} />)
    expect(screen.getByText(/water/i)).toBeInTheDocument()
    expect(screen.getByText(/repot/i)).toBeInTheDocument()
    expect(screen.getByText(/fertilize/i)).toBeInTheDocument()
  })

  it('calls POST /api/care-logs when water is tapped', async () => {
    render(<CareButtons plantId="p1" onLogged={jest.fn()} />)
    fireEvent.click(screen.getByText(/water/i))
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/care-logs', expect.objectContaining({ method: 'POST' }))
    })
  })
})
