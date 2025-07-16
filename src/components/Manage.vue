<script setup lang="ts">
import {Property} from "@/models/Property";
import {Player} from "@/models/Player";
import {Stadium} from "@/models/Stadium";
import EventBus from "@/event-bus";

interface Props {
  player: Player,
  onPayDebt?: Function,
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'dismiss'): void; }>();
const buttons = [
  {name: "Comprar Sillas", action: "buyChairs"},
  {name: "Vender Sillas", action: "sellChairs"},
  {name: "Hipotecar", action: "mortgage"},
  {name: "Deshipotecar", action: "redeem"},
];
const dismiss = () => {
  emit("dismiss");
}

const getChairs = (property: Property) => {
  if (property instanceof Stadium) {
    return property.chairs;
  }
  return [];
}
const filteredButtons = (property: Property) => {
   return buttons.filter(button => {
     if (canBuildChair(property) && canSellChair(property)) {
       return ["buyChairs", "sellChairs"].includes(button.action);
     }
     if (canBuildChair(property) && canMortgage(property)) {
       return ["buyChairs", "mortgage"].includes(button.action);
     }
     if (canSellChair(property)) {
       return button.action == "sellChairs";
     }
     if (canMortgage(property)) {
       return button.action == "mortgage";
     }
       return button.action == "redeem";
   });
};
const canMortgage = (property: Property) => {
  return (!property.mortgaged && property instanceof Stadium && property.chairs == 0) || !property.mortgaged;
}
const canBuildChair = (property: Property) => {
  return !property.mortgaged && property instanceof Stadium && property.chairs >= 0 && property.chairs < 5 && props.player?.hasGroup(property);
}
const canSellChair = (property: Property) => {
  return !property.mortgaged && property instanceof Stadium && property.chairs > 0 && property.chairs <= 5 && props.player?.hasGroup(property);
}
</script>

<template>
  <div class="fixed inset-0 z-10 h-full w-full bg-black/50">
    <div class="flex items-center justify-center min-h-screen">
      <div class="w-1/3 bg-white p-6 rounded-sm ">
        <div class="flex items-center justify-between text-black">
          <div class="text-2xl font-bold">
            Activos de {{ player?.name }}&nbsp;&nbsp;&nbsp;{{player?.money}} Ptas.
          </div>
          <button @click="dismiss" v-if="!onPayDebt">&times;</button>
        </div>
        <ul>
          <li v-for="(property, index) in player?.properties" :key="index" class="p-1">
            <div class="flex items-center justify-between text-black">
            <p>{{property.fullName}}</p>
              <button v-for="(button, index) in filteredButtons(property)" :key="index"
                      @click="EventBus.emit('dispatch-action', {action: button.action, property: property})"
                      class="transform rounded-lg bg-blue-600 px-6 py-2 font-medium uppercase tracking-wide text-white transition-colors duration-300 hover:bg-blue-500 focus:outline-hidden focus:ring-3 focus:ring-blue-300 focus:ring-opacity-80 disabled:opacity-25"
                      >
                {{ button.name }}
              </button>
            </div>
          </li>
        </ul>
        <button class="bg-green-600 px-2 py-2" v-if="onPayDebt" @click="onPayDebt()">finalizar</button>
        <button class="bg-blue-300 px-2 py-1 rounded-sm uppercase" v-else type="button" @click="dismiss">salir</button>
      </div>
    </div>
  </div>
</template>