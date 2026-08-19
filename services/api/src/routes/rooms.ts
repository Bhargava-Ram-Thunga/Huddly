import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { customAlphabet } from 'nanoid';
import { prisma, type Prisma } from '@huddly/database';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 4);
const generateInviteCode = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  8,
);

function generateRoomCode(): string {
  return `hud-${nanoid()}`;
}

type RoomMemberWithUser = Prisma.RoomMemberGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        displayName: true;
        avatarUrl: true;
      };
    };
  };
}>;

const CreateRoomSchema = z.object({
  name: z.string().min(1).max(100).default('Watch Room'),
  mediaUrl: z.string().url().optional(),
  settings: z
    .object({
      maxParticipants: z.number().int().min(2).max(100).optional(),
      isLocked: z.boolean().optional(),
      allowGuestChat: z.boolean().optional(),
      allowGuestVoice: z.boolean().optional(),
    })
    .optional(),
});

const UpdateRoomSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isLocked: z.boolean().optional(),
  allowGuestChat: z.boolean().optional(),
  allowGuestVoice: z.boolean().optional(),
  autoCloseOnHostLeave: z.boolean().optional(),
  maxParticipants: z.number().int().min(2).max(100).optional(),
});

const CreateInviteSchema = z.object({
  expiresInSeconds: z.number().int().positive().max(604800).optional(),
  maxUses: z.number().int().positive().max(1000).optional(),
});

const JoinRoomSchema = z.object({
  inviteCode: z.string().min(1).max(16).optional(),
});

