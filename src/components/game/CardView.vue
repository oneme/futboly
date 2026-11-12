<script setup lang="ts">
defineProps<{ deck: 'federation' | 'surprise'; text: string }>()
</script>

<template>
  <div
    class="w-full max-w-sm rounded-xl border-4 p-4 text-center shadow-lg"
    :class="deck === 'federation' ? 'border-federation-border bg-federation-bg' : 'border-surprise-border bg-surprise-bg'"
  >
    <div
      class="mb-2 text-xs font-extrabold uppercase tracking-widest"
      :class="deck === 'federation' ? 'text-federation-border' : 'text-surprise-border'"
    >
      {{ deck === 'federation' ? 'Federación' : 'Sorpresa' }}
    </div>
    <p class="text-sm leading-snug" :class="deck === 'federation' ? 'text-federation-ink' : 'text-surprise-ink'">{{ text }}</p>
  </div>
</template>
