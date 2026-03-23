const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'conversation.json');

let store = [];

function load() {
  try {
    if (fs.existsSync(FILE)) {
      const raw = fs.readFileSync(FILE, 'utf8');
      store = JSON.parse(raw || '[]');
    }
  } catch (e) {
    console.warn('memoryStore: failed to load', e);
    store = [];
  }
}

function persist() {
  try {
    fs.writeFileSync(FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.warn('memoryStore: failed to persist', e);
  }
}

function addMessage(role, text, metadata) {
  const msg = { id: Date.now(), role: role || 'user', text: text || '', metadata: metadata || {}, ts: new Date().toISOString() };
  store.push(msg);
  persist();
  return msg;
}

function getAll() {
  return store.slice();
}

function clear() {
  store = [];
  persist();
}

load();

module.exports = { addMessage, getAll, clear };
