'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { useOnboarding } from '@/contexts/onboarding-context'
import { getStepConfig } from './onboarding-steps'
import { OnboardingTooltip } from './onboarding-tooltip'
import confetti from 'canvas-confetti'

export function OnboardingOverlay() {
  const pathname = usePathname()
  const { isOnboardingActive, currentStep, nextStep, markChecklistItem, completeOnboarding } = useOnboarding()
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [mounted, setMounted] = useState(false)
  const hasTriggeredConfetti = useRef(false)

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
  useEffect(() => {
    if (!isOnboardingActive || config.triggerType !== 'click' || !config.triggerTarget) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const triggerElement = target.closest(`[data-onboarding="${config.triggerTarget}"]`)

      if (triggerElement) {
        // Mark checklist item if applicable
        if (config.checklistItem) {
          markChecklistItem(config.checklistItem as any)
        }
        // Delay to allow the action to complete
        setTimeout(() => {
          nextStep()
        }, 100)
      }
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [isOnboardingActive, config.triggerType, config.triggerTarget, config.checklistItem, nextStep, markChecklistItem])

  // Handle navigation triggers
  useEffect(() => {
    if (!isOnboardingActive || config.triggerType !== 'navigation' || !config.triggerPath) return

    // Check if current path matches the trigger path
    if (pathname.startsWith(config.triggerPath)) {
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
  }, [isOnboardingActive, config.triggerType, config.triggerPath, config.checklistItem, pathname, nextStep, markChecklistItem])

  // Handle element-visible triggers
  useEffect(() => {
    if (!isOnboardingActive || config.triggerType !== 'element-visible' || !config.triggerTarget) return

    const checkElement = () => {
      const element = document.querySelector(`[data-onboarding="${config.triggerTarget}"]`)
      if (element) {
        // Mark checklist item if applicable
        if (config.checklistItem) {
          markChecklistItem(config.checklistItem as any)
        }
        setTimeout(() => {
          nextStep()
        }, 300)
        return true
      }
      return false
    }

    // Check immediately
    if (checkElement()) return

    // Otherwise poll for the element
    const interval = setInterval(() => {
      if (checkElement()) {
        clearInterval(interval)
      }
    }, 300)

    return () => clearInterval(interval)
  }, [isOnboardingActive, config.triggerType, config.triggerTarget, config.checklistItem, nextStep, markChecklistItem])

  if (!mounted || !isOnboardingActive) return null

  const padding = config.spotlightPadding || 8

  // Create spotlight mask using SVG
  const renderSpotlight = () => {
    if (isCenteredStep || !targetRect) {
      return (
        <div
          className="fixed inset-0 bg-black/50 z-[9999] transition-opacity duration-300"
        />
      )
    }

    const spotlightX = targetRect.left - padding
    const spotlightY = targetRect.top - padding
    const spotlightWidth = targetRect.width + padding * 2
    const spotlightHeight = targetRect.height + padding * 2
    const borderRadius = 8

    return (
      <svg
        className="fixed inset-0 w-full h-full z-[9999] transition-all duration-300 pointer-events-none"
      >
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={spotlightX}
              y={spotlightY}
              width={spotlightWidth}
              height={spotlightHeight}
              rx={borderRadius}
              ry={borderRadius}
              fill="black"
            />
          </mask>
        </defs>

        {/* Semi-transparent overlay with spotlight cutout */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.5)"
          mask="url(#spotlight-mask)"
        />

        {/* Pulsing spotlight border */}
        {config.showPulse && (
          <>
            <rect
              x={spotlightX}
              y={spotlightY}
              width={spotlightWidth}
              height={spotlightHeight}
              rx={borderRadius}
              ry={borderRadius}
              fill="none"
              stroke="rgba(59, 130, 246, 0.8)"
              strokeWidth="3"
              className="animate-pulse"
            />
            {/* Outer glow ring */}
            <rect
              x={spotlightX - 4}
              y={spotlightY - 4}
              width={spotlightWidth + 8}
              height={spotlightHeight + 8}
              rx={borderRadius + 4}
              ry={borderRadius + 4}
              fill="none"
              stroke="rgba(59, 130, 246, 0.3)"
              strokeWidth="2"
              className="animate-ping"
              style={{ animationDuration: '1.5s' }}
            />
          </>
        )}
      </svg>
    )
  }

  // Click blocker that allows clicks on spotlight area
  const renderClickBlocker = () => {
    if (!targetRect) {
      return (
        <div
          className="fixed inset-0 z-[10000]"
          onClick={(e) => e.stopPropagation()}
        />
      )
    }

    const p = padding
    return (
      <>
        {/* Top blocker */}
        <div
          className="fixed left-0 right-0 top-0 z-[10000]"
          style={{ height: Math.max(0, targetRect.top - p) }}
          onClick={(e) => e.stopPropagation()}
        />
        {/* Bottom blocker */}
        <div
          className="fixed left-0 right-0 bottom-0 z-[10000]"
          style={{ top: targetRect.bottom + p }}
          onClick={(e) => e.stopPropagation()}
        />
        {/* Left blocker */}
        <div
          className="fixed top-0 bottom-0 left-0 z-[10000]"
          style={{
            width: Math.max(0, targetRect.left - p),
            top: targetRect.top - p,
            height: targetRect.height + p * 2,
          }}
          onClick={(e) => e.stopPropagation()}
        />
        {/* Right blocker */}
        <div
          className="fixed top-0 bottom-0 right-0 z-[10000]"
          style={{
            left: targetRect.right + p,
            top: targetRect.top - p,
            height: targetRect.height + p * 2,
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
      <OnboardingTooltip targetRect={targetRect} />
    </>,
    document.body
  )
}
