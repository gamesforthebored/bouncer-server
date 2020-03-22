const PORT = process.env.PORT || 3000;
const express = require('express');
const server = express().listen(PORT, () => console.log(`Listening on ${PORT}`));
const { Server } = require('ws');
const wss = new Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.on('close', () => console.log('Client disconnected'));
});

setInterval(() => {
  wss.clients.forEach((client) => {
    client.send(new Date().toTimeString());
  });
}, 2000);
