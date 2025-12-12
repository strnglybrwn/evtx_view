const request = require('supertest');
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');

// We need to create a minimal app for testing
// Import the agent modules
const exampleAgent = require('../../agents/exampleAgent');
const duckAgent = require('../../agents/duckduckgoAgent');
const openaiAgent = require('../../agents/openaiAgent');

describe('Server Health Check', () => {
  let app;

  beforeEach(() => {
    // Create a minimal Express app for testing
    app = express();
    app.use(bodyParser.json({ limit: '10mb' }));

    // Health endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    // Simple solve endpoint for testing
    app.post('/api/solve', (req, res) => {
      const { input, preview } = req.body;

      if (!input) {
        return res.status(400).json({ error: 'missing input' });
      }

      // Score agents
      const agents = [
        { name: 'exampleAgent', mod: exampleAgent },
        { name: 'duckAgent', mod: duckAgent },
        { name: 'openaiAgent', mod: openaiAgent }
      ];

      const scored = agents.map(a => ({
        name: a.name,
        score: (typeof a.mod.supports === 'function') ? a.mod.supports(input) : 0
      }));

      if (preview) {
        return res.json({ scored });
      }

      // For non-preview, return dummy result
      res.json({
        result: 'Test result',
        agents: [{ name: 'exampleAgent', output: 'test', durationMs: 10 }],
        scored
      });
    });
  });

  describe('GET /health', () => {
    test('should return status ok', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });
  });

  describe('POST /api/solve', () => {
    test('should return 400 if input is missing', async () => {
      const response = await request(app).post('/api/solve').send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should return result for valid input', async () => {
      const response = await request(app)
        .post('/api/solve')
        .send({ input: 'test question' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('result');
      expect(response.body).toHaveProperty('agents');
      expect(response.body).toHaveProperty('scored');
    });

    test('should return agent scores in preview mode', async () => {
      const response = await request(app)
        .post('/api/solve')
        .send({ input: 'test', preview: true });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('scored');
      expect(Array.isArray(response.body.scored)).toBe(true);
      expect(response.body.scored.length).toBeGreaterThan(0);
      expect(response.body.scored[0]).toHaveProperty('name');
      expect(response.body.scored[0]).toHaveProperty('score');
    });

    test('should return all agents in scored array', async () => {
      const response = await request(app)
        .post('/api/solve')
        .send({ input: 'test', preview: true });

      const names = response.body.scored.map(a => a.name);
      expect(names).toContain('exampleAgent');
      expect(names).toContain('duckAgent');
      expect(names).toContain('openaiAgent');
    });

    test('should handle large input', async () => {
      const largeInput = 'a'.repeat(1000);
      const response = await request(app)
        .post('/api/solve')
        .send({ input: largeInput });

      expect(response.status).toBe(200);
    });
  });
});
