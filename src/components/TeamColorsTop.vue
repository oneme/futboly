<script setup lang="ts">
import {computed} from "vue";
import {Stadium} from "@/models/Stadium";
interface Props {
  property: Stadium
}
const props = defineProps<Props>();
const squares = computed(() => props?.property?.colors?.top.split(','));
</script>

<template>
  <div class="border border-black flex">
    <div
        v-for="index in property.colors.style"
        :key="index"
        :class="[index % 2 === 1 ? squares[0] : squares[1], property?.colors?.style === 5 ? 'w-20 h-10' : 'w-16 h-10']" v-if="property?.colors?.style > 3"></div>
    <div v-else-if="property?.colors?.style > 1" class="bg-white flex w-full">
      <div class="h-12 w-2 mx-2" :class="property?.colors?.top"></div>
      <div class="h-12 w-2 me-2" :class="property?.colors?.top"></div>
      <div class="h-12 w-2" :class="property?.colors?.top"></div>
    </div>
    <div :class="property?.colors?.top" class="h-10 w-full" v-else></div>
  </div>
</template>
