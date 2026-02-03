// scriptcopy.js
"use strict";


const socket = new WebSocket("wss://kreatormator-7cd9cf35d253.herokuapp.com:443");


socket.addEventListener('open', () => {
    console.log("✅ Connected to TouchDesigner");
    let Phi = 0;
    sendTouchdesigner();
});

socket.addEventListener('error', (err) => {
    console.error("❌ WebSocket error:", err);
});

socket.addEventListener('close', () => {
    console.log("🔌 WebSocket connection closed");
});

let socketPaused = false;


const container = document.getElementById('container');
const canvas = document.getElementById('canvas');
const bottom = document.getElementById('bottom');
const ctx = canvas.getContext('2d');
const counterText = document.getElementById('phivalue');
const resetButton = document.getElementById('resetbutton');
const backButton = document.getElementById('backbutton');
const createButton = document.getElementById('createbutton');
const message = document.getElementById('message');
const bodyEl = document.getElementById('body');
const phiCounter = document.getElementById('phicounter')
const topPart = document.getElementById('top')
const topLeft = document.getElementById('topleft')
const topRight = document.getElementById('topright')
const swap = document.getElementById('swapslot')
const connectionStatus = document.getElementById('connectionStatus');
const agentStatus = document.getElementById('agentStatus');


let dots = [], lines = [], actions = [];
let dragging = false;
let dragFrom = null; // dot being dragged
let dragPos = null; // {x,y} for temporary line
let shapeReady = false, shapeCanvas, shapeCtx;
let locked = false;



// metrics and flags
let N = 0; // number of dots
let C = 0; // number aof persistent directed lines (each directed line counts 1)
let totalLines = 0; // legacy/unused but kept for compatibility
let NR = 0; // ready dots
let CR = 0; // ready lines (unused)
let NO = 0; // on dots
let CO = 0; // on-state lines (outputs of ON dots)
let I = 0; // global I
let D = 0; // global D
let Phi = 0;



let firstDotCreated = false;
let secondDotCreated = false;
let firstConnectionCreated = false;
let secondConnectionCreated = false;

let shapeLayout = null;
let thresholdTriggered = false;
let lowthresholdTriggered = false;

let inResultMode = false;
let pendingResultMode = false;


const shapeImage = new Image();
shapeImage.src = 'touchShape.png';
shapeImage.onload = () => loadShape();


function resizeCanvas() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    if (shapeReady) loadShape();
    renderDots();
    drawAll();
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
}


function isInsideShape(x, y) {
    if (!shapeReady) return false;
    const pixel = shapeCtx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    return pixel[3] > 0;
}
const REM = parseFloat(getComputedStyle(document.documentElement).fontSize); // 1rem in px

const DOT_DEFAULT_SIZE = 22 / 16 * REM;     // was 24px
const DOT_TOUCH_DIAMETER = 30 / 16 * REM;   // was 32px
const DOT_TOUCH_RADIUS = DOT_TOUCH_DIAMETER / 3; // auto scales
const DOT_MAX_SIZE = 32 / 16 * REM;         // was 28px

