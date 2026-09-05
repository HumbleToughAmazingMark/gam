const canvas = document.querySelector('#gameCanvas');
const context = canvas.getContext('2d');
const roundStatus = document.querySelector('#roundStatus');
const gameMessage = document.querySelector('#gameMessage');
const blueHealth = document.querySelector('#blueHealth');
const redHealth = document.querySelector('#redHealth');
const blueHealthBar = document.querySelector('#blueHealthBar');
const redHealthBar = document.querySelector('#redHealthBar');
const arenaLabel = document.querySelector('#arenaLabel');
const blueParryCooldown = document.querySelector('#blueParryCooldown');
const redParryCooldown = document.querySelector('#redParryCooldown');
const blueDashCooldown = document.querySelector('#blueDashCooldown');
const redDashCooldown = document.querySelector('#redDashCooldown');
const canvasWrap = document.querySelector('.canvas-wrap');
const fullscreenButton = document.querySelector('#fullscreenButton');
const keys = new Set();
const lastTap = new Map();
const effects = [];

const GRAVITY = 0.496;
const GROUND = 683;
const CEILING = 40;
const PLAYER_RADIUS = 16.38;
const MOVE_SPEED = 7.56;
const WORLD_WIDTH = 1955;
const WALL_WIDTH = 30;
const WALL_TOP = 80;
const WALL_SLIDE_SPEED = 1.65;
const PLATFORM_CLEARANCE = 90;
let gameOver = false;
let screenShake = 0;
let arenaIndex = 0;
let nextRoundTimer = 0;
let arena = null;
let camera = { x: WORLD_WIDTH / 2, y: 360, zoom: 1 };
let freezeTimer = 0;
let powerupSpawnTimer = 2400;

const arenaThemes = [
	{ name: 'CONCRETE GRID', sky: ['#e7eef0', '#b8c7c9'], floor: '#283139', stripe: '#f1c84b', grid: 'rgba(22, 23, 27, .1)' },
	{ name: 'SUNSET CIRCUIT', sky: ['#f4c3a1', '#bb7181'], floor: '#332e43', stripe: '#77e6d0', grid: 'rgba(255, 244, 214, .17)' },
	{ name: 'NIGHT DOCKS', sky: ['#526d88', '#1d2a42'], floor: '#151c29', stripe: '#ef4d45', grid: 'rgba(210, 232, 255, .14)' },
	{ name: 'LIME FACTORY', sky: ['#d9e6b2', '#8eae91'], floor: '#263b38', stripe: '#f1c84b', grid: 'rgba(22, 23, 27, .13)' }
];

