import React, { useState } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import './LoginPage.css';

// --- Firebase Configuration ---
// Get this from your Firebase Console: Project Settings > General
const firebaseConfig = {
  apiKey: "AIzaSyDRxooW6jm0Trn7GHY4tiMZQalAulxUVlI",
  authDomain: "komatsu-e213e.firebaseapp.com",
  projectId: "komatsu-e213e",
  storageBucket: "komatsu-e213e.firebasestorage.app",
  messagingSenderId: "452478107002",
  appId: "1:452478107002:web:a691189ba46682f1d9aac3",
  measurementId: "G-4V9BY5Z2JF"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const LoginPage = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // 1. Sign in with Firebase Client SDK
      // Note: We use credentials.username as the email here
      const userCredential = await signInWithEmailAndPassword(
        auth,
        credentials.username,
        credentials.password
      );

      // 2. Get the JWT ID Token from the user
      const idToken = await userCredential.user.getIdToken();

      const response = await fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });

      const data = await response.json();

      if (response.ok && data.user) {
        // The ?. ensures that if user is missing, it won't crash the whole app
        onLogin(data.user.email || data.user.uid);
      } else {
        setError(data.message || 'Login failed at server verification');
      }
    } catch (err) {
      console.error(err);
      setError('Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  return (
    <div className="login-container">
      <div className="login-background"></div>
      <div className="login-card">
        <div className="login-header">
          <div className="login-brand">Komatsu PC200-8 Excavator</div>
          <h1 className="login-title">Welcome Back</h1>
          {error && <p style={{ color: '#ff4d4d', fontSize: '0.9rem' }}>{error}</p>}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="login-form-group">
            <label className="login-label">Email (Username)</label>
            <input
              type="email"
              name="username"
              value={credentials.username}
              onChange={handleChange}
              required
              className="login-input"
              placeholder="admin@example.com"
            />
          </div>

          <div className="login-form-group" style={{ marginBottom: '30px' }}>
            <label className="login-label">Password</label>
            <input
              type="password"
              name="password"
              value={credentials.password}
              onChange={handleChange}
              required
              className="login-input"
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={isLoading} className="login-button">
            {isLoading ? "Verifying..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;