'use client'

import { useState, useEffect, useCallback } from 'react'
import Joyride, { CallBackProps, STATUS, EVENTS, ACTIONS, Step } from 'react-joyride'
import { usePathname } from 'next/navigation'
import { useOnboarding } from '@/contexts/onboarding-context'
import confetti from 'canvas-confetti'

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
    data: {
      checklistItem: 'create-client',
      waitForClick: true,
    },
  },
  {
    target: '[data-onboarding="create-client-dialog"]',
    content: 'Enter a name for your client (e.g., "Acme Dental" or "Test Client") and click Create.',
    title: 'Name Your Client',
    placement: 'right',
    disableBeacon: true,
    spotlightClicks: true,
    data: {
      waitForNavigation: '/clients/',
    },
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
    data: {
      checklistItem: 'add-table',
      waitForClick: true,
    },
  },
  {
    target: '[data-onboarding="template-grid"]',
    content: 'Templates give you a head start! Try the "Attendee Tracker" - it includes progress tracking built-in. Click any template to create it.',
    title: 'Choose a Template',
    placement: 'top',
    disableBeacon: true,
    spotlightClicks: true,
    data: {
      checklistItem: 'use-template',
      waitForElement: '[data-onboarding="data-grid"]',
    },
  },
  {
    target: '[data-onboarding="period-tracker"]',
    content: "Tables with time tracking show a Progress column. Click on any row's progress cell to view and edit metrics over time.",
    title: 'Progress Tracking',
    placement: 'left',
    disableBeacon: true,
    data: {
      checklistItem: 'progress-tracker',
    },
  },
  {
    target: 'body',
    content: "You've learned the basics! Explore more features like activity logging, CSV imports, and dashboard customization. Need help? Check Settings anytime.",
    title: "You're Ready to Go!",
    placement: 'center',
    disableBeacon: true,
    data: {
      isComplete: true,
    },
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

  // Sync with context
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

  // Handle Joyride callback
  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { action, index, status, type, step } = data
      const stepData = step?.data as {
        checklistItem?: string
        waitForClick?: boolean
        waitForNavigation?: string
        waitForElement?: string
        isComplete?: boolean
      } | undefined

      // Handle step completion
      if (type === EVENTS.STEP_AFTER) {
        // Mark checklist item if applicable
        if (stepData?.checklistItem) {
          markChecklistItem(stepData.checklistItem as any)
        }

        // Move to next step
        if (action === ACTIONS.NEXT) {
          const nextIndex = index + 1
          setLocalStepIndex(nextIndex)
          setStepIndex(nextIndex)
        }
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

      // Handle spotlight clicks for interactive steps
      if (type === EVENTS.TARGET_NOT_FOUND) {
        // Element not found, wait and retry
        console.log('Waiting for element:', step?.target)
      }
    },
    [markChecklistItem, setStepIndex, completeOnboarding, stopOnboarding, fireConfetti]
  )

  // Watch for navigation changes to auto-advance certain steps
  useEffect(() => {
    if (!run) return

    const currentStep = steps[stepIndex]
    const stepData = currentStep?.data as { waitForNavigation?: string } | undefined

    if (stepData?.waitForNavigation && pathname.startsWith(stepData.waitForNavigation)) {
      // Wait for dialog to close
      const checkDialogClosed = () => {
        const dialogOpen = document.querySelector('[role="dialog"]')
        if (!dialogOpen) {
          const nextIndex = stepIndex + 1
          setLocalStepIndex(nextIndex)
          setStepIndex(nextIndex)
        } else {
          setTimeout(checkDialogClosed, 200)
        }
      }
      setTimeout(checkDialogClosed, 500)
    }
  }, [pathname, stepIndex, run, setStepIndex])

  // Watch for elements becoming visible to auto-advance
  useEffect(() => {
    if (!run) return

    const currentStep = steps[stepIndex]
    const stepData = currentStep?.data as { waitForElement?: string } | undefined

    if (stepData?.waitForElement) {
      const checkElement = () => {
        const element = document.querySelector(stepData.waitForElement!)
        if (element) {
          const nextIndex = stepIndex + 1
          setLocalStepIndex(nextIndex)
          setStepIndex(nextIndex)
          return true
        }
        return false
      }

      if (!checkElement()) {
        const interval = setInterval(() => {
          if (checkElement()) {
            clearInterval(interval)
          }
        }, 500)

        return () => clearInterval(interval)
      }
    }
  }, [stepIndex, run, setStepIndex])

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
        disableAnimation: false,
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
