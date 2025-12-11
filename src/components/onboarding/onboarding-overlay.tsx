'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useOnboarding } from '@/contexts/onboarding-context'
import { getStepConfig } from './onboarding-steps'
import { OnboardingTooltip } from './onboarding-tooltip'

export function OnboardingOverlay() {
  const { isOnboardingActive, currentStep, nextStep } = useOnboarding()
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [mounted, setMounted] = useState(false)

  const config = getStepConfig(currentStep)
  const isCenteredStep = config.placement === 'center'

  // Update target element position
  const updateTargetPosition = useCallback(() => {
    if (!config.target) {
      setTargetRect(null)
      return
    }

    const element = document.querySelector(`[data-onboarding="${config.target}"]`)
    if (element) {
      setTargetRect(element.getBoundingClientRect())

      // Scroll element into view if needed
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
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

    updateTargetPosition()

    // Update on resize and scroll
    const handleUpdate = () => {
      requestAnimationFrame(updateTargetPosition)
    }

    window.addEventListener('resize', handleUpdate)
    window.addEventListener('scroll', handleUpdate, true)

    // Also check periodically for dynamic elements
    const interval = setInterval(updateTargetPosition, 500)

    return () => {
      window.removeEventListener('resize', handleUpdate)
      window.removeEventListener('scroll', handleUpdate, true)
      clearInterval(interval)
    }
  }, [isOnboardingActive, currentStep, updateTargetPosition])

  // Handle clicks on target elements that should trigger next step
  useEffect(() => {
    if (!isOnboardingActive || !config.nextTrigger) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const triggerElement = target.closest(`[data-onboarding="${config.nextTrigger}"]`)

      if (triggerElement) {
        // Delay to allow the action to complete
        setTimeout(() => {
          nextStep()
        }, 300)
      }
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [isOnboardingActive, config.nextTrigger, nextStep])

  if (!mounted || !isOnboardingActive) return null

  const padding = config.spotlightPadding || 8

  // Create spotlight mask using SVG
  const renderSpotlight = () => {
    if (isCenteredStep || !targetRect) {
      return (
        <div
          className="fixed inset-0 bg-black/50 z-[9999] transition-opacity duration-300"
          style={{ pointerEvents: config.allowInteraction ? 'none' : 'auto' }}
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
        className="fixed inset-0 w-full h-full z-[9999] transition-all duration-300"
        style={{ pointerEvents: config.allowInteraction ? 'none' : 'auto' }}
      >
        <defs>
          <mask id="spotlight-mask">
            {/* White = visible, Black = hidden */}
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

        {/* Spotlight border/glow effect */}
        <rect
          x={spotlightX}
          y={spotlightY}
          width={spotlightWidth}
          height={spotlightHeight}
          rx={borderRadius}
          ry={borderRadius}
          fill="none"
          stroke="rgba(59, 130, 246, 0.5)"
          strokeWidth="2"
          className="animate-pulse"
        />
      </svg>
    )
  }

  // Click blocker for non-interactive areas (but allow clicking on spotlight target)
  const renderClickBlocker = () => {
    if (config.allowInteraction && targetRect) {
      const padding = config.spotlightPadding || 8
      return (
        <>
          {/* Top blocker */}
          <div
            className="fixed left-0 right-0 top-0 z-[10000]"
            style={{ height: targetRect.top - padding }}
            onClick={(e) => e.stopPropagation()}
          />
          {/* Bottom blocker */}
          <div
            className="fixed left-0 right-0 bottom-0 z-[10000]"
            style={{ top: targetRect.bottom + padding }}
            onClick={(e) => e.stopPropagation()}
          />
          {/* Left blocker */}
          <div
            className="fixed top-0 bottom-0 left-0 z-[10000]"
            style={{ width: targetRect.left - padding }}
            onClick={(e) => e.stopPropagation()}
          />
          {/* Right blocker */}
          <div
            className="fixed top-0 bottom-0 right-0 z-[10000]"
            style={{ left: targetRect.right + padding }}
            onClick={(e) => e.stopPropagation()}
          />
        </>
      )
    }
    return null
  }

  return createPortal(
    <>
      {renderSpotlight()}
      {renderClickBlocker()}
      <OnboardingTooltip targetRect={targetRect} />
    </>,
    document.body
  )
}
