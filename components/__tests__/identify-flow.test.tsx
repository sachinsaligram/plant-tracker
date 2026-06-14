/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { IdentifyFlow } from '../identify-flow'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

describe('IdentifyFlow capture step', () => {
  it('shows a "Take a photo" file input', () => {
    render(<IdentifyFlow />)
    expect(screen.getByLabelText(/take a photo/i)).toBeInTheDocument()
  })

  it('shows a "Choose from gallery" file input', () => {
    render(<IdentifyFlow />)
    expect(screen.getByLabelText(/choose from gallery/i)).toBeInTheDocument()
  })

  it('"Take a photo" input has capture="environment"', () => {
    render(<IdentifyFlow />)
    const input = screen.getByLabelText(/take a photo/i)
    expect(input).toHaveAttribute('capture', 'environment')
  })

  it('"Choose from gallery" input does not have a capture attribute', () => {
    render(<IdentifyFlow />)
    const input = screen.getByLabelText(/choose from gallery/i)
    expect(input).not.toHaveAttribute('capture')
  })
})
