<script setup lang="ts">
import type {Property} from "@/models/Property";

interface Props {
  property: Property
}
const props = defineProps<Props>();

</script>

<template>
<div class="flex">
  <p class="font-semibold text-xs" :class="{'text-red-500': property.mortgaged}">{{property.fullName}}</p>
</div>
</template>
