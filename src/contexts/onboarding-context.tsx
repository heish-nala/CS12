'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'konekt_onboarding_complete'
const STEP_KEY = 'konekt_onboarding_step'

export type OnboardingStep =
  | 'welcome'
  | 'sidebar'
  | 'create-client'
  | 'client-dashboard'
  | 'data-tables-tab'
  | 'add-table'
  | 'templates'
  | 'progress-tracker'
  | 'time-tracking'
  | 'complete'

export const ONBOARDING_STEPS: OnboardingStep[] = [
  'welcome',
  'sidebar',
  'create-client',
  'client-dashboard',
  'data-tables-tab',
  'add-table',
  'templates',
  'progress-tracker',
  'time-tracking',
  'complete'
]

interface OnboardingContextType {
  isOnboardingActive: boolean
  hasCompletedOnboarding: boolean
  currentStep: OnboardingStep
  currentStepIndex: number
  totalSteps: number
  startOnboarding: () => void
  stopOnboarding: () => void
  nextStep: () => void
  prevStep: () => void
  goToStep: (step: OnboardingStep) => void
  completeOnboarding: () => void
  resetOnboarding: () => void
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [isOnboardingActive, setIsOnboardingActive] = useState(false)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true) // Default true to prevent flash
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  // Load state from localStorage on mount
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY)
    const savedStep = localStorage.getItem(STEP_KEY)

    setHasCompletedOnboarding(completed === 'true')

    if (savedStep) {
      const stepIndex = ONBOARDING_STEPS.indexOf(savedStep as OnboardingStep)
      if (stepIndex !== -1) {
        setCurrentStepIndex(stepIndex)
      }
    }
  }, [])

  // Save step to localStorage when it changes
  useEffect(() => {
    if (isOnboardingActive) {
      localStorage.setItem(STEP_KEY, ONBOARDING_STEPS[currentStepIndex])
    }
  }, [currentStepIndex, isOnboardingActive])

  const startOnboarding = useCallback(() => {
    setCurrentStepIndex(0)
    setIsOnboardingActive(true)
    localStorage.removeItem(STORAGE_KEY)
    setHasCompletedOnboarding(false)
  }, [])

  const stopOnboarding = useCallback(() => {
    setIsOnboardingActive(false)
  }, [])

  const nextStep = useCallback(() => {
    setCurrentStepIndex((prev) => {
      const next = prev + 1
      if (next >= ONBOARDING_STEPS.length) {
        return prev
      }
      return next
    })
  }, [])

  const prevStep = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(0, prev - 1))
  }, [])

  const goToStep = useCallback((step: OnboardingStep) => {
    const index = ONBOARDING_STEPS.indexOf(step)
    if (index !== -1) {
      setCurrentStepIndex(index)
    }
  }, [])

  const completeOnboarding = useCallback(() => {
    setIsOnboardingActive(false)
    setHasCompletedOnboarding(true)
    localStorage.setItem(STORAGE_KEY, 'true')
    localStorage.removeItem(STEP_KEY)
  }, [])

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STEP_KEY)
    setHasCompletedOnboarding(false)
    setCurrentStepIndex(0)
    setIsOnboardingActive(true)
  }, [])

  const value: OnboardingContextType = {
    isOnboardingActive,
    hasCompletedOnboarding,
    currentStep: ONBOARDING_STEPS[currentStepIndex],
    currentStepIndex,
    totalSteps: ONBOARDING_STEPS.length,
    startOnboarding,
    stopOnboarding,
    nextStep,
    prevStep,
    goToStep,
    completeOnboarding,
    resetOnboarding,
  }

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider')
  }
  return context
}
