require('dotenv').config();
const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const User = require('./models/User');
const initSocket = require('./socket');

const DEMO_ACCOUNT = {
  username: 'demo',
  email: 'demo@relay.local',
  password: 'RelayDemo2026!',
};

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Copy server/.env.example to server/.env');
  process.exit(1);
}

const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim());

const app = express();
app.use(helmet());
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: '10kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/messages', require('./routes/messages'));

// Optionally serve the built React app (single-service deployment)
const clientDist = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api|\/socket\.io).*/, (req, res) =>
    res.sendFile(path.join(clientDist, 'index.html'))
  );
}

app.use((req, res) => res.status(404).json({ message: 'Not found' }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: origins, credentials: true } });
initSocket(io);

const PORT = process.env.PORT || 5000;

connectDB()
  .then(async () => {
    // Nobody is connected right after a restart
    await User.updateMany({ isOnline: true }, { isOnline: false });
    if (process.env.DEMO_ACCOUNT_ENABLED === 'true') {
      const demoUser = await User.findOne({ email: DEMO_ACCOUNT.email });
      if (!demoUser) {
        await User.create(DEMO_ACCOUNT);
        console.log('Demo account created');
      } else {
        console.log('Demo account is ready');
      }
    }
    server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to start:', err.message);
    process.exit(1);
  });
