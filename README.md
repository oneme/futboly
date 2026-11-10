# futboly

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

## Motor de juego (rama `feature/motor-de-juego`)

La lógica del juego vive en `src/engine/`, separada de la interfaz y sin dependencias de Vue:

| Archivo | Contenido |
|---|---|
| `types.ts` | Tipos del dominio (casillas, propiedades, cartas) |
| `data.ts` | Construye el tablero (`src/json/board-layout.json`) y los mazos a partir de los JSON |
| `game.ts` | Estado y reglas: turnos, dados, dobles, Banquillo, compra, subasta, alquileres, cartas, deudas y quiebra |
| `management.ts` | Asientos, tribunas, hipotecas, intercambios y venta de la carta "Salga del Banquillo" |

La interfaz (`src/views/GameView.vue`, `src/components/game/`, `src/stores/match.ts`) solo lee `state.phase`
y llama a las acciones del motor. El código anterior (`Board.vue`, `stores/game.ts`, `models/`...) sigue en el repo
sin usarse.

`src/json/board-layout.json` es el orden real de las 40 casillas: `P<id>` = propiedad con ese id, `D<n>` = departamento n
de `departamentos.json`.

```sh
npm run validate-data   # comprueba los JSON (hipotecas, rentas, cartas de movimiento...)
npm run test:engine     # reglas del motor y simulaciones de partidas completas con bots
npm test                # pruebas de interfaz (vitest + jsdom)
```
