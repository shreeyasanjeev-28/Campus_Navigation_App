// server.js - Campus Navigation Backend (MySQL + Express + Dijkstra + bcryptjs)
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { randomBytes } = require('crypto');

const app = express();
const PORT = 5000;

// MySQL connection config (adjust if needed)
const MYSQL_HOST = 'localhost';
const MYSQL_USER = 'root';
const MYSQL_PASSWORD = '';
const MYSQL_DB = 'CampusNavigationSystem';

app.use(cors());
app.use(express.json());

// simple in-memory sessions
const sessions = {};

// initialize DB: create database and tables if not exist, create default admin
async function initDb() {
  try {
    // connect without database to create it if necessary
    const conn = await mysql.createConnection({
      host: MYSQL_HOST,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      multipleStatements: true
    });

    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${MYSQL_DB}\`;`);
    console.log('✅ Database ensured:', MYSQL_DB);
    await conn.end();

    // connect to the database
    const db = await mysql.createPool({
      host: MYSQL_HOST,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      database: MYSQL_DB,
      multipleStatements: true, 
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
});


    // create tables
    await db.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) UNIQUE,
        password_hash VARCHAR(255)
      );
      CREATE TABLE IF NOT EXISTS locations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) UNIQUE,
        latitude DOUBLE,
        longitude DOUBLE,
        type VARCHAR(50) DEFAULT 'building'
      );
      CREATE TABLE IF NOT EXISTS paths (
        id INT AUTO_INCREMENT PRIMARY KEY,
        from_id INT,
        to_id INT,
        distance DOUBLE,
        FOREIGN KEY (from_id) REFERENCES locations(id),
        FOREIGN KEY (to_id) REFERENCES locations(id)
      );
    `);

    // ensure default admin exists
    const [rows] = await db.query('SELECT * FROM admins WHERE username = ?', ['admin']);
    if (rows.length === 0) {
      const hash = bcrypt.hashSync('admin123', 10);
      await db.query('INSERT INTO admins (username, password_hash) VALUES (?, ?)', ['admin', hash]);
      console.log('✅ Default admin created (admin / admin123)');
    } else {
      console.log('✅ Admin user already present');
    }

    return db;
  } catch (err) {
    console.error('DB init error:', err);
    process.exit(1);
  }
}

let dbPool;
initDb().then(pool => { dbPool = pool; }).catch(e => { console.error(e); process.exit(1); });

// auth middleware
async function requireAuth(req, res, next) {
  const token = req.header('x-auth-token');
  if (!token || !sessions[token]) return res.status(401).json({ error: 'Unauthorized' });
  req.user = sessions[token];
  next();
}

// Login
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
    const [rows] = await dbPool.query('SELECT * FROM admins WHERE username = ?', [username]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid user or password' });
    const user = rows[0];
    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid user or password' });
    const token = randomBytes(24).toString('hex');
    sessions[token] = username;
    res.json({ token });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET locations
app.get('/locations', async (req, res) => {
  try {
    const [rows] = await dbPool.query('SELECT * FROM locations');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Add location (admin)
app.post('/add-location', requireAuth, async (req, res) => {
  try {
    const { name, latitude, longitude, type } = req.body || {};
    if (!name || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'Missing or invalid fields' });
    }
    const [result] = await dbPool.query('INSERT INTO locations (name, latitude, longitude, type) VALUES (?, ?, ?, ?)', [name, latitude, longitude, type || 'building']);
    res.json({ message: 'Location added', id: result.insertId });
  } catch (err) {
    console.error('Add location error', err);
    res.status(500).json({ error: 'DB insert error or duplicate' });
  }
});

// Add path (admin)
app.post('/add-path', requireAuth, async (req, res) => {
  try {
    const { from_id, to_id, distance } = req.body || {};
    if (!from_id || !to_id || typeof distance !== 'number') return res.status(400).json({ error: 'Missing fields' });
    const [result] = await dbPool.query('INSERT INTO paths (from_id, to_id, distance) VALUES (?, ?, ?)', [from_id, to_id, distance]);
    res.json({ message: 'Path added', id: result.insertId });
  } catch (err) {
    console.error('Add path error', err);
    res.status(500).json({ error: 'DB insert error' });
  }
});

// Route using Dijkstra
app.get('/route', async (req, res) => {
  try {
    const startId = parseInt(req.query.startId);
    const endId = parseInt(req.query.endId);
    if (!startId || !endId) return res.status(400).json({ error: 'Missing startId or endId' });

    const [locations] = await dbPool.query('SELECT * FROM locations');
    const [paths] = await dbPool.query('SELECT * FROM paths');

    // build adjacency list
    const graph = {};
    locations.forEach(l => { graph[l.id] = []; });
    paths.forEach(p => {
      if (graph[p.from_id]) graph[p.from_id].push({ to: p.to_id, w: p.distance });
      if (graph[p.to_id]) graph[p.to_id].push({ to: p.from_id, w: p.distance });
    });

    // Dijkstra
    const INF = 1e18;
    const dist = {};
    const prev = {};
    const q = new Set();
    locations.forEach(l => { dist[l.id] = INF; prev[l.id] = null; q.add(l.id); });
    dist[startId] = 0;

    while (q.size) {
      let u = null, best = INF;
      for (const x of q) {
        if (dist[x] < best) { best = dist[x]; u = x; }
      }
      if (u === null) break;
      q.delete(u);
      if (u === endId) break;
      const neighbors = graph[u] || [];
      neighbors.forEach(n => {
        const alt = dist[u] + n.w;
        if (alt < dist[n.to]) {
          dist[n.to] = alt;
          prev[n.to] = u;
        }
      });
    }

    if (dist[endId] === INF) return res.json({ path: [] });

    // reconstruct path ids
    const pathIds = [];
    let cur = endId;
    while (cur) {
      pathIds.unshift(cur);
      cur = prev[cur];
    }

    // convert to coordinates
    const pathCoords = pathIds.map(id => {
      const loc = locations.find(l => l.id === id);
      return [loc.latitude, loc.longitude];
    });

    res.json({ path: pathCoords });
  } catch (err) {
    console.error('Route error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/', (req, res) => res.send('Campus Navigation MySQL backend running'));

// start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
