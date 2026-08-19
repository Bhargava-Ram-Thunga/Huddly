import { z } from 'zod';

export const PROTOCOL_VERSION = 1 as const;

export const UUID_SCHEMA = z.string().uuid();

// --- Member & Room Schemas ---

export const MemberRoleSchema = z.enum(['HOST', 'PARTICIPANT']);
export type MemberRole = z.infer<typeof MemberRoleSchema>;

export const PresenceStatusSchema = z.enum(['ONLINE', 'IDLE', 'AWAY', 'RECONNECTING', 'OFFLINE']);
export type PresenceStatus = z.infer<typeof PresenceStatusSchema>;

export const RoomStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'CLOSED']);
export type RoomStatus = z.infer<typeof RoomStatusSchema>;

export const RoomLeaveReasonSchema = z.enum(['VOLUNTARY', 'KICKED', 'TIMEOUT']);
export type RoomLeaveReason = z.infer<typeof RoomLeaveReasonSchema>;

export const RoomCloseReasonSchema = z.enum([
  'HOST_TERMINATED',
  'INACTIVITY_TIMEOUT',
  'POLICY_VIOLATION',
]);
export type RoomCloseReason = z.infer<typeof RoomCloseReasonSchema>;

// --- Payload Schemas ---

// Room Lifecycle
export const RoomJoinedPayloadSchema = z.object({
  memberId: UUID_SCHEMA,
  userId: UUID_SCHEMA,
  displayName: z.string().min(1).max(50),
  avatarUrl: z.string().url().nullable().optional(),
  role: MemberRoleSchema,
  joinedAt: z.number().int().nonnegative(),
});
export type RoomJoinedPayload = z.infer<typeof RoomJoinedPayloadSchema>;

export const RoomLeftPayloadSchema = z.object({
  memberId: UUID_SCHEMA,
  reason: RoomLeaveReasonSchema,
});
export type RoomLeftPayload = z.infer<typeof RoomLeftPayloadSchema>;

export const RoomSummarySchema = z.object({
  roomId: UUID_SCHEMA,
  name: z.string().min(1),
  status: RoomStatusSchema,
  hostId: UUID_SCHEMA,
  revision: z.number().int().nonnegative(),
});
export type RoomSummary = z.infer<typeof RoomSummarySchema>;

export const RoomMemberSnapshotSchema = z.object({
  memberId: UUID_SCHEMA,
  userId: UUID_SCHEMA,
  displayName: z.string().min(1),
  role: MemberRoleSchema,
  presence: PresenceStatusSchema,
});
export type RoomMemberSnapshot = z.infer<typeof RoomMemberSnapshotSchema>;

export const PlaybackSnapshotSchema = z.object({
  mediaId: z.string().min(1),
  mediaUrl: z.string().url(),
  position: z.number().nonnegative(),
  playing: z.boolean(),
  playbackRate: z.number().min(0.25).max(4.0),
  revision: z.number().int().nonnegative(),
  serverTimestamp: z.number().int().nonnegative(),
});
export type PlaybackSnapshot = z.infer<typeof PlaybackSnapshotSchema>;

export const ChatMessageSnapshotSchema = z.object({
  messageId: UUID_SCHEMA,
  senderId: UUID_SCHEMA,
  senderName: z.string().min(1),
  content: z.string().min(1).max(2000),
  createdAt: z.number().int().nonnegative(),
});
export type ChatMessageSnapshot = z.infer<typeof ChatMessageSnapshotSchema>;

export const RoomStateSnapshotPayloadSchema = z.object({
  room: RoomSummarySchema,
  members: z.array(RoomMemberSnapshotSchema),
  playback: PlaybackSnapshotSchema,
  chat: z.object({
    messages: z.array(ChatMessageSnapshotSchema),
  }),
});
export type RoomStateSnapshotPayload = z.infer<typeof RoomStateSnapshotPayloadSchema>;

export const RoomClosedPayloadSchema = z.object({
  reason: RoomCloseReasonSchema,
  closedAt: z.number().int().nonnegative(),
});
export type RoomClosedPayload = z.infer<typeof RoomClosedPayloadSchema>;

// Presence
export const PresenceUpdatedPayloadSchema = z.object({
  memberId: UUID_SCHEMA,
  status: PresenceStatusSchema,
  updatedAt: z.number().int().nonnegative(),
});
export type PresenceUpdatedPayload = z.infer<typeof PresenceUpdatedPayloadSchema>;

// Playback
export const PlaybackPlayPayloadSchema = z.object({
  mediaId: z.string().min(1),
  position: z.number().nonnegative(),
  playbackRate: z.number().min(0.25).max(4.0),
});
export type PlaybackPlayPayload = z.infer<typeof PlaybackPlayPayloadSchema>;

export const PlaybackPausePayloadSchema = z.object({
  mediaId: z.string().min(1),
  position: z.number().nonnegative(),
});
export type PlaybackPausePayload = z.infer<typeof PlaybackPausePayloadSchema>;

export const PlaybackSeekPayloadSchema = z.object({
  mediaId: z.string().min(1),
  position: z.number().nonnegative(),
  previousPosition: z.number().nonnegative().optional(),
});
export type PlaybackSeekPayload = z.infer<typeof PlaybackSeekPayloadSchema>;

export const PlaybackRatePayloadSchema = z.object({
  mediaId: z.string().min(1),
  playbackRate: z.number().min(0.25).max(4.0),
});
export type PlaybackRatePayload = z.infer<typeof PlaybackRatePayloadSchema>;

export const MediaLoadedPayloadSchema = z.object({
  mediaId: z.string().min(1),
  mediaUrl: z.string().url(),
  mediaTitle: z.string().nullable().optional(),
  duration: z.number().nonnegative().nullable().optional(),
});
export type MediaLoadedPayload = z.infer<typeof MediaLoadedPayloadSchema>;

export const MediaEndedPayloadSchema = z.object({
  mediaId: z.string().min(1),
  position: z.number().nonnegative(),
});
export type MediaEndedPayload = z.infer<typeof MediaEndedPayloadSchema>;

export const BufferingPayloadSchema = z.object({
  memberId: UUID_SCHEMA,
  isBuffering: z.boolean(),
  position: z.number().nonnegative(),
});
export type BufferingPayload = z.infer<typeof BufferingPayloadSchema>;

// Chat
export const MessageCreatedPayloadSchema = z.object({
  messageId: UUID_SCHEMA,
  senderId: UUID_SCHEMA,
  senderName: z.string().min(1).max(50),
  content: z.string().min(1).max(2000),
  createdAt: z.number().int().nonnegative(),
});
export type MessageCreatedPayload = z.infer<typeof MessageCreatedPayloadSchema>;

export const MessageDeletedPayloadSchema = z.object({
  messageId: UUID_SCHEMA,
  deletedBy: UUID_SCHEMA,
  reason: z.string().nullable().optional(),
});
export type MessageDeletedPayload = z.infer<typeof MessageDeletedPayloadSchema>;

export const TypingPayloadSchema = z.object({
  memberId: UUID_SCHEMA,
  isTyping: z.boolean(),
});
export type TypingPayload = z.infer<typeof TypingPayloadSchema>;
