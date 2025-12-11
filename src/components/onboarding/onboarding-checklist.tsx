'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { useOnboarding } from '@/contexts/onboarding-context'
import { useAuth } from '@/contexts/auth-context'
import { defaultChecklistItems } from './onboarding-steps'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  PlayCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function OnboardingChecklist() {
  const { user } = useAuth()
  const pathname = usePathname()
  const {
    checklistItems,
    checklistProgress,
    isChecklistVisible,
    hideChecklist,
    hasCompletedOnboarding,
    resetOnboarding
  } = useOnboarding()

  const [isExpanded, setIsExpanded] = useState(true)
  const [mounted, setMounted] = useState(false)

  // Handle mount for portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // Don't show on login page or if user is not authenticated
  const isLoginPage = pathname === '/login'
  if (!mounted || !isChecklistVisible || !hasCompletedOnboarding || !user || isLoginPage) return null

  const completedCount = Object.values(checklistItems).filter(Boolean).length
  const totalCount = Object.keys(checklistItems).length
  const allComplete = completedCount === totalCount

  const content = (
    <div className="fixed bottom-6 right-6 z-[9000] w-80">
      {/* Checklist Card */}
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              allComplete ? "bg-green-100" : "bg-blue-100"
            )}>
              {allComplete ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <Sparkles className="h-5 w-5 text-blue-600" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">
                {allComplete ? "Setup Complete!" : "Getting Started"}
              </h3>
              <p className="text-xs text-gray-500">
                {completedCount} of {totalCount} tasks complete
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-4 pb-3">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                allComplete ? "bg-green-500" : "bg-blue-500"
              )}
              style={{ width: `${checklistProgress}%` }}
            />
          </div>
        </div>

        {/* Checklist Items */}
        {isExpanded && (
          <div className="border-t border-gray-100">
            <div className="p-3 space-y-1">
              {defaultChecklistItems.map((item) => {
                const isComplete = checklistItems[item.id as keyof typeof checklistItems]
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-start gap-3 p-2 rounded-lg transition-colors",
                      isComplete ? "bg-green-50" : "hover:bg-gray-50"
                    )}
                  >
                    <div className="mt-0.5">
                      {isComplete ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium",
                        isComplete ? "text-green-700 line-through" : "text-gray-700"
                      )}>
                        {item.label}
                      </p>
                      <p className={cn(
                        "text-xs",
                        isComplete ? "text-green-600" : "text-gray-500"
                      )}>
                        {item.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Actions */}
            <div className="p-3 pt-0 flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-gray-500"
                onClick={hideChecklist}
              >
                <X className="h-4 w-4 mr-1" />
                Dismiss
              </Button>
              {!allComplete && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={resetOnboarding}
                >
                  <PlayCircle className="h-4 w-4 mr-1" />
                  Restart Tour
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // Use portal to render at body level
  if (typeof window === 'undefined') return null

  return createPortal(content, document.body)
}
