// Cloud Socket.io App logic (Gruvbox Brutalist UI with / chat & M reconnect)

let socket = null;
let username = localStorage.getItem('sprite_username') || 'parker';
let currentTool = 'pencil';
let currentColor = '#b8bb26';
let isDrawing = false;
let currentRoom = 'lobby';

// 16x16 sprite data
let spriteData = Array(256).fill('transparent');

// Local users state map: id -> { username, sprite, x, y, chatMessage }
let users = {};
let myId = '';

// DOM Elements
const connectScreen = document.getElementById('connect-screen');
const appScreen = document.getElementById('app-screen');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const modeLobbyBtn = document.getElementById('mode-lobby-btn');
const modePrivateBtn = document.getElementById('mode-private-btn');
const roomCodeWrapper = document.getElementById('room-code-wrapper');
const roomCodeInput = document.getElementById('room-code-input');
const roomDisplayBadge = document.getElementById('room-display-badge');

const pixelGridEl = document.getElementById('pixel-grid');
const colorPicker = document.getElementById('color-picker');
const colorPaletteEl = document.getElementById('color-palette');
const toolPencil = document.getElementById('tool-pencil');
const toolEraser = document.getElementById('tool-eraser');
const toolFill = document.getElementById('tool-fill');
const toolClear = document.getElementById('tool-clear');
const saveSpriteBtn = document.getElementById('save-sprite-btn');

const widgetCanvas = document.getElementById('widget-canvas');
const statusBadge = document.getElementById('status-badge');

const gameChatBar = document.getElementById('game-chat-bar');
const gameChatInput = document.getElementById('game-chat-input');

const gruvboxPalette = [
  '#282828', '#ebdbb2', '#fb4934', '#fe8019', '#fabd2f', '#b8bb26',
  '#8ec07c', '#83a598', '#d3869b', '#d65d0e', '#cc241d', '#504945',
  '#928374', '#ebdbb2', '#fabd2f', '#8ec07c', '#83a598', '#d3869b'
];

function init() {
  usernameInput.value = username;
  buildPixelGrid();
  buildPalette();

  modeLobbyBtn.addEventListener('click', () => {
    currentRoom = 'lobby';
    modeLobbyBtn.className = 'py-2 bg-gruvbox-green text-gruvbox-bg font-jersey text-xl font-bold border-2 border-gruvbox-border shadow-[2px_2px_0px_0px_#504945]';
    modePrivateBtn.className = 'py-2 bg-gruvbox-lighter text-gruvbox-muted hover:text-gruvbox-fg font-jersey text-xl font-bold border-2 border-gruvbox-border';
    roomCodeWrapper.classList.add('hidden');
  });

  modePrivateBtn.addEventListener('click', () => {
    currentRoom = 'private';
    modePrivateBtn.className = 'py-2 bg-gruvbox-green text-gruvbox-bg font-jersey text-xl font-bold border-2 border-gruvbox-border shadow-[2px_2px_0px_0px_#504945]';
    modeLobbyBtn.className = 'py-2 bg-gruvbox-lighter text-gruvbox-muted hover:text-gruvbox-fg font-jersey text-xl font-bold border-2 border-gruvbox-border';
    roomCodeWrapper.classList.remove('hidden');
    roomCodeInput.focus();
  });

  joinBtn.addEventListener('click', connectToServer);
  usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') connectToServer();
  });
  roomCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') connectToServer();
  });

  toolPencil.addEventListener('click', () => setTool('pencil'));
  toolEraser.addEventListener('click', () => setTool('eraser'));
  toolFill.addEventListener('click', () => setTool('fill'));
  toolClear.addEventListener('click', clearCanvas);
  saveSpriteBtn.addEventListener('click', saveAndBroadcast);

  colorPicker.addEventListener('input', (e) => currentColor = e.target.value);

  // Global key listener for '/' and 'M'
  window.addEventListener('keydown', (e) => {
    const activeTag = document.activeElement.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

    if (e.key === '/') {
      e.preventDefault();
      openGameChat();
    } else if (e.key.toLowerCase() === 'm') {
      e.preventDefault();
      returnToConnectionScreen();
    }
  });

  gameChatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendGameChat();
    } else if (e.key === 'Escape') {
      closeGameChat();
    }
  });

  const saved = localStorage.getItem('sprite_data');
  if (saved) {
    try {
      spriteData = JSON.parse(saved);
      updateGridDisplay();
    } catch (e) {}
  }
}

function openGameChat() {
  if (appScreen.classList.contains('hidden')) return;
  gameChatBar.classList.remove('hidden');
  gameChatInput.value = '';
  gameChatInput.focus();
}

