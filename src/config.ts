export const config = {
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
  PORT: process.env.PORT || 3000,

  AUTH_SECRET: process.env.AUTH_SECRET || 'mysecret',
  VALID_ISSUERS: process.env.VALID_ISSUERS || '["https://api.topcoder-dev.com", "https://api.topcoder.com", "https://topcoder-dev.auth0.com/"]',

  POSTGRES_URL: process.env.POSTGRES_URL || 'postgres://postgres:password@localhost:5432/postgres',
  DB_SCHEMA_NAME: process.env.DB_SCHEMA_NAME || 'termsdb',

  AUTH0_URL: process.env.AUTH0_URL || 'https://topcoder-dev.auth0.com/oauth/token',
  AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE || 'https://m2m.topcoder-dev.com/',
  TOKEN_CACHE_TIME: process.env.TOKEN_CACHE_TIME || 120,
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID || '',
  AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET || '',
  AUTH0_PROXY_SERVER_URL: process.env.AUTH0_PROXY_SERVER_URL || 'https://topcoder-dev.auth0.com/oauth/token',

  BUSAPI_URL: process.env.BUSAPI_URL || 'https://api.topcoder-dev.com/v5',
  KAFKA_ERROR_TOPIC: process.env.KAFKA_ERROR_TOPIC || 'common.error.reporting',
  KAFKA_MESSAGE_ORIGINATOR: process.env.KAFKA_MESSAGE_ORIGINATOR || 'terms-receiver',
  TERMS_EMAIL_SUPPORT_TOPIC: process.env.TERMS_UPDATE_TOPIC || 'terms.action.email.support',
  DOCUSIGN_ENVELOPE_UPDATE_TOPIC: process.env.DOCUSIGN_ENVELOPE_UPDATE_TOPIC || 'terms.notification.docusign.envelope.updated',
  USER_AGREED_TERMS_TOPIC: process.env.USER_AGREED_TERMS_TOPIC || 'terms.notification.user.agreed',
  USER_TAXFORM_UPDATE_TOPIC: process.env.USER_TAXFORM_UPDATE_TOPIC || 'terms.notification.user.taxform.updated',
  TAXFORM_NOTIFY_TEMPLATE_NAMES: (process.env.TAXFORM_NOTIFY_TEMPLATE_NAMES || 'W-9(TopCoder),W-8BEN(TopCoder)').split(','),
  TOPCODER_USERS_API: process.env.TOPCODER_USERS_API || 'https://api.topcoder-dev.com/v3/users',

  DOCUSIGN: {
    USERNAME: process.env.DOCUSIGN_USERNAME,
    PASSWORD: process.env.DOCUSIGN_PASSWORD,
    INTEGRATOR_KEY: process.env.DOCUSIGN_INTEGRATOR_KEY,
    HMAC_KEYS: process.env.DOCUSIGN_HMAC_KEYS ? process.env.DOCUSIGN_HMAC_KEYS.split(',') : ['key1', 'key2'],
    SERVER_URL: process.env.DOCUSIGN_SERVER_URL || 'https://demo.docusign.net/restapi/v2/',
    W9TEMPLATE_ID: process.env.DOCUSIGN_W9TEMPLATE_ID,
    W8BEN_TEMPLATE_ID: process.env.DOCUSIGN_W8BEN_TEMPLATE_ID,
    NDA_TEMPLATE_ID: process.env.DOCUSIGN_NDA_TEMPLATE_ID,
    AFFIDAVIT_TEMPLATE_ID: process.env.DOCUSIGN_AFFIDAVIT_TEMPLATE_ID,
    ASSIGNMENT_TERMS_OF_USE_ID: process.env.ASSIGNMENT_TERMS_OF_USE_ID,
    CALLBACK_FAILED_EMAIL_SUBJECT: process.env.DOCUSIGN_CALLBACK_FAILED_EMAIL_SUBJECT || 'Processing DocuSign document failed',
    CALLBACK_CONNECT_KEY: process.env.DOCUSIGN_CALLBACK_CONNECT_KEY,
    CALLBACK_FAILED_SUPPORT_EMAIL_ADDRESS: process.env.DOCUSIGN_CALLBACK_FAILED_SUPPORT_EMAIL_ADDRESS,
    CALLBACK_FAILED_FROM_EMAIL_ADDRESS: process.env.DOCUSIGN_CALLBACK_FAILED_FROM_EMAIL_ADDRESS
  },

  BASE_PATH: process.env.BASE_PATH || '/v5'
}
