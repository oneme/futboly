<script setup lang="ts">
/** Iconos vectoriales de las casillas dibujadas desde los datos (edición actual). Usan el color del texto. */
defineProps<{ name?: string }>()
</script>

<template>
  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <!-- Videomarcador -->
    <template v-if="name === 'scoreboard'">
      <rect x="5" y="9" width="38" height="22" rx="3" />
      <path d="M17 31v8M31 31v8M12 39h24M13 20h6M29 20h6M24 15v10" />
    </template>
    <!-- Merchandising: camiseta -->
    <template v-else-if="name === 'merch'">
      <path d="M17 6l-11 7 5 8 4-2v21h18V19l4 2 5-8-11-7c-1 3-3 4-7 4s-6-1-7-4z" />
    </template>
    <!-- Restauración: perrito/copa y cubierto -->
    <template v-else-if="name === 'food'">
      <path d="M14 6v12a4 4 0 0 0 8 0V6M18 6v34M34 6c-4 3-5 9-5 15h5v19" />
    </template>
    <!-- Publicidad: megáfono -->
    <template v-else-if="name === 'ads'">
      <path d="M6 20v8h8l16 9V11l-16 9zM37 19a7 7 0 0 1 0 10M12 28l3 12h5l-3-12" />
    </template>
    <!-- Material deportivo: balón -->
    <template v-else-if="name === 'kit'">
      <circle cx="24" cy="24" r="17" />
      <path d="M24 15l8 6-3 9h-10l-3-9z M24 15V7M32 21l9-3M29 30l5 8M19 30l-5 8M16 21l-9-3" />
    </template>
    <!-- Autocares -->
    <template v-else-if="name === 'bus'">
      <rect x="6" y="8" width="36" height="28" rx="5" />
      <path d="M6 24h36M6 17h36M14 36v5M34 36v5" />
      <circle cx="14" cy="30" r="1.6" /><circle cx="34" cy="30" r="1.6" />
    </template>
    <!-- Salida: bandera de cuadros -->
    <template v-else-if="name === 'start'">
      <path d="M12 6v38" />
      <path d="M12 8h26l-4 8 4 8H12z" />
      <path d="M12 16h13M25 8v16M12 24h0" />
    </template>
    <!-- Multa: tarjeta roja -->
    <template v-else-if="name === 'fine'">
      <rect x="13" y="6" width="22" height="30" rx="3" transform="rotate(-8 24 21)" fill="currentColor" fill-opacity=".25" />
      <path d="M10 42h28" />
    </template>
    <!-- Parking -->
    <template v-else-if="name === 'parking'">
      <rect x="7" y="7" width="34" height="34" rx="6" />
      <path d="M19 34V14h8a6 6 0 0 1 0 12h-8" />
    </template>
    <!-- Día del Club: escudo -->
    <template v-else-if="name === 'club'">
      <path d="M24 5l16 5v13c0 10-7 16-16 20C15 39 8 33 8 23V10z" />
      <path d="M24 15l3 6h6l-5 4 2 7-6-4-6 4 2-7-5-4h6z" />
    </template>
    <circle v-else cx="24" cy="24" r="14" />
  </svg>
</template>
