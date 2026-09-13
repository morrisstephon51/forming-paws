import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginForm from '@/app/(auth)/login/LoginForm'

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), signInWithPassword: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithPassword: mocks.signInWithPassword } }),
}))

function submitCredentials() {
  fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'member@example.test' } })
  fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'correct horse' } })
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
}

describe('LoginForm destination', () => {
  beforeEach(() => {
    mocks.push.mockReset()
    mocks.refresh.mockReset()
    mocks.signInWithPassword.mockReset().mockResolvedValue({ error: null })
  })

  it('returns the member to the page they were sent from', async () => {
    render(<LoginForm error={null} offerResend={false} next="/admin" />)
    submitCredentials()
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/admin'))
  })

  it('goes to the member home when there is no destination', async () => {
    render(<LoginForm error={null} offerResend={false} />)
    submitCredentials()
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/home'))
  })

  it('goes nowhere when the sign-in fails', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    render(<LoginForm error={null} offerResend={false} next="/admin" />)
    submitCredentials()
    expect(await screen.findByLabelText('Reset your password')).toBeInTheDocument()
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
