import { createM2MClient, createBusApiClient, type M2MClient, type BusApiClient } from 'tc-core-library-js';
import { Injectable } from '@nestjs/common';
import { config } from './config.js';
import { ApiError } from './errors.js';

@Injectable()
export class Integrations {
  private m2m?: M2MClient;
  private bus?: BusApiClient;
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
    this.m2m ??= createM2MClient({
      AUTH0_URL: config.AUTH0_URL,
      AUTH0_AUDIENCE: config.AUTH0_AUDIENCE,
      AUTH0_PROXY_SERVER_URL: config.AUTH0_PROXY_SERVER_URL,
      TOKEN_CACHE_TIME: config.TOKEN_CACHE_TIME,
      timeoutMs: 30000
    });
    return this.m2m.getMachineToken(config.AUTH0_CLIENT_ID || '', config.AUTH0_CLIENT_SECRET || '');
  }
  async postEvent(topic: string, payload: unknown) {
    this.bus ??= createBusApiClient({
      BUSAPI_URL: config.BUSAPI_URL,
      getToken: () => this.machineToken(),
      timeoutMs: 30000
    });
    const result = await this.bus.postEvent({
      topic, originator: config.KAFKA_MESSAGE_ORIGINATOR,
      timestamp: new Date().toISOString(), 'mime-type': 'application/json',
      // Preserve the existing numeric JSON representation of database bigint IDs.
      payload: JSON.parse(JSON.stringify(payload, (_k, value) => typeof value === 'bigint' ? Number(value) : value))
    });
    return result.body;
  }
  async publishSafely(topic: string, payload: unknown) {
    try { await this.postEvent(topic, payload); } catch { console.error(`Failed to publish ${topic}.`); }
  }
}
