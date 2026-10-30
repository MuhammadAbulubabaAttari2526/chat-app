# Relay: real-time one-to-one chat

A full-stack chat application built with **Node.js, Express, Socket.IO, MongoDB and React (Vite)**.
Users register, log in, find other people, and message them in real time with typing indicators,
online/offline presence, and delivered/read receipts. Everything is stored in MongoDB.

## Features

| Feature | How it works |
| --- | --- |
| Authentication | Register and log in with email + password. Passwords are hashed with bcrypt; sessions use JWT. The same token authenticates REST calls and the Socket.IO handshake. |
| User list and search | `GET /api/users?search=` returns everyone else, with unread count and last message. The sidebar searches by username (debounced) and sorts recent conversations to the top. |
| Real-time messaging | Messages go over Socket.IO, are saved to MongoDB, and are pushed to the recipient instantly. The sender's other open tabs get a copy too. |
| Online / offline | The server tracks sockets per user (multi-tab safe). The first connection marks a user online and the last disconnect marks them offline and records `lastSeen`. |
| Typing indicators | `typing` events are relayed (not stored) and shown in the header, the user list and as an animated bubble. |
| Message history | Messages persist in MongoDB and load newest-first in pages of 30, with a "Load earlier messages" button. |
| Delivery and read receipts | Each message moves `sent` → `delivered` → `read`. See "How receipts work" below. |
| Responsive UI | Two panes on desktop. On phones the list and the chat are separate screens with a back button. |

## Tech stack

- **Server:** Node 18+, Express 4, Socket.IO 4, Mongoose 8, jsonwebtoken, bcryptjs, helmet, express-rate-limit
- **Client:** React 18, React Router 6, Vite 5, socket.io-client 4 (plain CSS, no UI library)
- **Database:** MongoDB 6/7 (local, Docker, or Atlas)

## Project structure

```
realtime-chat/
├── docker-compose.yml          # local MongoDB
├── package.json                # root scripts (install:all, dev, build, start)
├── server/
│   ├── .env.example
│   └── src/
│       ├── index.js            # Express + Socket.IO bootstrap
│       ├── config/db.js        # Mongo connection
│       ├── models/             # User, Message
│       ├── middleware/auth.js  # JWT guard for REST
│       ├── routes/             # auth, users, messages
│       ├── socket/index.js     # auth, presence, messaging, receipts, typing
│       └── utils.js
└── client/
    ├── .env.example
    ├── vite.config.js          # dev proxy to the API
    └── src/
        ├── api.js, utils.js
        ├── context/AuthContext.jsx
        ├── pages/              # Login, Register, Chat (all socket state lives here)
        └── components/         # Sidebar, ChatWindow, Avatar, Ticks
```

## Getting started

### 1. Prerequisites

- Node.js 18 or newer
- MongoDB: either `docker compose up -d` (uses the included file) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

### 2. Install

```bash
git clone <your-repo-url> realtime-chat
cd realtime-chat
npm run install:all
```

### 3. Configure

