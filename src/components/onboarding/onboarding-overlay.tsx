'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { useOnboarding } from '@/contexts/onboarding-context'
import { getStepConfig } from './onboarding-steps'
import { OnboardingTooltip } from './onboarding-tooltip'
import confetti from 'canvas-confetti'

interface AnimatedRect {
  x: number
  y: number
  width: number
  height: number
}

export function OnboardingOverlay() {
  const pathname = usePathname()
  const { isOnboardingActive, currentStep, nextStep, markChecklistItem, completeOnboarding } = useOnboarding()
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [animatedRect, setAnimatedRect] = useState<AnimatedRect | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [mounted, setMounted] = useState(false)
  const hasTriggeredConfetti = useRef(false)
  const prevStepRef = useRef(currentStep)

  const config = getStepConfig(currentStep)
  const isCenteredStep = config.placement === 'center'

  // Trigger confetti on completion
  useEffect(() => {
    if (currentStep === 'complete' && !hasTriggeredConfetti.current) {
      hasTriggeredConfetti.current = true
      // Fire confetti from both sides
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
    }
  }, [currentStep])

  // Reset confetti trigger when onboarding restarts
  useEffect(() => {
    if (currentStep === 'welcome') {
      hasTriggeredConfetti.current = false
    }
  }, [currentStep])

  // Update target element position
  const updateTargetPosition = useCallback(() => {
    if (!config.target) {
      setTargetRect(null)
      return
    }

    const element = document.querySelector(`[data-onboarding="${config.target}"]`)
    if (element) {
      const rect = element.getBoundingClientRect()
      setTargetRect(rect)

      // Scroll element into view if needed (but not for sidebar)
      if (config.target !== 'sidebar') {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    } else {
      setTargetRect(null)
    }
  }, [config.target])

  // Handle mount
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  // Detect step changes and trigger transition
  useEffect(() => {
    if (prevStepRef.current !== currentStep) {
      setIsTransitioning(true)
      prevStepRef.current = currentStep
      // End transition after animation completes
      const timeout = setTimeout(() => {
        setIsTransitioning(false)
      }, 400)
      return () => clearTimeout(timeout)
    }
  }, [currentStep])

  // Update animated rect with smooth transition
  useEffect(() => {
    if (targetRect) {
      const padding = config.spotlightPadding || 8
      setAnimatedRect({
        x: targetRect.left - padding,
        y: targetRect.top - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
      })
    } else {
      setAnimatedRect(null)
    }
  }, [targetRect, config.spotlightPadding])

  // Update position when step changes or on resize
  useEffect(() => {
    if (!isOnboardingActive) return

    // Delay to let DOM update
    const timeout = setTimeout(updateTargetPosition, 100)

    const handleUpdate = () => {
      requestAnimationFrame(updateTargetPosition)
    }

    window.addEventListener('resize', handleUpdate)
    window.addEventListener('scroll', handleUpdate, true)

    // Also check periodically for dynamic elements
    const interval = setInterval(updateTargetPosition, 500)

    return () => {
      clearTimeout(timeout)
      window.removeEventListener('resize', handleUpdate)
      window.removeEventListener('scroll', handleUpdate, true)
      clearInterval(interval)
    }
  }, [isOnboardingActive, currentStep, updateTargetPosition])

  // Handle click triggers
  const clickHandledRef = useRef<string | null>(null)
  useEffect(() => {
    if (!isOnboardingActive || config.triggerType !== 'click' || !config.triggerTarget) return

    const handleClick = (e: MouseEvent) => {
      // Don't trigger if we already handled this step
      if (clickHandledRef.current === currentStep) return

      const target = e.target as HTMLElement
      const triggerElement = target.closest(`[data-onboarding="${config.triggerTarget}"]`)

      if (triggerElement) {
        clickHandledRef.current = currentStep
        // Mark checklist item if applicable
        if (config.checklistItem) {
          markChecklistItem(config.checklistItem as any)
        }
        // Delay to allow the action to complete
        setTimeout(() => {
          nextStep()
        }, 300)
      }
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [isOnboardingActive, config.triggerType, config.triggerTarget, config.checklistItem, nextStep, markChecklistItem, currentStep])

  // Handle navigation triggers
  const navigationHandledRef = useRef<string | null>(null)
  useEffect(() => {
    if (!isOnboardingActive || config.triggerType !== 'navigation' || !config.triggerPath) return

    // Don't trigger if we already handled this step
    if (navigationHandledRef.current === currentStep) return

    // Check if current path matches the trigger path
    if (pathname.startsWith(config.triggerPath)) {
      // Mark this step as handled to prevent duplicate triggers
      navigationHandledRef.current = currentStep

      // Mark checklist item if applicable
      if (config.checklistItem) {
        markChecklistItem(config.checklistItem as any)
      }

      // Wait for dialog to close and page to fully render
      const waitForPageReady = () => {
        // Check if any dialog is still open
        const dialogOpen = document.querySelector('[role="dialog"]')
        if (dialogOpen) {
          // Dialog still open, wait more
          setTimeout(waitForPageReady, 200)
          return
        }
        // Dialog closed, advance to next step
        nextStep()
      }

      // Initial delay to let navigation complete
      setTimeout(waitForPageReady, 800)
    }
  }, [isOnboardingActive, config.triggerType, config.triggerPath, config.checklistItem, pathname, nextStep, markChecklistItem, currentStep])

  // Handle element-visible triggers
  const elementVisibleHandledRef = useRef<string | null>(null)
  useEffect(() => {
    if (!isOnboardingActive || config.triggerType !== 'element-visible' || !config.triggerTarget) return

    // Don't trigger if we already handled this step
    if (elementVisibleHandledRef.current === currentStep) return

    let handled = false

    const checkElement = () => {
      if (handled) return true
      const element = document.querySelector(`[data-onboarding="${config.triggerTarget}"]`)
      if (element) {
        handled = true
        elementVisibleHandledRef.current = currentStep
        // Mark checklist item if applicable
        if (config.checklistItem) {
          markChecklistItem(config.checklistItem as any)
        }
        setTimeout(() => {
          nextStep()
        }, 500)
        return true
      }
      return false
    }

    // Delay before starting to check - give time for user to see the current step
    const startDelay = setTimeout(() => {
      // Check if element is visible
      if (checkElement()) return

      // Otherwise poll for the element
      const interval = setInterval(() => {
        if (checkElement()) {
          clearInterval(interval)
        }
      }, 500)

      // Cleanup interval on unmount
      return () => clearInterval(interval)
    }, 1000)

    return () => clearTimeout(startDelay)
  }, [isOnboardingActive, config.triggerType, config.triggerTarget, config.checklistItem, nextStep, markChecklistItem, currentStep])

  // Don't show on login page
  const isLoginPage = pathname === '/login'
  if (!mounted || !isOnboardingActive || isLoginPage) return null

  const borderRadius = 8

  // Create spotlight using box-shadow for smooth CSS transitions
  const renderSpotlight = () => {
    if (isCenteredStep || !animatedRect) {
      return (
        <div
          className="fixed inset-0 bg-black/50 z-[9999] transition-opacity duration-300"
        />
      )
    }

    return (
      <>
        {/* Spotlight cutout using box-shadow */}
        <div
          className="fixed z-[9999] pointer-events-none rounded-lg"
          style={{
            left: animatedRect.x,
            top: animatedRect.y,
            width: animatedRect.width,
            height: animatedRect.height,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
            transition: 'all 400ms cubic-bezier(0.4, 0, 0.2, 1)',
            borderRadius: borderRadius,
          }}
        />

        {/* Pulsing spotlight border */}
        {config.showPulse && (
          <div
            className="fixed z-[9999] pointer-events-none"
            style={{
              left: animatedRect.x,
              top: animatedRect.y,
              width: animatedRect.width,
              height: animatedRect.height,
              transition: 'all 400ms cubic-bezier(0.4, 0, 0.2, 1)',
              borderRadius: borderRadius,
            }}
          >
            {/* Inner border */}
            <div
              className="absolute inset-0 rounded-lg animate-pulse"
              style={{
                border: '3px solid rgba(59, 130, 246, 0.8)',
                borderRadius: borderRadius,
              }}
            />
            {/* Outer glow ring */}
            <div
              className="absolute rounded-lg"
              style={{
                top: -4,
                left: -4,
                right: -4,
                bottom: -4,
                border: '2px solid rgba(59, 130, 246, 0.3)',
                borderRadius: borderRadius + 4,
                animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }}
            />
          </div>
        )}
      </>
    )
  }

  // Click blocker that allows clicks on spotlight area
  const renderClickBlocker = () => {
    if (!animatedRect) {
      return (
        <div
          className="fixed inset-0 z-[10000]"
          onClick={(e) => e.stopPropagation()}
        />
      )
    }

    return (
      <>
        {/* Top blocker */}
        <div
          className="fixed left-0 right-0 top-0 z-[10000]"
          style={{
            height: Math.max(0, animatedRect.y),
            transition: 'all 400ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onClick={(e) => e.stopPropagation()}
        />
        {/* Bottom blocker */}
        <div
          className="fixed left-0 right-0 bottom-0 z-[10000]"
          style={{
            top: animatedRect.y + animatedRect.height,
            transition: 'all 400ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onClick={(e) => e.stopPropagation()}
        />
        {/* Left blocker */}
        <div
          className="fixed top-0 bottom-0 left-0 z-[10000]"
          style={{
            width: Math.max(0, animatedRect.x),
            top: animatedRect.y,
            height: animatedRect.height,
            transition: 'all 400ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onClick={(e) => e.stopPropagation()}
        />
        {/* Right blocker */}
        <div
          className="fixed top-0 bottom-0 right-0 z-[10000]"
          style={{
            left: animatedRect.x + animatedRect.width,
            top: animatedRect.y,
            height: animatedRect.height,
            transition: 'all 400ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </>
    )
  }

  return createPortal(
    <>
      {renderSpotlight()}
      {config.blockInteraction !== false && renderClickBlocker()}
      <OnboardingTooltip targetRect={targetRect} isTransitioning={isTransitioning} />
    </>,
    document.body
  )
}