export const roomRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/v1/rooms
   * Create a new watch room and initialize playback state
   */
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userPayload = request.user as { sub: string };
    const parseResult = CreateRoomSchema.safeParse(request.body || {});

    if (!parseResult.success) {
      return reply.status(400).send({
        type: 'https://huddly.app/errors/invalid-payload',
        title: 'Invalid Room Creation Request',
        status: 400,
        detail: parseResult.error.issues[0]?.message || 'Invalid payload',
        code: 'ERR_INVALID_PAYLOAD',
      });
    }

    const { name, mediaUrl, settings } = parseResult.data;
    const roomCode = generateRoomCode();

    const roomData: Prisma.RoomCreateInput = {
      roomCode,
      name,
      hostUser: { connect: { id: userPayload.sub } },
      status: 'ACTIVE',
      settings: {
        create: {
          maxParticipants: settings?.maxParticipants ?? 10,
          isLocked: settings?.isLocked ?? false,
          allowGuestChat: settings?.allowGuestChat ?? true,
          allowGuestVoice: settings?.allowGuestVoice ?? true,
          defaultMemberRole: 'PARTICIPANT',
        },
      },
      members: {
        create: {
          userId: userPayload.sub,
          role: 'HOST',
          status: 'JOINED',
        },
      },
      playbackState: {
        create: {
          status: 'PAUSED',
          position: 0.0,
          playbackRate: 1.0,
          revision: 0n,
        },
      },
    };

    if (mediaUrl) {
      roomData.mediaSessions = {
        create: {
          mediaUrl,
          sourceType: 'GENERIC_HTML5',
        },
      };
    }

    const room = await prisma.room.create({
      data: roomData,
      include: {
        settings: true,
        playbackState: true,
      },
    });

    return reply.status(201).send({
      id: room.id,
      roomCode: room.roomCode,
      name: room.name,
      status: room.status,
      hostUserId: room.hostUserId,
      inviteUrl: `https://huddly.app/join/${room.roomCode}`,
      settings: room.settings,
      playbackState: {
        status: room.playbackState?.status,
        position: room.playbackState?.position,
        playbackRate: room.playbackState?.playbackRate,
        revision: Number(room.playbackState?.revision || 0n),
      },
      createdAt: room.createdAt,
    });
  });

  /**
   * GET /api/v1/rooms/:code
   * Resolve room by code or UUID
   */
  fastify.get('/:code', async (request, reply) => {
    const { code } = request.params as { code: string };

    const isUuid = code.length === 36 && code.includes('-');
    const room = await prisma.room.findFirst({
      where: isUuid ? { id: code } : { roomCode: code },
      include: {
        settings: true,
        playbackState: true,
        hostUser: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        members: {
          where: { status: 'JOINED' },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!room) {
      return reply.status(404).send({
        type: 'https://huddly.app/errors/room-not-found',
        title: 'Room Not Found',
        status: 404,
        detail: `The room with code '${code}' was not found.`,
        code: 'ERR_ROOM_NOT_FOUND',
      });
    }

    return reply.send({
      id: room.id,
      roomCode: room.roomCode,
      name: room.name,
      status: room.status,
      host: room.hostUser,
      settings: room.settings,
      memberCount: room.members.length,
      members: room.members.map((m: RoomMemberWithUser) => ({
        id: m.id,
        userId: m.userId,
        displayName: m.user.displayName,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
      playbackState: room.playbackState
        ? {
            status: room.playbackState.status,
            position: room.playbackState.position,
            playbackRate: room.playbackState.playbackRate,
            revision: Number(room.playbackState.revision),
          }
        : null,
      createdAt: room.createdAt,
    });
  });

  /**
   * PATCH /api/v1/rooms/:id
   * Update room settings (host only)
   */
  fastify.patch('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub;
    const { id } = request.params as { id: string };

    const parseResult = UpdateRoomSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      return reply.status(400).send({
        type: 'https://huddly.app/errors/invalid-payload',
        title: 'Invalid Update Payload',
        status: 400,
        detail: parseResult.error.issues[0]?.message || 'Invalid payload',
        code: 'ERR_INVALID_PAYLOAD',
      });
    }

    const room = await prisma.room.findUnique({
      where: { id },
      include: { settings: true },
    });

    if (!room) {
      return reply.status(404).send({
        type: 'https://huddly.app/errors/room-not-found',
        title: 'Room Not Found',
        status: 404,
        detail: 'The specified room does not exist.',
        code: 'ERR_ROOM_NOT_FOUND',
      });
    }

    if (room.hostUserId !== userId) {
      return reply.status(403).send({
        type: 'https://huddly.app/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only the room host can modify settings.',
        code: 'ERR_FORBIDDEN',
      });
    }

    const {
      name,
      isLocked,
      allowGuestChat,
      allowGuestVoice,
      autoCloseOnHostLeave,
      maxParticipants,
    } = parseResult.data;

    const updated = await prisma.room.update({
      where: { id },
      data: {
        ...(name && { name }),
        updatedAt: new Date(),
        settings: {
          update: {
            ...(isLocked !== undefined && { isLocked }),
            ...(allowGuestChat !== undefined && { allowGuestChat }),
            ...(allowGuestVoice !== undefined && { allowGuestVoice }),
            ...(autoCloseOnHostLeave !== undefined && { autoCloseOnHostLeave }),
            ...(maxParticipants !== undefined && { maxParticipants }),
          },
        },
      },
      include: {
        settings: true,
        members: {
          where: { status: 'JOINED' },
        },
      },
    });

    return reply.status(200).send({
      id: updated.id,
      roomCode: updated.roomCode,
      name: updated.name,
      hostUserId: updated.hostUserId,
      status: updated.status,
      settings: updated.settings,
      memberCount: updated.members.length,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  });

  /**
   * DELETE /api/v1/rooms/:id
   * Close a room (host only)
   */
  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub;
    const { id } = request.params as { id: string };

    const room = await prisma.room.findUnique({
      where: { id },
    });

    if (!room) {
      return reply.status(404).send({
        type: 'https://huddly.app/errors/room-not-found',
        title: 'Room Not Found',
        status: 404,
        detail: 'The specified room does not exist.',
        code: 'ERR_ROOM_NOT_FOUND',
      });
    }

    if (room.hostUserId !== userId) {
      return reply.status(403).send({
        type: 'https://huddly.app/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only the room host can close the room.',
        code: 'ERR_FORBIDDEN',
      });
    }

    const closed = await prisma.room.update({
      where: { id },
      data: {
        status: 'CLOSED',
        updatedAt: new Date(),
      },
    });

    return reply.status(200).send({
      id: closed.id,
      status: closed.status,
      message: 'Room closed successfully',
    });
  });

  /**
   * POST /api/v1/rooms/:id/invites
   * Generate an invite code + shareable URL with optional expiry and max uses (host only)
   */
  fastify.post('/:id/invites', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub;
    const { id } = request.params as { id: string };

    const parseResult = CreateInviteSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      return reply.status(400).send({
        type: 'https://huddly.app/errors/invalid-payload',
        title: 'Invalid Invite Creation Request',
        status: 400,
        detail: parseResult.error.issues[0]?.message || 'Invalid payload',
        code: 'ERR_INVALID_PAYLOAD',
      });
    }

    const room = await prisma.room.findUnique({
      where: { id },
    });

    if (!room || room.status !== 'ACTIVE') {
      return reply.status(404).send({
        type: 'https://huddly.app/errors/room-not-found',
        title: 'Room Not Found',
        status: 404,
        detail: 'The specified room does not exist or has closed.',
        code: 'ERR_ROOM_NOT_FOUND',
      });
    }

    if (room.hostUserId !== userId) {
      return reply.status(403).send({
        type: 'https://huddly.app/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only the room host can create invite links.',
        code: 'ERR_FORBIDDEN',
      });
    }

    const { expiresInSeconds, maxUses } = parseResult.data;
    const expiresAt = expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000) : null;
    const code = generateInviteCode();

    const invite = await prisma.roomInvite.create({
      data: {
        roomId: room.id,
        code,
        createdByUserId: userId,
        maxUses: maxUses ?? null,
        expiresAt,
      },
    });

    return reply.status(201).send({
      id: invite.id,
      roomId: invite.roomId,
      code: invite.code,
      inviteUrl: `https://huddly.app/join/${invite.code}`,
      maxUses: invite.maxUses,
      usesCount: invite.usesCount,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
    });
  });

  /**
   * POST /api/v1/rooms/:id/join
   * Join an active room as participant (supports inviteCode with expiry and maxUses enforcement)
   */
  fastify.post('/:id/join', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userPayload = request.user as { sub: string };
    const { id } = request.params as { id: string };

    const parseResult = JoinRoomSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      return reply.status(400).send({
        type: 'https://huddly.app/errors/invalid-payload',
        title: 'Invalid Join Request',
        status: 400,
        detail: parseResult.error.issues[0]?.message || 'Invalid payload',
        code: 'ERR_INVALID_PAYLOAD',
      });
    }

    const room = await prisma.room.findUnique({
      where: { id },
      include: { settings: true, members: { where: { status: 'JOINED' } } },
    });

    if (!room || room.status !== 'ACTIVE') {
      return reply.status(404).send({
        type: 'https://huddly.app/errors/room-not-found',
        title: 'Room Not Found or Closed',
        status: 404,
        detail: 'Cannot join room because it does not exist or has closed.',
        code: 'ERR_ROOM_NOT_FOUND',
      });
    }

    const { inviteCode } = parseResult.data;
    let hasValidInvite = false;

    if (inviteCode) {
      const invite = await prisma.roomInvite.findUnique({
        where: { code: inviteCode },
      });

      if (!invite || invite.roomId !== room.id) {
        return reply.status(404).send({
          type: 'https://huddly.app/errors/invite-not-found',
          title: 'Invite Not Found',
          status: 404,
          detail: 'The invite link is invalid for this room.',
          code: 'ERR_INVITE_NOT_FOUND',
        });
      }

      if (invite.expiresAt && new Date() > new Date(invite.expiresAt)) {
        return reply.status(400).send({
          type: 'https://huddly.app/errors/invite-expired',
          title: 'Invite Expired',
          status: 400,
          detail: 'This invite link has expired.',
          code: 'ERR_INVITE_EXPIRED',
        });
      }

      if (invite.maxUses !== null && invite.usesCount >= invite.maxUses) {
        return reply.status(400).send({
          type: 'https://huddly.app/errors/invite-max-uses',
          title: 'Invite Limit Reached',
          status: 400,
          detail: 'This invite link has reached its maximum usage limit.',
          code: 'ERR_INVITE_MAX_USES',
        });
      }

      // Increment redemption count
      await prisma.roomInvite.update({
        where: { id: invite.id },
        data: { usesCount: { increment: 1 } },
      });

      hasValidInvite = true;
    }

    if (room.settings?.isLocked && !hasValidInvite && room.hostUserId !== userPayload.sub) {
      return reply.status(403).send({
        type: 'https://huddly.app/errors/room-locked',
        title: 'Room Locked',
        status: 403,
        detail: 'This room is currently locked by the host.',
        code: 'ERR_ROOM_LOCKED',
      });
    }

    if (room.settings && room.members.length >= room.settings.maxParticipants) {
      return reply.status(409).send({
        type: 'https://huddly.app/errors/room-full',
        title: 'Room Full',
        status: 409,
        detail: 'The room has reached maximum participant capacity.',
        code: 'ERR_ROOM_FULL',
      });
    }

    const membership = await prisma.roomMember.upsert({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId: userPayload.sub,
        },
      },
      update: {
        status: 'JOINED',
        leftAt: null,
      },
      create: {
        roomId: room.id,
        userId: userPayload.sub,
        role: room.hostUserId === userPayload.sub ? 'HOST' : 'PARTICIPANT',
        status: 'JOINED',
      },
    });

    return reply.status(200).send({
      roomId: room.id,
      memberId: membership.id,
      role: membership.role,
      joinedAt: membership.joinedAt,
    });
  });

  /**
   * POST /api/v1/rooms/:id/leave
   * Leave a room (sets status to LEFT)
   */
  fastify.post('/:id/leave', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub;
    const { id } = request.params as { id: string };

    const member = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId: id,
          userId,
        },
      },
    });

    if (!member || member.status !== 'JOINED') {
      return reply.status(404).send({
        type: 'https://huddly.app/errors/not-a-member',
        title: 'Not a Member',
        status: 404,
        detail: 'You are not currently an active member of this room.',
        code: 'ERR_NOT_ROOM_MEMBER',
      });
    }

    const updated = await prisma.roomMember.update({
      where: { id: member.id },
      data: {
        status: 'LEFT',
        leftAt: new Date(),
      },
    });

    return reply.status(200).send({
      message: 'Left room successfully',
      roomId: id,
      status: updated.status,
    });
  });

  /**
   * DELETE /api/v1/rooms/:id/members/:userId
   * Host kicks a participant from the room (sets status to KICKED)
   */
  fastify.delete(
    '/:id/members/:userId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const hostUserId = (request.user as { sub: string }).sub;
      const { id, userId } = request.params as { id: string; userId: string };

      const room = await prisma.room.findUnique({
        where: { id },
      });

      if (!room || room.status !== 'ACTIVE') {
        return reply.status(404).send({
          type: 'https://huddly.app/errors/room-not-found',
          title: 'Room Not Found',
          status: 404,
          detail: 'The specified room does not exist or has closed.',
          code: 'ERR_ROOM_NOT_FOUND',
        });
      }

      if (room.hostUserId !== hostUserId) {
        return reply.status(403).send({
          type: 'https://huddly.app/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'Only the room host can kick participants.',
          code: 'ERR_FORBIDDEN',
        });
      }

      if (userId === hostUserId) {
        return reply.status(400).send({
          type: 'https://huddly.app/errors/invalid-operation',
          title: 'Invalid Operation',
          status: 400,
          detail: 'The room host cannot kick themselves.',
          code: 'ERR_CANNOT_KICK_SELF',
        });
      }

      const member = await prisma.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId: id,
            userId,
          },
        },
      });

      if (!member || member.status !== 'JOINED') {
        return reply.status(404).send({
          type: 'https://huddly.app/errors/not-a-member',
          title: 'Not a Member',
          status: 404,
          detail: 'The specified user is not an active member of this room.',
          code: 'ERR_NOT_ROOM_MEMBER',
        });
      }

      const updated = await prisma.roomMember.update({
        where: { id: member.id },
        data: {
          status: 'KICKED',
          leftAt: new Date(),
        },
      });

      return reply.status(200).send({
        message: 'Member kicked successfully',
        roomId: id,
        userId,
        status: updated.status,
      });
    },
  );
};