```bash
cp server/.env.example server/.env
# edit server/.env: set JWT_SECRET to a long random string
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5000` | API port |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/realtime_chat` | Mongo connection string |
| `JWT_SECRET` | none, **required** | Signs tokens. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `DEMO_ACCOUNT_ENABLED` | `false` | Set to `true` in local/demo environments to create the demo account |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed browser origin(s), comma-separated |

The client needs no config in development: Vite proxies `/api` and `/socket.io` to port 5000.
When `DEMO_ACCOUNT_ENABLED=true`, the login page offers a demo account (`demo@relay.local` / `RelayDemo2026!`). Leave this disabled in production.

### 4. Run

```bash
npm run dev
```

Open <http://localhost:5173>. To try the chat yourself, register two accounts: one in a normal window and one in a private window (or another browser), then message between them.

### Production build

```bash
npm run build     # builds client/dist
npm start         # server also serves client/dist, so one process hosts everything
```

## Try it: demo script (about 2 minutes)

1. Register **alice** in a normal window and **bob** in a private window.
2. In Alice's window, open Bob. His avatar shows a green dot and the header says **Online**.
3. Start typing in Alice's box. Bob sees **typing…** in the list and the chat header.
4. Send "hello". It shows one tick (sent), then two grey ticks (delivered) as soon as Bob's client receives it.
5. Bob opens Alice's chat: Alice's ticks turn **blue** (read). If Bob's chat was not open, he sees an unread badge instead.
6. Close Bob's window. Alice sees him go offline with "last seen …".
7. Send more messages while he is away, then log Bob back in. The messages are marked delivered, and the history is intact.
8. Resize the browser below 800px to see the single-pane mobile layout.

## API reference

All endpoints except register/login need `Authorization: Bearer <token>`.

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/auth/register` | `{ username, email, password }` → `{ token, user }` |
| POST | `/api/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | Current user |
| GET | `/api/users?search=` | Other users with `unreadCount` and `lastMessage` |
| GET | `/api/messages/:userId?limit=30&before=<ISO>` | Conversation page, oldest → newest, plus `hasMore` |
| GET | `/api/health` | Liveness check |

## Socket.IO events

Connect with `io(url, { auth: { token } })`. Connections with a missing or invalid token are rejected.

| Direction | Event | Payload |
| --- | --- | --- |
| client → server | `message:send` | `{ to, text }` with ack `{ ok, message }` or `{ ok:false, error }` |
| client → server | `message:read` | `{ from }`: I have read everything from this user |
| client → server | `typing` | `{ to, isTyping }` |
| server → client | `message:new` | message object |
| server → client | `message:status` | `{ ids, status: 'delivered' \| 'read', conversationWith }` |
| server → client | `conversation:read` | `{ with }`: sent to my other tabs so unread badges clear |
| server → client | `presence:list` | array of online user ids (sent on connect) |
| server → client | `presence:update` | `{ userId, isOnline, lastSeen? }` |
| server → client | `typing` | `{ from, isTyping }` |

## Data model

**User:** `username` (unique), `email` (unique), `password` (bcrypt, never selected by default), `isOnline`, `lastSeen`, timestamps.
**Message:** `sender`, `receiver`, `text` (≤ 2000), `status` (`sent | delivered | read`), `deliveredAt`, `readAt`, timestamps. Indexed on `(sender, receiver, createdAt)` and `(receiver, status)`.

## How receipts work

- **sent:** the server has saved the message.
- **delivered:** the recipient had at least one live socket when it arrived, or they connected later (on connect the server upgrades everything still `sent` and notifies the senders).
- **read:** the recipient's client emits `message:read` when they open the conversation, receive a message while viewing it, or return to the tab. The server marks the messages read and tells the sender.

The sender's UI adds an optimistic `sending` state before the server acknowledges, and a `failed` state (with a retry link) if the acknowledgement does not arrive within 8 seconds.

## Deployment

**Single service (simplest):** deploy the repo to Render, Railway, Fly.io or a VPS. Build command `npm run install:all && npm run build`, start command `npm start`, and set `MONGODB_URI` (Atlas), `JWT_SECRET`, and `CLIENT_ORIGIN` to your public URL. The Express server serves the built React app, so the client and API share one origin and no extra client config is needed. The host must support WebSockets (all of the above do).

**Split hosting:** host `client/dist` on a static host (Netlify, Vercel) with `VITE_API_URL=https://your-api` set at build time, host the server separately, and set `CLIENT_ORIGIN` to the static site's URL. Static hosts need a rewrite of all routes to `index.html`.

Note: presence tracking lives in server memory, so run a **single server instance**. To scale horizontally, add the Socket.IO Redis adapter and move the online-user map to Redis.

## Publishing to GitHub

```bash
cd realtime-chat
git init
git add .
git commit -m "Real-time chat app"
git branch -M main
git remote add origin https://github.com/<you>/realtime-chat.git
git push -u origin main
```

`.gitignore` already excludes `node_modules`, `.env` and build output. Never commit `server/.env`.

## Security notes

Passwords are hashed with bcrypt, auth endpoints are rate-limited, request bodies are size-limited, the search term is regex-escaped, and sockets are authenticated at the handshake. For production also consider moving the JWT into an httpOnly cookie (this app uses `localStorage` for simplicity), adding email verification, and enforcing HTTPS.

## Possible next steps

Message pagination by scroll position, image/file attachments, message deletion and editing, push notifications, group chats, and automated tests (Jest + Supertest for the API, a Socket.IO client test for receipts).
