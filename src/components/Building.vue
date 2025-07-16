<script setup lang="ts">
import {computed} from "vue";
import {Stadium} from "@/models/Stadium";
import {Position} from "@/types";

interface Props {
  stadium: Stadium,
  position: Position
}

const props = defineProps<Props>();
const chairs = {
  top: [
    {path: "_top", class: "top-[132px] right-0"},
    {path: "_top", class: "top-[132px] right-6"},
    {path: "_top", class: "top-[132px] right-12"},
    {path: "_top", class: "top-[132px] right-18"},
  ],
  bottom: [
    {path: "_bottom", class: "-top-8 left-0"},
    {path: "_bottom", class: "-top-8 left-6"},
    {path: "_bottom", class: "-top-8 left-12"},
    {path: "_bottom", class: "-top-8 left-18"},
  ],
  right: [
    {path: "_right", class: "left-8 -top-2"},
    {path: "_right", class: "left-8 top-4"},
    {path: "_right", class: "left-8 top-10"},
    {path: "_right", class: "left-8 top-[64px]"},
  ],
  left: [
    {path: "_left", class: "right-8 top-0"},
    {path: "_left", class: "right-8 top-6"},
    {path: "_left", class: "right-8 top-12"},
    {path: "_left", class: "right-8 top-[72px]"},
  ]
}
const tribune = {
  top: {path: "_top", class:"top-[132px] left-6"},
  bottom: {path: "_bottom", class:"-top-12 left-6"},
  right: {path: "_right", class:"top-4 left-4"},
  left: {path: "_left", class:"top-4 right-4"},
}
const getBoxChairs = computed(() => {
    const positionMap = {
      [Position.BOTTOM]: chairs.bottom,
      [Position.TOP]: chairs.top,
      [Position.LEFT]: chairs.left,
      [Position.RIGHT]: chairs.right
    };
    return positionMap[props.position].slice(0, props.stadium?.chairs) ?? [];

});
const getBoxTribune = computed(() => {
    const positionMap = {
      [Position.BOTTOM]: tribune.bottom,
      [Position.TOP]: tribune.top,
      [Position.LEFT]: tribune.left,
      [Position.RIGHT]: tribune.right
    };
    return positionMap[props.position] ?? {path: "", class: ""};
});
</script>

<template>
  <div class="relative">
    <img v-for="(chair, index) in getBoxChairs"
         :key="index"
         :src="`src/assets/buildings/chair${chair.path}.svg`"
         alt="chair"
         class="absolute w-8 h-8"
         :class="chair.class"
         v-if="stadium?.chairs < 5"
    />
    <img
        :src="`src/assets/buildings/tribune${getBoxTribune.path}.svg`"
        alt="tribune"
        class="absolute w-12 h-12"
        :class="getBoxTribune.class"
        v-else-if="stadium?.chairs === 5"
        />
  </div>
</template>