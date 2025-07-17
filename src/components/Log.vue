<script setup lang="ts">
import {storeToRefs} from 'pinia'
import {useLogStore} from "@/stores/log";

const logStore = useLogStore();
const {logs} = storeToRefs(logStore);
</script>
<template>
  <div class="flex flex-col items-center -mt-8">
    <p class="text-white text-center text-2xl py-2">{{ logs[0] }}</p>
    <p class="text-white/75 text-center text-2xl py-2">{{ logs[1] }}</p>
  </div>
</template>
