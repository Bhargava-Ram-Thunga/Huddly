# Huddly REST API Specification

> **Status:** Finalized (M1–M2)  
> **Base URL:** `/api/v1`  
> **Authentication:** JWT Bearer token (15-minute expiry)

---

## Overview

All API endpoints return standard HTTP status codes and structured RFC 7807 Problem Details on failure.

### Error Response Format (RFC 7807)

```json
{
  "type": "https://huddly.app/errors/invalid-credentials",
  "title": "Invalid Credentials",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "code": "ERR_INVALID_CREDENTIALS"
}
```

---

## Authentication Endpoints (`/api/v1/auth`)

### POST `/api/v1/auth/register`

Register a new user with email, password (Argon2id), and display name.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "displayName": "Alice",
  "deviceType": "WEB"
}
```

**Response: `201 Created`**

```json
{
  "user": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "email": "user@example.com",
    "displayName": "Alice",
    "avatarUrl": null,
    "isGuest": false,
    "status": "ACTIVE",
    "createdAt": "2026-08-17T12:00:00.000Z"
  },
  "token": "<jwt_access_token>",
  "refreshToken": "<refresh_token>"
}
```

**Errors:**

- `400 Bad Request` (`ERR_INVALID_PAYLOAD`): Password <8 chars, invalid email format.
- `409 Conflict` (`ERR_EMAIL_EXISTS`): Email already registered.

---

### POST `/api/v1/auth/login`

Authenticate using email and password.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response: `200 OK`** (same format as registration)

**Errors:**

- `401 Unauthorized` (`ERR_INVALID_CREDENTIALS`): Email not found or incorrect password (timing attack mitigated via `dummyVerify()`).
- `403 Forbidden` (`ERR_ACCOUNT_INACTIVE`): Account suspended or deleted.

---

### POST `/api/v1/auth/guest`

Generate an instant anonymous guest session.

**Request Body:**

```json
{
  "displayName": "Guest_4821"
}
```

**Response: `201 Created`**

```json
{
  "user": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "displayName": "Guest_4821",
    "isGuest": true,
    "createdAt": "2026-08-17T12:00:00.000Z"
  },
  "token": "<guest_jwt_token>"
}
```

---

### POST `/api/v1/auth/refresh`

Rotate refresh token and mint new access token (RFC 9700 Refresh Token Rotation).

**Request Body:**

```json
{
  "refreshToken": "<refresh_token>"
}
```

**Response: `200 OK`**

```json
{
  "token": "<jwt_access_token>",
  "refreshToken": "<new_rotated_refresh_token>"
}
```

**Errors:**

- `400 Bad Request` (`ERR_INVALID_PAYLOAD`): Missing or invalid payload.
- `401 Unauthorized` (`ERR_INVALID_TOKEN`): Token invalid, already rotated, or revoked.
- `401 Unauthorized` (`ERR_TOKEN_EXPIRED`): Token exceeded 7-day maximum lifetime.
- `403 Forbidden` (`ERR_ACCOUNT_INACTIVE`): Account suspended.

---

### POST `/api/v1/auth/logout`

Revoke device session and invalidate refresh token.

**Request Body:**

```json
{
  "refreshToken": "<refresh_token>"
}
```

**Response: `200 OK`**

```json
{
  "message": "Logged out successfully"
}
```

---

### GET `/api/v1/auth/me`

Retrieve current authenticated profile.

**Headers:** `Authorization: Bearer <token>`

**Response: `200 OK`**

```json
{
  "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "email": "user@example.com",
  "displayName": "Alice",
  "avatarUrl": null,
  "isGuest": false,
  "status": "ACTIVE",
  "createdAt": "2026-08-17T12:00:00.000Z"
}
```

---

## Room Endpoints (`/api/v1/rooms`)

### POST `/api/v1/rooms`

Create a new watch room with default playback state and settings.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "name": "Dune Night",
  "mediaUrl": "https://youtube.com/watch?v=123",
  "settings": {
    "maxParticipants": 10,
    "isLocked": false,
    "allowGuestChat": true,
    "allowGuestVoice": true
  }
}
```

**Response: `201 Created`**

```json
{
  "id": "9c858901-8a57-4791-81fe-4c455b099bc9",
  "roomCode": "hud-7k9p",
  "name": "Dune Night",
  "status": "ACTIVE",
  "hostUserId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "inviteUrl": "https://huddly.app/join/hud-7k9p",
  "settings": { ... },
  "playbackState": {
    "status": "PAUSED",
    "position": 0.0,
    "playbackRate": 1.0,
    "revision": 0
  },
  "createdAt": "2026-08-17T12:00:00.000Z"
}
```

---

### GET `/api/v1/rooms/:code`

Resolve a room by 8-char `roomCode` or UUID `id`.

**Response: `200 OK`**

```json
{
  "id": "9c858901-8a57-4791-81fe-4c455b099bc9",
  "roomCode": "hud-7k9p",
  "name": "Dune Night",
  "status": "ACTIVE",
  "host": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "displayName": "Alice",
    "avatarUrl": null
  },
  "settings": { ... },
  "memberCount": 1,
  "members": [ ... ],
  "playbackState": { ... },
  "createdAt": "2026-08-17T12:00:00.000Z"
}
```

---

### PATCH `/api/v1/rooms/:id`

