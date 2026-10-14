// Shown on todo.html. Plain data so it is easy to keep current: move an item to
// `done` (with the version) when it ships, or delete it.
//
// status: 'planned' | 'considering' | 'investigating'

export const TODO_GROUPS = [
  {
    id: 'planned',
    title: 'Planned',
    items: [
      {
        title: 'More known values in autocomplete',
        detail: 'Suggest values for _Journey.JourneyStatus, _AutomationInstance.AutomationInstanceStatus and _JourneyActivity.ActivityType once the lists are confirmed against a real account.',
      },
    ],
  },
  {
    id: 'considering',
    title: 'Under consideration',
    items: [
      {
        title: 'Business unit for older queries',
        detail: 'Queries saved before 1.4.0 have no business unit, so they get no badge. They get one the next time they run in the Query Workspace.',
      },
    ],
  },
]

export const TODO_STATUS_LABELS = {
  investigating: 'Investigating',
  planned: 'Planned',
  considering: 'Considering',
}
