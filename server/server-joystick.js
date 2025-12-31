const WebSocket = require('ws');

// --- Server 1: For the first ESP32 (e.g., JCB Arm Control) ---
const PORT_1 = 8080;
const wss1 = new WebSocket.Server({ port: PORT_1, host: '0.0.0.0' });

console.log(`WebSocket server 1 running at ws://0.0.0.0:${PORT_1}`);

wss1.on('connection', ws => {
  console.log(`Client connected to Server 1 (Port ${PORT_1})`);

  ws.on('message', message => {
    try {
      const data = JSON.parse(message); // ESP32 sends JSON
      console.log(`Received on Server 1:`, data);

      // Broadcast the data from ESP32 #1 to all clients connected to Server 1
      wss1.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    } catch (err) {
      console.error(`[Server 1] Invalid JSON:`, message.toString());
    }
  });

  ws.on('close', () => {
    console.log(`Client disconnected from Server 1 (Port ${PORT_1})`);
  });
});