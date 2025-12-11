'use client'

import { useOnboarding } from '@/contexts/onboarding-context'
import { getStepConfig, StepConfig } from './onboarding-steps'
import { Button } from '@/components/ui/button'
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OnboardingTooltipProps {
  targetRect?: DOMRect | null
}

export function OnboardingTooltip({ targetRect }: OnboardingTooltipProps) {
  const {
    currentStep,
    currentStepIndex,
    totalSteps,
    nextStep,
    prevStep,
    completeOnboarding,
    stopOnboarding,
  } = useOnboarding()

  const config = getStepConfig(currentStep)
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === totalSteps - 1
  const isCenteredStep = config.placement === 'center'

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (isCenteredStep || !targetRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }
    }

    const padding = config.spotlightPadding || 8
    const tooltipGap = 16

    switch (config.placement) {
      case 'right':
        return {
          position: 'fixed',
          top: targetRect.top + targetRect.height / 2,
          left: targetRect.right + padding + tooltipGap,
          transform: 'translateY(-50%)',
        }
      case 'left':
        return {
          position: 'fixed',
          top: targetRect.top + targetRect.height / 2,
          right: window.innerWidth - targetRect.left + padding + tooltipGap,
          transform: 'translateY(-50%)',
        }
      case 'bottom':
        return {
          position: 'fixed',
          top: targetRect.bottom + padding + tooltipGap,
          left: targetRect.left + targetRect.width / 2,
          transform: 'translateX(-50%)',
        }
      case 'top':
        return {
          position: 'fixed',
          bottom: window.innerHeight - targetRect.top + padding + tooltipGap,
          left: targetRect.left + targetRect.width / 2,
          transform: 'translateX(-50%)',
        }
      default:
        return {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }
    }
  }

  // Get arrow styles based on placement
  const getArrowStyle = (): React.CSSProperties | null => {
    if (isCenteredStep || !targetRect) return null

    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      width: 0,
      height: 0,
    }

    switch (config.placement) {
      case 'right':
        return {
          ...baseStyle,
          left: -8,
          top: '50%',
          transform: 'translateY(-50%)',
          borderTop: '8px solid transparent',
          borderBottom: '8px solid transparent',
          borderRight: '8px solid white',
        }
      case 'left':
        return {
          ...baseStyle,
          right: -8,
          top: '50%',
          transform: 'translateY(-50%)',
          borderTop: '8px solid transparent',
          borderBottom: '8px solid transparent',
          borderLeft: '8px solid white',
        }
      case 'bottom':
        return {
          ...baseStyle,
          top: -8,
          left: '50%',
          transform: 'translateX(-50%)',
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderBottom: '8px solid white',
        }
      case 'top':
        return {
          ...baseStyle,
          bottom: -8,
          left: '50%',
          transform: 'translateX(-50%)',
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '8px solid white',
        }
      default:
        return null
    }
  }

  const handleNext = () => {
    if (isLastStep) {
      completeOnboarding()
    } else {
      nextStep()
    }
  }

  const handleSkip = () => {
    completeOnboarding()
  }

  const arrowStyle = getArrowStyle()

  return (
    <div
      style={getTooltipStyle()}
      className={cn(
        'z-[10001] bg-white rounded-xl shadow-2xl border border-gray-100',
        isCenteredStep ? 'w-[420px] p-8' : 'w-[340px] p-6'
      )}
    >
      {/* Arrow */}
      {arrowStyle && <div style={arrowStyle} />}

      {/* Close button */}
      <button
        onClick={handleSkip}
        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Content */}
      <div className="space-y-4">
        {/* Icon for centered modals */}
        {isCenteredStep && (
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        )}

        {/* Title */}
        <h3 className={cn(
          'font-semibold text-gray-900',
          isCenteredStep ? 'text-xl text-center' : 'text-lg'
        )}>
          {config.title}
        </h3>

        {/* Description */}
        <p className={cn(
          'text-gray-600 leading-relaxed',
          isCenteredStep ? 'text-center' : ''
        )}>
          {config.description}
        </p>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1.5 py-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === currentStepIndex
                  ? 'w-6 bg-blue-600'
                  : i < currentStepIndex
                  ? 'w-1.5 bg-blue-300'
                  : 'w-1.5 bg-gray-200'
              )}
            />
          ))}
        </div>

        {/* Actions */}
        <div className={cn(
          'flex items-center gap-3 pt-2',
          isCenteredStep ? 'justify-center' : 'justify-between'
        )}>
          {isFirstStep ? (
            <>
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="text-gray-500"
              >
                Skip tour
              </Button>
              <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
                Start Tour
              </Button>
            </>
          ) : isLastStep ? (
            <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700 w-full">
              Get Started
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={prevStep}
                className="text-gray-500"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">
                  {currentStepIndex + 1} / {totalSteps}
                </span>
                <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
