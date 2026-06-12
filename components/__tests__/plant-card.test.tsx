/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { PlantCard } from '../plant-card'

jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children }: any) => <a href={href}>{children}</a> }))
jest.mock('next/image', () => ({ __esModule: true, default: ({ src, alt }: any) => <img src={src} alt={alt} /> }))

const plant = {
  id: 'p1',
  common_name: 'Monstera',
  scientific_name: 'Monstera deliciosa',
  next_watering_at: '2026-06-12T00:00:00.000Z',
  primary_photo: null,
}

describe('PlantCard', () => {
  it('renders plant name', () => {
    render(<PlantCard plant={plant} />)
    expect(screen.getByText('Monstera')).toBeInTheDocument()
  })

  it('shows next watering date', () => {
    render(<PlantCard plant={plant} />)
    expect(screen.getByText(/Jun 12/)).toBeInTheDocument()
  })

  it('links to plant detail page', () => {
    render(<PlantCard plant={plant} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/plants/p1')
  })
})
