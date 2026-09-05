'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const hexToRgba = (hex, alpha) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

// ── Power-ups ─────────────────────────────────────────────────────────────────
const POWERUP_RADIUS       = 14;
const POWERUP_SPAWN_MIN    = 15;   // seg. mínimo entre apariciones
const POWERUP_SPAWN_MAX    = 25;   // seg. máximo entre apariciones
const TRIPLE_SHOT_DURATION = 10;   // seg. de duración del efecto
const TRIPLE_SHOT_SPREAD   = 0.22; // rad (~12.6°) entre disparos adyacentes
const SHIELD_DURATION      = 5;    // seg. de duración del escudo (o hasta recibir un golpe)
const SLOWMO_DURATION      = 6;    // seg. de duración del slow motion
const SLOWMO_FACTOR        = 0.5;  // multiplicador de velocidad de los asteroides
const HYPER_DURATION       = 8;    // seg. de duración de la hiperpropulsión
const HYPER_THRUST_MULT    = 1.8;  // multiplicador de aceleración
const HYPER_DRAG           = 0.995;// menor fricción → mayor velocidad máxima
const HYPER_ROT_MULT       = 1.3;  // multiplicador de velocidad de giro
const NOVA_FLASH_DURATION  = 0.3;  // seg. del destello al detonar la bomba nova

const POWERUP_TYPES = ['triple', 'shield', 'slow', 'nova', 'hyper'];
// Un color distinto por power-up para identificarlos de un vistazo, sin leer texto.
const POWERUP_COLORS = {
  triple: '#00ffff', // cian
  shield: '#4da6ff', // azul
  slow:   '#b388ff', // violeta
  nova:   '#ff5533', // naranja/rojo
  hyper:  '#ffee33', // amarillo
};
const randomPowerUpType = () => POWERUP_TYPES[randInt(0, POWERUP_TYPES.length - 1)];

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting       = false;
    this.invincible      = 3;
    this.shootCooldown   = 0;
    this.tripleShotTimer = 0;
    this.shieldTimer     = 0;
    this.hyperTimer      = 0;
    this.hasNovaBomb     = false;
    this.dead            = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible     > 0) this.invincible     -= dt;
    if (this.shootCooldown  > 0) this.shootCooldown  -= dt;
    if (this.tripleShotTimer > 0) this.tripleShotTimer -= dt;
    if (this.shieldTimer     > 0) this.shieldTimer     -= dt;
    if (this.hyperTimer      > 0) this.hyperTimer      -= dt;

    const hyperActive = this.hyperTimer > 0;
    const ROT    = hyperActive ? 3.5 * HYPER_ROT_MULT    : 3.5;   // rad/s
    const THRUST = hyperActive ? 260 * HYPER_THRUST_MULT : 260;   // px/s²
    const DRAG   = hyperActive ? HYPER_DRAG               : 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShotTimer > 0) {
      return [
        new Bullet(ox, oy, this.angle - TRIPLE_SHOT_SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + TRIPLE_SHOT_SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = 'rgba(255, 130, 0, 0.85)';
      ctx.stroke();
    }

    // Escudo temporal
    if (this.shieldTimer > 0) {
      const alpha = 0.45 + 0.25 * Math.sin(this.shieldTimer * 10);
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 9, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(POWERUP_COLORS.shield, alpha.toFixed(2));
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Power-ups ─────────────────────────────────────────────────────────────────
class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = POWERUP_RADIUS;
    this.dead = false;
    this.pulse = 0;
  }

  update(dt) {
    this.pulse += dt;
  }

  draw() {
    const color = POWERUP_COLORS[this.type];
    const pulseScale = 0.8 + 0.2 * Math.sin(this.pulse * 4);
    const r = this.radius * 0.5 * pulseScale;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = color;
    ctx.fillStyle   = hexToRgba(color, 0.15);
    ctx.lineWidth   = 1.5;

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    switch (this.type) {
      case 'triple': {
        const fanAngles = [-TRIPLE_SHOT_SPREAD * 2, 0, TRIPLE_SHOT_SPREAD * 2];
        for (const a of fanAngles) {
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          ctx.lineTo(Math.cos(a) * this.radius, Math.sin(a) * this.radius);
          ctx.stroke();
        }
        break;
      }
      case 'shield': {
        // Dos arcos enfrentados, como un anillo de energía partido
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.78, -0.6, 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.78, Math.PI - 0.6, Math.PI + 0.6);
        ctx.stroke();
        break;
      }
      case 'slow': {
        // Carátula de reloj con manecillas
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.78, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -this.radius * 0.55);
        ctx.moveTo(0, 0);
        ctx.lineTo(this.radius * 0.4, 0);
        ctx.stroke();
        break;
      }
      case 'nova': {
        // Estallido radial (estrella nova)
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1);
          ctx.lineTo(Math.cos(a) * this.radius, Math.sin(a) * this.radius);
          ctx.stroke();
        }
        break;
      }
      case 'hyper': {
        // Flecha/chevron indicando velocidad
        ctx.beginPath();
        ctx.moveTo(-this.radius * 0.3, -this.radius * 0.55);
        ctx.lineTo(this.radius * 0.35, 0);
        ctx.lineTo(-this.radius * 0.3, this.radius * 0.55);
        ctx.stroke();
        break;
      }
    }

    ctx.restore();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerUp;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let powerUpTimer;           // cuenta regresiva hasta la próxima aparición de power-up
