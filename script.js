const container = document.getElementById('container');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const counterText = document.getElementById('counterText');
const createButton = document.getElementById('createButton');
const touchShape = document.getElementById('touchShape');

let dots = [];
let lines = [];
let counter = 0;
let lastSelectedDot = null;
let dragging = false;

// Shape hit-test canvas
let shapeReady = false;
let shapeCanvas, shapeCtx;

// Resize canvas to container
function resizeCanvas() {
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;

  if (touchShape.complete) {
    loadShape();
  }
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

// Check if point inside shape
function isInsideShape(x, y) {
  if (!shapeReady) return false;
  const pixel = shapeCtx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
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
}

// Update counter + text
function updateCounter() {
  counterText.textContent = `phi = ${counter}`;
  if (counter <= 30) {
    counterText.textContent += " - low phi. no consciousness found.";
  } else {
    counterText.textContent += " - some consciousness found.";
  }
}

// Find dot under coords
function getDotAt(x, y) {
  return dots.find(d => Math.hypot(d.x - x, d.y - y) <= 12);
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
    }
  } else {
    const dot = { x, y };
    dots.push(dot);
    const dotEl = document.createElement('div');
    dotEl.className = 'dot';
    dotEl.style.left = x + 'px';
    dotEl.style.top = y + 'px';
    container.appendChild(dotEl);

    counter += 2;
    if (counter > 0) createButton.disabled = false;

    lastSelectedDot = dot;
    dragging = true;
  }
  drawLines();
  updateCounter();
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
}

// Events
container.addEventListener('touchstart', handleTouch);
container.addEventListener('mousedown', handleTouch);

createButton.addEventListener('click', () => {
  if (createButton.textContent === 'Create') {
    createButton.textContent = 'Try Again';
    document.body.style.backgroundColor = 'black';
  } else {
    location.reload();
  }
});
