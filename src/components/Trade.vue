<script setup lang="ts">
import {onMounted, reactive, ref} from "vue";
import {useGameStore} from "@/stores/game";
import {Property} from "@/models/Property";

interface Form {
  providerMoney: number,
  offeredMoney: number,
  providerProperties: Property[],
  offeredProperties: Property[],
}

const gameStore = useGameStore();
const provider = ref();
const offered = ref();
onMounted(() => {
  provider.value = gameStore.turn;
  offered.value = gameStore.players.find(p => p.name !== provider.value.name);
});
const emit = defineEmits<{ (e: 'close'): void; (e: 'dismiss'): void; }>();
const form = reactive<Form>({
  providerMoney: 0,
  offeredMoney: 0,
  providerProperties: [],
  offeredProperties: [],
})
const close = () => {
  emit("close");
}
const dismiss = () => {
  emit("dismiss");
}
const proposeTrade = () => {
  const response = confirm(`${provider.value.name} ofrece
${form.providerProperties.map((p: Property) => p.fullName).join(',')} y ${form.providerMoney} Ptas.
A cambio de ${form.offeredProperties.map((p: Property) => p.fullName).join(',')} y ${form.offeredMoney} Ptas. ¿Aceptas?`);
  if (response) {
    provider.value.trade(form.offeredProperties, form.offeredMoney, form.providerProperties, form.providerMoney);
    offered.value.trade(form.providerProperties, form.providerMoney, form.offeredProperties, form.offeredMoney);
    close();
  }
}
</script>

<template>
  <div class="fixed inset-0 z-10 h-full w-full bg-black/50">
    <div class="flex items-center justify-center min-h-screen">
      <div class="w-1/3 bg-white p-6 rounded-sm ">
        <div class="flex items-center justify-center text-black">
          <div class="text-2xl font-bold">
            Trato
          </div>
        </div>
        <form @submit.prevent="proposeTrade">
          <label for="player-1" class="block">
            <span class="font-bold">{{ provider?.name }}</span>
            <input id="player-1" v-model="form.providerMoney" type="number" min="0" max="100000"
                   class="my-1 block w-full px-3 py-2 rounded-sm border border-gray-300"/>
          </label>
          <div class="flex items-center" v-for="(property, index) in provider?.properties" :key="index">
            <input :id="`checkbox-${provider?.name}-${property.name}`" type="checkbox" :value="property"
                   v-model="form.providerProperties" class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded-sm">
            <label :for="`checkbox-${provider?.name}-${property.name}`" class="ms-2 text-sm font-medium text-gray-900">{{
                property.fullName
              }}</label>
          </div>
          <label for="player-2" class="block">
            <span class="font-bold">{{ offered?.name }}</span>
            <input id="player-2" v-model="form.offeredMoney" type="number" min="0" max="10000"
                   class="my-1 block w-full px-3 py-2 rounded-sm border border-gray-300"/>
          </label>
          <div class="flex items-center" v-for="(property, index) in offered?.properties" :key="index">
            <input :id="`checkbox-${offered?.name}-${property.name}`" type="checkbox" :value="property"
                   v-model="form.offeredProperties" class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded-sm">
            <label :for="`checkbox-${offered?.name}-${property.name}`"
                   class="ms-2 text-sm font-medium text-gray-900">{{ property.fullName }}</label>
          </div>
          <div class="flex items-center justify-evenly">
            <button class="bg-blue-300 px-2 py-1 rounded-sm uppercase">proponer trato</button>
            <button class="bg-blue-300 px-2 py-1 rounded-sm uppercase" type="button" @click="dismiss">cancelar trato</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
