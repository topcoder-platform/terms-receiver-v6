import { Injectable } from '@nestjs/common';
import { config } from './config.js';
import { ApiError } from './errors.js';

@Injectable()
export class Integrations {
  private token?: { value: string; expires: number };
  private pendingToken?: Promise<string>;
  async request(url: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
    const body = await response.json();
    if (!response.ok) {
      const err = new ApiError(response.status, 'Integration request failed');
      Object.assign(err, { response: { status: response.status, body } });
      throw err;
    }
    return body;
  }
  async machineToken(): Promise<string> {
    if (this.token && this.token.expires > Date.now()) return this.token.value;
    if (this.pendingToken) return this.pendingToken;
    this.pendingToken = this.request(config.AUTH0_PROXY_SERVER_URL || config.AUTH0_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', client_id: config.AUTH0_CLIENT_ID, client_secret: config.AUTH0_CLIENT_SECRET, audience: config.AUTH0_AUDIENCE })
    }).then(body => {
      this.token = { value: body.access_token, expires: Date.now() + Math.min(Number(body.expires_in || 3600) - 60, Number(config.TOKEN_CACHE_TIME) * 60) * 1000 };
      return body.access_token;
    }).finally(() => { this.pendingToken = undefined; });
    return this.pendingToken!;
  }
  async postEvent(topic: string, payload: unknown) {
    return this.request(`${config.BUSAPI_URL.replace(/\/$/, '')}/bus/events`, {
      method: 'POST', headers: { Authorization: `Bearer ${await this.machineToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, originator: config.KAFKA_MESSAGE_ORIGINATOR, timestamp: new Date().toISOString(), 'mime-type': 'application/json', payload }, (_k, v) => typeof v === 'bigint' ? Number(v) : v)
    });
  }
  async publishSafely(topic: string, payload: unknown) {
    try { await this.postEvent(topic, payload); } catch { console.error(`Failed to publish ${topic}.`); }
  }
}
