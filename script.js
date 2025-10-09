// script.js
const container = document.getElementById('container');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const counterText = document.getElementById('counterText');
const createButton = document.getElementById('createButton');
const touchShape = document.getElementById('touchShape');
const backButton = document.getElementById('backButton');
const topText = document.getElementById('topText');
const bottomText = document.getElementById('bottomText');
const bodyEl = document.getElementById('body');

let dots = [];
let lines = [];
let counter = 0;
let lastSelectedDot = null;
let dragging = false;
let dots = [], lines = [], actions = [];
let lastSelectedDot = null, dragging = false;
let shapeReady = false, shapeCanvas, shapeCtx;
let locked = false;

// Shape hit-test canvas
let shapeReady = false;
let shapeCanvas, shapeCtx;
const shapeImage = new Image();
shapeImage.src = 'touchShape.png';
shapeImage.onload = () => loadShape();

// Resize canvas to container
function resizeCanvas() {
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;

  if (touchShape.complete) {
    loadShape();
  }
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
    if (shapeReady) loadShape();
    drawAll();
}


window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Load and scale shape image into offscreen canvas
function loadShape() {
  shapeCanvas = document.createElement('canvas');
  shapeCanvas.width = container.clientWidth;
  shapeCanvas.height = container.clientHeight;
  shapeCtx = shapeCanvas.getContext('2d');
  shapeCtx.drawImage(touchShape, 0, 0, shapeCanvas.width, shapeCanvas.height);
  shapeReady = true;
}
touchShape.onload = loadShape;
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

