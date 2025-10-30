
// script.js
const socket = new WebSocket("wss://kreatormator-7cd9cf35d253.herokuapp.com:443");

socket.addEventListener('open', () => {
    console.log("✅ Connected to TouchDesigner");
  });
  
  socket.addEventListener('error', (err) => {
    console.error("❌ WebSocket error:", err);
  });
  
  socket.addEventListener('close', () => {
    console.log("🔌 WebSocket connection closed");
  });

const container = document.getElementById('container');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const counterText = document.getElementById('counterText');
const createButton = document.getElementById('createButton');
const backButton = document.getElementById('backButton');
const topText = document.getElementById('topText');
const bottomText = document.getElementById('bottomText');
const bodyEl = document.getElementById('body');
const recordButton = document.getElementById ('recordButton')


let dots = [], lines = [], actions = []; 
let lastSelectedDot = null, dragging = false;
let shapeReady = false, shapeCanvas, shapeCtx;
let locked = false;
let NS = 0;
let CS = 0;
let Phi = 0;
let C = 0;
let N = 0;
let Rec= 0; 

const shapeImage = new Image();
shapeImage.src = 'touchShape.png';
shapeImage.onload = () => loadShape();

function resizeCanvas() {
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
    if (shapeReady) loadShape();
    drawAll();
}

const phiSounds = {
    hello1: new Audio('/sounds/hallo_1.mp3'),
    hello2: new Audio('/sounds/hallo_2.mp3'),
    hello3: new Audio('/sounds/hallo_3.mp3')
  };
  
  // Track which sounds have already played
  const playedSounds = {
    hello1: false,
    hello2: false,
    hello3: false
  };

function updateCounter() {
N = dots.length;
C = lines.length;
Phi = N+C+NS+CS
 
counterText.textContent = `Φ=${Phi} | N=${N} | NS=${NS} | C=${C} | CS=${CS}`;
counterText.textContent = `${Phi} phi`;

  if (Phi === 80 && !playedSounds.hello1) {
    phiSounds.hello1.play();
    playedSounds.hello1 = true;
  } else if (Phi === 100 && !playedSounds.hello2) {
    phiSounds.hello2.play();
    playedSounds.hello2 = true;
  } else if (Phi === 120 && !playedSounds.hello3) {
    phiSounds.hello3.play();
    playedSounds.hello3 = true;
  }
  
}

// Function to update button visibility
function updateButtonVisibility() {
    if (Phi < 80) {
        recordButton.style.display = 'none'; // hide
    } else {
        recordButton.style.display = 'inline-block'; // show
    }
}

let lastSent = 0;
const throttleInterval = 100; // milliseconds → 10 messages/sec

