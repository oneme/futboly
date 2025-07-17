<script setup lang="ts">
import {useGameStore} from "@/stores/game";
import Dice from "./Dice.vue";
import {Property} from "@/models/Property";
import {computed} from "vue";
import {Department} from "@/models/Department";
import {useBoxStore} from "@/stores/box";
import EventBus from "../event-bus";
import {Player} from "@/models/Player";
import {formatCurrency} from "@/utils";
import PropertySnippet from "@/components/PropertySnippet.vue";


const gameStore = useGameStore();
const counterBox = useBoxStore();

interface Props {
  player: Player;
  dice1Path: string;
  dice2Path: string;
}

const props = withDefaults(defineProps<Props>(), {
  dice1Path: 'src/assets/dices/1.webp',
  dice2Path: 'src/assets/dices/1.webp'
});

const buttons = [
  {name: "Comprar", action: "buy"},
  {name: "Trato", action: "trade"},
  {name: "Acabar turno", action: "finishTurn"}
];

const filteredButtons = computed(() => {
  const box = counterBox.getPropertyOrDepartment;
  const property = box instanceof Property ? box : null;
  const isFreeProperty = property && !gameStore.players.find(p => p.isPropertyOwned(property));
  return buttons.filter(button => {
    if ((box instanceof Department || !isFreeProperty) && !props.player.doubles || (box instanceof Property && box.price > props.player.money)) {
      return button.action === 'finishTurn';
    } else if ((box instanceof Department || !isFreeProperty) && props.player.doubles) {
      return;
    } else if (!props.player.doubles && isFreeProperty) {
      return ['buy', 'trade', 'finishTurn'].includes(button.action);
    }
    return button.action === 'buy';
  });
});
const isMyTurn = computed(() => gameStore.turn == props.player);
const disableDices = computed(() => (!props.player.doubles && props.player.turns < 3) || (props.player.turns == 0 && props.player.doubles));
</script>

<template>
  <div class="w-1/4 p-4 bg-white/30 shadow-lg rounded-lg my-4">
    <div class="flex flex-col">
      <div class="h-96">
        <h2 class="text-lg text-center font-semibold mb-2">{{ player?.name }}</h2>
        <p><b>Dinero:</b> {{ formatCurrency(player?.money) }} Ptas.</p>
        <p><b>Posición:</b> {{ counterBox.playerPos(player?.pos).kind.name }}</p>
        <div v-show="isMyTurn">
          <button class="flex justify-center p-1 disabled:opacity-60" @click="EventBus.emit('roll-dice')" type="button"
                  :disabled="disableDices">
            <Dice :path="dice1Path"/>
            <Dice :path="dice2Path"/>
          </button>
          <div class="p-1 grid place-content-center space-y-2">
            <button v-for="(button, index) in filteredButtons" :key="index"
                    @click="EventBus.emit('dispatch-action', {action: button.action, property: <Property>counterBox.current.kind})"
                    class="transform rounded-lg bg-blue-600 px-6 py-2 font-medium uppercase tracking-wide text-white transition-colors duration-300 hover:bg-blue-500 focus:outline-hidden focus:ring-3 focus:ring-blue-300 focus:ring-opacity-80 disabled:opacity-25"
                    :disabled="player.turns == 3">
              {{ button.name }}
            </button>
            <button
                class="transform rounded-lg bg-blue-600 px-6 py-2 font-medium uppercase tracking-wide text-white transition-colors duration-300 hover:bg-blue-500 focus:outline-hidden focus:ring-3 focus:ring-blue-300 focus:ring-opacity-80 disabled:opacity-25"
                @click="EventBus.emit('manage')"
            >
              Gestión
            </button>
          </div>
        </div>
      </div>
      <div>
        <property-snippet :property="property" v-for="(property, index) in player.properties.sort((a, b) =>  a.id - b.id)" :key="index"/>
      </div>
    </div>
  </div>
</template>
