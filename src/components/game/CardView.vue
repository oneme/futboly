<script setup lang="ts">
defineProps<{ deck: 'federation' | 'surprise'; text: string }>()
</script>

<template>
  <div
    class="w-full max-w-sm rounded-xl border-4 p-4 text-center shadow-lg"
    :class="deck === 'federation' ? 'border-sky-600 bg-sky-50' : 'border-amber-500 bg-amber-50'"
  >
    <div
      class="mb-2 text-xs font-extrabold uppercase tracking-widest"
      :class="deck === 'federation' ? 'text-sky-700' : 'text-amber-700'"
    >
      {{ deck === 'federation' ? 'Federación' : 'Sorpresa' }}
    </div>
    <p class="text-sm leading-snug text-slate-800">{{ text }}</p>
  </div>
</template>
