// ------------------------------
// Global Variables and Settings
// ------------------------------

const baseCanvasWidth = 400;
const baseCanvasHeight = 600;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game states: "menu", "playing", "gameover"
let gameState = "menu";
let gameOverTime = 0;    // timestamp when game over occurs
let gameStartTime = 0;   // timestamp when a new game starts

// Use a hand-drawn–style font for the menu
const menuFont = "30px Comic Sans MS";

// Wait time after game over (in milliseconds)
const afterGameEndWaitTime = 2000;

// Score counter
let score = 0;

// Global variables for roast bubble messages (assumed defined in insults.js)
let currentBubble = null; // { text: string, createdTime: number }
const bubbleDuration = 3000; // milliseconds

// Counter for each individual pipe passed
let pipeCrossings = 0;

// Game variables for the bird
const scale = 4;
const originalWidth = 16;
const originalHeight = 16;
let bird = { 
  x: 50, 
  y: 150, 
  width: originalWidth * scale, 
  height: originalHeight * scale, 
  gravity: 0, 
  lift: -8 * 0.7, 
  velocity: 0 
};

// Pipes, frame count, and game over flag
let pipes = [];
let frameCount = 0;
let gameOver = false;

// Menu items (drawn inside the canvas)
const menuItems = [
  { text: "Easy", x: baseCanvasWidth / 2, y: baseCanvasHeight / 2 - 30, hover: false },
  { text: "Hard", x: baseCanvasWidth / 2, y: baseCanvasHeight / 2 + 30, hover: false }
];

// ------------------------------
// Canvas Scaling for Mobile
// ------------------------------

function resizeCanvas() {
  // Calculate the maximum scale factor to fit the base canvas size in the window
  const ratio = Math.min(window.innerWidth / baseCanvasWidth, window.innerHeight / baseCanvasHeight);
  
  // Set the CSS display size (logical size scaled by ratio)
  canvas.style.width = baseCanvasWidth * ratio + "px";
  canvas.style.height = baseCanvasHeight * ratio + "px";
  
  // Set the actual canvas size based on devicePixelRatio for sharpness
  const dpr = window.devicePixelRatio || 1;
  canvas.width = baseCanvasWidth * dpr;
  canvas.height = baseCanvasHeight * dpr;
  
  // Reset the transform matrix and scale so that our drawing coordinates remain 0..baseCanvasWidth/Height
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ------------------------------
// Image Loading and Processing
// ------------------------------

const birdImg = new Image();
birdImg.crossOrigin = "anonymous";
birdImg.src = 'bird-16x16.png';

let birdImgProcessed = null; // holds the processed image with removed background

birdImg.onload = () => {
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = birdImg.width;
  offscreenCanvas.height = birdImg.height;
  const offscreenCtx = offscreenCanvas.getContext('2d');
  offscreenCtx.drawImage(birdImg, 0, 0);
  
  const imageData = offscreenCtx.getImageData(0, 0, birdImg.width, birdImg.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 240 && data[i+1] > 240 && data[i+2] > 240) {
      data[i+3] = 0;
    }
  }
  offscreenCtx.putImageData(imageData, 0, 0);
  birdImgProcessed = offscreenCanvas;
  
  update();
};

birdImg.onerror = () => {
  console.error("Bird image failed to load.");
  update();
};

// ------------------------------
// Event Listeners
// ------------------------------

// Mouse events for the in-canvas menu
canvas.addEventListener("mousemove", handleMouseMove);
canvas.addEventListener("click", handleMouseClick);

// Touch support: tap to emulate click or spacebar action
canvas.addEventListener("touchstart", handleTouchStart, false);

function handleTouchStart(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.innerWidth / baseCanvasWidth, window.innerHeight / baseCanvasHeight);
    const touch = e.touches[0];
    const touchX = (touch.clientX - rect.left) / ratio;
    const touchY = (touch.clientY - rect.top) / ratio;
    
    if (gameState === "menu") {
      ctx.font = menuFont;
      menuItems.forEach(item => {
        const textWidth = ctx.measureText(item.text).width;
        const box = {
          x: item.x - textWidth / 2,
          y: item.y - 20,
          width: textWidth,
          height: 40
        };
        if (touchX >= box.x && touchX <= box.x + box.width &&
            touchY >= box.y && touchY <= box.y + box.height) {
          startGame();
        }
      });
    } else if (gameState === "playing") {
      bird.velocity = bird.lift;
    } else if (gameState === "gameover") {
      if (Date.now() - gameOverTime >= afterGameEndWaitTime) {
        gameState = "menu";
      }
    }
  }
  

  function handleMouseClick(e) {
    if (gameState !== "menu") return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.innerWidth / baseCanvasWidth, window.innerHeight / baseCanvasHeight);
    const mouseX = (e.clientX - rect.left) / ratio;
    const mouseY = (e.clientY - rect.top) / ratio;
    
    ctx.font = menuFont;
    menuItems.forEach(item => {
      const textWidth = ctx.measureText(item.text).width;
      const box = {
        x: item.x - textWidth / 2,
        y: item.y - 20,
        width: textWidth,
        height: 40
      };
      if (mouseX >= box.x && mouseX <= box.x + box.width &&
          mouseY >= box.y && mouseY <= box.y + box.height) {
        startGame();
      }
    });
  } 

