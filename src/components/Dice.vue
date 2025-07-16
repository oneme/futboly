<script setup lang="ts">
defineProps({
    path: String
});
</script>
<template>
<img class="p-2 w-1/3" :src="path" alt="dice">
</template>
