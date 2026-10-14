<script setup>
import { ref } from 'vue'
import { BUILD_VERSION, DEV_MODE } from '@/utils/buildVersion.js'

const logoImg = ref(null)
const logoFallback = ref(null)

function onLogoError() {
  if (logoImg.value) logoImg.value.style.display = 'none'
  if (logoFallback.value) logoFallback.value.style.display = 'inline'
}
</script>

<template>
  <footer class="border-t border-border bg-muted/30 px-6 py-4 text-center">
    <div class="flex items-center justify-center gap-2.5 mb-2">
      <a
        href="https://ateko.com/en/apps/"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center"
      >
        <img
          src="https://logo.clearbit.com/ateko.com"
          alt="Ateko"
          class="h-5 w-auto block"
          ref="logoImg"
          @error="onLogoError"
        />
        <span ref="logoFallback" class="hidden text-sm font-extrabold text-foreground tracking-tight">
          Ateko
        </span>
      </a>
      <span class="text-sm text-border">·</span>
      <span class="text-xs font-medium text-muted-foreground">SFMC Query Saver</span>
    </div>
    <p class="text-[11px] text-muted-foreground leading-relaxed max-w-lg mx-auto">
      This extension is provided <strong class="text-muted-foreground/80 font-semibold">free of charge</strong> and
      <strong class="text-muted-foreground/80 font-semibold">"as-is"</strong> without any warranty, express or implied.
      Ateko accepts no liability for data loss, inaccuracies, or any damages arising from its use. Use at your own risk.
    </p>
    <p v-if="DEV_MODE" class="mt-2">
      <span class="text-xs font-mono font-bold text-white bg-fuchsia-600 px-2 py-0.5 rounded">BUILD {{ BUILD_VERSION }}</span>
    </p>
  </footer>
</template>
