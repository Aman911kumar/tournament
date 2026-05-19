/**
 * Provider contract.
 *
 * A provider must implement:
 * - name: string
 * - priority: number (lower = earlier)
 * - isConfigured(): boolean
 * - healthCheck(): Promise<{ ok: boolean; reason?: string; checkedAt: Date }>
 * - send(request): Promise<{ messageId?: string; raw?: unknown }>
 *
 * Providers must not throw secrets in error messages.
 */

export const EMAIL_PROVIDER_INTERFACE_VERSION = 1;

