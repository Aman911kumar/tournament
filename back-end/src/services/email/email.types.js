/**
 * @typedef {Object} EmailAddress
 * @property {string} email
 * @property {string=} name
 */

/**
 * @typedef {Object} EmailSendRequest
 * @property {string} to
 * @property {string} subject
 * @property {string} html
 * @property {string=} text
 * @property {string=} from
 * @property {string=} replyTo
 * @property {string=} templateType
 * @property {Record<string, unknown>=} templateData
 * @property {string=} requestId
 * @property {string=} idempotencyKey
 * @property {"high"|"normal"|"low"=} priority
 */

/**
 * @typedef {Object} EmailProviderSendResult
 * @property {string=} messageId
 * @property {string=} providerMessageId
 * @property {unknown=} raw
 */

