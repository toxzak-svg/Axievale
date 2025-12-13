const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

const FILE = path.join(__dirname, '..', 'data', 'users.json');

function ensureDir() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(FILE)) return {};
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    console.warn('Could not read users file:', err.message);
    return {};
  }
}

function save(store) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(store, null, 2), 'utf8');
}

function genKey() {
  return crypto.randomBytes(24).toString('hex');
}

function createUser({ email } = {}) {
  const store = load();
  const id = crypto.randomUUID();
  const apiKey = genKey();
  const user = {
    id,
    email: email || null,
    apiKey,
    isPaid: false,
    trialRemaining: parseInt(config.trialRequests || 100, 10),
    createdAt: new Date().toISOString()
  };
  store[id] = user;
  save(store);
  return user;
}

function getUserById(id) {
  const store = load();
  return store[id] || null;
}

function getUserByApiKey(key) {
  const store = load();
  return Object.values(store).find(u => u.apiKey === key) || null;
}

function activateUser(id) {
  const store = load();
  if (!store[id]) return null;
  store[id].isPaid = true;
  save(store);
  return store[id];
}

function decrementTrial(id) {
  const store = load();
  if (!store[id]) return null;
  if (store[id].trialRemaining > 0) {
    store[id].trialRemaining -= 1;
    save(store);
    return store[id].trialRemaining;
  }
  return 0;
}

function getAllUsers() {
  const store = load();
  return Object.values(store).map(u => ({ id: u.id, email: u.email, isPaid: u.isPaid, trialRemaining: u.trialRemaining, createdAt: u.createdAt }));
}

module.exports = {
  createUser,
  getUserById,
  getUserByApiKey,
  activateUser,
  decrementTrial
};
