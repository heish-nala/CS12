'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Joyride, { CallBackProps, STATUS, EVENTS, ACTIONS, Step } from 'react-joyride'
import { usePathname } from 'next/navigation'
import { useOnboarding } from '@/contexts/onboarding-context'
import confetti from 'canvas-confetti'

// Step data type for custom behavior
interface StepData {
  checklistItem?: string
  waitForClick?: string // Selector to watch for clicks
  waitForNavigation?: string // Path prefix to watch for
  waitForElement?: string // Selector to wait for visibility
  isComplete?: boolean
}

// Convert your existing steps to Joyride format
const steps: Step[] = [
  {
    target: 'body',
    content: "Let's get you set up with a quick hands-on tutorial. You'll create your first client and learn the key features.",
    title: 'Welcome to CS12!',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-onboarding="sidebar"]',
    content: "Your navigation sidebar shows all your clients and settings. Let's create your first client now!",
    title: 'This is Your Workspace',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '[data-onboarding="add-client-btn"]',
    content: "Click the + button to create your first client. Clients are the organizations you'll be tracking.",
    title: 'Create Your First Client',
    placement: 'right',
    disableBeacon: true,
    spotlightClicks: true,
    hideFooter: true, // Hide Next button - user must click target
    data: {
      checklistItem: 'create-client',
      waitForClick: '[data-onboarding="add-client-btn"]',
    } as StepData,
  },
  {
    target: '[data-onboarding="create-client-dialog"]',
    content: 'Enter a name for your client (e.g., "Acme Dental" or "Test Client") and click Create.',
    title: 'Name Your Client',
    placement: 'right',
    disableBeacon: true,
    spotlightClicks: true,
    hideFooter: true, // Hide Next button - user must complete action
    data: {
      waitForNavigation: '/clients/',
    } as StepData,
  },
  {
    target: '[data-onboarding="client-dashboard"]',
    content: "Great job! This is your client's home base. You can see metrics, manage data, and track activity here.",
    title: 'Your Client Dashboard',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-onboarding="data-tables-tab"]',
    content: "The Data tab is where you'll track all your information. Let's add your first table!",
    title: 'Data Tables',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-onboarding="add-table-btn"]',
    content: 'Click here to add your first data table. You can choose from templates or create a blank table.',
    title: 'Add a Data Table',
    placement: 'bottom',
    disableBeacon: true,
    spotlightClicks: true,
    hideFooter: true,
    data: {
      checklistItem: 'add-table',
      waitForClick: '[data-onboarding="add-table-btn"]',
    } as StepData,
  },
  {
    target: '[data-onboarding="template-grid"]',
    content: 'Templates give you a head start! Try the "Attendee Tracker" - it includes progress tracking built-in. Click any template to create it.',
    title: 'Choose a Template',
    placement: 'top',
    disableBeacon: true,
    spotlightClicks: true,
    hideFooter: true,
    data: {
      checklistItem: 'use-template',
      waitForElement: '[data-onboarding="data-grid"]',
    } as StepData,
  },
  {
    target: '[data-onboarding="period-tracker"]',
    content: "Tables with time tracking show a Progress column. Click on any row's progress cell to view and edit metrics over time.",
    title: 'Progress Tracking',
    placement: 'left',
    disableBeacon: true,
    data: {
      checklistItem: 'progress-tracker',
    } as StepData,
  },
  {
    target: 'body',
    content: "You've learned the basics! Explore more features like activity logging, CSV imports, and dashboard customization. Need help? Check Settings anytime.",
    title: "You're Ready to Go!",
    placement: 'center',
    disableBeacon: true,
    data: {
      isComplete: true,
    } as StepData,
  },
]

// Custom styles to match your existing design
const joyrideStyles = {
  options: {
    arrowColor: '#fff',
    backgroundColor: '#fff',
    overlayColor: 'rgba(0, 0, 0, 0.5)',
    primaryColor: '#3b82f6',
    textColor: '#1f2937',
    zIndex: 10000,
  },
  spotlight: {
    borderRadius: 8,
  },
  tooltip: {
    borderRadius: 12,
    padding: 20,
  },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 8,
  },
  tooltipContent: {
    fontSize: 14,
    lineHeight: 1.5,
  },
  buttonNext: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    fontSize: 14,
    padding: '10px 20px',
  },
  buttonBack: {
    color: '#6b7280',
    fontSize: 14,
  },
  buttonSkip: {
    color: '#9ca3af',
    fontSize: 14,
  },
  buttonClose: {
    color: '#9ca3af',
  },
}