function closeGameChat() {
  gameChatBar.classList.add('hidden');
  gameChatInput.blur();
}

function sendGameChat() {
  const text = gameChatInput.value.trim();
  if (text && socket && socket.connected) {
    socket.emit('send_message', text);
  }
  closeGameChat();
}

function returnToConnectionScreen() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  appScreen.classList.add('hidden');
  connectScreen.classList.remove('hidden');
  closeGameChat();
}

function connectToServer() {
  username = usernameInput.value.trim() || 'parker';
  localStorage.setItem('sprite_username', username);

  let room = 'lobby';
  if (currentRoom === 'private') {
    const code = roomCodeInput.value.trim().toUpperCase();
    if (!code) {
      alert('Please enter a private room code!');
      return;
    }
    room = 'room-' + code;
  }

  roomDisplayBadge.textContent = room === 'lobby' ? 'lobby' : room.replace('room-', '');

  // Connect via Socket.io to current host origin
  socket = io();

  socket.on('connect', () => {
    myId = socket.id;
    console.log('Connected to cloud server with id:', myId);
    
    socket.emit('join', {
      username,
      room,
      sprite: spriteData,
      x: 120 + Math.floor(Math.random() * 100),
      y: 150 + Math.floor(Math.random() * 50)
    });

    connectScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
  });

  socket.on('update_users', (serverUsers) => {
    users = {};
    serverUsers.forEach(u => {
      users[u.id] = u;
    });
    renderCanvas();
  });

  socket.on('disconnect', () => {
    statusBadge.textContent = 'disconnected ⚠️';
    statusBadge.className = 'px-3 py-1 font-mono text-xs uppercase bg-gruvbox-red text-gruvbox-bg font-bold shadow-[2px_2px_0px_0px_#504945]';
  });
}

function buildPalette() {
  colorPaletteEl.innerHTML = '';
  gruvboxPalette.forEach(hex => {
    const btn = document.createElement('button');
    btn.className = 'w-7 h-7 rounded-none border-2 border-gruvbox-border shadow-[1px_1px_0px_0px_#1d2021] transition hover:scale-105';
    btn.style.backgroundColor = hex;
    btn.addEventListener('click', () => {
      currentColor = hex;
      colorPicker.value = hex;
    });
    colorPaletteEl.appendChild(btn);
  });
}

function buildPixelGrid() {
  pixelGridEl.innerHTML = '';
  for (let i = 0; i < 256; i++) {
    const cell = document.createElement('div');
    cell.className = 'pixel-cell';
    cell.dataset.index = i;
    
    cell.addEventListener('mousedown', () => {
      isDrawing = true;
      applyTool(i);
    });
    cell.addEventListener('mouseover', () => {
      if (isDrawing) applyTool(i);
    });
    
    pixelGridEl.appendChild(cell);
  }
  window.addEventListener('mouseup', () => isDrawing = false);
  updateGridDisplay();
}

function applyTool(index) {
  if (currentTool === 'pencil') spriteData[index] = currentColor;
  else if (currentTool === 'eraser') spriteData[index] = 'transparent';
  else if (currentTool === 'fill') floodFill(index, spriteData[index], currentColor);
  updateGridDisplay();
  saveAndBroadcast();
}

function floodFill(index, targetColor, replacementColor) {
  if (targetColor === replacementColor) return;
  const queue = [index];
  const visited = new Set();
  while (queue.length > 0) {
    const curr = queue.pop();
    if (visited.has(curr)) continue;
    visited.add(curr);
    if (spriteData[curr] === targetColor || (targetColor === 'transparent' && !spriteData[curr])) {
      spriteData[curr] = replacementColor;
      const x = curr % 16;
      const y = Math.floor(curr / 16);
      if (x > 0) queue.push(curr - 1);
      if (x < 15) queue.push(curr + 1);
      if (y > 0) queue.push(curr - 16);
      if (y < 15) queue.push(curr + 16);
    }
  }
}

function updateGridDisplay() {
  const cells = pixelGridEl.children;
  for (let i = 0; i < 256; i++) {
    cells[i].style.backgroundColor = spriteData[i] || 'transparent';
    if (!spriteData[i] || spriteData[i] === 'transparent') {
      cells[i].style.backgroundImage = 'linear-gradient(45deg, #3c3836 25%, transparent 25%), linear-gradient(-45deg, #3c3836 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #3c3836 75%), linear-gradient(-45deg, transparent 75%, #3c3836 75%)';
      cells[i].style.backgroundSize = '8px 8px';
      cells[i].style.backgroundPosition = '0 0, 0 4px, 4px -4px, -4px 0px';
    } else {
      cells[i].style.backgroundImage = 'none';
    }
  }
}

