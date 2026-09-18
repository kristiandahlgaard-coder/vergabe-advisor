const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT NOW()');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: err.message });
  }
});

app.get('/api/seed-test-users', async (req, res) => {
  try {
    const passwordHash = await bcrypt.hash('test123', 12);
    const emails = ['kristian@example.com', 'vergabestelle@example.com', 'finanzen@example.com', 'recht@example.com', 'bereichsleitung@example.com', 'geschaeftsfuehrung@example.com', 'admin@example.com'];
    for (const email of emails) {
      await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [passwordHash, email]);
    }
    res.json({ status: 'ok', message: 'Test-User seeded', count: emails.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }
    const token = jwt.sign({ userId: user.id, email: user.email, rolle: user.rolle }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '24h' });
    res.json({ status: 'ok', token, user: { id: user.id, email: user.email, rolle: user.rolle } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/vergaben', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vergaben ORDER BY created_at DESC');
    res.json({ status: 'ok', vergaben: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/vergaben/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vergaben WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json({ status: 'ok', vergabe: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vergaben', async (req, res) => {
  try {
    const { leistungsart, volumen, beschreibung } = req.body;
    const result = await pool.query('INSERT INTO vergaben (leistungsart, volumen, beschreibung, status, created_by) VALUES ($1, $2, $3, $4, $5)
