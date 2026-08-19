# UX Wireframes and Interaction Layouts (ARCH-012)

This document defines the working structural wireframes, layout states, and user interaction flows for the Huddly web application and browser extension.

These low-fidelity specifications serve as implementation blueprints for UI development in `@huddly/ui` and `@huddly/web`.

---

## 1. Room Screen Layout (Main View)

```text
+-----------------------------------------------------------------------------------------------+
|  HUDDLY   [Room: Anime Night (hud-7k9p)] [Status: Synced] [Latency: 28ms]       [Profile (v)] |
+-----------------------------------------------------------------------+-----------------------+
|                                                                       | PARTICIPANTS (4)      |
|                                                                       | +-------------------+ |
|                         MAIN STAGE AREA                               | | [Avatar] Alice (H)| |
|                                                                       | | Mic: ON (Speaking)| |
|   +---------------------------------------------------------------+   | +-------------------+ |
|   |                                                               |   | | [Avatar] Bob      | |
|   |                                                               |   | | Mic: Muted        | |
|   |                                                               |   | +-------------------+ |
|   |                     SYNCHRONIZED VIDEO                        |   | | [Avatar] Charlie  | |
|   |                     (Direct or Extension)                     |   | | Mic: Muted        | |
|   |                                                               |   | +-------------------+ |
|   |                                                               |   | | [Avatar] Guest123 | |
|   |                                                               |   | | Mic: OFF          | |
|   +---------------------------------------------------------------+   | +-------------------+ |
|                                                                       |-----------------------+
|   [ > Play / || Pause ]  [ --o------------ 14:25 / 45:00 ] [ 1.0x ]   | CHAT                  |
|                                                                       | Alice: Starting now!  |
|                                                                       | Bob: Looks awesome    |
|   +---------------------------------------------------------------+   | Charlie: Audio loud?  |
|   | [Mute Mic] [Deafen] [Share Link] [Lock Room] [Layout (v)]     |   | +-------------------+ |
|   +---------------------------------------------------------------+   | | Type message... |>| |
+-----------------------------------------------------------------------+-----------------------+
```

---

## 2. Layout Variants (Phase 9)

### 2.1 Theater Layout (Default for Media Focus)

- Large central video element (80% width) with vertical participant strips and collapsible right chat drawer.

```text
+---------------------------------------------------------+-------------------+
|                                                         | [Participants]    |
|                   PRIMARY VIDEO PLAYER                  | Alice, Bob, Dan   |
|                                                         |-------------------|
|                                                         | [Chat Feed]       |
|                                                         |                   |
| [Play/Pause] [Timeline ------------------] [Fullscreen] | [Send message...] |
+---------------------------------------------------------+-------------------+
```

### 2.2 Grid Layout (Equal Social Focus)

- Video player shares screen with participant video/avatar tiles in a responsive dynamic grid.

```text
+-----------------------------+-----------------------------+-----------------+
|                             |                             | CHAT            |
|        VIDEO FEED           |      [Alice (Speaking)]     |                 |
|                             |                             | Alice: Hype!    |
|-----------------------------+-----------------------------|                 |
|                             |                             | Bob: +1         |
|     [Bob (Listening)]       |     [Charlie (Listening)]   |                 |
|                             |                             |                 |
+-----------------------------+-----------------------------+-----------------+
```

### 2.3 Speaker Focus Layout (Presentation / Commentary)

- Active speaker avatar highlighted in large preview tile; video stream docked side-by-side.

```text
+-----------------------------+-----------------------------+-----------------+
|                             |                             | CHAT & AUDIENCE |
|        MAIN VIDEO           |       ACTIVE SPEAKER        |                 |
|                             |          [ Alice ]          | Charlie         |
|                             |      "Let's skip intro"     | Dave            |
|-----------------------------+-----------------------------| Guest456        |
| [Timeline ----------------] | [Mute] [Leave] [Settings]   | [Message box]   |
+-----------------------------+-----------------------------+-----------------+
```

---

## 3. Join Flow Wireframes (4 Paths)

