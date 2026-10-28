# 🏀 CanastaMan

Juego **incremental** de baloncesto: cada "día" tienes 30 segundos para encestar, ganas puntos y al final del día los gastas en mejoras para que el día siguiente rinda más.

- **Jugar online:** https://canastaman.netlify.app
- `index.html`: versión **2D** (la principal): pulsas cuando la flecha está en la zona verde.
- `3d.html`: versión **3D**, se lanza deslizando el dedo.

Las dos tienen el mismo modo carrera, días de 30 s y los mismos precios.

## Modo carrera

- Al empezar **creas tu personaje**: nombre, número de camiseta y tono de piel.
- Empiezas en la **cancha del barrio**. Cada liga tiene un **objetivo**: hacer X puntos en un solo día.
- Si lo cumples, **un cazatalentos te hace una oferta** y decides si la aceptas o no.
- Al aceptar cambias de equipo: **camiseta nueva** (con tu nombre y dorsal en la espalda), **cancha nueva** y cada canasta vale más. Las mejoras se quedan.

| Liga | Equipo | Canasta vale | Objetivo para subir |
|---|---|---|---|
| Cancha del barrio | Barrio | x1 | 120 pts en un día |
| Liga de Secundaria | Halcones | x1,5 | 3.500 |
| Liga Universitaria | Toros | x2 | 50.000 |
| Liga Profesional | Titanes | x3 | 250.000 |
| Liga de Leyendas | Leyendas | x4 | 450.000 para ganar el campeonato 🏆 |

Al ganar el campeonato sale la pantalla final con los días que tardaste, y puedes seguir jugando.

El balance está calculado con un simulador que juega tiro a tiro con todas las mecánicas (zona verde, velocidad del medidor, fuego, últimos segundos, dorados, compañero y partido). Un jugador medio llega a Leyendas hacia el día 37 y es campeón hacia el día 45; uno muy bueno, hacia el día 20.

**Dificultad:** la flecha del medidor va más rápido cuanto más lejos tiras y más alta es la liga. El fuego dura 6 segundos y te vuelves a encender cada 10 canastas seguidas. El balón dorado sale como máximo un 17% de las veces.

**Compañeros:** al comprar la mejora Compañero eliges quién juega contigo: **Nico** (tirador, casi no falla), **Flash** (rápido), **Lucky** (suertudo, desde los Halcones) o **Capi** (capitán: tus canastas +20% y fuego más largo, desde los Toros).

Las ligas están en la tabla `STAGES` del código.

## Más cosas del juego (versión 2D)

- **Racha en llamas 🔥:** con 10 canastas seguidas te enciendes y todo vale x2 hasta que falles (`FIRE_AT`).
- **Partido contra un rival:** cada día juegas contra un equipo (Los del Parque, Lobos, Panteras, Dragones, Titanes Dorados). El marcador va arriba: cada canasta vale 2, o 3 desde la línea de triple. El rival anota a un ritmo calculado según tus mejoras (`RIVAL_LEVEL`). Si ganas, te llevas un bono del 50% de lo ganado ese día.
- **Ranking online:** "Mejor día" y "Campeón más rápido". Lo guarda una función de Netlify (`netlify/functions/ranking.mjs`) en Netlify Blobs y se consulta en `/api/ranking`.
- **Compartir por WhatsApp:** botón que manda tu récord con el enlace. El enlace muestra una vista previa con imagen (`og-image.png`) gracias a las etiquetas Open Graph.

## Cómo se juega (3D)

- **Desliza el dedo hacia arriba** (o arrastra con el ratón) para lanzar. Cuanto más largo el gesto, más fuerza: deslizar un 28% de la pantalla es la fuerza ideal. Si lo deslizas torcido, el tiro sale torcido.
- Mientras deslizas, a la derecha sale una **barra de fuerza con la zona verde** y una **guía de puntos** con el principio de la trayectoria.
- En PC también puedes **mantener Espacio** (la fuerza sube y baja) y soltarlo para lanzar recto.
- **Canasta limpia** (sin tocar aro ni tablero): +50%. **De tablero**: +25%. **Balón dorado**: x5.
- Empiezas con 6 balones. Si metes **todos** los del carro, se recarga gratis al instante.

## Cómo está hecho

La versión 2D (`index.html`) no usa ninguna librería: dibuja con **Canvas 2D** del navegador. La versión 3D es un solo archivo, `3d.html`, con HTML, CSS y **JavaScript**, y usa una sola librería:

| Qué | Con qué |
|---|---|
| Gráficos 3D | **Three.js** 0.160 (se carga desde el CDN jsDelivr) |
| Física del balón | Escrita a mano (gravedad, rebotes en aro, tablero y suelo) |
| Sonidos | **Web Audio API** del navegador, sin archivos de audio |
| Guardar la partida | `localStorage` |
| Marcador, tienda y estadísticas | HTML + CSS encima del 3D |