// Key events: SPACE for flapping during play or returning to menu after game over.
document.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    if (e.repeat) return;
    if (gameState === "playing") {
      bird.velocity = bird.lift;
    } else if (gameState === "gameover") {
      if (Date.now() - gameOverTime >= afterGameEndWaitTime) {
        gameState = "menu";
      }
    }
  }
});

// ------------------------------
// Menu Event Handlers
// ------------------------------

function handleMouseMove(e) {
    if (gameState !== "menu") return;
    
    const rect = canvas.getBoundingClientRect();
    // Compute the same ratio used in resizeCanvas():
    const ratio = Math.min(window.innerWidth / baseCanvasWidth, window.innerHeight / baseCanvasHeight);
    // Convert event coordinates to logical coordinates
    const mouseX = (e.clientX - rect.left) / ratio;
    const mouseY = (e.clientY - rect.top) / ratio;
    
    ctx.font = menuFont;
    menuItems.forEach(item => {
      const textWidth = ctx.measureText(item.text).width;
      const box = {
        x: item.x - textWidth / 2,
        y: item.y - 20,
        width: textWidth,
        height: 40
      };
      item.hover = (mouseX >= box.x && mouseX <= box.x + box.width &&
                    mouseY >= box.y && mouseY <= box.y + box.height);
    });
  }

// ------------------------------
// Drawing Functions
// ------------------------------

function drawMenu() {
  ctx.clearRect(0, 0, baseCanvasWidth, baseCanvasHeight);
  ctx.fillStyle = "#70c5ce";
  ctx.fillRect(0, 0, baseCanvasWidth, baseCanvasHeight);
  
  ctx.font = "40px Comic Sans MS";
  ctx.fillStyle = "black";
  ctx.textAlign = "center";
  ctx.fillText("Flappy Bird", baseCanvasWidth / 2, baseCanvasHeight / 2 - 100);
  
  menuItems.forEach(item => {
    ctx.font = item.hover ? "bold 34px Comic Sans MS" : menuFont;
    ctx.fillStyle = item.hover ? "red" : "black";
    ctx.fillText(item.text, item.x, item.y);
  });
}

function drawBird() {
  ctx.imageSmoothingEnabled = false;
  if (birdImgProcessed) {
    ctx.drawImage(birdImgProcessed, bird.x - bird.width / 2, bird.y - bird.height / 2, bird.width, bird.height);
  } else if (birdImg.complete && birdImg.naturalWidth !== 0) {
    ctx.drawImage(birdImg, bird.x - bird.width / 2, bird.y - bird.height / 2, bird.width, bird.height);
  } else {
    ctx.fillStyle = "yellow";
    ctx.fillRect(bird.x - bird.width / 2, bird.y - bird.height / 2, bird.width, bird.height);
  }
}

function drawPipes() {
  ctx.fillStyle = "green";
  pipes.forEach(pipe => {
    ctx.fillRect(pipe.x, pipe.y, pipe.width, pipe.height);
  });
}

function drawScore() {
  ctx.fillStyle = "#fff";
  ctx.font = "20px Arial";
  ctx.textAlign = "left";
  ctx.fillText("Score: " + Math.floor(score), 15, 30);
}

function drawBubble() {
  if (!currentBubble) return;
  
  const bubbleX = bird.x + bird.width / 2 + 10;
  const bubbleY = bird.y - bird.height / 2;
  const padding = 4;
  const text = currentBubble.text;
  ctx.font = "12px Arial";
  const textWidth = ctx.measureText(text).width;
  const bubbleWidth = textWidth + padding * 2;
  const bubbleHeight = 24;
  const radius = 5;
  
  ctx.fillStyle = "white";
  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bubbleX + radius, bubbleY);
  ctx.lineTo(bubbleX + bubbleWidth - radius, bubbleY);
  ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY, bubbleX + bubbleWidth, bubbleY + radius);
  ctx.lineTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight - radius);
  ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight, bubbleX + bubbleWidth - radius, bubbleY + bubbleHeight);
  ctx.lineTo(bubbleX + radius, bubbleY + bubbleHeight);
  ctx.quadraticCurveTo(bubbleX, bubbleY + bubbleHeight, bubbleX, bubbleY + bubbleHeight - radius);
  ctx.lineTo(bubbleX, bubbleY + radius);
  ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + radius, bubbleY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(bubbleX, bubbleY + bubbleHeight / 2);
  ctx.lineTo(bubbleX - 10, bubbleY + bubbleHeight / 2 + 5);
  ctx.lineTo(bubbleX, bubbleY + bubbleHeight / 2 + 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  ctx.fillStyle = "black";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, bubbleX + bubbleWidth / 2, bubbleY + bubbleHeight / 2);
}

