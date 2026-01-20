'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'cs12_onboarding_complete'
const STEP_KEY = 'cs12_onboarding_step'
const CHECKLIST_KEY = 'cs12_onboarding_checklist'

// Step IDs for mapping index to step name
export const ONBOARDING_STEP_IDS = [
  'welcome',
  'sidebar',
  'create-client',
  'client-dialog',
  'client-dashboard',
  'data-tables-tab',
  'add-table',
  'templates',
  'progress-tracker',
  'complete',
] as const

export type OnboardingStep = (typeof ONBOARDING_STEP_IDS)[number]

const TOTAL_STEPS = ONBOARDING_STEP_IDS.length

interface ChecklistState {
  'create-client': boolean
  'add-table': boolean
  'use-template': boolean
  'progress-tracker': boolean
}

const defaultChecklistState: ChecklistState = {
  'create-client': false,
  'add-table': false,
  'use-template': false,
  'progress-tracker': false,
}

interface OnboardingContextType {
  // Tour state
  isOnboardingActive: boolean
  hasCompletedOnboarding: boolean
  currentStep: OnboardingStep
  currentStepIndex: number
  totalSteps: number

  // Checklist state
  checklistItems: ChecklistState
  checklistProgress: number
  isChecklistVisible: boolean

  // Tour controls
  startOnboarding: () => void
  stopOnboarding: () => void
  setStepIndex: (index: number) => void
  completeOnboarding: () => void
  resetOnboarding: () => void

  // Checklist controls
  markChecklistItem: (itemId: keyof ChecklistState) => void
  toggleChecklist: () => void
  hideChecklist: () => void
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [isOnboardingActive, setIsOnboardingActive] = useState(false)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true) // Default true to prevent flash
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [checklistItems, setChecklistItems] = useState<ChecklistState>(defaultChecklistState)
  const [isChecklistVisible, setIsChecklistVisible] = useState(false)

  // Calculate checklist progress
  const checklistProgress = Object.values(checklistItems).filter(Boolean).length / Object.keys(checklistItems).length * 100

  // Load state from localStorage on mount
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY)
    const savedStep = localStorage.getItem(STEP_KEY)
    const savedChecklist = localStorage.getItem(CHECKLIST_KEY)

    setHasCompletedOnboarding(completed === 'true')

    if (savedStep) {
      const stepIndex = parseInt(savedStep, 10)
      if (!isNaN(stepIndex) && stepIndex >= 0 && stepIndex < TOTAL_STEPS) {
        setCurrentStepIndex(stepIndex)
      }
    }

    if (savedChecklist) {
      try {
        const parsed = JSON.parse(savedChecklist)
        setChecklistItems({ ...defaultChecklistState, ...parsed })
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Show checklist if onboarding is complete but not all items are done
    if (completed === 'true' && savedChecklist) {
      try {
        const parsed = JSON.parse(savedChecklist)
        const allDone = Object.values(parsed).every(Boolean)
        if (!allDone) {
          setIsChecklistVisible(true)
        }
      } catch (e) {
        // Ignore
      }
    }
  }, [])

  // Save step to localStorage when it changes
  useEffect(() => {
    if (isOnboardingActive) {
      localStorage.setItem(STEP_KEY, currentStepIndex.toString())
    }
  }, [currentStepIndex, isOnboardingActive])

  // Save checklist to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(checklistItems))
  }, [checklistItems])

  const startOnboarding = useCallback(() => {
    setCurrentStepIndex(0)
    setIsOnboardingActive(true)
    setIsChecklistVisible(false)
    localStorage.removeItem(STORAGE_KEY)
    setHasCompletedOnboarding(false)
  }, [])

  const stopOnboarding = useCallback(() => {
    setIsOnboardingActive(false)
    // Mark as completed so it doesn't restart
    setHasCompletedOnboarding(true)
    localStorage.setItem(STORAGE_KEY, 'true')
  }, [])

  const setStepIndex = useCallback((index: number) => {
    if (index >= 0 && index < TOTAL_STEPS) {
      setCurrentStepIndex(index)
    }
  }, [])

  const completeOnboarding = useCallback(() => {
    setIsOnboardingActive(false)
    setHasCompletedOnboarding(true)
    localStorage.setItem(STORAGE_KEY, 'true')
    localStorage.removeItem(STEP_KEY)

    // Mark all checklist items as complete when tour finishes
    const allComplete: ChecklistState = {
      'create-client': true,
      'add-table': true,
      'use-template': true,
      'progress-tracker': true,
    }
    setChecklistItems(allComplete)
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(allComplete))

    // Hide checklist since tour is complete
    setIsChecklistVisible(false)
  }, [])

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STEP_KEY)
    localStorage.removeItem(CHECKLIST_KEY)
    setHasCompletedOnboarding(false)
    setCurrentStepIndex(0)
    setChecklistItems(defaultChecklistState)
    setIsOnboardingActive(true)
    setIsChecklistVisible(false)
  }, [])

  const markChecklistItem = useCallback((itemId: keyof ChecklistState) => {
    setChecklistItems((prev) => ({
      ...prev,
      [itemId]: true,
    }))
  }, [])

  const toggleChecklist = useCallback(() => {
    setIsChecklistVisible((prev) => !prev)
  }, [])

  const hideChecklist = useCallback(() => {
    setIsChecklistVisible(false)
  }, [])

  const value: OnboardingContextType = {
    isOnboardingActive,
    hasCompletedOnboarding,
    currentStep: ONBOARDING_STEP_IDS[currentStepIndex],
    currentStepIndex,
    totalSteps: TOTAL_STEPS,
    checklistItems,
    checklistProgress,
    isChecklistVisible,
    startOnboarding,
    stopOnboarding,
    setStepIndex,
    completeOnboarding,
    resetOnboarding,
    markChecklistItem,
    toggleChecklist,
    hideChecklist,
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
