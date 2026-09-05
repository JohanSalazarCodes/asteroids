# Asteroids

Clon del clásico arcade **Asteroids** implementado en canvas HTML5 puro, sin dependencias ni bundler.

## Demo:

[Asteroids demo](https://klerith.github.io/claude-asteroids/)

## Descripción del juego

Nave espacial en un campo de asteroides con envolvimiento de bordes (el espacio es toroidal). Destruye asteroides para sumar puntos: los grandes se parten en medianos, los medianos en pequeños. Incluye power-ups especiales y tipos de asteroides únicos como la estrella fugaz...

## Tecnologías

- **HTML5 Canvas** — renderizado 2D
- **JavaScript (ES6+)** — lógica del juego en un solo archivo `game.js`
- Sin frameworks, sin bundler, sin dependencias

## Cómo correr

Abre `index.html` directamente en el navegador (doble clic), o usa un servidor local:

```bash
npx serve .
```

Luego visita `http://localhost:3000`.

## Controles

| Tecla     | Acción                          |
| --------- | ------------------------------- |
| `←` `→`   | Rotar nave                      |
| `↑`       | Propulsar                       |
| `Espacio` | Disparar                        |
| `B`       | Activar Bomba Nova (si se tiene)|

## Puntuación

| Asteroide | Puntos |
| --------- | ------ |
| Grande    | 20     |
| Mediano   | 50     |
| Pequeño   | 100    |

## Power-ups

Aparecen aleatoriamente (no todos en el mismo nivel); cada uno tiene un color propio para identificarlo a simple vista.

| Power-up          | Color    | Efecto                                                                 |
| ------------------ | -------- | ----------------------------------------------------------------------- |
| Disparo Triple      | Cian     | Dispara 3 balas en abanico durante 10s                                  |
| Escudo Temporal     | Azul     | Absorbe un impacto de asteroide; dura 5s o hasta recibir un golpe       |
| Slow Motion         | Violeta  | Los asteroides se mueven a mitad de velocidad durante 6s                |
| Bomba Nova          | Naranja  | Ítem de un solo uso: al presionar `B` destruye todos los asteroides en pantalla |
| Hiperpropulsión     | Amarillo | Aceleración y velocidad máxima muy superiores durante 8s                |

## Características

- 3 vidas con invencibilidad temporal al reaparecer (parpadeo)
- Asteroides se parten en fragmentos más pequeños al ser destruidos
- Partículas de explosión al destruir asteroides