const blue = createFighter({ name: 'BLUE', x: 270, color: '#2375ff', accent: '#bcd5ff', left: 'a', right: 'd', jump: 'w', down: 's', parry: 's', attack: 'f' });
const red = createFighter({ name: 'RED', x: 1230, color: '#ef4d45', accent: '#ffd0c9', left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', down: 'ArrowDown', parry: 'ArrowDown', attack: '/' });
const fighters = [blue, red];

function createFighter(options) {
	return { ...options, y: GROUND - PLAYER_RADIUS, radius: PLAYER_RADIUS, vx: 0, vy: 0, health: 100, grounded: true, wallSide: 0, jumpsRemaining: 2, facing: options.name === 'BLUE' ? 1 : -1, attackTimer: 0, parryTimer: 0, parryCooldown: 0, contactCooldown: 0, dashTimer: 0, dashCooldown: 0, dashVector: { x: 0, y: 0 }, stunTimer: 0, flashTimer: 0, criticalTimer: 0, powerup: null, powerupTimer: 0 };
}

function randomBetween(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function createArena() {
	const platformCount = randomBetween(3, 9);
	const platforms = [
		{ x: 150, y: GROUND - 190, width: 250, height: 26, spawn: true },
		{ x: WORLD_WIDTH - 400, y: GROUND - 190, width: 250, height: 26, spawn: true }
	];
	let attempts = 0;
	while (platforms.length < platformCount && attempts < 1000) {
		attempts++;
		const width = randomBetween(130, 250);
		const x = randomBetween(WALL_WIDTH + 45, WORLD_WIDTH - WALL_WIDTH - width - 45);
		const y = randomBetween(185, GROUND - 140);
		const vertical = Math.random() < 0.2;
		const candidate = vertical ? { x, y, width: 24, height: randomBetween(100, 190), vertical: true } : { x, y, width, height: 24, vertical: false };
		if (platforms.every((platform) => platformGap(platform, candidate) >= PLATFORM_CLEARANCE)) platforms.push(candidate);
	}
	return { ...arenaThemes[arenaIndex], platforms, lava: Math.random() < 0.5 };
}

function platformGap(first, second) {
	const horizontalGap = Math.max(first.x - (second.x + second.width), second.x - (first.x + first.width), 0);
	const verticalGap = Math.max(first.y - (second.y + second.height), second.y - (first.y + first.height), 0);
	return Math.hypot(horizontalGap, verticalGap);
}

function resetFighter(fighter, spawnPlatform) {
	Object.assign(fighter, createFighter({ ...fighter, x: spawnPlatform.x + spawnPlatform.width / 2 }));
	fighter.y = spawnPlatform.y - fighter.radius;
}

function startArena(advance = false) {
	if (advance) arenaIndex = (arenaIndex + 1) % arenaThemes.length;
	arena = createArena();
	arena.powerup = null;
	resetFighter(blue, arena.platforms[0]);
	resetFighter(red, arena.platforms[1]);
	gameOver = false;
	nextRoundTimer = 0;
	gameMessage.hidden = true;
	roundStatus.textContent = 'FIGHT';
	arenaLabel.textContent = `ARENA ${String(arenaIndex + 1).padStart(2, '0')} // ${arena.name}${arena.lava ? ' // LAVA FLOOR' : ''}`;
	effects.length = 0;
	powerupSpawnTimer = 2400;
	updateHealth();
	updateCooldowns();
}

window.addEventListener('keydown', (event) => {
	const key = event.key.toLowerCase();
	const fighterKeys = ['w', 'a', 's', 'd', 'f', 'r', '/', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
	if (fighterKeys.includes(key)) event.preventDefault();
	if (key === 'r' && gameOver) startArena();
	if (event.repeat || keys.has(key) || gameOver) return;
	keys.add(key);
	for (const fighter of fighters) handlePress(fighter, key);
});
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
document.querySelector('#resetButton').addEventListener('click', () => startArena());
fullscreenButton.addEventListener('click', async () => {
		if (document.fullscreenElement) await document.exitFullscreen();
		else await canvasWrap.requestFullscreen();
});

function getInputVector(fighter) {
	const horizontal = (keys.has(fighter.right) ? 1 : 0) - (keys.has(fighter.left) ? 1 : 0);
	const vertical = (keys.has(fighter.down) ? 1 : 0) - (keys.has(fighter.jump) ? 1 : 0);
	const length = Math.hypot(horizontal, vertical) || 1;
	return { x: horizontal / length, y: vertical / length };
}

function handlePress(fighter, key) {
	if (key === fighter.jump && fighter.stunTimer <= 0) attemptJump(fighter);
	if (key === fighter.parry && fighter.stunTimer <= 0 && fighter.parryCooldown <= 0) { fighter.parryTimer = 18; fighter.parryCooldown = 300; }
	if (key === fighter.attack && fighter.stunTimer <= 0 && fighter.attackTimer <= 0) fighter.attackTimer = 24;
	if ([fighter.left, fighter.right, fighter.jump, fighter.down].includes(key)) {
		const now = performance.now();
		const previous = lastTap.get(`${fighter.name}-${key}`) || 0;
		if (now - previous < 260 && fighter.stunTimer <= 0) startDash(fighter);
		lastTap.set(`${fighter.name}-${key}`, now);
	}
}

function attemptJump(fighter) {
	if (fighter.wallSide) {
		fighter.vy = -10.8375;
		fighter.vx = -fighter.wallSide * 9;
		fighter.jumpsRemaining = 1;
		emitEffect(fighter.x - fighter.wallSide * fighter.radius, fighter.y, fighter.accent, 'wallJump');
	} else if (fighter.grounded) {
		fighter.vy = -10.8375;
		fighter.grounded = false;
		fighter.jumpsRemaining = 1;
		emitEffect(fighter.x, fighter.y + fighter.radius, fighter.accent, 'jump');
	} else if (fighter.jumpsRemaining > 0) {
		fighter.vy = -10.115;
		fighter.jumpsRemaining--;
		emitEffect(fighter.x, fighter.y + fighter.radius, fighter.accent, 'jump');
	}
}

function startDash(fighter) {
	const vector = getInputVector(fighter);
	if ((!vector.x && !vector.y) || fighter.dashCooldown > 0) return;
	fighter.dashTimer = 11;
	fighter.dashCooldown = 300;
	fighter.dashVector = vector;
	fighter.facing = vector.x || fighter.facing;
	emitEffect(fighter.x, fighter.y, fighter.accent, 'dash');
	screenShake = 4;
}

function update() {
	if (freezeTimer > 0) freezeTimer--;
	if (!gameOver && freezeTimer === 0) {
		for (const fighter of fighters) updateFighter(fighter);
		resolveFighterContact();
		stabilizeFighter(blue);
		stabilizeFighter(red);
		updatePowerup();
		resolveAttack(blue, red);
		resolveAttack(red, blue);
		if (blue.health <= 0 || red.health <= 0) finishRound();
	} else if (nextRoundTimer > 0 && --nextRoundTimer === 0) startArena(true);
	updateEffects();
	updateCooldowns();
	updateCamera();
	screenShake *= 0.82;
	draw();
	requestAnimationFrame(update);
}

function updateFighter(fighter) {
	const previousX = fighter.x;
	const previousY = fighter.y;
	const previousBottom = fighter.y + fighter.radius;
	const movingLeft = keys.has(fighter.left);
	const movingRight = keys.has(fighter.right);
	const direction = movingLeft === movingRight ? 0 : movingLeft ? -1 : 1;
	if (fighter.stunTimer > 0) fighter.stunTimer--;
	if (fighter.attackTimer > 0) fighter.attackTimer--;
	else fighter.hitThisSwing = false;
	if (fighter.parryTimer > 0) fighter.parryTimer--;
	if (fighter.parryCooldown > 0) fighter.parryCooldown--;
	if (fighter.contactCooldown > 0) fighter.contactCooldown--;
	if (fighter.dashCooldown > 0) fighter.dashCooldown--;
	if (fighter.flashTimer > 0) fighter.flashTimer--;
	if (fighter.criticalTimer > 0) fighter.criticalTimer--;
	if (fighter.dashTimer > 0) {
		fighter.dashTimer--;
		fighter.vx = fighter.dashVector.x * 17;
		fighter.vy = fighter.dashVector.y * 17;
	} else if (fighter.stunTimer <= 0) {
		fighter.vx = direction * MOVE_SPEED;
		if (direction) fighter.facing = direction;
	}
	fighter.vy += GRAVITY;
	fighter.x += fighter.vx;
	fighter.y += fighter.vy;
	if (fighter.y - fighter.radius <= CEILING) { fighter.y = CEILING + fighter.radius; fighter.vy = Math.abs(fighter.vy) * 0.35; }
	fighter.wallSide = 0;
	if (fighter.x <= WALL_WIDTH + fighter.radius) { fighter.x = WALL_WIDTH + fighter.radius; fighter.wallSide = -1; fighter.jumpsRemaining = 2; }
	if (fighter.x >= WORLD_WIDTH - WALL_WIDTH - fighter.radius) { fighter.x = WORLD_WIDTH - WALL_WIDTH - fighter.radius; fighter.wallSide = 1; fighter.jumpsRemaining = 2; }
	resolveSolidPlatforms(fighter, previousX, previousY);
	if (fighter.wallSide && !fighter.grounded && fighter.vy > WALL_SLIDE_SPEED) fighter.vy = WALL_SLIDE_SPEED;
	if (arena.lava && fighter.y - fighter.radius > GROUND + 42) {
		fighter.health = 0;
		updateHealth();
	}
}

function resolveFighterContact() {
	const deltaX = red.x - blue.x;
	const deltaY = red.y - blue.y;
	const distance = Math.hypot(deltaX, deltaY);
	const minimumDistance = blue.radius + red.radius;
	if (distance >= minimumDistance) return;
	const normalX = distance ? deltaX / distance : 1;
	const normalY = distance ? deltaY / distance : 0;
	const overlap = minimumDistance - distance;
	blue.x -= normalX * overlap / 2;
	blue.y -= normalY * overlap / 2;
	red.x += normalX * overlap / 2;
	red.y += normalY * overlap / 2;
	blue.vx -= normalX * 3;
	blue.vy -= normalY * 3;
	red.vx += normalX * 3;
	red.vy += normalY * 3;
	if (blue.contactCooldown > 0 || red.contactCooldown > 0) return;
	blue.health = Math.max(0, blue.health - 1);
	red.health = Math.max(0, red.health - 1);
	blue.contactCooldown = 12;
	red.contactCooldown = 12;
	roundStatus.textContent = 'PLAYER CLASH';
	updateHealth();
}

function stabilizeFighter(fighter) {
	if (fighter.x < WALL_WIDTH + fighter.radius) fighter.x = WALL_WIDTH + fighter.radius;
	if (fighter.x > WORLD_WIDTH - WALL_WIDTH - fighter.radius) fighter.x = WORLD_WIDTH - WALL_WIDTH - fighter.radius;
	if (fighter.y < CEILING + fighter.radius) { fighter.y = CEILING + fighter.radius; fighter.vy = Math.max(0, fighter.vy); }
	if (!arena.lava && fighter.y > GROUND - fighter.radius) { fighter.y = GROUND - fighter.radius; fighter.vy = 0; fighter.grounded = true; fighter.jumpsRemaining = 2; }

	for (const platform of arena.platforms) {
		const horizontalOverlap = Math.min(fighter.x + fighter.radius, platform.x + platform.width) - Math.max(fighter.x - fighter.radius, platform.x);
		const verticalOverlap = Math.min(fighter.y + fighter.radius, platform.y + platform.height) - Math.max(fighter.y - fighter.radius, platform.y);
		if (horizontalOverlap <= 0 || verticalOverlap <= 0) continue;
		if (verticalOverlap <= horizontalOverlap) {
			if (fighter.y < platform.y + platform.height / 2) {
				fighter.y = platform.y - fighter.radius;
				fighter.vy = Math.min(0, fighter.vy);
				fighter.grounded = true;
				fighter.jumpsRemaining = 2;
			} else {
				fighter.y = platform.y + platform.height + fighter.radius;
				fighter.vy = Math.max(0, fighter.vy);
			}
		} else if (fighter.x < platform.x + platform.width / 2) {
			fighter.x = platform.x - fighter.radius;
			fighter.vx = Math.min(0, fighter.vx);
			fighter.wallSide = -1;
			fighter.jumpsRemaining = 2;
		} else {
			fighter.x = platform.x + platform.width + fighter.radius;
			fighter.vx = Math.max(0, fighter.vx);
			fighter.wallSide = 1;
			fighter.jumpsRemaining = 2;
		}
	}
}

function resolveSolidPlatforms(fighter, previousX, previousY) {
	fighter.grounded = false;
	for (const platform of arena.platforms) {
		const overlapsX = fighter.x + fighter.radius > platform.x && fighter.x - fighter.radius < platform.x + platform.width;
		const overlapsY = fighter.y + fighter.radius > platform.y && fighter.y - fighter.radius < platform.y + platform.height;
		if (!overlapsX || !overlapsY) continue;

		const previousBottom = previousY + fighter.radius;
		const previousTop = previousY - fighter.radius;
		const previousRight = previousX + fighter.radius;
		const previousLeft = previousX - fighter.radius;
		const landedOnTop = previousBottom <= platform.y && fighter.y + fighter.radius >= platform.y;
		const hitUnderside = previousTop >= platform.y + platform.height && fighter.y - fighter.radius <= platform.y + platform.height;
		const hitFromLeft = previousRight <= platform.x && fighter.x + fighter.radius >= platform.x;
		const hitFromRight = previousLeft >= platform.x + platform.width && fighter.x - fighter.radius <= platform.x + platform.width;

		if (landedOnTop && overlapsX) {
			fighter.y = platform.y - fighter.radius;
			fighter.vy = 0;
			fighter.grounded = true;
			fighter.jumpsRemaining = 2;
		} else if (hitUnderside && overlapsX) {
			fighter.y = platform.y + platform.height + fighter.radius;
			fighter.vy = 0;
		} else if (hitFromLeft && overlapsY) {
			fighter.x = platform.x - fighter.radius;
			fighter.vx = 0;
			fighter.wallSide = -1;
			fighter.jumpsRemaining = 2;
		} else if (hitFromRight && overlapsY) {
			fighter.x = platform.x + platform.width + fighter.radius;
			fighter.vx = 0;
			fighter.wallSide = 1;
			fighter.jumpsRemaining = 2;
		}
	}
	if (!arena.lava && previousY + fighter.radius <= GROUND && fighter.y + fighter.radius >= GROUND) {
		fighter.y = GROUND - fighter.radius;
		fighter.vy = 0;
		fighter.grounded = true;
		fighter.jumpsRemaining = 2;
	}
}

function resolveAttack(attacker, defender) {
	const attackActive = attacker.attackTimer <= 16 && attacker.attackTimer >= 7;
	if (!attackActive || attacker.hitThisSwing) return;
	const distance = Math.hypot(attacker.x - defender.x, attacker.y - defender.y);
	if (distance > 145) return;
	attacker.hitThisSwing = true;
	if (defender.parryTimer > 0 && attacker.powerup !== 'green') {
		attacker.stunTimer = 42;
		attacker.vx = -attacker.facing * 8;
		defender.flashTimer = 14;
		roundStatus.textContent = `${defender.name} PARRIED`;
		screenShake = 7;
		emitEffect(defender.x, defender.y, '#f1c84b', 'parry');
		defender.health = Math.min(100, defender.health + 15);
		freezeTimer = 10;
		updateHealth();
	} else {
		const critical = Math.floor(Math.random() * 24) === 0;
		const damage = randomBetween(10, 20) * (critical ? 2 : 1) * (attacker.powerup === 'yellow' ? 2 : 1);
		defender.health = Math.max(0, defender.health - damage);
		defender.vx = attacker.facing * (critical ? 13 : 10);
		defender.vy = -7;
		defender.flashTimer = 10;
		defender.criticalTimer = critical ? 55 : 0;
		emitHitSparks(defender, critical ? 12 : 6);
		roundStatus.textContent = `${attacker.name} HIT`;
		if (critical) roundStatus.textContent = 'CRITICAL HIT';
		screenShake = 5;
		updateHealth();
	}
}

function finishRound() {
	if (gameOver) return;
	gameOver = true;
	nextRoundTimer = 105;
	const winner = blue.health > 0 ? blue : red;
	roundStatus.textContent = 'ROUND OVER';
	gameMessage.textContent = `${winner.name} WINS`;
	gameMessage.hidden = false;
	arenaLabel.textContent = `NEXT ARENA LOADING // ${arenaThemes[(arenaIndex + 1) % arenaThemes.length].name}`;
}

function updateHealth() {
	blueHealth.textContent = Math.ceil(blue.health);
	redHealth.textContent = Math.ceil(red.health);
	blueHealthBar.style.width = `${blue.health}%`;
	redHealthBar.style.width = `${red.health}%`;
	blueHealthBar.classList.toggle('powerup-pulse-yellow', blue.powerup === 'yellow');
	blueHealthBar.classList.toggle('powerup-pulse-green', blue.powerup === 'green');
	redHealthBar.classList.toggle('powerup-pulse-yellow', red.powerup === 'yellow');
	redHealthBar.classList.toggle('powerup-pulse-green', red.powerup === 'green');
	blueHealthBar.style.backgroundColor = blue.powerup === 'yellow' ? '#f1c84b' : blue.powerup === 'green' ? '#53d68b' : '#2375ff';
	redHealthBar.style.backgroundColor = red.powerup === 'yellow' ? '#f1c84b' : red.powerup === 'green' ? '#53d68b' : '#ef4d45';
}

function updateCooldowns() {
	blueParryCooldown.style.width = `${(1 - blue.parryCooldown / 300) * 100}%`;
	redParryCooldown.style.width = `${(1 - red.parryCooldown / 300) * 100}%`;
	blueDashCooldown.style.width = `${(1 - blue.dashCooldown / 300) * 100}%`;
	redDashCooldown.style.width = `${(1 - red.dashCooldown / 300) * 100}%`;
}

function updateCamera() {
	const distance = Math.abs(blue.x - red.x);
	const targetZoom = Math.max(0.58, Math.min(1, canvas.width / (distance + 440)));
	camera.zoom += (targetZoom - camera.zoom) * 0.08;
	const targetX = (blue.x + red.x) / 2;
	camera.x += (targetX - camera.x) * 0.1;
	const halfWidth = canvas.width / (2 * camera.zoom);
	camera.x = Math.max(halfWidth, Math.min(WORLD_WIDTH - halfWidth, camera.x));
	camera.y += (360 - camera.y) * 0.08;
}

function updatePowerup() {
	if (arena.powerup) {
		arena.powerup.life--;
		if (arena.powerup.life <= 0) arena.powerup = null;
	} else if (--powerupSpawnTimer <= 0) {
		const horizontalPlatforms = arena.platforms.filter((platform) => !platform.vertical);
		if (horizontalPlatforms.length) {
			const platform = horizontalPlatforms[randomBetween(0, horizontalPlatforms.length - 1)];
			arena.powerup = { x: platform.x + platform.width / 2, y: platform.y - 22, type: Math.random() < 0.5 ? 'yellow' : 'green', life: 600 };
		}
		powerupSpawnTimer = 2400;
	}
	for (const fighter of fighters) {
		if (fighter.powerupTimer > 0) {
			fighter.powerupTimer--;
			if (fighter.powerupTimer === 0) { fighter.powerup = null; updateHealth(); }
		}
		if (!arena.powerup) continue;
		if (Math.hypot(fighter.x - arena.powerup.x, fighter.y - arena.powerup.y) <= fighter.radius + 20) {
			fighter.powerup = arena.powerup.type;
			fighter.powerupTimer = 600;
			emitEffect(fighter.x, fighter.y, arena.powerup.type === 'yellow' ? '#f1c84b' : '#53d68b', 'powerup');
			arena.powerup = null;
			updateHealth();
		}
	}
}

function emitEffect(x, y, color, type) {
	effects.push({ x, y, color, type, life: 1, radius: type === 'dash' ? 16 : 10, vx: type === 'dash' ? -2 : 0, vy: type === 'parry' ? -1.5 : -0.5 });
}

function emitHitSparks(fighter, count) {
	for (let index = 0; index < count; index++) {
		const angle = Math.random() * Math.PI * 2;
		const speed = randomBetween(3, 8);
		effects.push({ x: fighter.x, y: fighter.y, color: fighter.color, type: 'spark', life: 1, radius: randomBetween(3, 6), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2 });
	}
}

function updateEffects() {
	for (let index = effects.length - 1; index >= 0; index--) {
		const effect = effects[index];
		effect.life -= 0.045;
		effect.radius += effect.type === 'parry' ? 3 : 1.7;
		effect.x += effect.vx;
		effect.y += effect.vy;
		if (effect.type === 'spark') effect.vy += 0.25;
		if (effect.life <= 0) effects.splice(index, 1);
	}
}

function draw() {
	context.save();
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
	drawSky();
	context.save();
	context.translate(canvas.width / 2, canvas.height / 2);
	context.scale(camera.zoom, camera.zoom);
	context.translate(-camera.x, -camera.y);
	drawArena();
	drawPowerup();
	for (const fighter of fighters) drawFighter(fighter);
	drawEffects();
	context.restore();
	context.restore();
}

function drawSky() {
	context.fillStyle = '#222936';
	context.fillRect(0, 0, canvas.width, canvas.height);
}

function drawArena() {
	const sky = context.createLinearGradient(0, CEILING, 0, GROUND);
	sky.addColorStop(0, arena.sky[0]); sky.addColorStop(1, arena.sky[1]);
	context.fillStyle = sky; context.fillRect(0, CEILING, WORLD_WIDTH, GROUND - CEILING);
	context.strokeStyle = arena.grid; context.lineWidth = 1;
	for (let x = 0; x <= WORLD_WIDTH; x += 40) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, GROUND); context.stroke(); }
	for (let y = CEILING; y < GROUND; y += 40) { context.beginPath(); context.moveTo(0, y); context.lineTo(WORLD_WIDTH, y); context.stroke(); }
	context.fillStyle = arena.lava ? '#9e342e' : arena.floor;
	context.fillRect(0, GROUND, WORLD_WIDTH, canvas.height - GROUND + 160);
	if (arena.lava) {
		context.fillStyle = '#ffb52e';
		for (let x = 0; x < WORLD_WIDTH; x += 80) { context.beginPath(); context.arc(x + 28, GROUND + 22, 17, Math.PI, 0); context.fill(); }
	}
	context.fillStyle = arena.stripe; context.fillRect(0, GROUND, WORLD_WIDTH, 5);
	context.fillStyle = '#222936'; context.fillRect(0, CEILING, WALL_WIDTH, GROUND + 160); context.fillRect(WORLD_WIDTH - WALL_WIDTH, CEILING, WALL_WIDTH, GROUND + 160); context.fillRect(0, CEILING - WALL_WIDTH, WORLD_WIDTH, WALL_WIDTH);
	context.fillStyle = arena.stripe; context.fillRect(WALL_WIDTH - 5, WALL_TOP, 5, GROUND + 160 - WALL_TOP); context.fillRect(WORLD_WIDTH - WALL_WIDTH, WALL_TOP, 5, GROUND + 160 - WALL_TOP);
	for (const platform of arena.platforms) {
		context.fillStyle = '#e6dfd2'; context.fillRect(platform.x, platform.y, platform.width, platform.height);
		context.strokeStyle = '#16171b'; context.lineWidth = 4; context.strokeRect(platform.x, platform.y, platform.width, platform.height);
		context.fillStyle = arena.stripe; context.fillRect(platform.x, platform.y, platform.width, 5);
	}
	context.fillStyle = arena.stripe; context.fillRect(0, CEILING, WORLD_WIDTH, 5);
}

function drawPowerup() {
	if (!arena.powerup) return;
	const color = arena.powerup.type === 'yellow' ? '#f1c84b' : '#53d68b';
	context.save();
	context.translate(arena.powerup.x, arena.powerup.y);
	context.rotate(Math.PI / 4);
	context.shadowColor = color; context.shadowBlur = 20;
	context.fillStyle = color; context.fillRect(-13, -13, 26, 26);
	context.shadowBlur = 0; context.strokeStyle = '#fff9e8'; context.lineWidth = 3; context.strokeRect(-13, -13, 26, 26);
	context.restore();
}

function drawFighter(fighter) {
	context.save();
	context.translate(fighter.x, fighter.y);
	if (fighter.flashTimer % 4 < 2) context.globalAlpha = 0.6;
	context.shadowColor = fighter.color; context.shadowBlur = fighter.dashTimer ? 34 : 16;
	context.fillStyle = fighter.color; context.beginPath(); context.arc(0, 0, fighter.radius, 0, Math.PI * 2); context.fill();
	if (fighter.powerup) {
		const powerupColor = fighter.powerup === 'yellow' ? '#f1c84b' : '#53d68b';
		context.globalAlpha = 0.45 + Math.sin(performance.now() / 90) * 0.2;
		context.shadowColor = powerupColor; context.shadowBlur = 28;
		context.strokeStyle = powerupColor; context.lineWidth = 5; context.beginPath(); context.arc(0, 0, fighter.radius + 8, 0, Math.PI * 2); context.stroke();
		context.globalAlpha = 1;
	}
	context.shadowBlur = 0;
	context.lineWidth = fighter.parryTimer ? 8 : 4; context.strokeStyle = fighter.parryTimer ? '#f1c84b' : fighter.accent; context.stroke();
	if (fighter.attackTimer > 0) drawSwordSwing(fighter);
	if (fighter.parryTimer) { context.strokeStyle = '#f1c84b'; context.lineWidth = 4; context.beginPath(); context.arc(0, 0, 60, 0, Math.PI * 2); context.stroke(); }
	if (fighter.criticalTimer) { context.save(); context.fillStyle = '#f1c84b'; context.font = '800 18px "Barlow Condensed"'; context.textAlign = 'center'; context.fillText('CRITICAL!', 0, -58); context.restore(); }
	context.restore();
}

function drawSwordSwing(fighter) {
	const progress = 1 - fighter.attackTimer / 24;
	const angle = fighter.facing > 0 ? -1.15 + progress * 2.3 : Math.PI + 1.15 - progress * 2.3;
	context.save();
	context.rotate(angle);
	context.lineCap = 'round';
	context.strokeStyle = '#3b2b2a'; context.lineWidth = 7.36;
	context.beginPath(); context.moveTo(4.6, 0); context.lineTo(26.68, 0); context.stroke();
	context.strokeStyle = '#f1c84b'; context.lineWidth = 4.6;
	context.beginPath(); context.moveTo(22.08, -11.04); context.lineTo(22.08, 11.04); context.stroke();
	context.strokeStyle = '#f8f2df'; context.lineWidth = 8.28;
	context.beginPath(); context.moveTo(25.76, 0); context.lineTo(96.6, 0); context.stroke();
	context.strokeStyle = fighter.accent; context.lineWidth = 2.76;
	context.beginPath(); context.moveTo(25.76, 0); context.lineTo(96.6, 0); context.stroke();
	context.restore();
}

function drawEffects() {
	for (const effect of effects) {
		context.save();
		context.globalAlpha = Math.max(0, effect.life);
		context.strokeStyle = effect.color; context.lineWidth = effect.type === 'parry' ? 6 : 4;
		context.beginPath(); context.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2); context.stroke();
		if (effect.type === 'dash') { context.beginPath(); context.moveTo(effect.x, effect.y); context.lineTo(effect.x + 42, effect.y); context.stroke(); }
		if (effect.type === 'spark') { context.fillStyle = effect.color; context.fillRect(effect.x, effect.y, effect.radius, effect.radius); }
		context.restore();
	}
}

startArena();
update();