const LINE_BASE_WIDTH = 4 / 16 * REM;       // was 2px
const LINE_MAX_WIDTH = 18 / 16 * REM;       // was 18px
// helpers
function clientToLocal(e) {
    // unified pointer/touch/mouse reader
    const rect = container.getBoundingClientRect();
    const client = (e.touches && e.touches[0]) ? e.touches[0] : (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : e;
    return { x: client.clientX - rect.left, y: client.clientY - rect.top };
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

// get dot at position using touch radius
function getDotAt(x, y) {
    return dots.find(d => {
        return Math.hypot(d.x - x, d.y - y) <= DOT_TOUCH_DIAMETER;
    });
}

// prevent creating new dot if within toucharea of any existing dot
function isSpaceForDot(x, y) {
    return !dots.some(d => Math.hypot(d.x - x, d.y - y) < DOT_TOUCH_DIAMETER /* enforce at least one diameter spacing */);
}

function createDot(x, y) {
    const dot = {
        x, y,
        size: DOT_DEFAULT_SIZE,
        el: null,
        id: Date.now() + Math.random(),
        state: 'normal', // normal | ready | on
        inputs: 0, // incoming lines count
        outputs: 0, // outgoing lines count
        ready: false,
        on: false
    };
    const el = document.createElement('div');
    el.className = 'dot';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.width = dot.size + 'px';
    el.style.height = dot.size + 'px';
    el.style.backgroundColor = '#808080';
    container.appendChild(el);
    dot.el = el;
    dots.push(dot);

    actions.push({ type: 'dot', dot });
    
    if (pendingResultMode) {
        pendingResultMode = false;
        resultMode(); // ✅ user-gesture safe
    }

    updateStateAndCounters();
    updatebackButton();
    return dot;
}

function renderDots() {
    dots.forEach(dot => {
        const s = dot.size;
        if (dot.el) {
            dot.el.style.left = dot.x + 'px';
            dot.el.style.top = dot.y + 'px';
            dot.el.style.width = s + 'px';
            dot.el.style.height = s + 'px';
        }
    });
}

function findLine(a, b) {
    // find directed line from a -> b
    return lines.find(l => l.input === a && l.output === b);
}

function createLine(a, b) {
    if (a === b) return null;

    // if same directed line already exists, do nothing (no reinforcement)
    if (findLine(a, b)) return null;

    const line = {
        input: a,
        output: b,
        inputDot: a,
        outputDot: b,
        width: LINE_BASE_WIDTH,
        color: '#96244C',
        arrowSize: null
    };

    lines.push(line);
    a.outputs++;
    b.inputs++;

    actions.push({ type: 'line', line });

    if (pendingResultMode) {
        pendingResultMode = false;
        resultMode(); // ✅ user-gesture safe
    }

    updateStateAndCounters();
    return line;
}

function undoLastAction() {
    if (actions.length === 0) return;

    const last = actions.pop();

    if (last.type === 'dot') {
        const dot = last.dot;

        // remove connected lines first
        lines = lines.filter(l => {
            if (l.input === dot || l.output === dot) {
                l.input.outputs--;
                l.output.inputs--;
                return false;
            }
            return true;
        });

        // remove DOM element
        if (dot.el && dot.el.parentNode) {
            dot.el.parentNode.removeChild(dot.el);
        }

        dots = dots.filter(d => d !== dot);
    }

    if (last.type === 'line') {
        const line = last.line;
        line.input.outputs--;
        line.output.inputs--;
        lines = lines.filter(l => l !== line);
    }

    updateStateAndCounters();
}

function removeAll() {
    // remove DOM dots
    dots.forEach(d => {
        if (d.el && d.el.parentNode) d.el.parentNode.removeChild(d.el);
    });
    dots = [];
    lines = [];
    actions = [];
    dragging = false;
    dragFrom = null;
    dragPos = null;

    // reset flags
    firstDotCreated = false;
    secondDotCreated = false;
    firstConnectionCreated = false;

    updateStateAndCounters();
    updatebackButton();
}

function buildAdjacency() {
    const adj = new Map();
    dots.forEach(dot => adj.set(dot, []));

    lines.forEach(l => {
        // directed adjacency
        if (adj.has(l.input)) adj.get(l.input).push(l.output);
    });

    return adj;
}

function getConnectedComponents() {
    const adj = buildAdjacency();
    const visited = new Set();
    const components = [];

    function dfs(dot, comp) {
        if (visited.has(dot)) return;
        visited.add(dot);
        comp.push(dot);
        const neighbors = adj.get(dot) || [];
        neighbors.forEach(n => dfs(n, comp));
        // also consider incoming edges as connectivity (treat graph as undirected for components)
        lines.forEach(l => {
            if (l.output === dot && !visited.has(l.input)) dfs(l.input, comp);
        });
    }

    dots.forEach(dot => {
        if (!visited.has(dot)) {
            const comp = [];
            dfs(dot, comp);
            components.push(comp);
        }
    });

    return components;
}


function hasLoop(start) {
    const visited = new Set();

    function dfs(node) {
        if (visited.has(node)) return false;
        visited.add(node);

        // neighbors are outputs of node
        const neighbors = lines.filter(l => l.input === node).map(l => l.output);

        for (const nxt of neighbors) {
            if (nxt === start) return true;
            if (dfs(nxt)) return true;
        }
        return false;
    }

    return dfs(start);
}


/*function limitPhi (){
    if (Phi > 54) {
        resultMode();
    }
} */

// update READY and ON states and counters
function updateStateAndCounters() {
    // update dot readiness & on-state
    dots.forEach(dot => {
        const incoming = lines.filter(l => l.output === dot).length;
        const loopExists = hasLoop(dot);

        dot.ready = loopExists;
        dot.on = dot.ready && incoming >= 2;

        if (dot.on) dot.state = "on";
        else if (dot.ready) dot.state = "ready";
        else dot.state = "normal";

        if (dot.el) {
            if (dot.on) {
                dot.el.style.backgroundColor = "#96244c";
            } else if (dot.ready) {
                dot.el.style.backgroundColor = "#96244c";
            } else {
                dot.el.style.backgroundColor = "grey";
            }
        }
    });

    // update line colors: follow source (input) state
    lines.forEach(line => {
        const fromState = line.input.state;
        const toState = line.output.state;

        // for directed lines we color by the source (input) primarily
        if (fromState === "on") line.color = "#96244c";
        else if (fromState === "ready") line.color = "#96244c";
        else line.color = "grey";
    });

    // components and Phi calculation
    const components = getConnectedComponents();
    let maxPhi = 0;

    components.forEach((comp, idx) => {
        const subsystemN = comp.length;

        // Subsystem lines: count all directed lines with both ends in the component
        let subsystemC = 0;
        lines.forEach(l => {
            if (comp.includes(l.input) && comp.includes(l.output)) {
                subsystemC += 1; // each directed line counts as 1
            }
        });

        const NR_comp = comp.filter(d => d.state === 'ready').length;
        const NO_comp = comp.filter(d => d.state === 'on').length;

        const I_comp = subsystemN > 0 ? (NR_comp+NO_comp) / subsystemN : 0;
        const D_comp = comp.filter(d => d.on).reduce((sum, dot) => sum + dot.inputs, 0);


        const Phi_comp = 2 * I_comp * D_comp;

        console.log(`Subsystem ${idx}: N=${subsystemN}, C=${subsystemC}, NR=${NR_comp}, NO=${NO_comp}, I=${I_comp.toFixed(3)}, D=${D_comp.toFixed(3)}, Phi=${Phi_comp.toFixed(3)}`);

        if (Phi_comp > maxPhi) maxPhi = Phi_comp;
    });

    // global counters
    N = dots.length;
    C = lines.length; // each directed line counted once
    NR = dots.filter(d => d.state === 'ready').length;
    NO = dots.filter(d => d.state === 'on').length;

    // update global I and D (not shadowed)
    I = N > 0 ? (NR+NO) / N : 0;
    // D = sum of incoming connections of all ON-state dots
D = dots.filter(d => d.on).reduce((sum, dot) => sum + dot.inputs, 0);

    const Phi_global = 2 * I * D;

    console.log(`Global: N=${N}, C=${C}, NR=${NR}, NO=${NO}, I=${I.toFixed(3)}, D=${D.toFixed(3)}, Phi=${Phi_global.toFixed(3)}`);

    Phi = maxPhi;
    counterText.innerText = Phi.toFixed(0);
    CO = lines.filter(l => l.input.state === 'on').length;

    // update UI
    renderDots();
    drawAll();

    function controlPhi(Phi) {
        // Linear mapping
        let y = -0.04 * Phi + 2;
        
        // Clamp between 0 and 1
        if (y > 1) y = 1;
        if (y < 0) y = 0;
        
        return y;
      }
    
      let y = controlPhi(Phi);

    container.style.setProperty('--bg-filter', `grayscale(${y * 100}%)`);
    // reset button enable

    checkThreshold ();
    updatebackButton();
}


function updatebackButton() {
    if (dots.length > 0) {
        backButton.disabled = false;
        backButton.style.opacity = 1;
    } else {
        backButton.disabled = true;
        backButton.style.opacity = 0.5;
    }
}

let helpP5 = null;
function runP5(){
    if (helpP5) return;
    locked = true;
    helpP5 = new p5((p) => {
        let points = dots.map(d => p.createVector(d.x, d.y));
        let vertices = [];
        let hull = [];
        let startTime = 0;
        let fillingStarted = false;
        let fillStartTime = 0;

        p.setup = function() {
            const holder = document.getElementById('p5-holder');
            const canvas = p.createCanvas(holder.offsetWidth, holder.offsetHeight);
            canvas.parent('p5-holder');
            p.strokeWeight(1);

            p.stroke(150, 36, 76);
            points.forEach(pt => p.ellipse(pt.x, pt.y, 16));

            for (let i = 0; i < points.length; i++) {
                for (let j = i + 1; j < points.length; j++) {
                    p.line(points[i].x, points[i].y, points[j].x, points[j].y);
                }
            }
            startTime = p.millis();
        };

        p.draw = function() {
            if (!fillingStarted && p.millis() - startTime > 500) {
                vertices = points.map(pt => pt.copy());
                hull = convexHull(vertices);
                fillingStarted = true;
                fillStartTime = p.millis();
                p.strokeWeight(1);
                p.stroke(150, 36, 76, 50);
            }

            if (fillingStarted && p.millis() - fillStartTime < 3000) {
                for (let i = 0; i < 20; i++) {
                    let [v1, v2] = randomPair(vertices);
                    drawSmoothCurve(v1, v2);
                }
            }
        };

        function drawSmoothCurve(v1, v2) {
            let cp1 = p.createVector(
                p.lerp(v1.x, v2.x, p.random(0.3, 0.7)) + p.random(-40, 40),
                p.lerp(v1.y, v2.y, p.random(0.3, 0.7)) + p.random(-40, 40)
            );
            let cp2 = p.createVector(
                p.lerp(v1.x, v2.x, p.random(0.3, 0.7)) + p.random(-40, 40),
                p.lerp(v1.y, v2.y, p.random(0.3, 0.7)) + p.random(-40, 40)
            );
            p.noFill();
            p.beginShape();
            p.vertex(v1.x, v1.y);
            p.bezierVertex(cp1.x, cp1.y, cp2.x, cp2.y, v2.x, v2.y);
            p.endShape();
        }

        function randomPair(arr) {
            let i = Math.floor(p.random(arr.length));
            let j;
            do { j = Math.floor(p.random(arr.length)); } while (j === i);
            return [arr[i], arr[j]];
        }

        function convexHull(points) {
            if (points.length <= 3) return points.slice();
            let sorted = points.slice().sort((a,b) => a.x===b.x ? a.y-b.y : a.x-b.x);
            function cross(o,a,b){return (a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);}
            let lower=[], upper=[];
            for(let pnt of sorted){while(lower.length>=2 && cross(lower[lower.length-2], lower[lower.length-1], pnt)<=0) lower.pop(); lower.push(pnt);}
            for(let i=sorted.length-1;i>=0;i--){let pnt=sorted[i];while(upper.length>=2 && cross(upper[upper.length-2], upper[upper.length-1], pnt)<=0) upper.pop(); upper.push(pnt);}
            upper.pop(); lower.pop();
            return lower.concat(upper);
        }

    });

}





function checkThreshold () {
    if (inResultMode) return;
    console.log("checkThreshold called, Phi =", Phi);
    displayMessage ();
    
    if (Phi <1) { 
        gameMode();}

    else if (Phi <59) {
        consciousMode();
    }

    else if (Phi >49) {
       maxMode();
    }

    
}


function displayMessage (){
    if (Phi <25){
    message.innerText = "Kein Bewusstsein möglich."}
    else if (Phi <49) {
    message.innerText = "Einfaches Bewusstsein möglich."}
    else {
    message.innerText = "Du hast komplexes Bewusstsein erschaffen."}
}


function startMode() {
    disableTimeout();
    bodyEl.style.opacity ="100%"
    bodyEl.style.backgroundBlendMode ="normal"
    bodyEl.style.background = "url('bg_black.jpg') no-repeat center center fixed";
    topPart.classList.add ("hidden");
    topPart.classList.remove ("visible");
    locked = true;
    backButton.classList.add ("hidden");
    backButton.classList.remove ("visible");
    backButton.style.opacity ="0";
    resetButton.classList.add ("hidden");
    resetButton.classList.remove ("visible");
    container.style.background = "url('typo.png') center/contain no-repeat";
    container.style.backgroundBlendMode="normal";
    container.style.opacity ="100%"
    setState(ButtonState.START);
}

function gameMode(){
   runTimeout();
   locked = false;
   inResultMode =false;
   pendingResultMode =false;
topPart.classList.add ("visible");
topPart.classList.remove ("hidden");
topLeft.classList.add("visible");
topLeft.classList.remove("hidden");
topRight.classList.add("visible");
topRight.classList.remove("hidden");

    message.classList.add("hidden");
    message.classList.remove("visible");

    backButton.classList.add("visible");
    backButton.classList.remove("hidden");
    backButton.style.opacity = 0.5;

    resetButton.classList.add("visible");
    resetButton.classList.remove("hidden");
container.style.opacity ="90%"
container.style.background = "url('background_color.png') center/contain no-repeat";
container.style.setProperty('--bg-filter', `grayscale(${100}%)`);  
bodyEl.style.opacity ="100%"
bodyEl.style.backgroundBlendMode ="normal"
bodyEl.style.background = "url('bg_main.jpg') center/cover no-repeat fixed";
setState(ButtonState.HIDDEN);
}


function consciousMode() {
    runTimeout();
    locked = false;
    inResultMode =false;
    bodyEl.style.opacity ="100%"
bodyEl.style.backgroundBlendMode ="normal"
bodyEl.style.background = "url('bg_main.jpg') center/cover no-repeat fixed";
    topPart.classList.add ("visible");
    topPart.classList.remove ("hidden");
    topLeft.classList.add("hidden");
    topLeft.classList.remove("visible");
    
    topRight.classList.add("hidden");
    topRight.classList.remove("visible");
    
    message.classList.add("visible");
    message.classList.remove("hidden");
    if (Phi<25) {setState(ButtonState.HIDDEN);
       
    }
    else {setState(ButtonState.CREATE);
        
    }
   /* runTimeout(); 
    var delay = 2000; //1 second
    setTimeout(function() {
        playAudio();
    }, delay);  */
    }

function maxMode () {runTimeout();
    locked = true;
    bodyEl.style.opacity ="100%"
bodyEl.style.backgroundBlendMode ="normal"
bodyEl.style.background = "url('bg_highphi.jpg') center/cover no-repeat fixed";
    topPart.classList.add ("visible");
    topPart.classList.remove ("hidden");
    topLeft.classList.add("hidden");
    topLeft.classList.remove("visible");
    
    topRight.classList.add("hidden");
    topRight.classList.remove("visible");
    
    message.classList.add("visible");
    message.classList.remove("hidden");
    setState(ButtonState.CREATE);    
    }

function resultMode() {

   if (inResultMode) return;
    inResultMode = true;

    locked = true;
backButton.classList.add ("hidden");
backButton.classList.remove ("visible");
backButton.style.opacity ="0";
resetButton.classList.add ("hidden");
resetButton.classList.remove ("visible");
backButton.style.opacity ="0";
runP5();
sendTouchdesigner();

if (Phi <49) { 
    setState(ButtonState.AGAIN);  
    runTimeout(); 
    }
    else {
        setState(ButtonState.END);
        disableTimeout();
        playAudio();   
    }
}


// ------------------- Full Reset -------------------
function performFullReset(){
    dots=[]; lines=[]; dragging=false; dragFrom=null; dragPos=null;
    firstDotCreated=false; secondDotCreated=false; firstConnectionCreated=false;
    Phi=0; counterText.innerText='0'; locked = false;  pendingResultMode = false;
    inResultMode = false;
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
      }
   
}

function wipeCanvas() {
    if (dots.length === 0 && lines.length === 0) return;
    // remove all DOM dot elements
    dots.forEach(dot => {
        if (dot.el && dot.el.parentNode) container.removeChild(dot.el);
    });
    // reset everything
    dots = [];
    lines = [];
    actions = [];
    dragging = false;
    dragFrom = null;
    dragPos = null;
    locked = false;

    if (helpP5) {

        helpP5.remove();    // removes the canvas and stops draw loop
        helpP5 = null;      // clear reference
    }

    updateStateAndCounters();
    sendTouchdesigner();

    backButton.disabled = true;
    backButton.style.opacity = 0.5;
}



function drawLine(line) {
    let stroke = '#808080';
    if (line.input.state === 'ready') stroke = '#96244c';
    if (line.input.state === 'on') stroke = '#96244c'; // stronger visual for on

    ctx.strokeStyle = stroke;
    ctx.lineWidth = line.width;

    const dx = line.output.x - line.input.x;
    const dy = line.output.y - line.input.y;
    const angle = Math.atan2(dy, dx);

    const rFrom = (line.input.size || DOT_DEFAULT_SIZE) / 2 + 2;
    const rTo = (line.output.size || DOT_DEFAULT_SIZE) / 2 + 2;

    const startX = line.input.x + rFrom * Math.cos(angle);
    const startY = line.input.y + rFrom * Math.sin(angle);
    const endX = line.output.x - rTo * Math.cos(angle);
    const endY = line.output.y - rTo * Math.sin(angle);

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    const size = line.arrowSize || (6 + line.width * 0.6);

    // forward arrow (input -> output)
    drawArrow(endX, endY, angle, size, stroke);
}

function drawTempLine(x1, y1, x2, y2) {
    ctx.save();
    ctx.strokeStyle = '#808080';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
}

function drawArrow(x, y, angle, lineWidth = 2, color = '#808080') {
    const arrowSize = Math.max(10, lineWidth * 1.5);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
        x - arrowSize * Math.cos(angle - Math.PI / 6),
        y - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
        x - arrowSize * Math.cos(angle + Math.PI / 6),
        y - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}


resetButton.addEventListener('click', (e) => {
    wipeCanvas();
    performFullReset();
    startMode();
});

// drawing functions
function drawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // draw persistent lines
    lines.forEach(line => {
        drawLine(line);
    });
    // draw temporary dragging line
    if (dragging && dragFrom && dragPos && dragFrom !== null && dragPos !== null) {
        drawTempLine(dragFrom.x, dragFrom.y, dragPos.x, dragPos.y);
    }
}  

