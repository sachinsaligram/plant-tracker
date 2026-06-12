/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { IdentifyFlow } from '../identify-flow'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

describe('IdentifyFlow', () => {
  it('shows file input labeled "Take a photo" on mount', () => {
    render(<IdentifyFlow />)
    expect(screen.getByLabelText(/take a photo/i)).toBeInTheDocument()
  })
})
