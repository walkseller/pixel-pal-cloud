// P2P App logic using PeerJS (Gruvbox Brutalist UI)

let peer = null;
let conn = null;
let username = localStorage.getItem('sprite_username') || 'connor';
let currentTool = 'pencil';
let currentColor = '#b8bb26';
let isDrawing = false;

// 16x16 sprite data
let spriteData = Array(256).fill('transparent');

// Local users state map: id -> { username, sprite, x, y }
let users = {};
let myId = '';

// DOM Elements
const connectScreen = document.getElementById('connect-screen');
const appScreen = document.getElementById('app-screen');
const waitingModal = document.getElementById('waiting-modal');
const displayRoomCode = document.getElementById('display-room-code');

const usernameInput = document.getElementById('username-input');
const hostBtn = document.getElementById('host-btn');
const joinBtn = document.getElementById('join-btn');
const roomCodeInput = document.getElementById('room-code-input');

const pixelGridEl = document.getElementById('pixel-grid');
const colorPicker = document.getElementById('color-picker');
const colorPaletteEl = document.getElementById('color-palette');
const toolPencil = document.getElementById('tool-pencil');
const toolEraser = document.getElementById('tool-eraser');
const toolFill = document.getElementById('tool-fill');
const toolClear = document.getElementById('tool-clear');
const saveSpriteBtn = document.getElementById('save-sprite-btn');

const chatMessagesEl = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const toggleChatBtn = document.getElementById('toggle-chat-btn');
const chatDrawer = document.getElementById('chat-drawer');
const widgetCanvas = document.getElementById('widget-canvas');
const statusBadge = document.getElementById('status-badge');

const gruvboxPalette = [
  '#282828', '#ebdbb2', '#fb4934', '#fe8019', '#fabd2f', '#b8bb26',
  '#8ec07c', '#83a598', '#d3869b', '#d65d0e', '#cc241d', '#504945',
  '#928374', '#ebdbb2', '#fabd2f', '#8ec07c', '#83a598', '#d3869b'
];

function init() {
  usernameInput.value = username;
  buildPixelGrid();
  buildPalette();

  hostBtn.addEventListener('click', hostRoom);
  joinBtn.addEventListener('click', joinRoom);

  toolPencil.addEventListener('click', () => setTool('pencil'));
  toolEraser.addEventListener('click', () => setTool('eraser'));
  toolFill.addEventListener('click', () => setTool('fill'));
  toolClear.addEventListener('click', clearCanvas);
  saveSpriteBtn.addEventListener('click', saveAndBroadcast);

  colorPicker.addEventListener('input', (e) => currentColor = e.target.value);

  sendChatBtn.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });

  toggleChatBtn.addEventListener('click', () => {
    chatDrawer.classList.toggle('hidden');
  });

  const saved = localStorage.getItem('sprite_data');
  if (saved) {
    try {
      spriteData = JSON.parse(saved);
      updateGridDisplay();
    } catch (e) {}
  }
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
  if (myId) {
    users[myId] = { id: myId, username, sprite: spriteData, x: users[myId]?.x || 100, y: users[myId]?.y || 100 };
    broadcastState();
    renderCanvas();
  }
}

function hostRoom() {
  username = usernameInput.value.trim() || 'connor';
  localStorage.setItem('sprite_username', username);

  // Generate completely unique room ID to prevent collision
  const rand = Math.random().toString(36.2).substring(2, 6).toUpperCase();
  const code = 'PAL-' + rand;
  
  peer = new Peer(code);
  
  peer.on('open', (id) => {
    myId = id;
    displayRoomCode.textContent = id;
    waitingModal.classList.remove('hidden');
    users[myId] = { id: myId, username, sprite: spriteData, x: 120, y: 150 };
    console.log('Hosting room with ID:', id);
  });

  peer.on('connection', (connection) => {
    conn = connection;
    setupConnection();
    waitingModal.classList.add('hidden');
    enterApp();
    console.log('Partner connected!');
  });

  peer.on('error', (err) => {
    console.error('Peer error:', err);
    alert('Room error: ' + err.type + '. Try refreshing and creating a new room.');
  });
}

function joinRoom() {
  username = usernameInput.value.trim() || 'partner';
  localStorage.setItem('sprite_username', username);
  const code = roomCodeInput.value.trim().toUpperCase();

  if (!code) {
    alert('Please enter a valid room code!');
    return;
  }

  peer = new Peer();
  
  peer.on('open', (id) => {
    myId = id;
    users[myId] = { id: myId, username, sprite: spriteData, x: 300, y: 150 };
    
    console.log('Connecting to room code:', code);
    conn = peer.connect(code, { reliable: true });
    setupConnection();
  });

  peer.on('error', (err) => {
    console.error('Peer connect error:', err);
    alert('Could not connect to room ("' + code + '"). Check if the host is still waiting and the code is correct!');
  });
}

function setupConnection() {
  if (!conn) return;

  conn.on('open', () => {
    console.log('Data connection opened successfully!');
    enterApp();
    broadcastState();
  });

  conn.on('data', (data) => {
    handlePeerData(data);
  });

  conn.on('close', () => {
    statusBadge.textContent = 'disconnected ⚠️';
    statusBadge.className = 'px-3 py-1 font-mono text-xs uppercase bg-gruvbox-red text-gruvbox-bg font-bold shadow-[2px_2px_0px_0px_#504945]';
  });
}

function enterApp() {
  connectScreen.classList.add('hidden');
  waitingModal.classList.add('hidden');
  appScreen.classList.remove('hidden');
  renderCanvas();
}

function broadcastState() {
  if (conn && conn.open) {
    conn.send({
      type: 'state_update',
      user: users[myId]
    });
  }
}

function handlePeerData(data) {
  if (data.type === 'state_update') {
    users[data.user.id] = data.user;
    renderCanvas();
  } else if (data.type === 'chat_message') {
    appendMessage(data.msg);
  }
}

function sendChatMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  const msgObj = {
    sender: username,
    text: text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
  appendMessage(msgObj);
  if (conn && conn.open) {
    conn.send({ type: 'chat_message', msg: msgObj });
  }
  chatInput.value = '';
}

function appendMessage(msg) {
  const div = document.createElement('div');
  div.className = 'p-2 bg-gruvbox-lighter border border-gruvbox-border shadow-[2px_2px_0px_0px_#1d2021]';
  div.innerHTML = `
    <div class="flex justify-between text-[11px] text-gruvbox-green font-bold mb-1">
      <span>${msg.sender}</span>
      <span class="text-gruvbox-muted font-normal">${msg.timestamp}</span>
    </div>
    <div class="text-gruvbox-fg text-xs break-words">${escapeHtml(msg.text)}</div>
  `;
  chatMessagesEl.appendChild(div);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
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
        broadcastState();
      });

      window.addEventListener('mouseup', () => {
        isDragging = false;
      });
    }

    widgetCanvas.appendChild(userDiv);
  });
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

window.addEventListener('DOMContentLoaded', init);