// --- Pointer Events handlers (works on tablet & desktop) ---
container.style.touchAction = 'none'; // important for pointer/touch dragging on mobile

function onPointerDown(e) {
    if (locked) return;
    e.preventDefault();
    const p = clientToLocal(e);
    if (!isInsideShape(p.x, p.y)) return;

    const hit = getDotAt(p.x, p.y);
    if (hit) {
        // start dragging from this dot
        dragFrom = hit;
        dragging = true;
        dragPos = { x: p.x, y: p.y };
        // capture pointer to container (optional more specific logic can be added)
        if (e.pointerId && container.setPointerCapture) {
            try { container.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        }
        drawAll();
    } else {
        // try to create dot if space
        const tooClose = dots.some(d => Math.hypot(d.x - p.x, d.y - p.y) <= DOT_TOUCH_DIAMETER);
        if (!tooClose) {
            createDot(p.x, p.y);
        }
    }
}

function onPointerMove(e) {
    if (!dragging) return;
    e.preventDefault();
    const p = clientToLocal(e);
    dragPos = { x: p.x, y: p.y };
    drawAll();
}

function onPointerUp(e) {
    if (!dragging) return;
    e.preventDefault();
    const p = clientToLocal(e);

    // release pointer capture
    if (e.pointerId && container.releasePointerCapture) {
        try { container.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }

    const hit = getDotAt(p.x, p.y);

    if (dragFrom && hit && hit !== dragFrom) {
        // create a directed line dragFrom -> hit
        createLine(dragFrom, hit);
    } else if (dragFrom && hit === dragFrom) {
        // clicked and released on same dot -> nothing
    } else {
        // released on empty space -> nothing persistent
    }

    // reset drag
    dragging = false;
    dragFrom = null;
    dragPos = null;
    drawAll();
    updateStateAndCounters();
}

// bind pointer events
container.addEventListener('pointerdown', onPointerDown);
container.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);



// simple TouchDesigner sender (throttled)
let lastSent = 0;
const throttleInterval = 100; // ms

function sendTouchdesigner() {
    if (socket.readyState !== WebSocket.OPEN) return;
    const now = Date.now();
    if (now - lastSent < throttleInterval) return;
    lastSent = now;

    // Helper to get random number in range with 2 decimals
function randomWithTwoDecimals(max) {
    return Number((Math.random() * max).toFixed(2));
  }
  
  // Two random numbers between 0 and 3 (inclusive-ish, float)
  const color1 = randomWithTwoDecimals(3);
  const color2 = randomWithTwoDecimals(3);
  const comp = randomWithTwoDecimals(3);
  
  // Two random numbers between 0 and 2
  const mirror = randomWithTwoDecimals(2);
  const switcher = randomWithTwoDecimals(2);

    const payload = {
        phi: Phi,
        n: N,
        nr: NR,
        no: NO,
        c: C,
        i: I,
        d: D,
        color1: color1,
        color2: color2,
        comp: comp,
        mirror: mirror,
        switcher: switcher,

    };
    try {
        socket.send(JSON.stringify(payload));
        console.log ("send")
    } catch (err) {
        console.warn("Failed to send payload", err);
    }
}



const ButtonState = {
    START: "start",
    CREATE: "create",
    AGAIN: "again",
    HIDDEN: "hidden",
    END: "end",
  };

let currentState = ButtonState.CREATE;

function renderButton(state) {
    switch (state) {
      case ButtonState.START:
        createButton.disabled = false;
        createButton.style.opacity = "100%";
        swap.style.width ="200px";
        bottom.style.backgroundColor = "#000";
        createButton.innerText = "START";
        createButton.style.backgroundColor ="#96244C";
        createButton.style.color ="white";
       
        break;
  
      case ButtonState.CREATE:
        createButton.disabled = false;
        createButton.style.opacity = "100%";
        swap.style.width ="200px";
        bottom.style.backgroundColor = "rgba(255, 255, 255, 0.50)";
        createButton.innerText = "ENTFALTEN";
        createButton.style.backgroundColor ="white";
        createButton.style.color ="#96244C";
        break;
  
      case ButtonState.AGAIN:
            createButton.disabled = false;
            createButton.style.opacity ="100%"
        swap.style.width ="200px";
        bottom.style.backgroundColor = "rgba(255, 255, 255, 0.50)";
        createButton.innerText = "TRY AGAIN";
        createButton.style.backgroundColor ="#96244C";
        createButton.style.color ="white";
        
        break;

        case ButtonState.END:
            createButton.disabled = false;
            createButton.style.opacity ="100%"
        swap.style.width ="200px";
        bottom.style.backgroundColor = "rgba(255, 255, 255, 0.50)";
        createButton.innerText = "ENDE";
        createButton.style.backgroundColor ="#96244C";
        createButton.style.color ="white";
        
        break;

        case ButtonState.HIDDEN:
            bottom.style.backgroundColor = "rgba(255, 255, 255, 0.50)";
            createButton.disabled = true
            createButton.style.opacity = "0%";
        break;

    }
  }

  function setState(nextState) {
    if (currentState === nextState) return;
  
    console.log("STATE:", currentState, "→", nextState);
    currentState = nextState;
    renderButton(currentState);
  }

  let idleTimeout = null;
const IDLE_TIME = 50000; // example value
const idleEvents = ["mousemove", "mousedown", "keydown", "touchstart", "wheel"];


function runTimeout() {

  function onIdle() {
    console.log("Idle detected");
    wipeCanvas();
    performFullReset();
    startMode();
  }

  function resetIdleTimer() {
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(onIdle, IDLE_TIME);
  }

  // save reference so we can remove it later
  runTimeout.resetIdleTimer = resetIdleTimer;

  // attach listeners
  idleEvents.forEach(evt =>
    window.addEventListener(evt, resetIdleTimer, { passive: true })
  );

  // start counting immediately
  resetIdleTimer();
}

function disableTimeout() {
  // clear timeout
  clearTimeout(idleTimeout);

  // remove listeners
  if (runTimeout.resetIdleTimer) {
    idleEvents.forEach(evt =>
      window.removeEventListener(evt, runTimeout.resetIdleTimer)
    );
  }

  console.log("Idle timeout disabled");
}

  const audioSources = [
    "audio/C1.mp3",
    "audio/C2.mp3",
    "audio/C3.mp3",
    "audio/C4.mp3",
    "audio/C5.mp3",
    "audio/C6.mp3",
    "audio/C7.mp3",
    "audio/C8.mp3"
  ];
  
  let currentAudio = null;
  
  function playAudio() {

    const randomIndex = Math.floor(Math.random() * audioSources.length);
    currentAudio = new Audio(audioSources[randomIndex]);

    currentAudio.addEventListener("ended", () => {
        wipeCanvas();
        performFullReset();
        startMode();
    });

    currentAudio.play().catch(err => {
        console.error("Audio playback failed:", err);
    });
}


  createButton.addEventListener("click", () => {
    switch (currentState) {
      case ButtonState.START:
        gameMode();
        break;
  
      case ButtonState.CREATE:
        locked = true;
        resultMode();
        break;
  
      case ButtonState.AGAIN:
        wipeCanvas();
        performFullReset();
        gameMode();
        break;

    case ButtonState.END:
        wipeCanvas();
        performFullReset();
        startMode();
        break;
  
    case ButtonState.HIDDEN:

        break;
    }
  });

  backButton.addEventListener('click', () => {
    undoLastAction();
});