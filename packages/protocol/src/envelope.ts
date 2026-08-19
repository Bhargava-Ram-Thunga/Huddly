import { z } from 'zod';
import {
  BufferingPayloadSchema,
  MediaEndedPayloadSchema,
  MediaLoadedPayloadSchema,
  MessageCreatedPayloadSchema,
  MessageDeletedPayloadSchema,
  PlaybackPausePayloadSchema,
  PlaybackPlayPayloadSchema,
  PlaybackRatePayloadSchema,
  PlaybackSeekPayloadSchema,
  PresenceUpdatedPayloadSchema,
  PROTOCOL_VERSION,
  RoomClosedPayloadSchema,
  RoomJoinedPayloadSchema,
  RoomLeftPayloadSchema,
  RoomStateSnapshotPayloadSchema,
  TypingPayloadSchema,
  UUID_SCHEMA,
} from './schemas.js';

export { PROTOCOL_VERSION } from './schemas.js';

/** Events the MVP control plane carries. Extended per phase. */
export const EVENT_TYPES = [
  // room lifecycle
  'ROOM_JOINED',
  'ROOM_LEFT',
  'ROOM_STATE_SNAPSHOT',
  'ROOM_CLOSED',
  // presence
  'PRESENCE_UPDATED',
  // playback
  'PLAYBACK_PLAY',
  'PLAYBACK_PAUSE',
  'PLAYBACK_SEEK',
  'PLAYBACK_RATE',
  'MEDIA_LOADED',
  'MEDIA_ENDED',
  'BUFFERING',
  // chat
  'MESSAGE_CREATED',
  'MESSAGE_DELETED',
  'TYPING',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
export const EventTypeSchema = z.enum(EVENT_TYPES);

export const EVENT_PAYLOAD_SCHEMAS = {
  ROOM_JOINED: RoomJoinedPayloadSchema,
  ROOM_LEFT: RoomLeftPayloadSchema,
  ROOM_STATE_SNAPSHOT: RoomStateSnapshotPayloadSchema,
  ROOM_CLOSED: RoomClosedPayloadSchema,
  PRESENCE_UPDATED: PresenceUpdatedPayloadSchema,
  PLAYBACK_PLAY: PlaybackPlayPayloadSchema,
  PLAYBACK_PAUSE: PlaybackPausePayloadSchema,
  PLAYBACK_SEEK: PlaybackSeekPayloadSchema,
  PLAYBACK_RATE: PlaybackRatePayloadSchema,
  MEDIA_LOADED: MediaLoadedPayloadSchema,
  MEDIA_ENDED: MediaEndedPayloadSchema,
  BUFFERING: BufferingPayloadSchema,
  MESSAGE_CREATED: MessageCreatedPayloadSchema,
  MESSAGE_DELETED: MessageDeletedPayloadSchema,
  TYPING: TypingPayloadSchema,
} as const;

export interface EventEnvelope<TPayload = unknown> {
  /** Unique id for this event; used for de-duplication on the client. */
  eventId: string;
  eventType: EventType;
  roomId: string;
  /** User who caused the event. Null for server-originated events. */
  actorId: string | null;
  /** Server-assigned, monotonically increasing per room. Orders all state. */
  revision: number;
  /** Authoritative server clock in epoch milliseconds. Never a device clock. */
  serverTimestamp: number;
  protocolVersion: number;
  payload: TPayload;
}

export const EventEnvelopeBaseSchema = z.object({
  eventId: UUID_SCHEMA,
  eventType: EventTypeSchema,
  roomId: UUID_SCHEMA,
  actorId: UUID_SCHEMA.nullable(),
  revision: z.number().int().nonnegative(),
  serverTimestamp: z.number().finite(),
  protocolVersion: z.literal(PROTOCOL_VERSION),
  payload: z.unknown(),
});

export const EventEnvelopeSchema = EventEnvelopeBaseSchema;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: readonly string[] };

/**
 * Validates an untrusted inbound message against the envelope contract.
 *
 * This is a structural gate only — it never implies the actor is *authorized*
 * to perform the event. Authorization is always a separate server-side check
 * (spec §46: never trust a client that claims to be host).
 */
export function validateEnvelope(input: unknown): ValidationResult<EventEnvelope> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: ['envelope must be an object'] };
  }

  const result = EventEnvelopeBaseSchema.safeParse(input);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    });
    return { ok: false, errors };
  }

  return { ok: true, value: result.data as EventEnvelope };
}

/**
 * Validates both envelope structure and its specific typed payload.
 */
export function validateEventWithPayload<T extends EventType>(
  input: unknown,
  expectedType?: T,
): ValidationResult<EventEnvelope<z.infer<(typeof EVENT_PAYLOAD_SCHEMAS)[T]>>> {
  const envResult = validateEnvelope(input);
  if (!envResult.ok) {
    return envResult;
  }

  const envelope = envResult.value;
  if (expectedType && envelope.eventType !== expectedType) {
    return {
      ok: false,
      errors: [`expected eventType ${expectedType}, received ${envelope.eventType}`],
    };
  }

  const payloadSchema = EVENT_PAYLOAD_SCHEMAS[envelope.eventType as T];
  if (!payloadSchema) {
    return {
      ok: false,
      errors: [`no payload schema registered for eventType: ${envelope.eventType}`],
    };
  }

  const payloadResult = payloadSchema.safeParse(envelope.payload);
  if (!payloadResult.success) {
    const errors = payloadResult.error.issues.map(
      (issue) => `payload.${issue.path.join('.')}: ${issue.message}`,
    );
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      ...envelope,
      payload: payloadResult.data,
    } as EventEnvelope<z.infer<(typeof EVENT_PAYLOAD_SCHEMAS)[T]>>,
  };
}

/**
 * Decides whether an inbound event should be applied to local state.
 *
 * Clients never decide final room state (spec §24) — they only accept events
 * that advance the server-assigned revision, discarding stale or replayed ones.
 */
export function shouldApply(currentRevision: number, incoming: EventEnvelope): boolean {
  return incoming.revision > currentRevision;
}
