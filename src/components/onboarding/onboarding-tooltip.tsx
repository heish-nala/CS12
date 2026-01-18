'use client'

import { useOnboarding } from '@/contexts/onboarding-context'
import { getStepConfig } from './onboarding-steps'
import { Button } from '@/components/ui/button'
import { X, ChevronLeft, ChevronRight, Sparkles, MousePointerClick, PartyPopper } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OnboardingTooltipProps {
  targetRect?: DOMRect | null
  isTransitioning?: boolean
}

export function OnboardingTooltip({ targetRect, isTransitioning }: OnboardingTooltipProps) {
  const {
    currentStep,
    currentStepIndex,
    totalSteps,
    nextStep,
    prevStep,
    completeOnboarding,
  } = useOnboarding()

  const config = getStepConfig(currentStep)
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === totalSteps - 1
  const isCenteredStep = config.placement === 'center'

  // Determine what action text to show
  const getActionHint = () => {
    switch (config.triggerType) {
      case 'click':
        return 'Click the highlighted area to continue'
      case 'navigation':
        return 'Complete the action to continue'
      case 'element-visible':
        return 'Select an option to continue'
      default:
        return null
    }
  }

  const actionHint = getActionHint()

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    const transitionStyle = 'all 400ms cubic-bezier(0.4, 0, 0.2, 1)'

    if (isCenteredStep || !targetRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        transition: transitionStyle,
      }
    }

    const padding = config.spotlightPadding || 8
    const tooltipGap = 16

    switch (config.placement) {
      case 'right':
        return {
          position: 'fixed',
          top: Math.min(targetRect.top + targetRect.height / 2, window.innerHeight - 200),
          left: Math.min(targetRect.right + padding + tooltipGap, window.innerWidth - 360),
          transform: 'translateY(-50%)',
          transition: transitionStyle,
        }
      case 'left':
        return {
          position: 'fixed',
          top: Math.min(targetRect.top + targetRect.height / 2, window.innerHeight - 200),
          right: Math.min(window.innerWidth - targetRect.left + padding + tooltipGap, window.innerWidth - 20),
          transform: 'translateY(-50%)',
          transition: transitionStyle,
        }
      case 'bottom':
        // Ensure tooltip doesn't go below viewport - leave room for full tooltip height (~350px)
        const bottomTop = targetRect.bottom + padding + tooltipGap
        const maxTop = window.innerHeight - 380
        return {
          position: 'fixed',
          top: Math.min(bottomTop, maxTop),
          left: Math.max(20, Math.min(targetRect.left + targetRect.width / 2 - 170, window.innerWidth - 360)),
          transition: transitionStyle,
        }
      case 'top':
        return {
          position: 'fixed',
          bottom: Math.min(window.innerHeight - targetRect.top + padding + tooltipGap, window.innerHeight - 20),
          left: Math.max(20, Math.min(targetRect.left + targetRect.width / 2 - 170, window.innerWidth - 360)),
          transition: transitionStyle,
        }
      default:
        return {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          transition: transitionStyle,
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
      style={{
        ...getTooltipStyle(),
        opacity: isTransitioning ? 0.7 : 1,
      }}
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
        title="Skip tour"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Content */}
      <div className="space-y-4">
        {/* Icon for centered modals */}
        {isCenteredStep && (
          <div className="flex justify-center mb-2">
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center',
              isLastStep ? 'bg-green-50' : 'bg-blue-50'
            )}>
              {isLastStep ? (
                <PartyPopper className="h-6 w-6 text-green-600" />
              ) : (
                <Sparkles className="h-6 w-6 text-blue-600" />
              )}
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

        {/* Action hint for interactive steps */}
        {actionHint && (
          <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
            <MousePointerClick className="h-4 w-4 shrink-0" />
            <span>{actionHint}</span>
          </div>
        )}

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
                Let's Go!
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          ) : isLastStep ? (
            <Button onClick={handleNext} className="bg-green-600 hover:bg-green-700 w-full">
              <PartyPopper className="h-4 w-4 mr-2" />
              Start Using CS12
            </Button>
          ) : config.showNextButton ? (
            <>
              <Button
                variant="ghost"
                onClick={prevStep}
                className="text-gray-500"
                disabled={currentStepIndex <= 1}
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
          ) : (
            // Interactive step - show back button and skip option
            <div className="w-full flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={prevStep}
                className="text-gray-500"
                size="sm"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">
                  {currentStepIndex + 1} / {totalSteps}
                </span>
                <Button
                  variant="ghost"
                  onClick={handleNext}
                  className="text-gray-500 hover:text-gray-700"
                  size="sm"
                >
                  Skip
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