```text
                               [ User clicks invite link: /join/:code ]
                                                  |
                                                  v
                                      +-----------------------+
                                      | Authenticated / Guest |
                                      +-----------------------+
                                                  |
                     +----------------------------+----------------------------+
                     |                                                         |
          [ Path A / B: Desktop Browser ]                            [ Path D: Unsupported ]
                     |                                                         |
         +-----------+-----------+                                             v
         |                       |                                   +-------------------+
  [ Extension Found ]   [ No Extension ]                             | Mobile / Web-only |
         |                       |                                   | Manual Sync Bar   |
         v                       v                                   +-------------------+
+------------------+   +-------------------+
| Ready to Sync    |   | 1. Install Ext    |
| [ Enter Room ]   |   | 2. Or Manual Mode |
+------------------+   +-------------------+
```

### Path A: Extension Detected (Seamless Direct Join)

```text
+-------------------------------------------------------+
|  HUDDLY                                               |
|                                                       |
|  Join Watch Room: "Anime Night"                       |
|  Host: Alice | 3 Participants Active                  |
|                                                       |
|  [✓] Browser Extension Connected                      |
|                                                       |
|  Display Name: [ Bob                       ]          |
|                                                       |
|  [     Enter Room & Sync Video     ]                  |
+-------------------------------------------------------+
```

### Path B: No Extension Detected (Fallback Prompt)

```text
+-------------------------------------------------------+
|  HUDDLY                                               |
|                                                       |
|  Join Watch Room: "Anime Night"                       |
|                                                       |
|  [!] Extension not detected in this browser.          |
|                                                       |
|  For automatic video sync:                            |
|  [ Download Extension (.zip / Chrome Store) ]         |
|                                                       |
|  Or continue in browser:                              |
|  [ Join in Manual Sync Mode (Web Only) ]              |
+-------------------------------------------------------+
```

### Path C: Guest Join Flow (Instant Access)

```text
+-------------------------------------------------------+
|  HUDDLY                                               |
|                                                       |
|  You have been invited to join a watch party!         |
|                                                       |
|  Enter a temporary nickname to join:                  |
|  [ Guest-Panda                             ]          |
|                                                       |
|  [ Join as Guest ]     or     [ Sign In with Account ]|
+-------------------------------------------------------+
```

### Path D: Unsupported Browser (Manual Sync Mode)

```text
+-------------------------------------------------------+
|  HUDDLY                                               |
|                                                       |
|  Connected to "Anime Night" (Manual Web Client)       |
|                                                       |
|  Room Time: [ 00:23:45 ]  Status: PLAYING             |
|                                                       |
|  Open video in your favorite player and seek to:      |
|  [ 23m 45s ] [ Copy Timestamp ]                       |
|                                                       |
|  [ Enter Chat & Voice ]                               |
+-------------------------------------------------------+
```

---

## 4. Extension Popup & Permission Onboarding

### 4.1 Extension Popup UI

```text
+-------------------------------------+
|  HUDDLY SYNC HELPER           [v1.0]|
+-------------------------------------+
|  Status: CONNECTED TO ROOM          |
|  Room: Anime Night (hud-7k9p)       |
|  Detected Video: HTML5 (1080p)      |
|  Current Drift: +12ms (Synced)      |
|                                     |
|  [ (o) Auto-Sync Active          ]  |
|  [ Rescan Tab for Video Elements ]  |
|                                     |
|  [ Open Web Dashboard ]             |
+-------------------------------------+
```

### 4.2 Microphone / Media Permission Modal

```text
+-------------------------------------------------------+
|  Enable Voice Chat Permissions                        |
|                                                       |
|  Huddly needs microphone access for room audio.       |
|                                                       |
|  [ Microphone: Default - Built-in Mic (Apple) (v) ]   |
|  [ Input Level: ||||||||||||.......... ]              |
|                                                       |
|  [ Allow Microphone & Join Voice ]   [ Stay Muted ]   |
+-------------------------------------------------------+
```

---

## 5. Empty and Error States

### 5.1 Room Not Found / Closed State

```text
+-------------------------------------------------------+
|  Room Closed or Not Found                             |
|                                                       |
|  This watch room (hud-9999) has ended or expired.     |
|                                                       |
|  [ Back to Home ]          [ Create New Room ]        |
+-------------------------------------------------------+
```

### 5.2 Room Full State

```text
+-------------------------------------------------------+
|  Room Capacity Reached                                |
|                                                       |
|  This room has reached its limit of 10 participants.  |
|  Please ask the host to expand room capacity.         |
|                                                       |
|  [ Retry Join ]            [ Back to Home ]           |
+-------------------------------------------------------+
```
