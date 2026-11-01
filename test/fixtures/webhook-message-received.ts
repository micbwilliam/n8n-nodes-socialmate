/**
 * The body the SocialMate Trigger receives for `message.received` /
 * `message.sent` — and therefore exactly what `$('SocialMate Trigger').item.json`
 * is, because the Trigger emits the delivered body as-is
 * (`returnJsonArray([body])`; there is no `body` wrapper — that is n8n's generic
 * Webhook node).
 *
 * Envelope: ~/Desktop/SM4/src/main/services/webhook-sender.ts (`WebhookPayload`:
 * version, event, timestamp, tunnelUrl, data).
 * `data`: ~/Desktop/SM4/src/main/router/router.ts `emitMessageWebhooks`; `chat`
 * from `lookupChatInfo`; `media` from src/main/services/media-block.ts
 * `buildMediaApiBlock` (null for a text message — filled in here so example
 * expressions that read media fields can be checked too).
 */
export const MESSAGE_RECEIVED_PAYLOAD = {
	version: 1,
	event: 'message.received',
	timestamp: '2026-11-01T10:00:00.000Z',
	tunnelUrl: null,
	data: {
		account: { id: 'acc1', phone: '15550001111', name: 'Shop' },
		accountId: 'acc1',
		messageId: '3EB0C431C26A1916E2A5',
		chat: {
			id: '15551234567',
			name: 'Sara',
			phone: '15551234567',
			jid: '15551234567@s.whatsapp.net',
			displayName: 'Sara',
			type: 'individual',
		},
		chatId: '15551234567',
		sender: {
			id: '15551234567',
			name: 'Sara',
			phone: '15551234567',
			jid: '15551234567@s.whatsapp.net',
			lid: null,
			displayName: 'Sara',
		},
		senderId: '15551234567',
		body: 'Hi, where is my order?',
		type: 'image',
		timestamp: 1_793_527_200_000,
		fromMe: false,
		source: 'phone',
		hasMedia: true,
		media: {
			id: 'media-1',
			kind: 'image',
			mimeType: 'image/jpeg',
			fileName: null,
			fileSize: 52_000,
			caption: 'Hi, where is my order?',
			width: 1080,
			height: 1920,
			durationSec: null,
			isVoice: false,
			isAnimated: false,
			state: 'pending',
			hasThumbnail: true,
			apiPath: null,
			thumbnailApiPath: '/v1/accounts/acc1/media/media-1/thumbnail',
			context: null,
			contextSource: null,
			contextAt: null,
			needsContext: true,
		},
		metadata: null,
		replyTo: null,
	},
};
