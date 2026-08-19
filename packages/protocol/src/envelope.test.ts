import { describe, expect, it } from 'vitest';
import {
  EVENT_TYPES,
  PROTOCOL_VERSION,
  shouldApply,
  validateEnvelope,
  validateEventWithPayload,
  type EventEnvelope,
} from './envelope.js';

const validEnvelope = (overrides: Record<string, unknown> = {}) => ({
  eventId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  eventType: 'PLAYBACK_PLAY',
  roomId: '9c858901-8a57-4791-81fe-4c455b099bc9',
  actorId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  revision: 42,
  serverTimestamp: 1786780000000,
  protocolVersion: PROTOCOL_VERSION,
  payload: { mediaId: 'vid-1', position: 105.32, playbackRate: 1.0 },
  ...overrides,
});

describe('validateEnvelope', () => {
  it('accepts a well-formed envelope', () => {
    const result = validateEnvelope(validEnvelope());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.eventId).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301');
      expect(result.value.eventType).toBe('PLAYBACK_PLAY');
      expect(result.value.revision).toBe(42);
      expect(result.value.protocolVersion).toBe(PROTOCOL_VERSION);
    }
  });

  it('accepts a null actorId for server-originated events', () => {
    const result = validateEnvelope(
      validEnvelope({
        actorId: null,
        eventType: 'ROOM_CLOSED',
        payload: { reason: 'HOST_TERMINATED', closedAt: 1786780000000 },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('accepts revision zero as the initial room state', () => {
    const result = validateEnvelope(validEnvelope({ revision: 0 }));
    expect(result.ok).toBe(true);
  });

  it.each([
    ['non-object string', 'not-an-object'],
    ['null input', null],
    ['array input', []],
    ['number input', 12345],
    ['boolean input', true],
  ])('rejects %s', (_label, input) => {
    const result = validateEnvelope(input);
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown event type', () => {
    const result = validateEnvelope(validEnvelope({ eventType: 'UNKNOWN_EVENT_TYPE' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toMatch(/eventType/);
  });

  it('rejects an unsupported protocol version', () => {
    const result = validateEnvelope(validEnvelope({ protocolVersion: 999 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toMatch(/protocolVersion/);
  });

  it.each([
    'eventId',
    'eventType',
    'roomId',
    'actorId',
    'revision',
    'serverTimestamp',
    'protocolVersion',
    'payload',
  ])('rejects when missing required field: %s', (field) => {
    const base = validEnvelope();
    delete (base as Record<string, unknown>)[field];
    const result = validateEnvelope(base);
    expect(result.ok).toBe(false);
  });

  it('rejects a malformed eventId', () => {
    const result = validateEnvelope(validEnvelope({ eventId: 'not-a-uuid' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toMatch(/eventId/);
  });

  it('rejects a malformed roomId', () => {
    const result = validateEnvelope(validEnvelope({ roomId: 'invalid-room-id' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toMatch(/roomId/);
  });

  it('rejects a malformed actorId when not null', () => {
    const result = validateEnvelope(validEnvelope({ actorId: 'invalid-actor' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toMatch(/actorId/);
  });

  it('rejects negative revision numbers', () => {
    const result = validateEnvelope(validEnvelope({ revision: -1 }));
    expect(result.ok).toBe(false);
  });

  it('rejects fractional revision numbers', () => {
    const result = validateEnvelope(validEnvelope({ revision: 1.5 }));
    expect(result.ok).toBe(false);
  });

  it('accepts all known event types in the MVP catalog', () => {
    for (const eventType of EVENT_TYPES) {
      const result = validateEnvelope(validEnvelope({ eventType }));
      expect(result.ok).toBe(true);
    }
  });
});

describe('validateEventWithPayload', () => {
  it('validates a valid PLAYBACK_PLAY event with payload', () => {
    const raw = validEnvelope({
      eventType: 'PLAYBACK_PLAY',
      payload: { mediaId: 'video-123', position: 45.5, playbackRate: 1.25 },
    });
    const result = validateEventWithPayload(raw, 'PLAYBACK_PLAY');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.payload.mediaId).toBe('video-123');
      expect(result.value.payload.playbackRate).toBe(1.25);
    }
  });

  it('rejects PLAYBACK_PLAY when rate is outside range (0.25..4.0)', () => {
    const raw = validEnvelope({
      eventType: 'PLAYBACK_PLAY',
      payload: { mediaId: 'video-123', position: 45.5, playbackRate: 10.0 },
    });
    const result = validateEventWithPayload(raw, 'PLAYBACK_PLAY');
    expect(result.ok).toBe(false);
  });

  it('validates a valid MESSAGE_CREATED event', () => {
    const raw = validEnvelope({
      eventType: 'MESSAGE_CREATED',
      payload: {
        messageId: 'b7b830d9-95e2-4bd5-bda2-b1e0fcfb465a',
        senderId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
        senderName: 'Alice',
        content: 'Hello everyone!',
        createdAt: 1786780001000,
      },
    });
    const result = validateEventWithPayload(raw, 'MESSAGE_CREATED');
    expect(result.ok).toBe(true);
  });

  it('rejects MESSAGE_CREATED with empty content', () => {
    const raw = validEnvelope({
      eventType: 'MESSAGE_CREATED',
      payload: {
        messageId: 'b7b830d9-95e2-4bd5-bda2-b1e0fcfb465a',
        senderId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
        senderName: 'Alice',
        content: '',
        createdAt: 1786780001000,
      },
    });
    const result = validateEventWithPayload(raw, 'MESSAGE_CREATED');
    expect(result.ok).toBe(false);
  });

  it('validates a valid ROOM_JOINED event', () => {
    const raw = validEnvelope({
      eventType: 'ROOM_JOINED',
      payload: {
        memberId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
        userId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
        displayName: 'Bob',
        role: 'PARTICIPANT',
        joinedAt: 1786780002000,
      },
    });
    const result = validateEventWithPayload(raw, 'ROOM_JOINED');
    expect(result.ok).toBe(true);
  });

  it('validates a valid PRESENCE_UPDATED event', () => {
    const raw = validEnvelope({
      eventType: 'PRESENCE_UPDATED',
      payload: {
        memberId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
        status: 'ONLINE',
        updatedAt: 1786780003000,
      },
    });
    const result = validateEventWithPayload(raw, 'PRESENCE_UPDATED');
    expect(result.ok).toBe(true);
  });

  it('rejects event with mismatching expectedType', () => {
    const raw = validEnvelope({
      eventType: 'PLAYBACK_PAUSE',
      payload: { mediaId: 'vid-1', position: 10 },
    });
    const result = validateEventWithPayload(raw, 'PLAYBACK_PLAY');
    expect(result.ok).toBe(false);
  });
});

describe('shouldApply', () => {
  const event = (revision: number) =>
    ({ ...validEnvelope({ revision }) }) as unknown as EventEnvelope;

  it('applies an event that advances the revision', () => {
    expect(shouldApply(41, event(42))).toBe(true);
  });

  it('discards a replayed event at the same revision', () => {
    expect(shouldApply(42, event(42))).toBe(false);
  });

  it('discards an out-of-order event from the past', () => {
    expect(shouldApply(42, event(7))).toBe(false);
  });
});
