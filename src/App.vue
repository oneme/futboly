<script setup lang="ts">

import Board from "@/components/Board.vue";
import Dashboard from "@/components/Dashboard.vue";
import {useGameStore} from "@/stores/game";

const gameStore = useGameStore();
</script>

<template>
  <dashboard v-if="gameStore.players.length === 0"/>
  <board v-else/>
</template>