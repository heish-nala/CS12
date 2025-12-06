import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import Page from './page'

test('Page', () => {
    render(<Page />)
    expect(screen.getByText('Konekt Agent')).toBeDefined()
    expect(screen.getByText('How can I help you today?')).toBeDefined()
})
