import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CustomerOnly, OpsOnly } from './RoleGate'
import { AuthProvider } from '../context/AuthContext'
import { TOKEN_KEY, USER_KEY } from '../api'
import type { Role } from '../api'

/** Seeds the stored session AuthContext reads at mount. */
function seedSession(role: Role) {
  localStorage.setItem(TOKEN_KEY, 'test-token')
  localStorage.setItem(USER_KEY, JSON.stringify({ id: 1, name: 'Test User', email: 't@example.com', role }))
}

/** Renders both gated worlds plus the pages redirects land on. */
function renderAt(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<div>login page</div>} />
          <Route element={<CustomerOnly />}>
            <Route path="/portal" element={<div>customer portal</div>} />
          </Route>
          <Route element={<OpsOnly />}>
            <Route path="/" element={<div>ops console</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('CustomerOnly', () => {
  it('redirects anonymous visitors to the login page', () => {
    renderAt('/portal')
    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('lets a customer through to the portal', () => {
    seedSession('CUSTOMER')
    renderAt('/portal')
    expect(screen.getByText('customer portal')).toBeInTheDocument()
  })

  it('bounces staff to the ops console', () => {
    seedSession('ADMIN')
    renderAt('/portal')
    expect(screen.getByText('ops console')).toBeInTheDocument()
  })
})

describe('OpsOnly', () => {
  it('redirects anonymous visitors to the login page', () => {
    renderAt('/')
    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('lets an analyst through to the console', () => {
    seedSession('ANALYST')
    renderAt('/')
    expect(screen.getByText('ops console')).toBeInTheDocument()
  })

  it('bounces customers to their portal', () => {
    seedSession('CUSTOMER')
    renderAt('/')
    expect(screen.getByText('customer portal')).toBeInTheDocument()
  })
})
