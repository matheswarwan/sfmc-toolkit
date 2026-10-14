<script setup>
import { useRoute } from 'vue-router'
const route = useRoute()
</script>

<template>
  <div class="max-w-xl mx-auto mt-16 px-4 text-center">
    <h1 class="text-lg font-semibold">{{ route.meta.title }}</h1>
    <p class="mt-2 text-sm text-muted-foreground">
      This section is being moved into SFMC Toolkit (build step {{ route.meta.step }}).
      Until then it is in SFMC Query Saver or SFMC Automation Viewer.
    </p>
  </div>
</template>
