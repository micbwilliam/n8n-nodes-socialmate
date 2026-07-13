import { describe, it, expect } from 'vitest';
import { normalizeChatId, normalizeBaseUrl } from '../../nodes/SocialMate/GenericFunctions';

// These rules MUST mirror the app's `phoneOrGroupToJid` (src/shared/formatting.ts)
// exactly — the node returns bare digits and the server appends the JID suffix,
// so any divergence in the digit-normalisation would send to the wrong number.
describe('normalizeChatId — phone/JID rule parity with the app', () => {
	it.each([
		['+1 (555) 123-4567', '15551234567'],
		['15551234567', '15551234567'],
		['0044 20 7946 0958', '442079460958'], // 00 international access code → dropped
		['00201553806868', '201553806868'],
		['  +49 30 1234567  ', '49301234567'], // trims + strips punctuation
	])('normalises phone %s → %s', (input, expected) => {
		expect(normalizeChatId(input)).toBe(expected);
	});

	it('passes a group JID through unchanged', () => {
		expect(normalizeChatId('120363042000000000@g.us')).toBe('120363042000000000@g.us');
	});

	it('passes a 1:1 JID through unchanged', () => {
		expect(normalizeChatId('15551234567@s.whatsapp.net')).toBe('15551234567@s.whatsapp.net');
	});

	it('preserves a bare legacy group id (12+ digits - suffix) without stripping the hyphen', () => {
		expect(normalizeChatId('120363042000000000-1609459200')).toBe('120363042000000000-1609459200');
	});

	it('does NOT treat a short dashed phone as a group id', () => {
		// Fewer than 12 leading digits → not the group pattern → punctuation stripped.
		expect(normalizeChatId('555-1234')).toBe('5551234');
	});

	it('throws on an empty/whitespace input', () => {
		expect(() => normalizeChatId('   ')).toThrow(/required/i);
	});
});

describe('normalizeBaseUrl', () => {
	it('strips trailing slashes', () => {
		expect(normalizeBaseUrl('http://127.0.0.1:3456/')).toBe('http://127.0.0.1:3456');
		expect(normalizeBaseUrl('https://api.example.com//')).toBe('https://api.example.com');
	});

	it('adds https:// when no scheme is present (named tunnel host)', () => {
		expect(normalizeBaseUrl('api.example.com')).toBe('https://api.example.com');
	});

	it('keeps an explicit http scheme (localhost dev)', () => {
		expect(normalizeBaseUrl('http://localhost:3456')).toBe('http://localhost:3456');
	});

	it('returns empty string for empty input', () => {
		expect(normalizeBaseUrl('')).toBe('');
		expect(normalizeBaseUrl(null)).toBe('');
		expect(normalizeBaseUrl(undefined)).toBe('');
	});
});

// ── The national-number trap (mirrors SM4's assertSendableRecipient) ────────
// Regression: "01281839243" (how an Egyptian writes their own number) used to be
// passed straight through with its trunk prefix, producing a malformed recipient
// that WhatsApp accepts and then silently drops. E.164 numbers never begin with 0.
// SM4 and this node MUST agree on which recipients are sendable, or a workflow
// succeeds here and dies in the app.
describe('normalizeChatId — national numbers', () => {
	it('refuses a national number with a trunk prefix, and says how to fix it', () => {
		for (const national of ['01281839243', '0128 183 9243', '07700900123']) {
			expect(() => normalizeChatId(national)).toThrow(/national number/i);
			expect(() => normalizeChatId(national)).toThrow(/country code/i);
		}
	});

	it('never returns a recipient that starts with 0', () => {
		for (const ok of ['+201281839243', '201281839243', '00201281839243', '+20 128 183 9243']) {
			expect(normalizeChatId(ok).startsWith('0')).toBe(false);
		}
	});

	it('accepts the same number once it carries its country code', () => {
		for (const ok of ['+201281839243', '201281839243', '+20 128 183 9243', '00201281839243']) {
			expect(normalizeChatId(ok)).toBe('201281839243');
		}
	});

	it('still passes JIDs and group ids through untouched', () => {
		expect(normalizeChatId('201281839243@s.whatsapp.net')).toBe('201281839243@s.whatsapp.net');
		expect(normalizeChatId('120363042000000000-1609459200')).toBe('120363042000000000-1609459200');
	});
});
