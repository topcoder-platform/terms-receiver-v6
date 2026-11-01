import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../dist/app.js';
import { config } from '../dist/config.js';
import { ReceiverService } from '../dist/receiver.service.js';
import { verifySignature } from '../dist/receiver.controller.js';
import { Database } from '../dist/database.js';
import { Integrations } from '../dist/integrations.js';
let app: Awaited<ReturnType<typeof createApp>>;
before(async () => { app = await createApp(); });
after(async () => { await app?.close(); });
const xml = (id: string, status = 'Completed') => `<DocuSignEnvelopeInformation><EnvelopeStatus><EnvelopeID>${id}</EnvelopeID><Status>${status}</Status><RecipientStatuses><RecipientStatus><Email>a@example.com</Email></RecipientStatus></RecipientStatuses><DocumentStatuses><DocumentStatus><TemplateName>Other</TemplateName></DocumentStatus></DocumentStatuses></EnvelopeStatus></DocuSignEnvelopeInformation>`;
const sign = (body: string) => createHmac('sha256', config.DOCUSIGN.HMAC_KEYS[0]).update(body).digest('base64');
test('HMAC checks raw bytes and supports key rotation and numbered signatures', () => {
  const body = Buffer.from('exact bytes');
  const signature = createHmac('sha256', 'second').update(body).digest('base64');
  assert.equal(verifySignature(body, { 'x-docusign-signature-1': 'wrong', 'x-docusign-signature-2': signature }, ['first', 'second']), true);
  assert.equal(verifySignature(Buffer.from('changed'), { 'x-docusign-signature-1': signature }, ['second']), false);
});
test('webhook preserves signature, XML parsing and validation contracts', async () => {
  const server = app.getHttpServer(), service = app.get(ReceiverService), original = service.callback;
  let received: unknown;
  service.callback = async value => { received = value; return { message: 'success' }; };
  try {
    await request(server).get('/v5/terms-receiver').expect(200, { message: 'hello!' });
    await request(server).post('/v5/terms-receiver/webhook').type('xml').send(xml('ABC')).expect(403, { message: 'Failed to verify the Docusign signature' });
    const body = xml(' ABC ');
    await request(server).post('/v5/terms-receiver/webhook').type('xml').set('x-docusign-signature-1', sign(body)).send(body).expect(200, { message: 'success' });
    assert.deepEqual(received, { envelopeId: ' ABC ', status: 'Completed', recipientEmail: 'a@example.com', templateName: 'Other' });
    await request(server).post('/v5/terms-receiver/webhook').type('xml').set('x-docusign-signature-1', sign('<broken')).send('<broken').expect(400, { message: '"data.status" is required' });
  } finally { service.callback = original; }
});
test('transaction commits agreement before optional publications; duplicate delivery is idempotent', { skip: !process.env.TERMS_TEST_DATABASE }, async () => {
  assert.match(config.POSTGRES_URL, /(?:localhost|127\.0\.0\.1):\d+\/terms_contract_test$/);
  const db = app.get(Database), service = app.get(ReceiverService), api = app.get(Integrations);
  const id = '534cf8a8-e946-4aa5-adf0-ff5b7b21fabc';
  await db.termsOfUse.upsert({ where: { id }, create: { id, title: 'Webhook', typeId: 1n, created: new Date() }, update: {} });
  await db.termsOfUseDocusignTemplateXref.upsert({ where: { termsOfUseId: id }, create: { termsOfUseId: id, docusignTemplateId: 'Template-ABC' }, update: {} });
  await db.docusignEnvelope.upsert({ where: { id: 'Envelope-ABC' }, create: { id: 'Envelope-ABC', userId: 321n, docusignTemplateId: 'TEMPLATE-ABC', isCompleted: 0n }, update: { isCompleted: 0n } });
  await db.userTermsOfUseXref.deleteMany({ where: { userId: 321n, termsOfUseId: id } });
  const published: string[] = [];
  api.postEvent = async topic => {
    assert.ok(await db.userTermsOfUseXref.findUnique({ where: { userId_termsOfUseId: { userId: 321n, termsOfUseId: id } } }));
    published.push(topic); throw new Error('BUS unavailable');
  };
  assert.deepEqual(await service.callback({ envelopeId: ' ENVELOPE-ABC ', status: 'Completed' }), { message: 'success' });
  assert.equal((await db.docusignEnvelope.findUnique({ where: { id: 'Envelope-ABC' } }))?.isCompleted, 1n);
  assert.deepEqual(await service.callback({ envelopeId: 'envelope-abc', status: 'Completed' }), { message: 'success' });
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(published.filter(topic => topic === config.USER_AGREED_TERMS_TOPIC).length, 1);
  assert.equal(await db.userTermsOfUseXref.count({ where: { userId: 321n, termsOfUseId: id } }), 1);
});
