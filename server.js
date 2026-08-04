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
  },
  pingInterval: 10000,
  pingTimeout: 5000
});

let rooms = {}; // roomId -> { users: { socketId: userData } }

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (data) => {
    const { username, room = 'lobby', sprite, x, y } = data;
    
    Array.from(socket.rooms).forEach(r => {
      if (r !== socket.id) socket.leave(r);
    });

    socket.join(room);
    socket.currentRoom = room;

    if (!rooms[room]) {
      rooms[room] = { users: {} };
    }

    rooms[room].users[socket.id] = {
      id: socket.id,
      username: username || 'Anonymous',
      sprite: sprite || Array(256).fill('transparent'),
      x: x || 120,
      y: y || 150,
      chatMessage: '',
      chatTimer: null
    };

    io.to(room).emit('update_users', Object.values(rooms[room].users));
  });

  socket.on('update_sprite', (spriteData) => {
    const room = socket.currentRoom;
    if (room && rooms[room] && rooms[room].users[socket.id]) {
      rooms[room].users[socket.id].sprite = spriteData;
      io.to(room).emit('update_users', Object.values(rooms[room].users));
    }
  });

  socket.on('update_position', (pos) => {
    const room = socket.currentRoom;
    if (room && rooms[room] && rooms[room].users[socket.id]) {
      rooms[room].users[socket.id].x = pos.x;
      rooms[room].users[socket.id].y = pos.y;
      io.to(room).emit('update_users', Object.values(rooms[room].users));
    }
  });

  socket.on('send_message', (text) => {
    const room = socket.currentRoom;
    if (room && rooms[room] && rooms[room].users[socket.id]) {
      const user = rooms[room].users[socket.id];
      user.chatMessage = text;
      
      if (user.chatTimer) clearTimeout(user.chatTimer);

      io.to(room).emit('update_users', Object.values(rooms[room].users));

      user.chatTimer = setTimeout(() => {
        if (rooms[room] && rooms[room].users[socket.id]) {
          rooms[room].users[socket.id].chatMessage = '';
          io.to(room).emit('update_users', Object.values(rooms[room].users));
        }
      }, 6000);
    }
  });

  socket.on('disconnect', () => {
    const room = socket.currentRoom;
    if (room && rooms[room] && rooms[room].users[socket.id]) {
      if (rooms[room].users[socket.id].chatTimer) clearTimeout(rooms[room].users[socket.id].chatTimer);
      delete rooms[room].users[socket.id];
      if (Object.keys(rooms[room].users).length === 0) {
        delete rooms[room];
      } else {
        io.to(room).emit('update_users', Object.values(rooms[room].users));
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`PixelPal Railway server running on port ${PORT}`);
});
