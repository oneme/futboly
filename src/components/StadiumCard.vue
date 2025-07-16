<script setup lang="ts">
import {Stadium} from "@/models/Stadium";
import {formatCurrency} from "@/utils";
import TeamColorsTop from "@/components/TeamColorsTop.vue";
import TeamColorsBottom from "@/components/TeamColorsBottom.vue";

interface Props {
  property: Stadium
}

defineProps<Props>();
</script>

<template>
  <div class="bg-orange-200 p-2 w-1/6 rounded-sm">
    <div class="border border-black flex flex-col p-1">
      <p class="uppercase text-center mb-1">titulo de propiedad</p>
      <team-colors-top :property="property" />
      <p class="capitalize text-center mt-8">{{ property?.type === 0 ? 'general' : 'tribuna' }}</p>
      <p class="uppercase text-center">{{ property?.name }}</p>
      <div class="my-4">
        <p class="uppercase">alquileres:</p>
        <div class="flex items-center justify-between" v-for="(item, index) in property?.rents" :key="index">
          <p class="capitalize">{{ item.title }}</p>
          <p>{{ formatCurrency(item.rent) }}</p>
        </div>
        <p class="uppercase">precio de compra:</p>
        <div class="flex items-center justify-between" v-for="index in 2" :key="index">
          <p>{{ index % 2 == 0 ? 'De la Tribuna' : 'De cada silla' }}</p>
          <p>{{ formatCurrency(property?.build) }}</p>
        </div>
        <div class="flex items-center justify-between">
          <p class="uppercase">valor hipotecario de la concesion</p>
          <p>{{ formatCurrency(property?.mortgage) }}</p>
        </div>
      </div>
      <team-colors-bottom :property="property" />
    </div>
  </div>
</template>
