'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useOnboarding } from '@/contexts/onboarding-context'
import { useAuth } from '@/contexts/auth-context'

export function OnboardingTrigger() {
  const { user } = useAuth()
  const { hasCompletedOnboarding, isOnboardingActive, startOnboarding } = useOnboarding()
  const pathname = usePathname()

  useEffect(() => {
    // Only trigger on home page for logged in users who haven't completed onboarding
    if (
      user &&
      pathname === '/' &&
      !hasCompletedOnboarding &&
      !isOnboardingActive
    ) {
      // Small delay to let the page render first
      const timer = setTimeout(() => {
        startOnboarding()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [user, pathname, hasCompletedOnboarding, isOnboardingActive, startOnboarding])

  return null
}
