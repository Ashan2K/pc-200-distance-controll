// server.js
const express = require('express');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
app.use(express.json());

// Initialize Firebase Admin
const serviceAccount = require('../service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

/**
 * LOGIN ENDPOINT
 * The client sends an ID Token generated after signing in on the frontend.
 */
app.post('/api/login', async (req, res) => {
  const idToken = req.body.idToken;

  if (!idToken) {
    return res.status(400).json({ error: 'No token provided' });
  }

  try {
    // Verify the ID token sent from the client
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // You now have the user's UID and can fetch user data from your DB
    // or create a session/JWT for your own system.
    res.status(200).json({
      message: 'Login successful',
      user: decodedToken
    });
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));