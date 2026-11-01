/**
 * SocialMate API error replies, exactly as a client receives them.
 *
 * Each body is copied from a `reply.code(N).send({...})` call in the app
 * (~/Desktop/SM4/src/main/services/api-server.ts unless noted), and then put
 * through the app's `onSend` hook (api-server.ts, "Response envelope (API
 * v1.1)"), which rewrites every error into `{ error: { code, message, ...extra } }`:
 *   · `{ error: '<code>', message, ...extra }` → `code` = that string;
 *   · `{ error: '<human text>', ...extra }`   → `code` = defaultErrorCode(status),
 *     `message` = the text; an explicit sibling `code` in `extra` wins.
 *
 * The mock server serves these bodies and the tests assert on them. Hand-written
 * mock shapes are how MCP and n8n mocks drifted from what the server actually
 * sends. When the app changes one of these replies, change it here first and let
 * the failing test show what the node needs.
 */
export interface ErrorEnvelopeFixture {
	status: number;
	/** Response headers the route sets (only Retry-After matters to clients). */
	headers?: Record<string, string>;
	body: { error: Record<string, unknown> };
}

export const API_ERRORS = {
	/** api-server.ts onRequest auth hook: `reply.code(401).send({ error: 'Invalid API key' })`. */
	unauthorized: {
		status: 401,
		body: { error: { code: 'unauthorized', message: 'Invalid API key' } },
	},

	/** pro-gate.ts `requireProRest(reply, feature)`. */
	licenseRequired: {
		status: 402,
		body: {
			error: {
				code: 'license_required',
				message: "Feature 'localMessageCache' requires a Pro license",
				feature: 'localMessageCache',
				tier: 'pro',
			},
		},
	},

	/** api-server.ts `assertWebhookEventsAllowed` (POST/PATCH /v1/webhooks with a Pro event on Free). */
	webhookEventsRequirePro: {
		status: 402,
		body: {
			error: {
				code: 'license_required',
				message: 'These webhook events require Pro: message.delivered',
				feature: 'webhookMaxEndpoints',
				tier: 'pro',
			},
		},
	},

	/** api-server.ts `assertWebhookEndpointCap` (third endpoint on Free). */
	webhookEndpointCap: {
		status: 402,
		body: {
			error: {
				code: 'license_required',
				message: 'Free tier is limited to 2 webhook endpoints. Upgrade to Pro for unlimited.',
				feature: 'webhookMaxEndpoints',
				tier: 'pro',
			},
		},
	},

	/** api-server.ts onRequest scope check: `error: 'insufficient_scope'`. */
	insufficientScope: {
		status: 403,
		body: {
			error: {
				code: 'insufficient_scope',
				message: "Key requires 'admin' scope",
				required: 'admin',
				have: ['read', 'send'],
			},
		},
	},

	/** api-server.ts onRequest account-scope check: `error: 'account_scope_mismatch'`. */
	accountScopeMismatch: {
		status: 403,
		body: {
			error: {
				code: 'account_scope_mismatch',
				message: 'This key is scoped to a different account',
				scopedTo: ['acc1'],
				requested: 'acc2',
			},
		},
	},

	/** api-server.ts onRequest Free account-limit cascade: `error: 'account_suspended_free'`. */
	accountSuspendedFree: {
		status: 403,
		body: {
			error: {
				code: 'account_suspended_free',
				message: 'Every account this key is scoped to is suspended on Free. Upgrade to Pro to reactivate.',
				scopedTo: ['acc1'],
			},
		},
	},

	/** api-server.ts POST /v1/accounts/:id/queue/import with batch sending off: `error: 'bulk_import_disabled'`. */
	bulkImportDisabled: {
		status: 403,
		body: {
			error: {
				code: 'bulk_import_disabled',
				message:
					'Batch sending is turned off. SocialMate is a personal messaging tool, not a ' +
					'broadcaster, so this is off by default. Ask the user to switch it on in the app ' +
					'under Settings → Advanced → Enable batch sending — every recipient must have ' +
					'consented. Do not work around this: send individually via ' +
					'POST /v1/accounts/{id}/messages, and never loop a send over a list.',
			},
		},
	},

	/** api-server.ts `replyGroupError(reply, err, 'leave the group')`: `error: 'group_forbidden'`. */
	groupForbidden: {
		status: 403,
		body: {
			error: {
				code: 'group_forbidden',
				message:
					'WhatsApp refused to leave the group: this account is not an admin of the group ' +
					'(or the group restricts the action to admins). This will not succeed on retry.',
			},
		},
	},

	/** api-server.ts every adapter route: `reply.code(409).send({ error: 'Account is not connected' })`. */
	accountNotConnected: {
		status: 409,
		body: { error: { code: 'conflict', message: 'Account is not connected' } },
	},

	/** api-server.ts onRequest per-key limiter (`tryConsumeKeyToken`): retryable, no `reason`. */
	perKeyRateLimited: {
		status: 429,
		headers: { 'retry-after': '1' },
		body: { error: { code: 'rate_limited', message: 'Per-key request rate exceeded', retryAfterMs: 5 } },
	},

	/**
	 * api-server.ts POST /v1/accounts/:id/messages, text path, Free (no
	 * apiSmartQueue) — an AntiBanError from the warming gate (pipeline.ts
	 * `reason: 'warming'`, cold outbound capped per phase).
	 */
	antiBanWarming: {
		status: 429,
		headers: { 'retry-after': '3600' },
		body: {
			error: {
				code: 'rate_limited',
				message: 'Warming limit for new contacts reached (20/20 this phase)',
				reason: 'warming',
				retryAfterMs: 3_600_000,
				hint: 'Upgrade to Pro to auto-queue blocked sends and have them retried when the block clears.',
				upgrade: { tier: 'pro', feature: 'apiSmartQueue' },
			},
		},
	},

	/** Same route, quiet hours (pipeline.ts `AntiBanError('Quiet hours active', { reason: 'night_mode' })`). */
	antiBanNightMode: {
		status: 429,
		headers: { 'retry-after': '3600' },
		body: {
			error: {
				code: 'rate_limited',
				message: 'Quiet hours active',
				reason: 'night_mode',
				retryAfterMs: 3_600_000,
				hint: 'Quiet hours are active. Upgrade to Pro to auto-queue this send and deliver it when quiet hours end.',
				upgrade: { tier: 'pro', feature: 'apiSmartQueue' },
			},
		},
	},

	/**
	 * Signal lane (react / mark read / presence). The routes re-throw the
	 * AntiBanError and the shared `setErrorHandler` replies — so there is NO
	 * Retry-After header, and the explicit `code: err.code` wins over the
	 * status-derived code. Message from pipeline.ts `signal_rate_limit`.
	 */
	signalRateLimitShort: {
		status: 429,
		body: {
			error: {
				code: 'ANTI_BAN_SIGNAL_RATE_LIMIT',
				message: 'Signal rate limit hit (signal_minute_limit). Try again in 1s.',
				reason: 'signal_rate_limit',
				retryAfterMs: 5,
				factor: 'signal_minute_limit',
			},
		},
	},

	/** Same, but an hourly cap: the wait is far longer than a run should sleep. */
	signalRateLimitLong: {
		status: 429,
		body: {
			error: {
				code: 'ANTI_BAN_SIGNAL_RATE_LIMIT',
				message: 'Signal rate limit hit (signal_hour_limit). Try again in 1800s.',
				reason: 'signal_rate_limit',
				retryAfterMs: 1_800_000,
				factor: 'signal_hour_limit',
			},
		},
	},
} satisfies Record<string, ErrorEnvelopeFixture>;

export type ApiErrorName = keyof typeof API_ERRORS;
