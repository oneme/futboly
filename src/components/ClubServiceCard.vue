<script setup lang="ts">
import {ClubService} from "@/models/ClubService";
import {formatCurrency} from "@/utils";

interface Props {
  property: ClubService
}
defineProps<Props>();
</script>

<template>
  <div class="p-2 w-1/6 bg-white rounded-sm bg-contain bg-no-repeat bg-center" :style="`background-image: url('${property.card}');`">
    <div class="border border-black flex flex-col p-1 rounded-sm">
      <h1 class="uppercase text-center font-semibold mt-4">{{property.name}}</h1>
      <hr class="bg-black mx-2 my-4"/>
      <p class="uppercase px-2 my-4">alquileres:</p>
      <div class="px-2 w-10/12" v-for="(item, index) in property?.rents" :key="index">
        <p>{{ `${item.title} ${formatCurrency(item.rent)}` }}</p>
      </div>
      <h1 class="uppercase text-center font-semibold mt-8 mb-2">{{property.name}}</h1>
      <div class="flex items-end justify-between px-2 mb-20">
        <p class="uppercase">valor hipotecario de la concesion:</p>
        <p>{{ formatCurrency(property?.mortgage) }}</p>
      </div>
    </div>
  </div>
</template>