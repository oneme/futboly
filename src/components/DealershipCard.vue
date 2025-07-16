<script setup lang="ts">
import {Dealership} from "@/models/Dealership";
import {formatCurrency} from "@/utils";

interface Props {
  property: Dealership
}
defineProps<Props>();
</script>

<template>
  <div class="p-2 w-1/6 bg-white rounded-sm bg-contain bg-no-repeat bg-center" :style="`background-image: url('${property.card}');`">
    <div class="border border-black flex flex-col p-1 rounded-sm">
      <h1 class="uppercase text-center">servicios estadio</h1>
      <h1 class="uppercase text-center font-semibold">{{property.name}}</h1>
      <hr class="bg-black mx-2 my-4"/>
      <p class="uppercase px-2 my-4">alquileres:</p>
      <div class="flex items-center justify-between px-2" v-for="(item, index) in property?.rents" :key="index">
        <p class="capitalize">{{ item.title }}</p>
        <p>{{ formatCurrency(item.rent) }}</p>
      </div>
      <h1 class="uppercase text-center font-semibold my-6">{{property.name}}</h1>
      <div class="flex items-end justify-between px-2 mt-2 mb-8">
        <p class="uppercase">valor hipotecario de la concesion:</p>
        <p>{{ formatCurrency(property?.mortgage) }}</p>
      </div>
      <h1 class="uppercase text-center">servicios estadio</h1>
    </div>
  </div>
</template>
