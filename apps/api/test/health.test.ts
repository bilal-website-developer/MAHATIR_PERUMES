import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';

describe('Health and Status Endpoints', () => {
  const app = createApp();

  it('GET /health returns 200 with status ok and standard { data, error, meta } format', async () => {
    // Basic test using node's http server or supertest-like invocation
    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 4000;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('status', 'ok');
      expect(body.data).toHaveProperty('service', 'Mahatir Perfumes ERP API');
      expect(body.error).toBeNull();
    } finally {
      server.close();
    }
  });

  it('GET /health/db returns 200 with database health status', async () => {
    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 4000;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/health/db`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toHaveProperty('database');
      expect(body.error).toBeNull();
    } finally {
      server.close();
    }
  });

  it('GET /api/v1/settings returns standard default settings', async () => {
    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 4000;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/settings`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toHaveProperty('company_name', 'Mahatir Perfumes');
      expect(body.data).toHaveProperty('currency', 'USD');
    } finally {
      server.close();
    }
  });
});
