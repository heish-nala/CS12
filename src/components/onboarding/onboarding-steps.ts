import { OnboardingStep } from '@/contexts/onboarding-context'

export interface StepConfig {
  id: OnboardingStep
  title: string
  description: string
  target?: string // data-onboarding attribute value
  placement: 'center' | 'top' | 'bottom' | 'left' | 'right'
  spotlightPadding?: number
  allowInteraction?: boolean // Allow clicking on the target
  nextTrigger?: string // data-onboarding attribute that triggers next step when clicked
}

export const stepConfigs: StepConfig[] = [
  {
    id: 'welcome',
    title: 'Welcome to Konekt!',
    description: "Let's take a quick tour of the key features to help you get started. This will only take about 2 minutes.",
    placement: 'center',
  },
  {
    id: 'sidebar',
    title: 'Navigation Sidebar',
    description: 'This is your main navigation. Access all your clients, search across your data, and manage your account settings from here.',
    target: 'sidebar',
    placement: 'right',
    spotlightPadding: 0,
  },
  {
    id: 'create-client',
    title: 'Create Your First Client',
    description: 'Click here to create your first client. Clients are the organizations you track — each has their own dashboard, data tables, and team.',
    target: 'add-client-btn',
    placement: 'right',
    spotlightPadding: 8,
    allowInteraction: true,
    nextTrigger: 'add-client-btn',
  },
  {
    id: 'client-dashboard',
    title: 'Client Dashboard',
    description: 'This is your client\'s home base. View key metrics, manage data tables, track doctor progress, and see recent activity all in one place.',
    target: 'client-dashboard',
    placement: 'bottom',
    spotlightPadding: 16,
  },
  {
    id: 'data-tables-tab',
    title: 'Data Tables',
    description: 'Data Tables are where you track all your information. Create custom tables for contacts, accounts, collections, and more.',
    target: 'data-tables-tab',
    placement: 'bottom',
    spotlightPadding: 8,
    allowInteraction: true,
    nextTrigger: 'data-tables-tab',
  },
  {
    id: 'add-table',
    title: 'Add a New Table',
    description: 'Click here to add a new data table. You can start from scratch or use one of our pre-built templates.',
    target: 'add-table-btn',
    placement: 'bottom',
    spotlightPadding: 8,
    allowInteraction: true,
    nextTrigger: 'add-table-btn',
  },
  {
    id: 'templates',
    title: 'Use Templates',
    description: 'Templates give you a head start! Choose from pre-configured tables like Attendee Tracker (with monthly progress), Weekly Collections, or Doctors/Providers tracking.',
    target: 'template-grid',
    placement: 'top',
    spotlightPadding: 16,
  },
  {
    id: 'progress-tracker',
    title: 'Progress Tracker',
    description: 'The Progress Tracker lets you monitor metrics over time. Track weekly, monthly, or quarterly progress for any row — perfect for onboarding journeys and goal tracking.',
    target: 'period-tracker',
    placement: 'left',
    spotlightPadding: 8,
  },
  {
    id: 'time-tracking',
    title: 'Configure Time Tracking',
    description: 'Customize your tracking periods here. Choose the frequency (weekly, monthly, quarterly) and define the metrics you want to track.',
    target: 'time-tracking-config',
    placement: 'left',
    spotlightPadding: 8,
  },
  {
    id: 'complete',
    title: "You're All Set!",
    description: 'You now know the key features of Konekt. Need help? Check out the settings for more options. You can restart this tour anytime from the Settings page.',
    placement: 'center',
  },
]

export function getStepConfig(step: OnboardingStep): StepConfig {
  return stepConfigs.find((s) => s.id === step) || stepConfigs[0]
}
