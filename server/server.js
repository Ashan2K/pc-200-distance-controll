const WebSocket = require('ws');
const express = require('express');
const admin = require('firebase-admin');
require('dotenv').config();
const cors = require('cors');
const axios = require('axios');


const app = express();
app.use(express.json());

app.use(cors());

// --- 1. Firebase Admin Setup ---
// Ensure you have your service account JSON file in the project folder
const serviceAccount = require("./service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const addRecord = async (record) => {
  const docRef = await db.collection("maintenance_records").add({
    ...record,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return docRef.id;
};

const getRecords = async () => {
  const snapshot = await db.collection("maintenance_records").orderBy("createdAt", "desc").get();
  const records = [];
  snapshot.forEach(doc => {
    records.push({ id: doc.id, ...doc.data() });
  });
  return records;
};

app.post('/api/login', async (req, res) => {
  const { idToken } = req.body;
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Log this to your terminal to see what is actually inside decodedToken
    console.log("Verified User:", decodedToken);

    // Make sure you send back an object that has a 'user' property
    res.status(200).json({ 
      status: 'success', 
      user: decodedToken // This contains email, uid, etc.
    });
  } catch (error) {
    console.error("Auth Error:", error);
    res.status(401).json({ status: 'error', message: 'Auth failed' });
  }
});

// Add Maintenance Record
app.post('/api/maintenance', async (req, res) => {
  try {
    const record = req.body;
    const id = await addRecord(record);
    res.status(200).json({ id, message: 'Record added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add record' });
  }
});

// Fetch All Records
app.get('/api/maintenance', async (req, res) => {
  try {
    const records = await getRecords();
    res.status(200).json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// --- API: Fetch sensor data for a given period ---
app.get('/api/sensorData', async (req, res) => {
  try {
    const { sensor, period } = req.query; // e.g., sensor=eng_wtr_temp&period=24h
    const endTime = new Date();
    let startTime = new Date();

    if(period === '24h') startTime.setHours(endTime.getHours() - 24);
    else if(period === '7d') startTime.setDate(endTime.getDate() - 7);
    else startTime.setHours(endTime.getHours() - 1); // default 1 hour

    const snapshot = await db.collection("machine_logs")
      .where("timestamp", ">=", startTime)
      .where("timestamp", "<=", endTime)
      .orderBy("timestamp", "asc")
      .get();

    const data = [];
    snapshot.forEach(doc => {
      const record = doc.data();
      data.push({
        timestamp: record.timestamp.toDate(),
        value: record[sensor] || 0
      });
    });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch sensor data' });
  }
});

// At the top of server.js
// For Node < 18, uncomment this line:
// import fetch from 'node-fetch';

app.post('/api/predict', async (req, res) => {
  try {
    const { values } = req.body;
    console.log("Received values for prediction:", values);
    if (!values || !Array.isArray(values)) {
      return res.status(400).json({ error: "Invalid input: values must be an array" });
    }

    const flaskURL = 'http://127.0.0.1:5005/predict'; // use 127.0.0.1, not localhost:6000:/
    const response = await fetch(flaskURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values :values})
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Flask API error: ${text}`);
    }

    const data = await response.json();
    res.json(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error("AI prediction failed:", err);
    res.status(500).json({ error: 'AI prediction failed', details: err.message });
  }
});


app.post('/api/log-error', async (req, res) => {
  try {
    const { errorDetail, fullSnapshot } = req.body;
    console.log("Logging error:", errorDetail);
    const errorRef = db.collection('active_errors').doc(errorDetail.code);
    const doc = await errorRef.get();

    if (!doc.exists) {
      // 🟢 FIRST TIME ERROR
      await errorRef.set({
        code: errorDetail.code,
        message: errorDetail.msg,
        sensor: errorDetail.sensor,
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
        snapshot: fullSnapshot,
      });
    } else {
      // 🟡 ERROR STILL ACTIVE → update heartbeat only
      await errorRef.update({
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    }

    res.send({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false });
  }
});

app.post('/api/resolve-error', async (req, res) => {
  try {
    const { errorCode, fullSnapshot } = req.body;
    const errorRef = db.collection('active_errors').doc(errorCode);
    const doc = await errorRef.get();

    if (!doc.exists) return res.send({ success: true });

    const data = doc.data();

    await db.collection('error_history').add({
      code: data.code,
      message: data.message,
      sensor: data.sensor,
      startedAt: data.startedAt,
      endedAt: admin.firestore.FieldValue.serverTimestamp(),
      durationSec:
        (Date.now() - data.startedAt.toMillis()) / 1000,
      firstSnapshot: data.snapshot,
      lastSnapshot: fullSnapshot,
    });

    await errorRef.delete();

    res.send({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false });
  }
});


app.get('/api/error-history', async (req, res) => {
  try {
    const snap = await db
      .collection('error_history')
      .orderBy('startedAt', 'desc')
      .limit(200)
      .get();

    const data = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      startedAt: d.data().startedAt?.toDate(),
      resolvedAt: d.data().resolvedAt?.toDate(),
    }));

    res.send(data);
  } catch (e) {
    console.error(e);
    res.status(500).send([]);
  }
});
app.get('/api/active-errors', async (req, res) => {
  try {
    const snap = await db.collection('active_errors').get();
    const data = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      startedAt: d.data().startedAt?.toDate(),
      lastSeenAt: d.data().lastSeenAt?.toDate(),
    }));
    res.send(data);
  } catch (e) {
    res.status(500).send([]);
  }
});


// Start Express on a separate port (e.g., 3000)
const HTTP_PORT = 3000;
app.listen(HTTP_PORT, () => console.log(`HTTP Login Server: http://localhost:${HTTP_PORT}`));

// --- 3. Existing WebSocket Logic ---

// Server 1: JCB Arm Control
const PORT_1 = 8080;
const wss1 = new WebSocket.Server({ port: PORT_1 });
console.log(`WebSocket server 1: ws://localhost:${PORT_1}`);

wss1.on('connection', ws => {
  console.log(`Client connected to Server 1`);
  ws.on('message', message => {
    try {
      const data = JSON.parse(message);
      console.log("Received JCB Control Data:", data);
      wss1.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(message);
      });
    } catch (err) { console.error(`[S1] Error:`, err.message); }
  });
});

// Server 2: Komatsu Sensor Data
const PORT_2 = 8081;
const wss2 = new WebSocket.Server({ port: PORT_2 });
console.log(`WebSocket server 2: ws://localhost:${PORT_2}`);

let lastSaveTime = 0;
const SAVE_INTERVAL = 1000000; // Log to database every 10 seconds

wss2.on('connection', ws => {
  console.log(`Client connected to Server 2`);
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      // 1. Immediate Broadcast for Real-time Gauges
      wss2.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(message);
      });

      // 2. Periodic Save to Firestore for AI Analysis
      const currentTime = Date.now();
      if (currentTime - lastSaveTime > SAVE_INTERVAL) {
        await db.collection("machine_logs").add({
          ...data,
          timestamp: admin.firestore.FieldValue.serverTimestamp() // Crucial for slope math
        });
        lastSaveTime = currentTime;
        console.log("Data logged to Firestore for AI Analysis");
      }
    } catch (err) { console.error(`[S2] Error:`, err.message); }
  });
});

