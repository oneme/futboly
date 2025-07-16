<script setup lang="ts">

interface Options {
  action: string,
  title: string,
}
interface Props {
  text: string,
  options?: Options[]
}

defineProps<Props>();
const emit = defineEmits<(e: 'dismiss') => void>();
</script>

<template>
  <div class="fixed inset-0 z-10 h-full w-full bg-black/50">
    <div class="flex items-center justify-center min-h-screen">
      <div class="w-1/4 bg-white p-6 rounded-sm">
        <div class="flex items-center justify-center text-black mb-2">
          <p></p>
          <div class="text-2xl font-bold">
            {{text}}
          </div>
        </div>
        <div class="flex justify-end">
          <button class="bg-blue-300 px-2 py-1 rounded-sm uppercase" type="button" @click="$emit('dismiss')">ok</button>
        </div>
      </div>
    </div>
  </div>
</template>