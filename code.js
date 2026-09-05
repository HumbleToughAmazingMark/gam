const canvas = document.querySelector('#gameCanvas');
const context = canvas.getContext('2d');
const roundStatus = document.querySelector('#roundStatus');
const gameMessage = document.querySelector('#gameMessage');
const blueHealth = document.querySelector('#blueHealth');
const redHealth = document.querySelector('#redHealth');
const blueHealthBar = document.querySelector('#blueHealthBar');
const redHealthBar = document.querySelector('#redHealthBar');
const keys = new Set();
const lastTap = new Map();

const GRAVITY = 0.62;
const GROUND = 486;
let gameOver = false;
let screenShake = 0;

const blue = createFighter({ name: 'BLUE', x: 270, color: '#2375ff', accent: '#bcd5ff', left: 'a', right: 'd', jump: 'w', parry: 's', attack: 'f' });
const red = createFighter({ name: 'RED', x: 730, color: '#ef4d45', accent: '#ffd0c9', left: 'j', right: 'l', jump: 'i', parry: 'k', attack: 'h' });
const fighters = [blue, red];

function createFighter(options) {
	return { ...options, y: GROUND - 28, radius: 28, vx: 0, vy: 0, health: 100, grounded: true, facing: options.name === 'BLUE' ? 1 : -1, attackTimer: 0, parryTimer: 0, dashTimer: 0, stunTimer: 0, flashTimer: 0 };
}

window.addEventListener('keydown', (event) => {
	const key = event.key.toLowerCase();
	if (['w', 'a', 's', 'd', 'f', 'i', 'j', 'k', 'l', 'h', 'r'].includes(key)) event.preventDefault();
	if (key === 'r' && gameOver) resetGame();
	if (event.repeat || keys.has(key) || gameOver) return;
	keys.add(key);
	for (const fighter of fighters) handlePress(fighter, key);
});
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
document.querySelector('#resetButton').addEventListener('click', resetGame);

function handlePress(fighter, key) {
	if (key === fighter.jump && fighter.grounded && fighter.stunTimer <= 0) fighter.vy = -12;
	if (key === fighter.parry && fighter.stunTimer <= 0) fighter.parryTimer = 18;
	if (key === fighter.attack && fighter.stunTimer <= 0 && fighter.attackTimer <= 0) fighter.attackTimer = 22;
	if (key === fighter.left || key === fighter.right) {
		const now = performance.now();
		const previous = lastTap.get(key) || 0;
		if (now - previous < 260 && fighter.grounded && fighter.stunTimer <= 0) fighter.dashTimer = 11;
		lastTap.set(key, now);
	}
}

function update() {
	if (!gameOver) {
		for (const fighter of fighters) updateFighter(fighter);
		resolveAttack(blue, red);
		resolveAttack(red, blue);
		if (blue.health <= 0 || red.health <= 0) finishRound();
	}
	screenShake *= 0.82;
	draw();
	requestAnimationFrame(update);
}

function updateFighter(fighter) {
	const movingLeft = keys.has(fighter.left);
	const movingRight = keys.has(fighter.right);
	const direction = movingLeft === movingRight ? 0 : movingLeft ? -1 : 1;
	if (fighter.stunTimer > 0) fighter.stunTimer--;
	if (fighter.attackTimer > 0) fighter.attackTimer--;
	else fighter.hitThisSwing = false;
	if (fighter.parryTimer > 0) fighter.parryTimer--;
	if (fighter.flashTimer > 0) fighter.flashTimer--;
	if (fighter.dashTimer > 0) { fighter.dashTimer--; fighter.vx = fighter.facing * 16; }
	else if (fighter.stunTimer <= 0) { fighter.vx = direction * 4.2; if (direction) fighter.facing = direction; }
	else fighter.vx *= 0.9;
	fighter.vy += GRAVITY;
	fighter.x += fighter.vx;
	fighter.y += fighter.vy;
	fighter.x = Math.max(fighter.radius + 14, Math.min(canvas.width - fighter.radius - 14, fighter.x));
	if (fighter.y >= GROUND - fighter.radius) { fighter.y = GROUND - fighter.radius; fighter.vy = 0; fighter.grounded = true; }
	else fighter.grounded = false;
}