export function OnboardingTour() {
  const pathname = usePathname()
  const {
    isOnboardingActive,
    currentStepIndex,
    setStepIndex,
    completeOnboarding,
    stopOnboarding,
    markChecklistItem,
  } = useOnboarding()

  const [run, setRun] = useState(false)
  const [stepIndex, setLocalStepIndex] = useState(0)
  const [mounted, setMounted] = useState(false)
  const clickHandledRef = useRef<number | null>(null)
  const navigationHandledRef = useRef<number | null>(null)

  // Sync with context on mount
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOnboardingActive && mounted) {
      setRun(true)
      setLocalStepIndex(currentStepIndex)
    } else {
      setRun(false)
    }
  }, [isOnboardingActive, currentStepIndex, mounted])

  // Fire confetti on complete step
  const fireConfetti = useCallback(() => {
    const duration = 2000
    const end = Date.now() + duration

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'],
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'],
      })

      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }
    frame()
  }, [])

  // Advance to next step helper
  const advanceStep = useCallback(() => {
    const currentStep = steps[stepIndex]
    const stepData = currentStep?.data as StepData | undefined

    // Mark checklist item if applicable
    if (stepData?.checklistItem) {
      markChecklistItem(stepData.checklistItem as any)
    }

    const nextIndex = stepIndex + 1
    if (nextIndex < steps.length) {
      setLocalStepIndex(nextIndex)
      setStepIndex(nextIndex)
    }
  }, [stepIndex, markChecklistItem, setStepIndex])

  // Handle Joyride callback
  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { action, index, status, type, step } = data
      const stepData = step?.data as StepData | undefined

      // Handle step completion via Next button
      if (type === EVENTS.STEP_AFTER && action === ACTIONS.NEXT) {
        // Mark checklist item if applicable
        if (stepData?.checklistItem) {
          markChecklistItem(stepData.checklistItem as any)
        }

        const nextIndex = index + 1
        setLocalStepIndex(nextIndex)
        setStepIndex(nextIndex)
      }

      // Handle going back
      if (type === EVENTS.STEP_AFTER && action === ACTIONS.PREV) {
        const prevIndex = index - 1
        setLocalStepIndex(prevIndex)
        setStepIndex(prevIndex)
      }

      // Handle tour completion
      if (status === STATUS.FINISHED) {
        fireConfetti()
        completeOnboarding()
      }

      // Handle tour skip
      if (status === STATUS.SKIPPED || action === ACTIONS.CLOSE) {
        stopOnboarding()
      }
    },
    [markChecklistItem, setStepIndex, completeOnboarding, stopOnboarding, fireConfetti]
  )

  // Watch for clicks on target elements (for steps with waitForClick)
  useEffect(() => {
    if (!run) return

    const currentStep = steps[stepIndex]
    const stepData = currentStep?.data as StepData | undefined

    if (!stepData?.waitForClick) return
    if (clickHandledRef.current === stepIndex) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const clickTarget = target.closest(stepData.waitForClick!)

      if (clickTarget) {
        clickHandledRef.current = stepIndex
        // Delay to allow the click action to complete (e.g., dialog opening)
        setTimeout(() => {
          advanceStep()
        }, 300)
      }
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [run, stepIndex, advanceStep])

  // Watch for navigation changes (for steps with waitForNavigation)
  useEffect(() => {
    if (!run) return

    const currentStep = steps[stepIndex]
    const stepData = currentStep?.data as StepData | undefined

    if (!stepData?.waitForNavigation) return
    if (navigationHandledRef.current === stepIndex) return

    if (pathname.startsWith(stepData.waitForNavigation)) {
      navigationHandledRef.current = stepIndex

      // Wait for dialog to close before advancing
      const checkDialogClosed = () => {
        const dialogOpen = document.querySelector('[role="dialog"]')
        if (!dialogOpen) {
          advanceStep()
        } else {
          setTimeout(checkDialogClosed, 200)
        }
      }
      setTimeout(checkDialogClosed, 500)
    }
  }, [pathname, stepIndex, run, advanceStep])

  // Watch for elements becoming visible (for steps with waitForElement)
  useEffect(() => {
    if (!run) return

    const currentStep = steps[stepIndex]
    const stepData = currentStep?.data as StepData | undefined

    if (!stepData?.waitForElement) return

    const checkElement = () => {
      const element = document.querySelector(stepData.waitForElement!)
      if (element) {
        advanceStep()
        return true
      }
      return false
    }

    // Initial delay before checking
    const startTimeout = setTimeout(() => {
      if (!checkElement()) {
        const interval = setInterval(() => {
          if (checkElement()) {
            clearInterval(interval)
          }
        }, 500)

        // Cleanup interval after 30 seconds max
        setTimeout(() => clearInterval(interval), 30000)
      }
    }, 1000)

    return () => clearTimeout(startTimeout)
  }, [stepIndex, run, advanceStep])

  // Reset handled refs when step changes
  useEffect(() => {
    if (stepIndex === 0) {
      clickHandledRef.current = null
      navigationHandledRef.current = null
    }
  }, [stepIndex])

  // Don't render on login page or before mount
  if (!mounted || pathname === '/login') return null

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={joyrideStyles}
      floaterProps={{
        styles: {
          floater: {
            transition: 'opacity 0.3s ease-in-out',
          },
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip Tour',
      }}
      scrollToFirstStep
      spotlightPadding={12}
      disableOverlayClose
    />
  )
}
