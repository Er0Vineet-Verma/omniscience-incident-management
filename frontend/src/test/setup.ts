// Vitest setup: registers the jest-dom matchers (toBeInTheDocument, …) and
// their type augmentation for every test file, and isolates browser storage
// between tests.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  localStorage.clear()
})