function resolveAttack(attacker, defender) {
	const attackActive = attacker.attackTimer <= 15 && attacker.attackTimer >= 7;
	if (!attackActive || attacker.hitThisSwing) return;
	const distance = Math.hypot(attacker.x - defender.x, attacker.y - defender.y);
	if (distance > 105) return;
	attacker.hitThisSwing = true;
	if (defender.parryTimer > 0) {
		attacker.stunTimer = 42;
		attacker.vx = -attacker.facing * 8;
		defender.flashTimer = 14;
		roundStatus.textContent = `${defender.name} PARRIED`;
		screenShake = 7;
	} else {
		defender.health = Math.max(0, defender.health - 12);
		defender.vx = attacker.facing * 8;
		defender.vy = -4;
		defender.flashTimer = 10;
		roundStatus.textContent = `${attacker.name} HIT`;
		screenShake = 5;
		updateHealth();
	}
}

function finishRound() {
	gameOver = true;
	const winner = blue.health > 0 ? blue : red;
	roundStatus.textContent = 'ROUND OVER';
	gameMessage.textContent = `${winner.name} WINS`;
	gameMessage.hidden = false;
}

function updateHealth() {
	blueHealth.textContent = Math.ceil(blue.health);
	redHealth.textContent = Math.ceil(red.health);
	blueHealthBar.style.width = `${blue.health}%`;
	redHealthBar.style.width = `${red.health}%`;
}

function resetGame() {
	Object.assign(blue, createFighter({ name: 'BLUE', x: 270, color: '#2375ff', accent: '#bcd5ff', left: 'a', right: 'd', jump: 'w', parry: 's', attack: 'f' }));
	Object.assign(red, createFighter({ name: 'RED', x: 730, color: '#ef4d45', accent: '#ffd0c9', left: 'j', right: 'l', jump: 'i', parry: 'k', attack: 'h' }));
	gameOver = false;
	gameMessage.hidden = true;
	roundStatus.textContent = 'FIGHT';
	updateHealth();
}

function draw() {
	context.save();
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
	drawArena();
	for (const fighter of fighters) drawFighter(fighter);
	context.restore();
}

function drawArena() {
	const sky = context.createLinearGradient(0, 0, 0, canvas.height);
	sky.addColorStop(0, '#e7eef0'); sky.addColorStop(1, '#b8c7c9');
	context.fillStyle = sky; context.fillRect(-10, -10, canvas.width + 20, canvas.height + 20);
	context.strokeStyle = 'rgba(22, 23, 27, .1)'; context.lineWidth = 1;
	for (let x = 20; x < canvas.width; x += 40) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, GROUND); context.stroke(); }
	for (let y = 20; y < GROUND; y += 40) { context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke(); }
	context.fillStyle = '#283139'; context.fillRect(0, GROUND, canvas.width, canvas.height - GROUND);
	context.fillStyle = '#f1c84b'; context.fillRect(0, GROUND, canvas.width, 5);
	context.fillStyle = 'rgba(255,255,255,.18)'; context.fillRect(0, GROUND + 7, canvas.width, 3);
	context.font = '700 12px "Space Mono"'; context.fillStyle = 'rgba(255,255,255,.5)'; context.textAlign = 'center'; context.fillText('DUEL ZONE', canvas.width / 2, GROUND + 34);
}

function drawFighter(fighter) {
	context.save();
	context.translate(fighter.x, fighter.y);
	if (fighter.flashTimer % 4 < 2) context.globalAlpha = 0.6;
	context.shadowColor = fighter.color; context.shadowBlur = fighter.dashTimer ? 28 : 13;
	context.fillStyle = fighter.color; context.beginPath(); context.arc(0, 0, fighter.radius, 0, Math.PI * 2); context.fill();
	context.shadowBlur = 0;
	context.lineWidth = fighter.parryTimer ? 6 : 3; context.strokeStyle = fighter.parryTimer ? '#f1c84b' : fighter.accent; context.stroke();
	context.fillStyle = '#fff'; context.beginPath(); context.arc(fighter.facing * 9, -8, 5, 0, Math.PI * 2); context.fill();
	context.fillStyle = '#16171b'; context.beginPath(); context.arc(fighter.facing * 11, -8, 2, 0, Math.PI * 2); context.fill();
	if (fighter.attackTimer <= 15 && fighter.attackTimer >= 7) { context.strokeStyle = fighter.accent; context.lineWidth = 8; context.beginPath(); context.moveTo(fighter.facing * 21, 4); context.lineTo(fighter.facing * 65, 4); context.stroke(); }
	if (fighter.parryTimer) { context.strokeStyle = '#f1c84b'; context.lineWidth = 3; context.beginPath(); context.arc(0, 0, 40, 0, Math.PI * 2); context.stroke(); }
	context.restore();
}

update();
