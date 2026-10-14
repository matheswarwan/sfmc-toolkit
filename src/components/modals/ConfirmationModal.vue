<script setup>
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from 'radix-vue'
import Button from '@/components/ui/button/Button.vue'

const emit = defineEmits(['confirm', 'cancel', 'okEmit'])
const props = defineProps({
  visible:  Boolean,
  message:  String,
  btnYes:   Boolean,
  btnNo:    Boolean,
  btnOk:    Boolean,
})
</script>

<template>
  <DialogRoot :open="visible">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/50" />
      <DialogContent class="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-80 rounded-xl bg-white border border-border shadow-2xl p-6 focus:outline-none">
        <DialogTitle class="sr-only">Confirmation</DialogTitle>
        <p class="text-sm text-foreground mb-5 leading-relaxed">{{ message }}</p>
        <div class="flex justify-end gap-2">
          <Button v-if="btnNo" variant="outline" size="sm" @click="emit('cancel')">
            No
          </Button>
          <Button v-if="btnYes" size="sm" @click="emit('confirm')">
            Yes
          </Button>
          <Button v-if="btnOk" size="sm" @click="emit('okEmit')">
            OK
          </Button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