### La escena

Todo está hecho con figuras de Three.js, sin modelos descargados: estilo **low-poly**.

- **Pista:** un plano con una textura dibujada en un `<canvas>` (zona, línea de tiro libre, triple, círculo central y las marcas de distancia).
- **Canasta:** poste, tablero (`BoxGeometry`), aro (`TorusGeometry`) y red (`LineSegments`), que se estira cuando encestas.
- **Jugadores:** cajas y esferas. Los brazos giran desde el hombro para la animación de lanzar.
- **Ciudad de fondo:** cajas con una textura de ventanas que brillan (`emissiveMap`), cielo de atardecer, valla metálica y árboles.
- **Luz:** una luz de ambiente y un "sol" que proyecta sombras.

Todas las medidas son reales, en metros: el aro está a 3,05 m, tiene 23 cm de radio y el balón 12 cm.

### La física del tiro

1. `shotVel()` calcula la **velocidad ideal** para que el balón caiga justo en el centro del aro desde donde estás (fórmula del tiro parabólico con un ángulo de 48–52°).
2. Tu gesto da un **error de fuerza** (gesto más corto o más largo que el ideal) y un **error de dirección** (gesto torcido).
3. La mejora de **Puntería** reduce esos errores: `effS()` y `effYaw()` acercan tu tiro al ideal.
4. El balón vuela con física real en `stepBall()`, en 6 pasos pequeños por fotograma para que no atraviese el aro:
   - **Tablero:** rebota y pierde energía.
   - **Aro:** busca el punto del aro más cercano al balón y lo hace rebotar en esa dirección. Por eso a veces el balón da vueltas por el aro y entra o sale.
   - **Canasta:** cuenta cuando el balón cruza hacia abajo el plano del aro por dentro.
   - **Suelo:** bota y se frena.

La **zona verde** de la barra no es inventada: al empezar el día, `computeZone()` simula cientos de tiros con distintas fuerzas y marca cuáles entran.

### Las mejoras

Todo el balance está en tablas al principio del script, para ajustarlo sin tocar la lógica:

- `UPS`: cada mejora con su coste base (`base`), cuánto se encarece por nivel (`g`) y nivel máximo (`max`). Coste = `base × g^nivel`.
- `DIST`: las distancias de tiro reales (de 4,6 m de tiro libre a 12,8 m de medio campo) y los puntos por canasta.
- `powAssist`, `yawAssist` y `guideFrac`: cuánto ayuda la Puntería y cuánto se ve de la guía.

El día dura 30 s (`DAY_BASE`) y la mejora Día más largo suma 5 s por nivel (`DAY_STEP`).

Mejoras: Puntería, Distancia, Más balones, Recarga rápida, Multiplicador (x1 a x21), Doble tiro, Suerte (balón dorado x5), Compañero y Día más largo.

### Cómo salen los sonidos

No hay archivos de audio. Los sonidos **se generan en el momento** con la Web Audio API:

- `beep()`: un **oscilador** genera una onda con un tono (en hercios) y el volumen se apaga rápido. Así salen el lanzamiento, los pitidos de canasta (660 → 880 Hz), el golpe del tablero y el "clang" del aro.
- `noise()`: el **swish de la red**. Genera ruido aleatorio y lo pasa por un filtro (`BiquadFilter`) que deja solo los agudos, como el sonido de la red al pasar el balón.

```js
const o = AC.createOscillator();   // genera una onda (el "pitido")
const g = AC.createGain();         // controla el volumen
o.type = 'square';                 // forma de onda: square, triangle, sawtooth, sine
o.frequency.value = 660;           // tono en hercios (más alto = más agudo)
g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + 0.08); // se apaga rápido
o.connect(g); g.connect(AC.destination); // oscilador → volumen → altavoces
```

Los navegadores no dejan sonar nada hasta que el jugador toca la pantalla, por eso el audio se activa al empezar el día.

### Guardado

La partida (puntos, día y niveles de mejora) se guarda en `localStorage` al final de cada día y al comprar. Es por navegador: en otro móvil u ordenador se empieza de cero. Las versiones 3D y 2D tienen partidas separadas.

## Probarlo en local

Por usar módulos de JavaScript, la versión 3D necesita un servidor (abrir el archivo con doble clic puede no funcionar):

```bash
npx http-server -p 5180
```

y abrir http://localhost:5180

## Publicación

La web es estática y Netlify la sirve tal cual (`netlify.toml` publica la carpeta raíz). El ranking es una función de Netlify; para subir todo:

```bash
npm install
npx netlify-cli deploy --prod --dir=. --functions=netlify/functions
```

---

Hecho con ❤️ por Gonzalo Dario Riveros Plaza
