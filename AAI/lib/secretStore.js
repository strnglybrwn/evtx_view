// Simple secret store that persists to .env.local in repository root.
// WARNING: This is a development convenience only. Secrets are stored in plaintext on disk.
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const FILE = path.join(__dirname, '..', '.env.local');
const store = new Map();

function loadFromDisk() {
  try {
    if (!fs.existsSync(FILE)) return;
    const contents = fs.readFileSync(FILE, 'utf8');
    contents.split('\n').forEach(line => {
      const idx = line.indexOf('=');
      if (idx > 0) {
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx+1).trim();
        if (k) store.set(k, v);
      }
    });
    logger.debug('Loaded secrets from disk', { file: FILE, count: store.size });
  } catch (e) {
    logger.warn('Failed to load secrets from disk', { error: e.message });
  }
}

function persistToDisk() {
  try {
    const lines = [];
    for (const [k, v] of store.entries()) lines.push(`${k}=${v}`);
    fs.writeFileSync(FILE, lines.join('\n'), { encoding: 'utf8', mode: 0o600 });
    logger.debug('Persisted secrets to disk', { file: FILE });
  } catch (e) {
    logger.warn('Failed to persist secrets to disk', { error: e.message });
  }
}

loadFromDisk();

function set(key, value) {
  store.set(key, value);
  persistToDisk();
  logger.debug('Secret store updated', { key });
}

function get(key) {
  return store.has(key) ? store.get(key) : null;
}

function clear(key) {
  if (key) store.delete(key);
  else store.clear();
  persistToDisk();
  logger.debug('Secret store cleared', { key: key || 'all' });
}

module.exports = { set, get, clear };
