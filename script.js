// ------------------------------
// Global Variables and Settings
// ------------------------------

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Use a hand-drawn–style font (or any web-safe alternative)
const menuFont = "30px Comic Sans MS"; // change as desired
const afterGameEndWaitTime = 2000; // milliseconds

// Game states: "menu", "playing", "gameover"
let gameState = "menu";
let gameOverTime = 0;    // Timestamp when game over occurs
let gameStartTime = 0;   // Timestamp when a new game starts

// Inverted difficulty mapping:
// "Easy" (menu item) sets difficulty = "easy" which uses tough (hard-mode) settings,
// while "Hard" sets difficulty = "hard" which uses easier (easy-mode) settings.
let difficulty = null;

// Scale factor for the bird image
const scale = 4;
const originalWidth = 16;
const originalHeight = 16;

// Global variables for roast bubble messages (loaded from insults.js)
let currentBubble = null; // { text: string, createdTime: number }
const bubbleDuration = 3000; // milliseconds

// Counter for each individual pipe passed
let pipeCrossings = 0;

// Game variables
let bird = { 
  x: 50, 
  y: 150, 
  width: originalWidth * scale, 
  height: originalHeight * scale, 
  gravity: 0, 
  lift: -8 * 0.7, // ~ -5.6
  velocity: 0 
};
let pipes = [];
let frameCount = 0;
let score = 0;
let gameOver = false;

// Menu items (drawn inside the canvas)
const menuItems = [
  { text: "Easy", difficulty: "easy", x: canvas.width / 2, y: canvas.height / 2 - 30, hover: false },
  { text: "Hard", difficulty: "hard", x: canvas.width / 2, y: canvas.height / 2 + 30, hover: false }
];

// ------------------------------
// Image Loading and Processing
// ------------------------------

const birdImg = new Image();
birdImg.crossOrigin = "anonymous";
birdImg.src = 'bird-16x16.png';

let birdImgProcessed = null; // holds the processed image with removed background

birdImg.onload = () => {
  // Process the image to remove near-white background
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = birdImg.width;
  offscreenCanvas.height = birdImg.height;
  const offscreenCtx = offscreenCanvas.getContext('2d');
  offscreenCtx.drawImage(birdImg, 0, 0);
  
  const imageData = offscreenCtx.getImageData(0, 0, birdImg.width, birdImg.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 240 && data[i+1] > 240 && data[i+2] > 240) {
      data[i+3] = 0; // make near-white pixels transparent
    }
  }
  offscreenCtx.putImageData(imageData, 0, 0);
  birdImgProcessed = offscreenCanvas;
  
  // Start the update loop (menu is drawn when gameState === "menu")
  update();
};

birdImg.onerror = () => {
  console.error("Bird image failed to load. Using fallback drawing.");
  update();
};

// ------------------------------
// Event Listeners
// ------------------------------

// Mouse events for the in-canvas menu (active only when in menu state)
canvas.addEventListener("mousemove", handleMouseMove);
canvas.addEventListener("click", handleMouseClick);

// Key events: SPACE for flapping during play or (after game over) to return to menu.
document.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    if (e.repeat) return;
    if (gameState === "playing") {
      bird.velocity = bird.lift;
    } else if (gameState === "gameover") {
      // Allow return to menu only after 5 seconds have passed
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
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  ctx.font = menuFont;
  menuItems.forEach(item => {
    // Create a bounding box for each menu item (centered at item.x, item.y)
    const textWidth = ctx.measureText(item.text).width;
    const box = {
      x: item.x - textWidth / 2,
      y: item.y - 20, // approximate half-height
      width: textWidth,
      height: 40   // approximate height
    };
    
    // Set hover state if mouse is inside the box
    if (mouseX >= box.x && mouseX <= box.x + box.width &&
        mouseY >= box.y && mouseY <= box.y + box.height) {
      item.hover = true;
    } else {
      item.hover = false;
    }
  });
}

function handleMouseClick(e) {
  if (gameState !== "menu") return;
  // Check for a clicked menu item
  menuItems.forEach(item => {
    if (item.hover) {
      difficulty = item.difficulty;
      startGame();
    }
  });
}

// ------------------------------
// Drawing Functions
// ------------------------------

// Draw the main menu inside the canvas.
function drawMenu() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#70c5ce";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw title using a hand-drawn style
  ctx.font = "40px Comic Sans MS";
  ctx.fillStyle = "black";
  ctx.textAlign = "center";
  ctx.fillText("Flappy Bird", canvas.width / 2, canvas.height / 2 - 100);
  
  // Draw each menu item with highlighting if hovered
  menuItems.forEach(item => {
    if (item.hover) {
      ctx.font = "bold 34px Comic Sans MS";
      ctx.fillStyle = "red";
    } else {
      ctx.font = menuFont;
      ctx.fillStyle = "black";
    }
    ctx.textAlign = "center";
    ctx.fillText(item.text, item.x, item.y);
  });
}

// Draw the bird using the processed image if available; fallback to a yellow rectangle.
function drawBird() {
  ctx.imageSmoothingEnabled = false;
  if (birdImgProcessed) {
    ctx.drawImage(birdImgProcessed, bird.x - bird.width / 2, bird.y - bird.height / 2, bird.width, bird.height);
  } else if (birdImg.complete && birdImg.naturalWidth !== 0) {
    ctx.drawImage(birdImg, bird.x - bird.width / 2, bird.y - bird.height / 2, bird.width, bird.height);
  } else {
    ctx.fillStyle = 'yellow';
    ctx.fillRect(bird.x - bird.width / 2, bird.y - bird.height / 2, bird.width, bird.height);
  }
}

