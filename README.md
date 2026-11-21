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

### Niveles de la IA y resumen final

- **Niveles** (`src/engine/aiProfiles.ts`): fácil, normal y difícil. Cada uno es un perfil de parámetros (colchón de dinero,
  despistes, pujas, dureza al negociar...). El difícil, además, ajusta su colchón al mayor alquiler que puede pagar en las
  próximas 12 casillas. Valores ajustados con partidas IA contra IA: la normal gana a la fácil ~85 % y la difícil a la
  normal ~70 % (`scripts/test-levels.ts`). Se elige por jugador en la pantalla de inicio.
- **Resumen** (`src/engine/summary.ts`, `GameOverDialog.vue`): clasificación por patrimonio (manera rápida del manual),
  eliminados ordenados por quién aguantó más, datos curiosos y botón de **Revancha** con los mismos jugadores y reglas.
- **Colores de las cartas** (`main.css`): Federación en verde y Sorpresa en morado, borde oscuro y fondo claro.

### Ediciones: clásica y actual

Se elige en la pantalla de inicio y se guarda en las reglas de la partida (`rules.edition`, `rules.inflation`), así que la
revancha y las partidas guardadas mantienen su edición (las antiguas se cargan como clásica). `src/engine/editions.ts` las define.

| Edición | Datos | Aspecto | Importes |
|---|---|---|---|
| **Clásica (1982)** | `estadios.json`, `concesiones.json`, `servicios.json`, `departamentos.json`, `federacion.json`, `sorpresa.json` | Tablero original con sus imágenes | Pesetas |
| **Actual** | los mismos con sufijo `_new` | Todas las casillas se dibujan desde el JSON (sin imágenes de estadios, servicios ni Salida/Multa/Parking/Día del Club) | Euros con inflación |

- La edición actual renombra los servicios de estadio: Gorras → **Merchandising**, Bares → **Restauración**,
  Almohadillas → **Videomarcador** (Publicidad se mantiene). Federación, Sorpresa, Banquillo y Vaya al Banquillo conservan su imagen.
- Los servicios sin `path` se dibujan con `icon` y `color` (`SquareIcon.vue`, `ServiceSquareView.vue`); los departamentos sin
  `path`, con `icon` (`DepartmentSquareView.vue`). Iconos: `scoreboard, merch, food, ads, kit, bus, start, fine, club, parking`.
- Euros: `euros = ceil(pesetas / 166,386 · (1 + coeficiente))`, coeficiente 35,79 por defecto (editable al elegir la edición actual).
  El motor trabaja siempre en pesetas; el registro usa marcadores (`[[6000]]`, `src/engine/money.ts`) que la interfaz convierte
  (`src/lib/currency.ts`, `src/lib/useMoney.ts`). Las cantidades escritas a mano (pujas, tratos) son en pesetas y muestran su equivalente.

### Tratos y contraofertas

- Un humano ofrece un trato a una IA desde **Gestionar → Intercambios**: la IA acepta, rechaza o **contraofrece** (mismas concesiones,
  pidiendo el mínimo dinero extra que le compensa). La contraoferta aparece como una propuesta que se acepta, se rechaza o se contraofertea.
- Cuando una IA propone un trato al humano, este puede **Contraofertar**: edita concesiones y dinero (`TradeEditor.vue`) y la IA responde.
- Hay como máximo 3 contraofertas (`MAX_COUNTER_ROUNDS` en `src/engine/trading.ts`); la última oferta solo se acepta o se rechaza.

### Datos y ediciones (`src/json/`)

El tablero y los equipos salen de los JSON; el motor y la interfaz no tienen ningún nombre de equipo en el código.

| Archivo | Contenido |
|---|---|
| `estadios.json` / `estadios_new.json` | Equipos y estadios: `team`, `short` (nombre corto de la casilla), `name` (estadio), `type` (0 General, 1 Tribuna), precios, alquileres, hipoteca, `build` y `colors` |
| `federacion*.json`, `sorpresa*.json` | Cartas; los `move` usan posiciones 1 a 40 (0 = Salida) |
| `concesiones*.json`, `servicios*.json`, `departamentos*.json` | Servicios de estadio, de club y casillas especiales (en `_new`, con `icon` y `color` en vez de imágenes) |
| `board-layout.json` | Orden de las 40 casillas (`P<id>` concesión, `D<n>` departamento) |

`colors` de un estadio: `top` son las clases de las franjas (`"bg-green-1000,bg-white"`), `style` el dibujo (4 o más = ese
número de franjas alternas, 2-3 = tres barras sobre blanco, 1 = liso) y `bottom` la banda inferior y el color del texto.
`path` es opcional: sin imagen, la casilla se construye desde el JSON.

```sh
npm run validate-data   # revisa las dos ediciones (parejas General/Tribuna, alquileres, hipotecas, cartas y sus destinos...)
npm run team-colors     # regenera src/assets/team-colors.css (se ejecuta solo antes de dev y build-only)
```

**Añadir o cambiar un equipo**: editar las dos entradas del equipo en `estadios.json` (General y Tribuna, mismo `team`, `short`
y `colors`), ajustar el texto de las cartas que lo mencionen y ejecutar `npm run validate-data`. Las clases de color nuevas
se detectan solas. Para cambiar los equipos de la edición actual, editar los `_new` (el validador revisa las dos ediciones).
