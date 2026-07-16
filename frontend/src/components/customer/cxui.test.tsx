import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusPill, priorityLabel } from './cxui'

describe('StatusPill', () => {
  it('renders customer-friendly labels for every status', () => {
    render(
      <>
        <StatusPill status="OPEN" />
        <StatusPill status="IN_PROGRESS" />
        <StatusPill status="PENDING" />
        <StatusPill status="RESOLVED" />
        <StatusPill status="CLOSED" />
      </>,
    )
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    // PENDING is deliberately surfaced to customers as an action prompt.
    expect(screen.getByText('Awaiting You')).toBeInTheDocument()
    expect(screen.getByText('Resolved')).toBeInTheDocument()
    expect(screen.getByText('Closed')).toBeInTheDocument()
  })
})

describe('priorityLabel', () => {
  it('maps P1–P4 to plain-language urgency', () => {
    expect(priorityLabel('P1')).toBe('Critical')
    expect(priorityLabel('P2')).toBe('High')
    expect(priorityLabel('P3')).toBe('Medium')
    expect(priorityLabel('P4')).toBe('Low')
  })
})
