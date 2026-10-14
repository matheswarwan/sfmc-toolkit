// Sidebar sections and the routes behind them. `step` is the build step that ports
// the screen (see ../../README.md); until then the route shows a placeholder.
import {
  Bookmark, LayoutGrid, Blocks, Workflow, ListChecks, Database, Route, Globe, Mail,
} from 'lucide-vue-next'

export const NAV_GROUPS = [
  {
    label: 'Queries',
    items: [
      { path: '/queries/saved', name: 'Saved queries', icon: Bookmark, step: 2 },
      { path: '/queries/workspace', name: 'Workspace', icon: LayoutGrid, step: 2 },
      { path: '/queries/builder', name: 'Query Builder', icon: Blocks, step: 2 },
    ],
  },
  {
    label: 'Automation',
    items: [
      { path: '/automations', name: 'Automations', icon: Workflow, step: 5 },
      { path: '/activities', name: 'Activities', icon: ListChecks, step: 5 },
    ],
  },
  {
    label: 'Data',
    items: [
      { path: '/data-extensions', name: 'Data Extensions', icon: Database, step: 4 },
      { path: '/journeys', name: 'Journeys', icon: Route, step: 6 },
    ],
  },
  {
    label: 'Content',
    items: [
      { path: '/cloudpages', name: 'CloudPages', icon: Globe, step: 6 },
      { path: '/emails', name: 'Emails', icon: Mail, step: 3 },
    ],
  },
]

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })))
