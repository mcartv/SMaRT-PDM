// Extracted from original server.js: imports, app/server creation, and socket setup
require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const multer = require('multer');
const {
  buildAuthToken,
  protect,
  authenticateSocket,
} = require('./middleware/authMiddleware');
const { createAccountRecoveryService } = require('./services/accountRecoveryService');
const notificationService = require('./services/notificationService');
const messageService = require('./services/messageService');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:5000",
      "https://smart-pdm-mipx.onrender.com"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  // Add these for Render compatibility
  allowUpgrades: true,
  perMessageDeflate: false,
  httpCompression: false
});

// Add connection error handling
io.engine.on("connection_error", (err) => {
  console.log("Connection error:", err);
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