let powerUpSpawnedThisLevel; // garantiza al menos una aparición por nivel
let slowMoTimer;            // efecto global de Slow Motion sobre los asteroides
let novaFlashTimer;         // destello visual al detonar la Bomba Nova

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerUp   = null;
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  powerUpTimer = rand(POWERUP_SPAWN_MIN, POWERUP_SPAWN_MAX);
  powerUpSpawnedThisLevel = false;
  slowMoTimer    = 0;
  novaFlashTimer = 0;
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  powerUpSpawnedThisLevel = false;
  // Los efectos activos de la nave sobreviven al cambio de nivel
  const { tripleShotTimer, shieldTimer, hyperTimer, hasNovaBomb } = ship;
  ship.reset();
  Object.assign(ship, { tripleShotTimer, shieldTimer, hyperTimer, hasNovaBomb });
  spawnAsteroids(3 + level);
}

function applyPowerUp(type) {
  switch (type) {
    case 'triple': ship.tripleShotTimer = TRIPLE_SHOT_DURATION; break;
    case 'shield': ship.shieldTimer     = SHIELD_DURATION;      break;
    case 'slow':   slowMoTimer          = SLOWMO_DURATION;      break;
    case 'nova':   ship.hasNovaBomb     = true;                 break;
    case 'hyper':  ship.hyperTimer      = HYPER_DURATION;       break;
  }
}

function detonateNovaBomb() {
  ship.hasNovaBomb = false;
  for (const a of asteroids) {
    score += POINTS[a.size];
    explode(a.x, a.y, a.size * 5);
  }
  asteroids = [];
  novaFlashTimer = NOVA_FLASH_DURATION;
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    const deadAsteroidDt = slowMoTimer > 0 ? dt * SLOWMO_FACTOR : dt;
    asteroids.forEach(a => a.update(deadAsteroidDt));
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  // Bomba Nova: uso único, destruye todos los asteroides en pantalla
  if (pressed('KeyB') && ship.hasNovaBomb && asteroids.length > 0) {
    detonateNovaBomb();
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  const asteroidDt = slowMoTimer > 0 ? dt * SLOWMO_FACTOR : dt;
  asteroids.forEach(a => a.update(asteroidDt));
  particles.forEach(p => p.update(dt));

  if (powerUp) powerUp.update(dt);
  if (slowMoTimer    > 0) slowMoTimer    -= dt;
  if (novaFlashTimer > 0) novaFlashTimer -= dt;

  // Aparición de power-up (solo si no hay uno activo/sin recoger)
  if (!powerUp) {
    powerUpTimer -= dt;
    if (powerUpTimer <= 0) {
      powerUp = new PowerUp(rand(40, W - 40), rand(40, H - 40), randomPowerUpType());
      powerUpTimer = rand(POWERUP_SPAWN_MIN, POWERUP_SPAWN_MAX);
      powerUpSpawnedThisLevel = true;
    }
  }

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        if (ship.shieldTimer > 0) {
          // El escudo absorbe el impacto: la nave sobrevive, se consume el escudo
          ship.shieldTimer = 0;
          ship.invincible  = 0.6;
          explode(ship.x, ship.y, 6);
        } else {
          killShip();
        }
        break;
      }
    }
  }

  // Nave vs power-up
  if (powerUp && !powerUp.dead && dist(ship, powerUp) < ship.radius + powerUp.radius) {
    powerUp.dead = true;
    applyPowerUp(powerUp.type);
  }
  if (powerUp && powerUp.dead) powerUp = null;

  // Garantiza al menos una aparición de power-up por nivel
  if (asteroids.length === 0 && !powerUp && !powerUpSpawnedThisLevel) {
    powerUp = new PowerUp(rand(40, W - 40), rand(40, H - 40), randomPowerUpType());
    powerUpSpawnedThisLevel = true;
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  ctx.textAlign = 'left';
  ctx.font = '13px monospace';
  let hudY = 48;
  if (ship.tripleShotTimer > 0) {
    ctx.fillStyle = POWERUP_COLORS.triple;
    ctx.fillText(`TRIPLE ${ship.tripleShotTimer.toFixed(1)}s`, 14, hudY);
    hudY += 16;
  }
  if (ship.shieldTimer > 0) {
    ctx.fillStyle = POWERUP_COLORS.shield;
    ctx.fillText(`ESCUDO ${ship.shieldTimer.toFixed(1)}s`, 14, hudY);
    hudY += 16;
  }
  if (slowMoTimer > 0) {
    ctx.fillStyle = POWERUP_COLORS.slow;
    ctx.fillText(`SLOW-MO ${slowMoTimer.toFixed(1)}s`, 14, hudY);
    hudY += 16;
  }
  if (ship.hyperTimer > 0) {
    ctx.fillStyle = POWERUP_COLORS.hyper;
    ctx.fillText(`HIPERPROPULSIÓN ${ship.hyperTimer.toFixed(1)}s`, 14, hudY);
    hudY += 16;
  }
  if (ship.hasNovaBomb) {
    ctx.fillStyle = POWERUP_COLORS.nova;
    ctx.fillText('BOMBA NOVA LISTA [B]', 14, hudY);
    hudY += 16;
  }
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  if (powerUp) powerUp.draw();
  bullets.forEach(b => b.draw());
  ship.draw();

  if (novaFlashTimer > 0) {
    ctx.fillStyle = hexToRgba('#ffffff', (novaFlashTimer / NOVA_FLASH_DURATION * 0.5).toFixed(2));
    ctx.fillRect(0, 0, W, H);
  }

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