Update room settings (Host only).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "name": "Dune Part 2",
  "isLocked": true,
  "maxParticipants": 20
}
```

**Response: `200 OK`** (updated room entity)

**Errors:**

- `403 Forbidden` (`ERR_FORBIDDEN`): Authenticated user is not the host.
- `404 Not Found` (`ERR_ROOM_NOT_FOUND`): Room ID does not exist.

---

### DELETE `/api/v1/rooms/:id`

Soft-close a room (Host only).

**Headers:** `Authorization: Bearer <token>`

**Response: `200 OK`**

```json
{
  "id": "9c858901-8a57-4791-81fe-4c455b099bc9",
  "status": "CLOSED",
  "message": "Room closed successfully"
}
```

---

### POST `/api/v1/rooms/:id/invites`

Generate a custom invite link with optional usage limit and expiration (Host only).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "expiresInSeconds": 3600,
  "maxUses": 5
}
```

**Response: `201 Created`**

```json
{
  "id": "c1f7a8b9-8a57-4791-81fe-4c455b099bc9",
  "roomId": "9c858901-8a57-4791-81fe-4c455b099bc9",
  "code": "aB8k9LmX",
  "inviteUrl": "https://huddly.app/join/aB8k9LmX",
  "maxUses": 5,
  "usesCount": 0,
  "expiresAt": "2026-08-19T15:48:00.000Z",
  "createdAt": "2026-08-19T14:48:00.000Z"
}
```

**Errors:**

- `403 Forbidden` (`ERR_FORBIDDEN`): Authenticated user is not the host.
- `404 Not Found` (`ERR_ROOM_NOT_FOUND`): Room is closed or non-existent.

---

### POST `/api/v1/rooms/:id/join`

Join an active room as participant (supports optional `inviteCode` with expiry/capacity validation and lock bypass).

**Headers:** `Authorization: Bearer <token>`

**Request Body (Optional):**

```json
{
  "inviteCode": "aB8k9LmX"
}
```

**Response: `200 OK`**

```json
{
  "roomId": "9c858901-8a57-4791-81fe-4c455b099bc9",
  "memberId": "member-123",
  "role": "PARTICIPANT",
  "joinedAt": "2026-08-17T12:05:00.000Z"
}
```

**Errors:**

- `400 Bad Request` (`ERR_INVITE_EXPIRED`): The provided invite link has expired.
- `400 Bad Request` (`ERR_INVITE_MAX_USES`): The invite link has reached its maximum redemption limit.
- `403 Forbidden` (`ERR_ROOM_LOCKED`): Room is locked by host and no valid invite was provided.
- `404 Not Found` (`ERR_ROOM_NOT_FOUND`): Room is closed or non-existent.
- `404 Not Found` (`ERR_INVITE_NOT_FOUND`): The provided invite code does not belong to this room.
- `409 Conflict` (`ERR_ROOM_FULL`): Participant capacity reached.

---

### POST `/api/v1/rooms/:id/leave`

Leave an active room.

**Headers:** `Authorization: Bearer <token>`

**Response: `200 OK`**

```json
{
  "message": "Left room successfully",
  "roomId": "9c858901-8a57-4791-81fe-4c455b099bc9",
  "status": "LEFT"
}
```

**Errors:**

- `404 Not Found` (`ERR_NOT_ROOM_MEMBER`): Caller is not an active member of this room.

---

### DELETE `/api/v1/rooms/:id/members/:userId`

Host kicks a participant from the room.

**Headers:** `Authorization: Bearer <token>`

**Response: `200 OK`**

```json
{
  "message": "Member kicked successfully",
  "roomId": "9c858901-8a57-4791-81fe-4c455b099bc9",
  "userId": "target-user-id",
  "status": "KICKED"
}
```

**Errors:**

- `400 Bad Request` (`ERR_CANNOT_KICK_SELF`): Host cannot kick themselves.
- `403 Forbidden` (`ERR_FORBIDDEN`): Caller is not the room host.
- `404 Not Found` (`ERR_ROOM_NOT_FOUND`): Room does not exist or is closed.
- `404 Not Found` (`ERR_NOT_ROOM_MEMBER`): Target user is not an active member.

---

## Realtime Tickets (`/api/v1/realtime`)

### POST `/api/v1/realtime/ticket`

Mint a single-use, 60-second connection ticket for WebSocket upgrade.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "roomId": "9c858901-8a57-4791-81fe-4c455b099bc9"
}
```

**Response: `200 OK`**

```json
{
  "ticket": "8c67a57a-bfd9-4822-95f2-95b6cf7162fa",
  "expiresIn": 60,
  "wsUrl": "ws://127.0.0.1:4001/ws?ticket=8c67a57a-bfd9-4822-95f2-95b6cf7162fa"
}
```

---

## Error Code Reference

| Code                      | HTTP Status | Description                          |
| ------------------------- | ----------- | ------------------------------------ |
| `ERR_INVALID_PAYLOAD`     | 400         | Zod schema validation failed         |
| `ERR_UNAUTHORIZED`        | 401         | Missing or invalid Bearer JWT        |
| `ERR_INVALID_CREDENTIALS` | 401         | Incorrect email or password          |
| `ERR_FORBIDDEN`           | 403         | Insufficient role permissions        |
| `ERR_ACCOUNT_INACTIVE`    | 403         | Account suspended or deleted         |
| `ERR_NOT_ROOM_MEMBER`     | 403         | Must join room before ticket minting |
| `ERR_ROOM_LOCKED`         | 403         | Room locked to new joiners           |
| `ERR_ROOM_NOT_FOUND`      | 404         | Room code or UUID not found          |
| `ERR_EMAIL_EXISTS`        | 409         | Email already registered             |
| `ERR_ROOM_FULL`           | 409         | Room capacity exceeded               |
| `ERR_RATE_LIMITED`        | 429         | Rate limit exceeded                  |
