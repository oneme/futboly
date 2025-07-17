<script setup lang="ts">

import {Player} from "@/models/Player";
import {useGameStore} from "@/stores/game";


const gameStore = useGameStore();
const player1 = defineModel<string>("player1", {default: 'Jugador 1'});
const player2 = defineModel<string>("player2", {default: 'Jugador 2'});
const addPlayer = (name: string) => {
  const player = new Player(name);
  gameStore.addPlayer(player);
}
const startGame = () => {
  addPlayer(player1.value);
  addPlayer(player2.value);
}
</script>
<template>
  <div class="mx-auto w-1/4 bg-orange-200 rounded-sm p-4 mt-20">
    <img src="/src/assets/futboly_title.webp" alt="title">
    <div class="flex flex-col space-y-2">
      <label for="player-1" class="block w-1/2">
        <span class="text-gray-700">Jugador 1:</span>
        <input type="text"
               id="player-1"
               v-model="player1"
               class="mt-1 block w-full px-3 py-2 rounded-sm border-gray-300 shadow-xs bg-white">
      </label>
      <label for="player-2" class="block w-1/2">
        <span class="text-gray-700">Jugador 2:</span>
        <input type="text"
               id="player-2"
               v-model="player2"
               class="mt-1 block w-full px-3 py-2 rounded-sm border-gray-300 shadow-xs bg-white">
      </label>
    </div>
    <button class="bg-blue-300 px-2 py-3 rounded-sm my-2" @click="startGame">Empezar</button>
  </div>
</template>

