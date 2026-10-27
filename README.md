# 🏀 Canasta Infinita

Prototipo de juego **incremental** de baloncesto: cada "día" tienes 60 segundos para encestar, ganas puntos y al final del día los gastas en mejoras para que el día siguiente rinda más.

Para jugar: abre `index.html` en cualquier navegador (no hay que instalar nada).

## Cómo se juega

- Clic, toque o **Espacio** para lanzar cuando la flecha del medidor esté en la **zona verde**.
- Centro exacto (verde claro) = **tiro limpio**, vale +50%.
- Empiezas con 6 balones. Si metes **todos** los del carro, se recarga gratis al instante; si fallas alguno, toca esperar la recarga.
- Al acabar el día salen las estadísticas y la tienda de mejoras.

## Cómo está hecho

**No usa ninguna librería ni motor.** Es un solo archivo, `index.html`, con HTML, CSS y **JavaScript puro** (vanilla JS). Todo lo que hace lo hace con funciones que ya trae el navegador:

| Qué | Con qué (API del navegador) |
|---|---|
| Dibujar el juego | **Canvas 2D** (`<canvas>` + `getContext('2d')`) |
| Animación | `requestAnimationFrame` (bucle a ~60 fps) |
| Sonidos | **Web Audio API** (`AudioContext` + osciladores) |
| Guardar la partida | `localStorage` |
| Tienda y estadísticas | HTML + CSS normales encima del canvas |

### El bucle del juego

Cada fotograma se llama a `loop()`, que hace dos cosas:

1. `update(dt)`: mueve todo según el tiempo pasado (`dt`, en segundos): baja el reloj del día, mueve la flecha del medidor arriba y abajo, avanza los balones, las partículas y los textos flotantes, y gestiona la recarga y el compañero.
2. `draw()`: borra y vuelve a pintar la escena entera: fondo, suelo, canasta, jugadores, balones, medidor y marcador.

### Los tiros

Cuando pulsas, `shoot()` mira **dónde está la flecha** del medidor. Si está dentro de la zona verde, es canasta; si no, fallo. El resultado se decide **en el momento de lanzar**, y luego el balón solo hace la animación:

- Vuela en **parábola** desde el jugador hasta el aro (interpolación lineal en X + una curva `4·p·(1-p)` para la altura).
- Si entra, cae por la red y suma puntos (`scoreBall`). Si falla, rebota en el aro con una física sencilla (gravedad + rebote en el suelo).

### Las mejoras

Todo el balance está en dos tablas al principio del script, así se puede ajustar sin tocar la lógica:

- `UPS`: cada mejora con su coste base (`base`), cuánto se encarece por nivel (`g`) y nivel máximo (`max`). Coste = `base × g^nivel`.
- `DIST`: las distancias de tiro, su posición en pantalla y los puntos por canasta.

Mejoras: Puntería, Distancia, Más balones, Recarga rápida, Puntos x2, Doble tiro, Suerte (balón dorado x5), Compañero y Día más largo.

### Cómo salen los sonidos

No hay archivos de audio (ni `.mp3` ni `.wav`). Los sonidos **se generan en el momento** con la Web Audio API, en la función `beep()`:

```js
const o = AC.createOscillator();   // genera una onda (el "pitido")
const g = AC.createGain();         // controla el volumen
o.type = 'square';                 // forma de onda: square, triangle, sawtooth...
o.frequency.value = 660;           // tono en hercios (más alto = más agudo)
g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + 0.08); // se apaga rápido
o.connect(g); g.connect(AC.destination); // oscilador → volumen → altavoces
o.start(); o.stop(AC.currentTime + 0.08);
```

Así suena cada cosa:

- **Lanzar**: onda triangular grave (220 Hz).
- **Canasta**: dos pitidos seguidos que suben (660 → 880 Hz), estilo arcade. Con balón dorado, más agudos.
- **Fallo**: onda "sawtooth" muy grave (120 Hz), suena a golpe en el aro.
- **Carro perfecto / comprar mejora / recarga**: otros pitidos cortos.

Los navegadores no dejan reproducir sonido hasta que el jugador toca algo, por eso el `AudioContext` se crea en el primer lanzamiento.

### Guardado

La partida (puntos, día y niveles de mejora) se guarda en `localStorage` del navegador al final de cada día y al comprar. Es por navegador: si lo abres en otro móvil u ordenador, empiezas de cero.

### Formato de números

`fmt()` convierte los números grandes a 1.2K, 3.4M, 5.6B…, típico de los juegos incrementales.

## Publicación

El sitio es estático, así que Netlify lo sirve tal cual (`netlify.toml` publica la carpeta raíz, sin paso de build).
