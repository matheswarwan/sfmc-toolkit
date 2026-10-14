import { createRouter, createWebHashHistory } from 'vue-router'
import { NAV_ITEMS } from './nav.js'

const Placeholder = () => import('../views/common/PlaceholderPage.vue')

// Sections that are built; the rest show the placeholder until their step lands.
const PAGES = {
  '/queries/saved': () => import('../views/queries/SavedQueriesPage.vue'),
  '/queries/workspace': () => import('../views/queries/WorkspacePage.vue'),
  '/queries/builder': () => import('../views/queries/BuilderPage.vue'),
  '/emails': () => import('../views/emails/EmailsPage.vue'),
  '/data-extensions': () => import('../views/data/DataExtensionsPage.vue'),
  '/automations': () => import('../views/automation/AutomationsPage.vue'),
  '/activities': () => import('../views/automation/ActivitiesPage.vue'),
}

export const routes = [
  { path: '/', redirect: '/queries/saved' },
  ...NAV_ITEMS.map((item) => ({
    path: item.path,
    component: PAGES[item.path] || Placeholder,
    meta: { title: item.name, group: item.group, step: item.step },
  })),
  {
    path: '/automations/:id',
    component: () => import('../views/automation/AutomationDetailPage.vue'),
    meta: { title: 'Automations', group: 'Automation' },
  },
  {
    path: '/emails/:id',
    component: () => import('../views/emails/EmailDetailPage.vue'),
    meta: { title: 'Emails', group: 'Content' },
  },
  { path: '/settings', component: () => import('../views/settings/SettingsPage.vue'), meta: { title: 'Settings' } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export function createAppRouter(history = createWebHashHistory()) {
  const router = createRouter({ history, routes })
  router.afterEach((to) => {
    document.title = to.meta?.title ? `${to.meta.title} · SFMC Toolkit` : 'SFMC Toolkit'
  })
  return router
}
