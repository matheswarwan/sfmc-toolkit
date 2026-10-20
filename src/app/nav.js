// Sidebar sections and the routes behind them (pages in router.js).
import {
  Bookmark, LayoutGrid, Blocks, Workflow, ListChecks, Database, Route, LogIn, Globe, Mail, Network, Trash2, LayoutTemplate,
} from 'lucide-vue-next'

export const NAV_GROUPS = [
  {
    label: 'Queries',
    items: [
      { path: '/queries/saved', name: 'Saved queries', icon: Bookmark },
      { path: '/queries/workspace', name: 'Run Query', icon: LayoutGrid },
      { path: '/queries/builder', name: 'Query Builder', icon: Blocks },
      { path: '/queries/cleanup', name: 'Clean up SFMC', icon: Trash2 },
    ],
  },
  {
    label: 'Automation',
    items: [
      { path: '/automations', name: 'Automations', icon: Workflow },
      { path: '/activities', name: 'Activities', icon: ListChecks },
      { path: '/templates', name: 'Templates', icon: LayoutTemplate },
    ],
  },
  {
    label: 'Journey',
    items: [
      { path: '/journeys', name: 'Journeys', icon: Route },
      { path: '/journey-entry', name: 'Journey Entry', icon: LogIn },
    ],
  },
  {
    label: 'Data',
    items: [
      { path: '/data-extensions', name: 'Data Extensions', icon: Database },
      { path: '/where-used', name: 'Where used', icon: Network },
    ],
  },
  {
    label: 'Content',
    items: [
      { path: '/cloudpages', name: 'CloudPages', icon: Globe },
      { path: '/emails', name: 'Saved Emails', icon: Mail },
    ],
  },
]

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })))
