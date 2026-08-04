const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend from public folder
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let users = {};
let messages = [];

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userData) => {
    users[socket.id] = {
      id: socket.id,
      username: userData.username || 'Anonymous',
      sprite: userData.sprite || Array(256).fill('transparent'),
      x: userData.x || 120,
      y: userData.y || 150
    };
    io.emit('update_users', Object.values(users));
    socket.emit('chat_history', messages);
  });

  socket.on('update_sprite', (spriteData) => {
    if (users[socket.id]) {
      users[socket.id].sprite = spriteData;
      io.emit('update_users', Object.values(users));
    }
  });

  socket.on('update_position', (pos) => {
    if (users[socket.id]) {
      users[socket.id].x = pos.x;
      users[socket.id].y = pos.y;
      io.emit('update_users', Object.values(users));
    }
  });

  socket.on('send_message', (msg) => {
    const messageObj = {
      sender: users[socket.id] ? users[socket.id].username : 'Unknown',
      text: msg,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    messages.push(messageObj);
    if (messages.length > 50) messages.shift();
    io.emit('new_message', messageObj);
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
    io.emit('update_users', Object.values(users));
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`PixelPal cloud server running on port ${PORT}`);
});