function drawGameOver() {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, baseCanvasWidth, baseCanvasHeight);
  
  ctx.fillStyle = "#fff";
  ctx.font = "40px Comic Sans MS";
  ctx.textAlign = "center";
  ctx.fillText("Game Over!", baseCanvasWidth / 2, baseCanvasHeight / 2 - 40);
  
  const playedTime = (gameOverTime - gameStartTime) / 60000;
  const playedTimeStr = playedTime.toFixed(2);
  
  ctx.font = "20px Arial";
  if (Date.now() - gameOverTime < afterGameEndWaitTime) {
    ctx.fillText("You wasted " + playedTimeStr + " minutes playing this game...", baseCanvasWidth / 2, baseCanvasHeight / 2 + 10);
  } else {
    ctx.fillText("Press SPACE to return to menu", baseCanvasWidth / 2, baseCanvasHeight / 2 + 10);
  }
}

// ------------------------------
// Pipe Creation Function
// ------------------------------

// Increase spacing between pipes: gap is now randomized between 300 and 400 pixels.
function addPipe() {
  const minGap = 300;
  const maxGap = 400;
  const gap = Math.floor(Math.random() * (maxGap - minGap + 1)) + minGap;
  
  const minPipeHeight = 50;
  const maxPipeHeight = baseCanvasHeight - gap - 50;
  const pipeHeight = Math.floor(Math.random() * (maxPipeHeight - minPipeHeight + 1)) + minPipeHeight;
  
  pipes.push({
    x: baseCanvasWidth,
    y: 0,
    width: 50,
    height: pipeHeight
  });
  pipes.push({
    x: baseCanvasWidth,
    y: pipeHeight + gap,
    width: 50,
    height: baseCanvasHeight - pipeHeight - gap
  });
}

// ------------------------------
// Roast Bubble Functions (Assumes insult arrays from insults.js)
// ------------------------------

function createBubble() {
  let tier = Math.floor(pipeCrossings / 10);
  if (tier < 0) tier = 0;
  if (tier > 3) tier = 3;
  let messages;
  switch (tier) {
    case 0:
      messages = roastMessagesTier0;
      break;
    case 1:
      messages = roastMessagesTier1;
      break;
    case 2:
      messages = roastMessagesTier2;
      break;
    case 3:
      messages = roastMessagesTier3;
      break;
  }
  const randomIndex = Math.floor(Math.random() * messages.length);
  const text = messages[randomIndex];
  currentBubble = {
    text,
    createdTime: Date.now()
  };
}

// ------------------------------
// Game Logic Functions
// ------------------------------

function resetGame() {
  bird = { 
    x: 50, 
    y: 150, 
    width: originalWidth * scale, 
    height: originalHeight * scale, 
    gravity: 0, 
    lift: -8 * 0.7, 
    velocity: 0 
  };
  pipes = [];
  frameCount = 0;
  score = 0;
  gameOver = false;
  pipeCrossings = 0;
  currentBubble = null;
}

function startGame() {
  resetGame();
  gameState = "playing";
  gameStartTime = Date.now();
}

// ------------------------------
// Main Update Loop
// ------------------------------

function update() {
  ctx.clearRect(0, 0, baseCanvasWidth, baseCanvasHeight);
  
  if (gameState === "menu") {
    drawMenu();
  } else if (gameState === "playing") {
    // Bird physics
    bird.velocity += 0.4;
    bird.y += bird.velocity;
    
    // End game if bird touches the top or bottom
    if (bird.y + bird.height / 2 >= baseCanvasHeight || bird.y - bird.height / 2 <= 0) {
      gameOver = true;
      gameState = "gameover";
      gameOverTime = Date.now();
    }
    
    // Add pipes every 100 frames
    if (frameCount % 100 === 0) {
      addPipe();
    }
    
    // Move pipes leftwards
    for (let i = 0; i < pipes.length; i++) {
      pipes[i].x -= 2;
    }
    
    // Remove off-screen pipes, update score, and create a roast bubble per pipe passed
    while (pipes.length > 0 && pipes[0].x + pipes[0].width < 0) {
      pipes.shift();
      score += 0.5;
      pipeCrossings++;
      createBubble();
    }
    
    if (currentBubble && Date.now() - currentBubble.createdTime >= bubbleDuration) {
      currentBubble = null;
    }
    
    // Collision detection with pipes
    for (let i = 0; i < pipes.length; i++) {
      const pipe = pipes[i];
      if (
        bird.x + bird.width / 2 > pipe.x &&
        bird.x - bird.width / 2 < pipe.x + pipe.width &&
        bird.y + bird.height / 2 > pipe.y &&
        bird.y - bird.height / 2 < pipe.y + pipe.height
      ) {
        gameOver = true;
        gameState = "gameover";
        gameOverTime = Date.now();
      }
    }
    
    frameCount++;
    drawBird();
    drawPipes();
    drawScore();
    drawBubble();
  } else if (gameState === "gameover") {
    drawBird();
    drawPipes();
    drawScore();
    drawBubble();
    drawGameOver();
  }
  
  requestAnimationFrame(update);
}