function setTool(tool) {
  currentTool = tool;
  [toolPencil, toolEraser, toolFill].forEach(btn => {
    btn.className = 'px-2 py-1 bg-gruvbox-lighter text-gruvbox-muted hover:text-gruvbox-fg font-jersey text-lg font-bold border border-gruvbox-border';
  });
  if (tool === 'pencil') {
    toolPencil.className = 'px-2.5 py-1 bg-gruvbox-green text-gruvbox-bg font-jersey text-lg font-bold border border-gruvbox-border shadow-[1px_1px_0px_0px_#1d2021]';
  } else if (tool === 'eraser') {
    toolEraser.className = 'px-2.5 py-1 bg-gruvbox-orange text-gruvbox-bg font-jersey text-lg font-bold border border-gruvbox-border shadow-[1px_1px_0px_0px_#1d2021]';
  } else if (tool === 'fill') {
    toolFill.className = 'px-2.5 py-1 bg-gruvbox-yellow text-gruvbox-bg font-jersey text-lg font-bold border border-gruvbox-border shadow-[1px_1px_0px_0px_#1d2021]';
  }
}

function clearCanvas() {
  spriteData = Array(256).fill('transparent');
  updateGridDisplay();
  saveAndBroadcast();
}

function saveAndBroadcast() {
  localStorage.setItem('sprite_data', JSON.stringify(spriteData));
  if (socket && socket.connected) {
    socket.emit('update_sprite', spriteData);
  }
}

function renderCanvas() {
  widgetCanvas.innerHTML = '';
  Object.values(users).forEach(user => {
    const userDiv = document.createElement('div');
    userDiv.className = 'absolute flex flex-col items-center floating-sprite select-none transition-all duration-300';
    userDiv.style.left = `${user.x}px`;
    userDiv.style.top = `${user.y}px`;

    const miniGrid = document.createElement('div');
    miniGrid.className = 'grid grid-cols-16 w-16 h-16 bg-gruvbox-card rounded-none shadow-[4px_4px_0px_0px_#1d2021] border-2 border-gruvbox-border overflow-hidden pixel-canvas';
    miniGrid.style.gridTemplateColumns = 'repeat(16, minmax(0, 1fr))';
    miniGrid.style.gridTemplateRows = 'repeat(16, minmax(0, 1fr))';

    const spriteArr = user.sprite || Array(256).fill('transparent');
    for (let i = 0; i < 256; i++) {
      const pCell = document.createElement('div');
      pCell.style.backgroundColor = spriteArr[i] || 'transparent';
      miniGrid.appendChild(pCell);
    }

    const nameTag = document.createElement('div');
    nameTag.className = 'mt-1.5 px-2.5 py-0.5 bg-gruvbox-card border border-gruvbox-border text-gruvbox-green text-xs font-jersey tracking-wider font-bold shadow-[2px_2px_0px_0px_#1d2021] whitespace-nowrap';
    nameTag.textContent = user.username;

    userDiv.appendChild(miniGrid);
    userDiv.appendChild(nameTag);

    // Speech bubble
    if (user.chatMessage) {
      const bubble = document.createElement('div');
      bubble.className = 'mt-1 px-3 py-1 bg-gruvbox-card border-2 border-gruvbox-border text-gruvbox-yellow text-[11px] font-mono shadow-[2px_2px_0px_0px_#1d2021] max-w-[160px] text-center break-words';
      bubble.textContent = user.chatMessage;
      userDiv.appendChild(bubble);
    }

    // Make own sprite draggable
    if (user.id === myId) {
      let isDragging = false;
      let startX, startY;

      userDiv.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX - user.x;
        startY = e.clientY - user.y;
        e.stopPropagation();
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const newX = Math.max(0, Math.min(window.innerWidth - 100, e.clientX - startX));
        const newY = Math.max(0, Math.min(window.innerHeight - 120, e.clientY - startY));
        userDiv.style.left = `${newX}px`;
        userDiv.style.top = `${newY}px`;
        
        users[myId].x = newX;
        users[myId].y = newY;
        
        if (socket && socket.connected) {
          socket.emit('update_position', { x: newX, y: newY });
        }
      });

      window.addEventListener('mouseup', () => {
        isDragging = false;
      });
    }

    widgetCanvas.appendChild(userDiv);
  });
}

window.addEventListener('DOMContentLoaded', init);
