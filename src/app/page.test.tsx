import { expect, test, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Page from './page'

// Mock next/navigation
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
    }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
}))

// Mock the auth context
vi.mock('@/contexts/auth-context', () => ({
    useAuth: () => ({
        user: { id: 'test-user-id', email: 'test@example.com' },
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        signInWithGoogle: vi.fn(),
    }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock the clients context
vi.mock('@/contexts/clients-context', () => ({
    useClients: () => ({
        clients: [],
        loading: false,
        error: null,
        refreshClients: vi.fn(),
    }),
    ClientsProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock fetch for API calls
beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ clients: [] }),
    })
})

test('Page renders homepage with correct heading', () => {
    render(<Page />)
    expect(screen.getByText('Dashboard')).toBeDefined()
    expect(screen.getByText('Customer Success')).toBeDefined()
})
