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

### IA, subastas, animación y sonido

- **Jugadores IA** (`src/engine/ai.ts`): `aiStep(state)` hace una acción del jugador al que le toca (turno, subasta o deuda).
  Compra y puja según el valor que da a cada concesión (más si completa un grupo), construye con colchón de dinero y
  vende/hipoteca solo lo necesario para pagar. No propone ni acepta intercambios.
- **Subasta por pujas**: `declineBuy` abre la subasta; `auctionBid` / `auctionPass` se turnan los jugadores hasta que queda uno.
- **Eventos** (`state.events`, `emit()` en el motor): sirven para los sonidos; los sonidos se sintetizan en
  `src/lib/sound.ts` con Web Audio (sin archivos).
- **Animación de peones** (`src/lib/pawnPath.ts`): avanzan casilla a casilla; el store espera a que lleguen antes de
  reproducir sonidos o dejar jugar a la IA. Tiempos en `src/stores/match.ts` (`STEP_MS`, `AI_DELAY_MS`).

### Tratos con la IA (`src/engine/trading.ts`)

- **Valoración**: la IA valora un conjunto de concesiones por su precio más un bonus por grupos completos y parejas de
  servicios; acepta un trato si gana valor (con el dinero incluido) y no regala al rival más de lo que le compensan.
- **Humano → IA**: en el gestor, pestaña Intercambios, el botón pasa a "Proponer a la IA" y responde al momento.
- **IA → humano**: la IA compra la concesión que le completa un grupo y deja una propuesta pendiente
  (`state.proposal`); sale una ventana para aceptar o rechazar. Si se rechaza no vuelve a insistir en 8 turnos.
- **IA ↔ IA**: negocian subiendo la oferta hasta que la otra acepte; se cierra sin intervención.
- Los jugadores IA son de solo lectura en el gestor de propiedades.