// Draw the pipes on the canvas.
function drawPipes() {
  ctx.fillStyle = 'green';
  pipes.forEach(pipe => {
    ctx.fillRect(pipe.x, pipe.y, pipe.width, pipe.height);
  });
}

// Draw the score on the canvas.
function drawScore() {
  ctx.fillStyle = '#fff';
  ctx.font = '20px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(`Score: ${Math.floor(score)}`, 15, 30);
}

// Draw the roast bubble near the bird's mouth.
function drawBubble() {
  if (!currentBubble) return;
  
  const bubbleX = bird.x + bird.width / 2 + 10;
  const bubbleY = bird.y - bird.height / 2;
  const padding = 4;
  const text = currentBubble.text;
  ctx.font = '12px Arial';
  const textWidth = ctx.measureText(text).width;
  const bubbleWidth = textWidth + padding * 2;
  const bubbleHeight = 24;
  const radius = 5;
  
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'black';
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
  
  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bubbleX + bubbleWidth / 2, bubbleY + bubbleHeight / 2);
}

// Draw the game over overlay and a message indicating the wasted time.
function drawGameOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = '#fff';
  ctx.font = "40px Comic Sans MS";
  ctx.textAlign = "center";
  ctx.fillText('Game Over!', canvas.width / 2, canvas.height / 2 - 40);
  
  // Compute the played time in minutes.
  const playedTime = (gameOverTime - gameStartTime) / 1000;
  const playedTimeStr = playedTime.toFixed(2);
  
  ctx.font = "20px Arial";
  if (Date.now() - gameOverTime < afterGameEndWaitTime) {
    ctx.fillText(`You wasted ${playedTimeStr} seconds playing this game...`, canvas.width / 2, canvas.height / 2 + 10);
  } else {
    ctx.fillText(`Press SPACE to return to menu`, canvas.width / 2, canvas.height / 2 + 10);
  }
}

// ------------------------------
// Pipe Creation Functions
// ------------------------------

// In our inverted mapping:
// When difficulty is "easy" (menu "Easy") we use the tougher settings: fixed gap of 350 and more frequent pipes.
function addPipeHard() {
  const gap = 350;
  const offset = Math.floor(Math.random() * 101) - 50; // between -50 and 50
  let pipeHeight = ((canvas.height - gap) / 2) + offset;
  pipeHeight = Math.max(50, Math.min(pipeHeight, canvas.height - gap - 50));
  
  pipes.push({
    x: canvas.width,
    y: 0,
    width: 50,
    height: pipeHeight
  });
  pipes.push({
    x: canvas.width,
    y: pipeHeight + gap,
    width: 50,
    height: canvas.height - pipeHeight - gap
  });
}

// When difficulty is "hard" (menu "Hard") we use the easier settings: variable gap between 200 and 300.
function addPipeEasy() {
  const minGap = 200;
  const maxGap = 300;
  const gap = Math.floor(Math.random() * (maxGap - minGap + 1)) + minGap;
  
  const minPipeHeight = 50;
  const maxPipeHeight = canvas.height - gap - 50;
  const pipeHeight = Math.floor(Math.random() * (maxPipeHeight - minPipeHeight + 1)) + minPipeHeight;
  
  pipes.push({
    x: canvas.width,
    y: 0,
    width: 50,
    height: pipeHeight
  });
  pipes.push({
    x: canvas.width,
    y: pipeHeight + gap,
    width: 50,
    height: canvas.height - pipeHeight - gap
  });
}

// ------------------------------
// Roast Bubble Functions
// ------------------------------

// Assumes insult arrays (roastMessagesTier0, etc.) are defined in insults.js.
function createBubble() {
  let tier = Math.floor(pipeCrossings / 10);
  if (tier < 0) tier = 0;
  if (tier > 3) tier = 3;
  let messages;
  switch(tier) {
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

// Reset game state for a new game.
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

// Start the game (called when a menu item is clicked).
function startGame() {
  resetGame();
  gameState = "playing";
  gameStartTime = Date.now();
}

// ------------------------------
// Main Update Loop
// ------------------------------

function update() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (gameState === "menu") {
    drawMenu();
  } else if (gameState === "playing") {
    // Update bird physics
    bird.velocity += 0.4;
    bird.y += bird.velocity;
    
    // End game if bird hits top or bottom
    if (bird.y + bird.height / 2 >= canvas.height || bird.y - bird.height / 2 <= 0) {
      gameOver = true;
      gameState = "gameover";
      gameOverTime = Date.now();
    }
    
    // Add pipes based on inverted difficulty:
    // If difficulty is "easy" (menu "Easy"), use tough settings.
    if (difficulty === "easy") {
      if (frameCount % 80 === 0) {
        addPipeHard();
      }
    } else if (difficulty === "hard") {
      if (frameCount % 100 === 0) {
        addPipeEasy();
      }
    }
    
    // Move pipes leftwards.
    for (let i = 0; i < pipes.length; i++) {
      pipes[i].x -= 2;
    }
    
    // Remove off-screen pipes, update score and create a roast bubble per pipe passed.
    while (pipes.length > 0 && pipes[0].x + pipes[0].width < 0) {
      pipes.shift();
      score += 0.5;
      pipeCrossings++;
      createBubble();
    }
    
    // Remove bubble if its duration has passed.
    if (currentBubble && Date.now() - currentBubble.createdTime >= bubbleDuration) {
      currentBubble = null;
    }
    
    // Collision detection with pipes.
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
    
    // Draw game elements
    drawBird();
    drawPipes();
    drawScore();
    drawBubble();
  } else if (gameState === "gameover") {
    // During game over, draw the final frame and overlay the game over message.
    drawBird();
    drawPipes();
    drawScore();
    drawBubble();
    drawGameOver();
  }
  
  requestAnimationFrame(update);
}