// Check if point inside shape
    shapeCtx.clearRect(0, 0, cW, cH);
    shapeCtx.drawImage(shapeImage, offsetX, offsetY, drawW, drawH);
    shapeLayout = {
        offsetX,
        offsetY,
        drawW,
        drawH
    };
    
    shapeReady = true;
}
function isInsideShape(x, y) {
  if (!shapeReady) return false;
  const pixel = shapeCtx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
  return pixel[3] > 0;
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

// Draw lines + arrows
function drawLines() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  lines.forEach(line => {
    ctx.strokeStyle = 'red';
    ctx.lineWidth = line.width;
    ctx.beginPath();
    ctx.moveTo(line.from.x, line.from.y);
    ctx.lineTo(line.to.x, line.to.y);
    ctx.stroke();

    const angle = Math.atan2(line.to.y - line.from.y, line.to.x - line.from.x);
    const arrowSize = 10;
    ctx.beginPath();
    ctx.moveTo(line.to.x, line.to.y);
    ctx.lineTo(
      line.to.x - arrowSize * Math.cos(angle - Math.PI / 6),
      line.to.y - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      line.to.x - arrowSize * Math.cos(angle + Math.PI / 6),
      line.to.y - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = 'red';
    ctx.fill();
  });


function toNormalized(x, y) {
    if (!shapeLayout) return { nx: 0, ny: 0 };
    const { offsetX, offsetY, drawW, drawH } = shapeLayout;
    return {
        nx: (x - offsetX) / drawW,
        ny: (y - offsetY) / drawH
    };
}

// Update counter + text
function updateCounter() {
  counterText.textContent = `phi = ${counter}`;
  if (counter <= 30) {
    counterText.textContent += " - low phi. no consciousness found.";
  } else {
    counterText.textContent += " - some consciousness found.";
  }

function toAbsolute(nx, ny) {
    if (!shapeLayout) return { x: 0, y: 0 };
    const { offsetX, offsetY, drawW, drawH } = shapeLayout;
    return {
        x: nx * drawW + offsetX,
        y: ny * drawH + offsetY
    };
}

// Find dot under coords

function getDotAt(x, y) {
  return dots.find(d => Math.hypot(d.x - x, d.y - y) <= 12);
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
        ctx.strokeStyle = '#96244c';
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
    ctx.fillStyle = '#96244c';
    ctx.fill();
}

// Handle touch/click
function handleTouch(e) {
  e.preventDefault();
  const rect = container.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : e;
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

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
  } else {
    const dot = { x, y };
    dots.push(dot);

    const minDistance = 20+ 2; // dot radius (16/2) + 2px safe space
const tooClose = dots.some(d => {
    const pos = toAbsolute(d.nx, d.ny);
    return Math.hypot(pos.x - x, pos.y - y) <= minDistance;
});
if (tooClose) return; // skip creating dot


    // Create dot with normalized coordinates
    const { nx, ny } = toNormalized(x, y);
    const dot = { nx, ny, size: 16, connections: 0, el: null };
const dotEl = document.createElement('div');
dotEl.className = 'dot';
    dotEl.style.left = x + 'px';
    dotEl.style.top = y + 'px';
container.appendChild(dotEl);
    dot.el = dotEl;
    dots.push(dot);

    counter += 2;
    if (counter > 0) createButton.disabled = false;
    actions.push({ type: 'dot', dot });
    createButton.disabled = false; createButton.style.opacity = 1;
    backButton.disabled = false; backButton.style.opacity = 1;

lastSelectedDot = dot;
dragging = true;
  }
  drawLines();
  updateCounter();
    drawAll();
}

// Connect two dots




function connectDots(dotA, dotB) {
  const existingLine = lines.find(
    l => (l.from === dotA && l.to === dotB) || (l.from === dotB && l.to === dotA)
  );
  if (existingLine) {
    existingLine.width += 2;
    counter += 10;
  } else {
    lines.push({ from: dotA, to: dotB, width: 2 });
    counter += 10;
  }
  updateCounter();
  drawLines();
    if (locked) return;
    let line = lines.find(l => (l.from===dotA && l.to===dotB));
    let reverse = lines.find(l => l.from === dotB && l.to === dotA);
    if (line) {
        line.count++; line.width += 0.5;
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
}

// Events
function growDot(dot) {
    dot.size += 0.5;
    if (dot.el) {
      dot.el.style.width = dot.size + 'px';
      dot.el.style.height = dot.size + 'px';
    }
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
});



createButton.addEventListener('click', () => {
  if (createButton.textContent === 'Create') {
    createButton.textContent = 'Try Again';
    document.body.style.backgroundColor = 'black';
  } else {
    location.reload();
  }
    if (dots.length === 0) return;

    const N = dots.length;
    const C = lines.length;
    const Phi = 5*N + 2*C;

    if (Phi > 80) enterState('high', Phi);
    else if (Phi > 50) enterState('low', Phi);
    else enterState('none', Phi);
});

function enterState(state, phi) {
    locked = true;
    topText.style.opacity = 0;
    counterText.style.opacity = 1;
    counterText.textContent = `${phi} phi`;

    if (state==='high') {
        bodyEl.style.backgroundColor = '#be7d92';
        bottomText.textContent = 'Complex consciousness.';
        bottomText.style.opacity = 1;

        backButton.style.background = "url('close.svg') center/contain no-repeat";
        backButton.style.border = '0.2rem solid #96244c';
        backButton.style.backgroundColor = '#96244c'
        backButton.style.opacity = 1; backButton.disabled=false;

        createButton.textContent = 'print';
        createButton.style.background = '#FFF';
        createButton.style.boxShadow = '4px 4px 28px 0 #96244c';
        createButton.style.color = '#96244c';
        createButton.style.border = 'none';
        createButton.onclick = () => {
            localStorage.clear();
            window.location.reload();
        };
        
        
        
        
        
        

    } else if (state==='low') {
        bodyEl.style.backgroundColor = '#e8d3da';
        bottomText.textContent = 'Simple consciousness.';
        bottomText.style.opacity = 1;

        backButton.style.background = "url('close.svg') center/contain no-repeat";
        backButton.style.border = '0.2rem solid #96244c';
        backButton.style.backgroundColor = '#96244c'
        backButton.style.opacity = 1; backButton.disabled=false;

        createButton.textContent = 'print';
        createButton.style.background = '#FFF';
        createButton.style.boxShadow = '4px 4px 28px 0 #96244c';
        createButton.style.color = '#96244c';
        createButton.style.border = 'none';
        createButton.onclick = () => {
            localStorage.clear();
            window.location.reload();
        };
        

    } else if (state === 'none') {
        bodyEl.style.backgroundColor = '#8a8b92';
        bottomText.textContent = 'No consciousness found.';
        bottomText.style.opacity = 1;

        backButton.classList.add('hidden');

        createButton.textContent = 'try again';
        createButton.style.border = '0.2rem solid #96244c';
        createButton.style.background = '#FFF';
        createButton.style.boxShadow = '4px 4px 28px 0 #AE053C';
        createButton.style.color = '#96244c';
        createButton.onclick = () => {
            localStorage.clear();
            window.location.reload();
        };
    }

    drawLines();
    updateCounter();
}
