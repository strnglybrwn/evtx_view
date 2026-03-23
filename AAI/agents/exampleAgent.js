// Example agent: echoes and returns simple metadata
async function run(input) {
  // very small, deterministic transform — real agents can call external APIs or models
  const output = `I'm looking into the following question for you: ${input.trim()}`;
  const metadata = { length: output.length };
  // read transient api key if present (do NOT echo it back)
  let hasApiKey = false;
  try {
    const secretStore = require('../lib/secretStore');
    hasApiKey = !!secretStore.get('external_api_key');
  } catch (e) {}
  if (hasApiKey) metadata.hasApiKey = true;
  return { output, metadata };
}

// Simple capability: this agent is a generic conversational helper and can attempt any query
function supports(input) {
  // low-confidence generalist
  return 0.5;
}

const requirements = [];

module.exports = { run, supports, requirements };