function sendTouchdesigner() {
    if (socket.readyState !== WebSocket.OPEN) return;

    const now = Date.now();
    if (now - lastSent < throttleInterval) return; // skip if too soon
    lastSent = now;

    const payload = {
        phi: Phi,
        n: N,
        ns: NS,
        c: C,
        cs: CS,
        rec: Rec
    };

    socket.send(JSON.stringify(payload));
    console.log("📤 Sent to TouchDesigner:", JSON.stringify(payload));
}
    
  

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function loadShape() {
    shapeCanvas = document.createElement('canvas');
    shapeCanvas.width = container.offsetWidth;
    shapeCanvas.height = container.offsetHeight;
    shapeCtx = shapeCanvas.getContext('2d', { willReadFrequently: true });


    const imgW = shapeImage.naturalWidth;
    const imgH = shapeImage.naturalHeight;
    const cW = shapeCanvas.width;
    const cH = shapeCanvas.height;

    const scale = Math.min(cW / imgW, cH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const offsetX = (cW - drawW) / 2;
    const offsetY = (cH - drawH) / 2;

    shapeCtx.clearRect(0, 0, cW, cH);
    shapeCtx.drawImage(shapeImage, offsetX, offsetY, drawW, drawH);
    shapeLayout = {
        offsetX,
        offsetY,
        drawW,
        drawH
    };
    
    shapeReady = true;
    sendTouchdesigner();
}
function isInsideShape(x, y) {
    if (!shapeReady) return false;

    if (!isInsideShape._maskCtx) {
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = shapeImage.naturalWidth;
        maskCanvas.height = shapeImage.naturalHeight;
        const maskCtx = maskCanvas.getContext('2d');
        maskCtx.drawImage(shapeImage, 0, 0);
        isInsideShape._maskCtx = maskCtx;
    }

    const { nx, ny } = toNormalized(x, y);
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return false;

    const imgX = Math.floor(nx * shapeImage.naturalWidth);
    const imgY = Math.floor(ny * shapeImage.naturalHeight);

    const pixel = isInsideShape._maskCtx.getImageData(imgX, imgY, 1, 1).data;
    return pixel[3] > 0;
}




function toNormalized(x, y) {
    if (!shapeLayout) return { nx: 0, ny: 0 };
    const { offsetX, offsetY, drawW, drawH } = shapeLayout;
    return {
        nx: (x - offsetX) / drawW,
        ny: (y - offsetY) / drawH
    };
}


function toAbsolute(nx, ny) {
    if (!shapeLayout) return { x: 0, y: 0 };
    const { offsetX, offsetY, drawW, drawH } = shapeLayout;
    return {
        x: nx * drawW + offsetX,
        y: ny * drawH + offsetY
    };
}


function getDotAt(x, y) {
    return dots.find(d => {
        const abs = toAbsolute(d.nx, d.ny);
        const dx = abs.x - x;
        const dy = abs.y - y;
        const radius = (d.size || 24)/2 + 2;
        return Math.hypot(dx, dy) <= radius;
    });
}

function drawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    lines.forEach(line => {
        
        const from = toAbsolute(line.from.nx, line.from.ny);
        const to = toAbsolute(line.to.nx, line.to.ny);

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const angle = Math.atan2(dy, dx);

        let offsetX = 0, offsetY = 0;
        if (line.parallelOffset) {
          offsetX = line.parallelOffset * Math.cos(angle + Math.PI / 2);
          offsetY = line.parallelOffset * Math.sin(angle + Math.PI / 2);
        }

        const rFrom = (line.from.size || 24)/2 + 2;
        const rTo = (line.to.size || 24)/2 + 2;

        const startX = from.x + offsetX + rFrom * Math.cos(angle);
        const startY = from.y + offsetY + rFrom * Math.sin(angle);
        const endX = to.x + offsetX - rTo * Math.cos(angle);
        const endY = to.y + offsetY - rTo * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = '#333c8b';
        ctx.lineWidth = line.width;
        ctx.stroke();

        drawArrow(endX, endY, angle, line.width);
    });

    dots.forEach(dot => {
        const pos = toAbsolute(dot.nx, dot.ny);
    
        const manualOffset = 0.4 * parseFloat(getComputedStyle(document.documentElement).fontSize); // 0.1rem in pixels
    
        dot.el.style.position = 'absolute';
        dot.el.style.left = pos.x - dot.size / 2 + manualOffset + 'px';
        dot.el.style.top  = pos.y - dot.size / 2 + manualOffset + 'px';
        dot.el.style.width = dot.size + 'px';
        dot.el.style.height = dot.size + 'px';
        dot.el.style.borderRadius = '50%';
        dot.el.style.pointerEvents = 'none';
    });
    
    updateCounter();
    updateButtonVisibility();
    
}

function drawArrow(x, y, angle, lineWidth = 2) {
    const arrowSize = Math.max(10, lineWidth*3);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - arrowSize * Math.cos(angle - Math.PI/6),
               y - arrowSize * Math.sin(angle - Math.PI/6));
    ctx.lineTo(x - arrowSize * Math.cos(angle + Math.PI/6),
               y - arrowSize * Math.sin(angle + Math.PI/6));
    ctx.closePath();
    ctx.fillStyle = '#333c8b';
    ctx.fill();
}

function handleTouch(e) {
    e.preventDefault();
    if (locked) return;

    // Pointer coordinates in container space
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    // Map to canvas pixel space
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    // Check alpha of the shape
    if (!isInsideShape(x, y)) return;

    const existingDot = getDotAt(x, y);
    if (existingDot) {
        if (dragging && lastSelectedDot && lastSelectedDot !== existingDot) {
            connectDots(lastSelectedDot, existingDot);
            dragging = false;
            lastSelectedDot = null;
        } else {
            lastSelectedDot = existingDot;
            dragging = true;
        }
        drawAll();
        return;
        
    }

    const minDistance = 20+ 2; // dot radius (16/2) + 2px safe space
const tooClose = dots.some(d => {
    const pos = toAbsolute(d.nx, d.ny);
    return Math.hypot(pos.x - x, pos.y - y) <= minDistance;
});
if (tooClose) return; // skip creating dot


    // Create dot with normalized coordinates
    const { nx, ny } = toNormalized(x, y);
    const dot = { nx, ny, size: 24, connections: 0, el: null };
    const dotEl = document.createElement('div');
    dotEl.className = 'dot';
    container.appendChild(dotEl);
    dot.el = dotEl;
    dots.push(dot);

    actions.push({ type: 'dot', dot });
    createButton.disabled = false; createButton.style.opacity = 1;
    backButton.disabled = false; backButton.style.opacity = 1;

    lastSelectedDot = dot;
    dragging = true;
    drawAll();
    sendTouchdesigner();
}





