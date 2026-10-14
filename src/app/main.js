import '../assets/base.css'
import '../assets/tailwind.css'

import { createApp } from 'vue'
import App from './App.vue'
import { createAppRouter } from './router.js'
import store from '../stores/queryStore.js'

createApp(App).use(createAppRouter()).use(store).mount('#app')
