import { Controller, Get, Post, Req, Res, HttpCode } from '@nestjs/common';
import type { Response } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { parseStringPromise } from 'xml2js';
import { ReceiverService } from './receiver.service.js';
import { ApiError } from './errors.js';
import { config } from './config.js';
export function verifySignature(body: Buffer, headers: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    const expected = createHmac('sha256', key).update(body).digest('base64');
    for (let index = 1; headers[`x-docusign-signature-${index}`]; index++) {
      const supplied = String(headers[`x-docusign-signature-${index}`]);
      const a = Buffer.from(expected), b = Buffer.from(supplied);
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    }
  }
  return false;
}
@Controller(config.BASE_PATH + '/terms-receiver')
export class ReceiverController {
  constructor(private readonly receiver: ReceiverService) {}
  @Get() hello() { return { message: 'hello!' }; }
  @Post('webhook') @HttpCode(200) async webhook(@Req() req: any, @Res() res: Response) {
    const body = Buffer.isBuffer(req.body) ? req.body : req.rawBody;
    if (!body || !verifySignature(body, req.headers, config.DOCUSIGN.HMAC_KEYS)) throw new ApiError(403, 'Failed to verify the Docusign signature');
    let parsed: any;
    try { parsed = await parseStringPromise(body.toString('utf8')); } catch { parsed = {}; }
    const envelope = parsed?.DocuSignEnvelopeInformation?.EnvelopeStatus?.[0];
    const status = envelope?.Status?.[0], envelopeId = envelope?.EnvelopeID?.[0];
    // The legacy receiver validates status before envelopeId with Joi.
    if (!status || typeof status !== 'string') throw new ApiError(400, status === '' ? '"data.status" is not allowed to be empty' : '"data.status" is required');
    if (!envelopeId || typeof envelopeId !== 'string') throw new ApiError(400, envelopeId === '' ? '"data.envelopeId" is not allowed to be empty' : '"data.envelopeId" is required');
    res.json(await this.receiver.callback({ envelopeId, status, recipientEmail: envelope.RecipientStatuses?.[0]?.RecipientStatus?.[0]?.Email?.[0], templateName: envelope.DocumentStatuses?.[0]?.DocumentStatus?.[0]?.TemplateName?.[0] }));
  }
}
