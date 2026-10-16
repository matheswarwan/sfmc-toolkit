// Shown on the To do page (#/todo). Plain data so it is easy to keep current: delete
// an item when it ships (and add it to features.js).
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
      {
        title: 'Where used: more places',
        detail: 'Where used on a data extension covers SQL Query activities and their automations. Next: imports, filters, data extracts, scripts, journeys (entry source, Update Contact) and emails (AMPscript lookups).',
      },
      {
        title: 'Better journey details',
        detail: 'Show more about a journey and its activities on the Journeys page.',
      },
      {
        title: 'Better emails',
        detail: 'Improve the Emails section.',
      },
    ],
  },
  {
    id: 'considering',
    title: 'Under consideration',
    items: [
      {
        title: 'Monitor automations',
        detail: 'Watch chosen automations and get a notice when one is paused, activated or fails. SFMC Automation Viewer had an unfinished version of this; it was left out of SFMC Toolkit until it can notify properly.',
      },
      {
        title: 'Business unit for older queries',
        detail: 'Queries saved before SFMC Query Saver 1.4.0 have no business unit, so they get no badge. They get one the next time they run in Run Query.',
      },
    ],
  },
]

export const TODO_STATUS_LABELS = {
  investigating: 'Investigating',
  planned: 'Planned',
  considering: 'Considering',
}
