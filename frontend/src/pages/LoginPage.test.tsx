import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import LoginPage from './LoginPage'
import { AuthProvider } from '../context/AuthContext'
import { authApi } from '../api'

vi.mock('../api', () => ({
  TOKEN_KEY: 'ims_token',
  USER_KEY: 'ims_user',
  errorMessage: () => 'Invalid credentials',
  publicApi: { stats: vi.fn().mockResolvedValue(null) },
  authApi: { login: vi.fn(), register: vi.fn() },
}))

function renderLogin() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/portal" element={<div>portal home</div>} />
          <Route path="/" element={<div>ops home</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

// Both slide panels are always mounted, so queries target the customer panel's
// unique ids/exact names ("Sign In" the submit, not "Operations sign-in";
// #cx-password, not the ops password field).
const emailField = () => screen.getByLabelText('Email', { selector: '#cx-email' })
const passwordField = () => screen.getByLabelText('Password', { selector: '#cx-password' })
const signInButton = () => screen.getByRole('button', { name: 'Sign In' })

describe('LoginPage', () => {
  it('shows the customer sign-in panel by default', () => {
    renderLogin()
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(signInButton()).toBeInTheDocument()
    // Self-signup is offered on the customer side only.
    expect(screen.getByRole('button', { name: 'Create an account' })).toBeInTheDocument()
  })

  it('slides to the operations console panel via the toggle', async () => {
    const user = userEvent.setup()
    renderLogin()
    // Two toggles exist (one per panel); the customer panel's renders first.
    await user.click(screen.getAllByRole('tab', { name: 'Operations' })[0])
    expect(screen.getByText('Incident Intelligence Platform')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /access workspace/i })).toBeInTheDocument()
    // Ops accounts are admin-provisioned: no signup on this panel.
    expect(screen.getByText(/provisioned by your administrator/i)).toBeInTheDocument()
  })

  it('routes a customer to the portal after login', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      token: 'jwt', tokenType: 'Bearer', id: 5, name: 'Demo Customer', email: 'customer@ims.com', role: 'CUSTOMER',
    })
    const user = userEvent.setup()
    renderLogin()

    await user.type(emailField(), 'customer@ims.com')
    await user.type(passwordField(), 'Customer@123')
    await user.click(signInButton())

    // The post-login transition holds for ~1s before navigating.
    await waitFor(() => expect(screen.getByText('portal home')).toBeInTheDocument(), { timeout: 3000 })
    expect(authApi.login).toHaveBeenCalledWith('customer@ims.com', 'Customer@123')
  })

  it('shows an error when credentials are rejected', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new Error('401'))
    const user = userEvent.setup()
    renderLogin()

    await user.type(emailField(), 'customer@ims.com')
    await user.type(passwordField(), 'wrong')
    await user.click(signInButton())

    // Both slide panels surface the same error state, so expect one per panel.
    const alerts = await screen.findAllByRole('alert', {}, { timeout: 3000 })
    expect(alerts[0]).toHaveTextContent('Invalid credentials')
  })
})
