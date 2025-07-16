<script setup lang="ts">
import {computed, onMounted, ref} from "vue";
import {Property} from "@/models/Property";
import {useGameStore} from "@/stores/game";

interface Props {
  property: Property,
}
const props = defineProps<Props>();
const gameStore = useGameStore();
const bid = ref(0);
const currentBidder = ref();
const highestBidder = ref();
const highestBid = ref(0);
const passedTurns = ref(0);
onMounted(() => currentBidder.value = gameStore.turn);
const emit = defineEmits<(e: 'close') => void>();
const increaseBid = () => {
  if (canBid.value) {
    highestBid.value += bid.value;
    highestBidder.value = currentBidder.value;
    currentBidder.value = gameStore.players.find(p => p.name !== currentBidder.value.name);
  }
}
const passTurn = () => {
  if (passedTurns.value < gameStore.players.length -1) {
    passedTurns.value++;
    currentBidder.value = gameStore.players.find(p => p.name !== currentBidder.value.name);
  } else {
    if (highestBidder.value) {
      highestBidder.value.pay(highestBid.value);
      highestBidder.value.properties.push(props.property);
    }
    close();
  }
}
const canBid = computed(() => highestBid.value < bid.value);
const close = () => {
  emit("close");
}
</script>

<template>
  <div class="fixed inset-0 z-10 h-full w-full bg-black/50">
    <div class="flex items-center justify-center min-h-screen">
      <div class="w-1/4 bg-white p-6 rounded-sm ">
        <div class="flex items-center justify-center text-black">
          <div class="text-2xl font-bold">
            Subasta de {{ property.fullName }}
          </div>
        </div>
        <form @submit.prevent="increaseBid">
          <p>Puja más alta: {{ highestBid }}</p>
          <p>Es tu turno: {{ currentBidder?.name }}</p>
          <label for="bid" class="block">
            <span class="font-bold">Cantidad</span>
            <input id="bid" v-model="bid" type="number" min="1" max="10000"
                   class="my-1 block w-full px-3 py-2 rounded-sm border border-gray-300"/>
          </label>
          <div class="flex justify-evenly">
            <button class="bg-blue-300 px-2 py-1 rounded-sm uppercase" :class="{'opacity-25 cursor-not-allowed': !canBid}"
                    :disabled="!canBid">pujar
            </button>
            <button class="bg-blue-300 px-2 py-1 rounded-sm uppercase" type="button" @click="passTurn">pasar</button>
            <button class="bg-blue-300 px-2 py-1 rounded-sm uppercase" type="button" @click="close">salir</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
