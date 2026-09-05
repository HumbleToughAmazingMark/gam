const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const root = __dirname;
const rooms = new Map();
const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function createRoomCode() {
	let code;
	while (!code || rooms.has(code)) code = String(Math.floor(10000 + Math.random() * 90000));
	return code;
}

function send(socket, message) {
	if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function broadcast(room, message) {
	for (const player of room.players) send(player.socket, message);
}

function roomState(room) {
	return { type: 'room-state', code: room.code, hostId: room.hostId, players: room.players.map((player) => ({ id: player.id, color: player.color })) };
}

function leaveRoom(socket) {
	const room = socket.room;
	if (!room) return;
	room.players = room.players.filter((player) => player.socket !== socket);
	socket.room = null;
	if (!room.players.length) rooms.delete(room.code);
	else {
		room.hostId = room.players[0].id;
		broadcast(room, roomState(room));
	}
}

function joinRoom(socket, code) {
	const room = rooms.get(code);
	if (!room) return send(socket, { type: 'error', message: 'Room not found.' });
	if (room.players.length >= 2) return send(socket, { type: 'error', message: 'That room is full.' });
	room.players.push({ id: socket.playerId, socket, color: null });
	socket.room = room;
	broadcast(room, roomState(room));
}

const server = http.createServer((request, response) => {
	const requestedPath = request.url === '/' ? '/index.html' : request.url;
	const filePath = path.join(root, requestedPath.replace(/^\//, ''));
	if (!filePath.startsWith(root)) return response.writeHead(403).end();
	fs.readFile(filePath, (error, data) => {
		if (error) return response.writeHead(404).end('Not found');
		response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
		response.end(data);
	});
});

const webSocketServer = new WebSocket.Server({ server });
webSocketServer.on('connection', (socket) => {
	socket.playerId = Math.random().toString(36).slice(2);
	send(socket, { type: 'player-id', id: socket.playerId });
	socket.on('message', (rawMessage) => {
		let message;
		try { message = JSON.parse(rawMessage); } catch { return send(socket, { type: 'error', message: 'Invalid message.' }); }
		if (message.type === 'create-room' && !socket.room) {
			const code = createRoomCode();
			const room = { code, hostId: socket.playerId, players: [{ id: socket.playerId, socket, color: null }], started: false };
			rooms.set(code, room);
			socket.room = room;
			return send(socket, roomState(room));
		}
		if (message.type === 'join-room' && !socket.room) return joinRoom(socket, String(message.code || '').trim());
		const room = socket.room;
		if (!room) return send(socket, { type: 'error', message: 'Create or join a room first.' });
		const player = room.players.find((entry) => entry.socket === socket);
		if (message.type === 'choose-color' && !room.started && (message.color === 'BLUE' || message.color === 'RED')) {
			if (room.players.some((entry) => entry !== player && entry.color === message.color)) return send(socket, { type: 'error', message: `${message.color} is already taken.` });
			player.color = message.color;
			return broadcast(room, roomState(room));
		}
		if (message.type === 'start-match' && socket.playerId === room.hostId && room.players.length === 2 && room.players.every((entry) => entry.color)) {
			room.started = true;
			for (const entry of room.players) send(entry.socket, { type: 'match-started', hostId: room.hostId, isHost: entry.id === room.hostId, players: room.players.map((player) => ({ id: player.id, color: player.color })) });
			return;
		}
		if (message.type === 'arena-data' && socket.playerId === room.hostId && room.started) return broadcast(room, { type: 'arena-data', arena: message.arena });
		if (message.type === 'state' && socket.playerId === room.hostId && room.started) {
			for (const entry of room.players) if (entry.socket !== socket) send(entry.socket, { type: 'state', state: message.state });
			return;
		}
		if (message.type === 'reset' && room.started) {
			const host = room.players.find((entry) => entry.id === room.hostId);
			if (host) send(host.socket, { type: 'reset' });
			return;
		}
		if (message.type === 'input' && room.started) {
			for (const entry of room.players) if (entry.socket !== socket) send(entry.socket, { type: 'input', action: message.action, key: message.key });
		}
	});
	socket.on('close', () => leaveRoom(socket));
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Pulse Duel running at http://localhost:${port}`));