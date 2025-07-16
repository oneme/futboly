<script setup lang="ts">
import {Stadium} from "@/models/Stadium";

interface Props {
  property: Stadium
  showTeamName?: boolean
}
withDefaults(defineProps<Props>(), {showTeamName: true});
</script>

<template>
  <div :class="property?.colors?.bottom" v-if="property?.colors?.style !== 3" class="h-8 border border-black">
    <p class="uppercase text-center pt-1" v-show="showTeamName">{{ property?.team }}</p>
  </div>
  <div class="border border-black bg-white flex items-center gap-12" v-else>
    <div class="flex h-8">
      <div class="w-2 mx-2" :class="property?.colors?.top"></div>
      <div class="w-2 me-2" :class="property?.colors?.top"></div>
      <div class="w-2" :class="property?.colors?.top"></div>
    </div>
    <p class="uppercase text-center text-black" v-show="showTeamName">{{ property?.team }}</p>
  </div>
</template>