import { Injectable } from '@nestjs/common';
import { Database } from './database.js';
import { Integrations } from './integrations.js';
import { config } from './config.js';
import { ApiError } from './errors.js';
export type Callback = { envelopeId: string; status: string; recipientEmail?: string; templateName?: string };
@Injectable()
export class ReceiverService {
  constructor(private readonly db: Database, private readonly api: Integrations) {}
  private async taxForm(data: Callback) {
    if (!config.TAXFORM_NOTIFY_TEMPLATE_NAMES.includes(data.templateName!)) return;
    try {
      const url = new URL(config.TOPCODER_USERS_API);
      url.searchParams.set('filter', `email=${data.recipientEmail}`);
      url.searchParams.set('fields', 'handle,id,email,firstName,lastName');
      const body = await this.api.request(url.toString(), { headers: { Authorization: `Bearer ${await this.api.machineToken()}`, Accept: 'application/json' } });
      const user = body.result.content[0];
      await this.api.publishSafely(config.USER_TAXFORM_UPDATE_TOPIC, { userId: user.id, taxForm: data.templateName, Handle: user.handle, created: new Date() });
    } catch { console.error(`Failed to prepare ${config.USER_TAXFORM_UPDATE_TOPIC}.`); }
  }
  async callback(data: Callback) {
    const normalized = data.envelopeId.trim().toLowerCase();
    if (data.status !== 'Completed' || !normalized) return { message: 'success' };
    let envelope: { id: string; userId: bigint; docusignTemplateId: string } | null = null;
    let agreement: Record<string, unknown> | undefined;
    let foundMapping = false;
    let transactionStarted = false;
    try {
      await this.db.$transaction(async tx => {
        transactionStarted = true;
        envelope = await tx.docusignEnvelope.findFirst({ where: { id: { equals: normalized, mode: 'insensitive' } } });
        if (!envelope) return;
        await tx.docusignEnvelope.update({ where: { id: envelope.id }, data: { isCompleted: 1n } });
        const mapping = await tx.termsOfUseDocusignTemplateXref.findFirst({ where: { docusignTemplateId: { equals: envelope.docusignTemplateId.trim().toLowerCase(), mode: 'insensitive' } } });
        if (!mapping) return;
        foundMapping = true;
        const term = await tx.termsOfUse.findUnique({ where: { id: mapping.termsOfUseId } });
        if (!term) throw new Error(`No terms of use exists for id: ${mapping.termsOfUseId}`);
        const where = { userId_termsOfUseId: { userId: envelope.userId, termsOfUseId: mapping.termsOfUseId } };
        if (await tx.userTermsOfUseBanXref.findUnique({ where }) || await tx.userTermsOfUseXref.findUnique({ where })) return;
        const created = new Date();
        await tx.userTermsOfUseXref.create({ data: { userId: envelope.userId, termsOfUseId: mapping.termsOfUseId, created } });
        agreement = { userId: envelope.userId, termsOfUseId: mapping.termsOfUseId, legacyId: term.legacyId, created };
      });
    } catch (error: any) {
      if (!transactionStarted) throw error;
      const failedEnvelope = envelope as { id: string; userId: bigint; docusignTemplateId: string } | null;
      const params = { subject: config.DOCUSIGN.CALLBACK_FAILED_EMAIL_SUBJECT, toAddress: config.DOCUSIGN.CALLBACK_FAILED_SUPPORT_EMAIL_ADDRESS, fromAddress: config.DOCUSIGN.CALLBACK_FAILED_FROM_EMAIL_ADDRESS, userId: failedEnvelope?.userId, templateId: failedEnvelope?.docusignTemplateId, envelopeId: failedEnvelope?.id || normalized, message: error.message };
      void this.api.publishSafely(config.TERMS_EMAIL_SUPPORT_TOPIC, { payload: { data: params, version: 'v3', recipients: [params.toAddress], from: { name: 'Terms receiver', email: params.fromAddress } } });
      if (error.temporary === true) throw new ApiError(500, error.message);
      return { message: error.message };
    }
    void this.taxForm(data);
    if (foundMapping) {
      if (agreement) void this.api.publishSafely(config.USER_AGREED_TERMS_TOPIC, agreement);
      void this.api.publishSafely(config.DOCUSIGN_ENVELOPE_UPDATE_TOPIC, { payload: { envelopeId: data.envelopeId, status: data.status } });
    }
    return { message: 'success' };
  }
}
