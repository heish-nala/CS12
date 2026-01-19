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