function connectDots(dotA, dotB) {
    if (locked) return;
    let line = lines.find(l => (l.from===dotA && l.to===dotB));
    let reverse = lines.find(l => l.from === dotB && l.to === dotA);
    if (line) {
        line.count++; line.width += 0.5;
        CS++;
        actions.push({type:'reinforce', line});
    } else {
        let parallelOffset = 0;
        if (reverse) {
            // put this on the opposite side of the reverse line
            parallelOffset = reverse.parallelOffset ? -reverse.parallelOffset : -6;
        }

    line = { from: dotA, to: dotB, width: 2, count: 1, parallelOffset };
    lines.push(line);

    dotA.connections++;
    dotB.connections++;
    growDot(dotA);
    growDot(dotB);
        actions.push({type:'line', line});
    }
    drawAll();
    sendTouchdesigner();
}

function growDot(dot) {
    dot.size += 0.5;
    NS++;
    if (dot.el) {
      dot.el.style.width = dot.size + 'px';
      dot.el.style.height = dot.size + 'px';
    }
    sendTouchdesigner();
  }

// Event listeners
container.addEventListener('touchstart', handleTouch);
container.addEventListener('mousedown', handleTouch);


// ---- CREATE BUTTON & STATE LOGIC ----
function undoLastAction() {
    if (actions.length === 0) return;

    const last = actions.pop();

    if (last.type === 'dot') {
        // Remove the dot element from DOM
        if (last.dot.el && last.dot.el.parentNode) {
            container.removeChild(last.dot.el);
        }
        // Remove from dots array
        dots = dots.filter(d => d !== last.dot);
    } 
    else if (last.type === 'line') {
        // Remove line
        lines = lines.filter(l => l !== last.line);

        // Decrease connections and sizes
        last.line.from.connections = Math.max(0, last.line.from.connections - 1);
        last.line.to.connections = Math.max(0, last.line.to.connections - 1);
        last.line.from.size = Math.max(16, last.line.from.size - 1);
        last.line.to.size = Math.max(16, last.line.to.size - 1);
    } 
    else if (last.type === 'reinforce') {
        // Decrease reinforcement
        last.line.count = Math.max(1, last.line.count - 1);
        last.line.width = Math.max(2, last.line.width - 0.5);
    }

    // Redraw after undo
    drawAll();
    sendTouchdesigner();

    // Disable back button if no actions left
    if (actions.length === 0) {
        backButton.disabled = true;
        backButton.style.opacity = 0.5;
    }
}



// --- Remove any previous backButton click bindings and add a single correct one ---
// --- Correct back button listener ---
backButton.addEventListener('click', (e) => {
    e.preventDefault();

    if (locked) {
        localStorage.clear();
        window.location.reload();
        return;
    }

    undoLastAction();
    updateButtonVisibility()
});

function wipeCanvas () {
    if (actions.length === 0) return;
      // Remove all dot elements from DOM
  dots.forEach(dot => {
    if (dot.el && dot.el.parentNode) {
      container.removeChild(dot.el);
    }
    updateButtonVisibility()
  });

  // Reset all arrays and state
  dots = [];
  lines = [];
  actions = [];
  lastSelectedDot = null;
  dragging = false;
  locked = false;

  // Reset counters
  NS = 0;
  CS = 0;
  N = 0;
  C = 0;
  Phi = 0;

  // Clear canvas visually
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Disable buttons again if you want
  createButton.disabled = true;
  createButton.style.opacity = 0.5;
  backButton.disabled = true;
  backButton.style.opacity = 0.5;

  // Update UI and TouchDesigner
  updateCounter();
  sendTouchdesigner();

  console.log("🧹 Canvas fully wiped and counters reset.");
}

createButton.addEventListener('click', (e) => {
    e.preventDefault();

    if (locked) {
        localStorage.clear();
        window.location.reload();
        return;
    }

    wipeCanvas();
});




recordButton.addEventListener('mousedown', () => {
    console.log("🟥 Mousedown triggered");
    recordButton.style.opacity = 0.5;
    Rec = 1;
    sendTouchdesigner();
  });
  
  recordButton.addEventListener('mouseup', () => {
    console.log("⬜ Mouseup triggered");
    recordButton.style.opacity = 1;
    Rec = 0;
    sendTouchdesigner();
  });
  
  recordButton.addEventListener('touchstart', (e) => {
    console.log("📱 Touchstart triggered");
    e.preventDefault();
    recordButton.style.opacity = 0.5;
    Rec = 1;
    sendTouchdesigner();
  });
  
  recordButton.addEventListener('touchend', (e) => {
    console.log("📱 Touchend triggered");
    e.preventDefault();
    recordButton.style.opacity = 1;
    Rec = 0;
    sendTouchdesigner();
  });
