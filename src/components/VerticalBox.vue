<script setup lang="ts">

import {Box} from "@/models/Box";
import {useGameStore} from "@/stores/game";
import {Stadium} from "@/models/Stadium";
import {computed, ref} from "vue";
import {Dealership} from "@/models/Dealership";
import {ClubService} from "@/models/ClubService";
import {Position} from "@/types";
import StadiumCard from "@/components/StadiumCard.vue";
import DealershipCard from "@/components/DealershipCard.vue";
import ClubServiceCard from "@/components/ClubServiceCard.vue";
import Building from "@/components/Building.vue";

interface Props {
  box: Box,
  position: Position
}

const gameStore = useGameStore();
const props = defineProps<Props>();
const showDetail = ref();

const isStadium = computed(() => props.box?.kind instanceof Stadium);
const isDealership = computed(() => props.box?.kind instanceof Dealership);
const isClubService = computed(() => props.box?.kind instanceof ClubService);

</script>
<template>
  <div id="building">
    <building :stadium="<Stadium>box.kind" :position="position" v-if="isStadium"/>
    <div id="box">
      <div class="h-32 bg-auto" :style="`background-image: url('${box.kind.path}');`"
      :class="{'rotate-180': position === Position.TOP}" @mouseover="showDetail = box?.id" @mouseleave="showDetail = null">
        <div class="flex h-full items-end pb-1">
          <img src="/src/assets/player-1.webp" alt="player-1" class="size-10"
               v-show="box?.id == gameStore.players[0]?.pos">
          <img src="/src/assets/player-2.webp" alt="player-2" class="size-10"
               v-show="box?.id == gameStore.players[1]?.pos">
        </div>
      </div>
    </div>
  </div>
  <StadiumCard :property="<Stadium>box?.kind" v-show="showDetail" class="absolute z-50 left-[30%] top-36"
               v-if="isStadium"/>
  <DealershipCard :property="<Dealership>box?.kind" v-show="showDetail" class="absolute z-50 left-[30%] top-36"
                  v-else-if="isDealership"/>
  <ClubServiceCard :property="<ClubService>box?.kind" v-show="showDetail" class="absolute z-50 left-[30%] top-36"
                   v-else-if="isClubService"/>
</template>