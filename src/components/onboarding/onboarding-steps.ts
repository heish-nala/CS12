import { OnboardingStep } from '@/contexts/onboarding-context'

export type TriggerType =
  | 'click'           // Wait for user to click the target
  | 'navigation'      // Wait for navigation to a specific path
  | 'element-visible' // Wait for an element to become visible
  | 'manual'          // User clicks Next button
  | 'auto'            // Auto-advance after delay

export interface StepConfig {
  id: OnboardingStep
  title: string
  description: string
  target?: string // data-onboarding attribute value
  placement: 'center' | 'top' | 'bottom' | 'left' | 'right'
  spotlightPadding?: number

  // Interactive behavior
  triggerType: TriggerType
  triggerTarget?: string // Element to watch for trigger
  triggerPath?: string   // Path to watch for navigation
  triggerDelay?: number  // Delay for auto-advance (ms)

  // UI behavior
  showNextButton?: boolean // Show manual next button
  showPulse?: boolean      // Show pulsing animation on target
  blockInteraction?: boolean // Block clicks outside spotlight

  // Checklist item (if this step corresponds to a checklist task)
  checklistItem?: string
}

export const stepConfigs: StepConfig[] = [
  {
    id: 'welcome',
    title: 'Welcome to Konekt!',
    description: "Let's get you set up with a quick hands-on tutorial. You'll create your first client and learn the key features.",
    placement: 'center',
    triggerType: 'manual',
    showNextButton: true,
  },
  {
    id: 'sidebar',
    title: 'This is Your Workspace',
    description: 'Your navigation sidebar shows all your clients and settings. Let\'s create your first client now!',
    target: 'sidebar',
    placement: 'right',
    spotlightPadding: 0,
    triggerType: 'manual',
    showNextButton: true,
  },
  {
    id: 'create-client',
    title: 'Create Your First Client',
    description: 'Click the + button to create your first client. Clients are the organizations you\'ll be tracking.',
    target: 'add-client-btn',
    placement: 'right',
    spotlightPadding: 12,
    triggerType: 'click',
    triggerTarget: 'add-client-btn',
    showPulse: true,
    blockInteraction: false,
    checklistItem: 'create-client',
  },
  {
    id: 'client-dialog',
    title: 'Name Your Client',
    description: 'Enter a name for your client (e.g., "Acme Dental" or "Test Client") and click Create.',
    target: 'create-client-dialog',
    placement: 'right',
    spotlightPadding: 16,
    triggerType: 'navigation',
    triggerPath: '/clients/',
    blockInteraction: false,
  },
  {
    id: 'client-dashboard',
    title: 'Your Client Dashboard',
    description: 'Great job! This is your client\'s home base. You can see metrics, manage data, and track activity here.',
    target: 'client-dashboard',
    placement: 'bottom',
    spotlightPadding: 16,
    triggerType: 'manual',
    showNextButton: true,
  },
  {
    id: 'data-tables-tab',
    title: 'Data Tables',
    description: 'The Data tab is where you\'ll track all your information. Let\'s add your first table!',
    target: 'data-tables-tab',
    placement: 'bottom',
    spotlightPadding: 8,
    triggerType: 'manual',
    showNextButton: true,
  },
  {
    id: 'add-table',
    title: 'Add a Data Table',
    description: 'Click here to add your first data table. You can choose from templates or create a blank table.',
    target: 'add-table-btn',
    placement: 'bottom',
    spotlightPadding: 12,
    triggerType: 'click',
    triggerTarget: 'add-table-btn',
    showPulse: true,
    blockInteraction: false,
    checklistItem: 'add-table',
  },
  {
    id: 'templates',
    title: 'Choose a Template',
    description: 'Templates give you a head start! Try the "Attendee Tracker" - it includes progress tracking built-in. Click any template to create it.',
    target: 'template-grid',
    placement: 'top',
    spotlightPadding: 16,
    triggerType: 'element-visible',
    triggerTarget: 'data-grid',
    blockInteraction: false,
    checklistItem: 'use-template',
  },
  {
    id: 'progress-tracker',
    title: 'Progress Tracking',
    description: 'Tables with time tracking show a Progress column. Click on any row\'s progress cell to view and edit metrics over time.',
    target: 'period-tracker',
    placement: 'left',
    spotlightPadding: 12,
    triggerType: 'manual',
    showNextButton: true,
    showPulse: true,
    checklistItem: 'progress-tracker',
  },
  {
    id: 'complete',
    title: "You're Ready to Go!",
    description: 'You\'ve learned the basics! Explore more features like activity logging, CSV imports, and dashboard customization. Need help? Check Settings anytime.',
    placement: 'center',
    triggerType: 'manual',
    showNextButton: true,
  },
]

export function getStepConfig(step: OnboardingStep): StepConfig {
  return stepConfigs.find((s) => s.id === step) || stepConfigs[0]
}

// Checklist items that users should complete
export interface ChecklistItem {
  id: string
  label: string
  description: string
  completed: boolean
}

export const defaultChecklistItems: Omit<ChecklistItem, 'completed'>[] = [
  {
    id: 'create-client',
    label: 'Create your first client',
    description: 'Add an organization to track',
  },
  {
    id: 'add-table',
    label: 'Add a data table',
    description: 'Create a table to store data',
  },
  {
    id: 'use-template',
    label: 'Try a template',
    description: 'Use a pre-built table template',
  },
  {
    id: 'progress-tracker',
    label: 'Explore progress tracking',
    description: 'View time-based metrics',
  },
]
