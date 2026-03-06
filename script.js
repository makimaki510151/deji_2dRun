const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let audioCtx = null;
let platforms = [];
let particles = [];
let clouds = [];

const baseWidth = 1000;
let renderScale = 1;

let playerX = 120; 
let playerY, playerVY;
const playerSize = 40;
let scrollX = 0;
let score = 0;
let lastMilestone = 0;
let jumpCount = 0;
let rotation = 0;
let isGameOver = false;
let isStarted = false;
let scoreScale = 1;
let lastTime = 0;

// 速度管理
const initialSpeed = 550; // 開始時の速度
let currentSpeed = initialSpeed;
const acceleration = 0.15; // 1秒あたりの加算速度（この値が「勘づかれない」絶妙なラインです）
const maxSpeed = 2400;    // スピードの上限

const gravity = 1800; 
const jumpPower = -750; 
const worldScale = 0.7;

class Cloud {
    constructor(x, y) {
        this.x = x; this.y = y; this.baseY = y;
        this.speed = Math.random() * 40 + 20;
        this.offset = Math.random() * Math.PI * 2;
    }
    update(dt) {
        this.x -= this.speed * dt;
        if (this.x < -200) {
            this.x = (baseWidth / worldScale) + 200;
            this.baseY = Math.random() * 300 + 50;
        }
        this.y = this.baseY + Math.sin(Date.now() * 0.002 + this.offset) * 20;
    }
    draw(ctx) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, 50, 30, 0, 0, Math.PI * 2);
        ctx.ellipse(this.x + 25, this.y + 15, 45, 25, 0, 0, Math.PI * 2);
        ctx.ellipse(this.x - 25, this.y + 15, 45, 25, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

function playSound(type) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);

    if (type === 'jump1') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(550, now + 0.1);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(); osc.stop(now + 0.1);
    } else if (type === 'jump2') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(); osc.stop(now + 0.15);
    } else if (type === 'land') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.06);
        osc.start(); osc.stop(now + 0.06);
    } else if (type === 'milestone100') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(); osc.stop(now + 0.2);
    } else if (type === 'gameover') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(55, now + 0.6);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.6);
        osc.start(); osc.stop(now + 0.6);
    }
}

class Particle {
    constructor(x, y, color, type) {
        this.x = x; this.y = y;
        const speedMult = type === '1000' ? 1.2 : 0.5;
        this.vx = (Math.random() - 0.5) * 800 * speedMult;
        this.vy = (Math.random() - 0.5) * 800 * speedMult;
        this.size = Math.random() * 10 + 4;
        this.color = color;
        this.life = 1.0;
    }
    update(dt) { 
        this.x += this.vx * dt; 
        this.y += this.vy * dt; 
        this.vy += 1500 * dt; 
        this.life -= 1.2 * dt; 
    }
    draw(ctx) {
        ctx.save(); ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
    }
}

function spawnCelebration(type) {
    const colors = type === '1000' ? ['#FFD700', '#FF69B4', '#00FF7F', '#1E90FF'] : ['#FFF'];
    const count = type === '1000' ? 100 : 15;
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(
            type === '1000' ? Math.random() * (baseWidth / worldScale) : playerX + scrollX,
            type === '1000' ? -50 : playerY,
            colors[Math.floor(Math.random() * colors.length)],
            type
        ));
    }
}

class Platform { constructor(x, y, w) { this.x = x; this.y = y; this.w = w; } }

function resize() { 
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    renderScale = (canvas.width / dpr) / baseWidth;
}

function resetGame() {
    scrollX = 0; score = 0; lastMilestone = 0;
    currentSpeed = initialSpeed; // スピードのリセット
    scoreScale = 1; platforms = []; particles = [];
    const virtualHeight = (window.innerHeight / renderScale) / worldScale;
    
    platforms.push(new Platform(0, virtualHeight - 200, (baseWidth / worldScale) + 600));
    playerY = virtualHeight - 200 - playerSize / 2;
    playerVY = 0; jumpCount = 0; isGameOver = false;
    for (let i = 0; i < 5; i++) generatePlatform();
}

function generatePlatform() {
    let last = platforms[platforms.length - 1];
    const virtualHeight = (window.innerHeight / renderScale) / worldScale;
    
    // スピードに合わせて足場の間隔を調整（詰み防止）
    const speedFactor = currentSpeed / initialSpeed;
    let gap = (Math.random() * 320 + 180) * speedFactor;
    
    let newX = last.x + last.w + gap;
    let newW = Math.random() * 450 + 200;
    let newY = Math.max(virtualHeight * 0.35, Math.min(virtualHeight - 200, last.y + (Math.random() * 300 - 150)));
    platforms.push(new Platform(newX, newY, newW));
}

function handleAction() {
    if (!isStarted) {
        isStarted = true; playerVY = jumpPower; jumpCount = 1; playSound('jump1');
    } else if (isGameOver) {
        resetGame();
    } else if (jumpCount < 2) {
        playerVY = jumpPower; jumpCount++;
        playSound(jumpCount === 1 ? 'jump1' : 'jump2');
    }
}

function update(dt) {
    clouds.forEach(c => c.update(dt));
    if (!isStarted || isGameOver) return;

    // スピードの漸増
    if (currentSpeed < maxSpeed) {
        currentSpeed += acceleration;
    }

    scrollX += currentSpeed * dt;
    score = Math.floor(scrollX / 10);

    if (Math.floor(score / 1000) > Math.floor(lastMilestone / 1000)) {
        playSound('milestone1000'); spawnCelebration('1000');
        scoreScale = 1.8; lastMilestone = score;
    } else if (Math.floor(score / 100) > Math.floor(lastMilestone / 100)) {
        playSound('milestone100'); spawnCelebration('100');
        scoreScale = 1.4; lastMilestone = score;
    }
    scoreScale += (1 - scoreScale) * 12 * dt; 

    playerVY += gravity * dt;
    playerY += playerVY * dt;
    rotation = jumpCount === 2 ? rotation + 22 * dt : 0;

    const virtualHeight = (window.innerHeight / renderScale) / worldScale;
    platforms.forEach(p => {
        let px = p.x - scrollX;
        if (playerX + playerSize/2 > px && playerX - playerSize/2 < px + p.w) {
            if (playerVY >= 0 && playerY + playerSize/2 <= p.y + playerVY * dt + 20 && playerY + playerSize/2 >= p.y - 20) {
                if (playerVY > 0) playSound('land');
                playerY = p.y - playerSize/2; playerVY = 0; jumpCount = 0;
            }
        }
    });

    if (playerY > virtualHeight + 200) { isGameOver = true; playSound('gameover'); }
    if (platforms[platforms.length - 1].x - scrollX < (baseWidth / worldScale)) generatePlatform();
    particles = particles.filter(p => { p.update(dt); return p.life > 0; });
}

function draw() {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, baseWidth * renderScale, (window.innerHeight));
    
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, baseWidth * renderScale, window.innerHeight);

    ctx.save();
    ctx.scale(renderScale, renderScale);
    ctx.scale(worldScale, worldScale);

    clouds.forEach(c => c.draw(ctx));

    ctx.save();
    ctx.translate(-scrollX, 0);
    ctx.fillStyle = '#649664';
    const virtualHeight = (window.innerHeight / renderScale) / worldScale;
    platforms.forEach(p => ctx.fillRect(p.x, p.y, p.w, virtualHeight - p.y + 600));
    particles.forEach(p => p.draw(ctx));
    ctx.restore();

    ctx.save();
    ctx.translate(playerX, playerY);
    ctx.rotate(rotation);
    ctx.fillStyle = '#FF6464';
    ctx.fillRect(-playerSize / 2, -playerSize / 2, playerSize, playerSize);
    ctx.restore();
    ctx.restore();

    const uiScale = renderScale;
    ctx.save();
    ctx.scale(uiScale, uiScale);

    if (!isStarted) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, baseWidth, window.innerHeight / renderScale);
        ctx.fillStyle = '#FFF';
        ctx.textAlign = 'center';
        ctx.font = 'bold 80px sans-serif';
        ctx.fillText('箱跳び', baseWidth / 2, (window.innerHeight / renderScale) / 2 - 40);
        ctx.font = '30px sans-serif';
        ctx.fillText('タップしてスタート', baseWidth / 2, (window.innerHeight / renderScale) / 2 + 60);
    } else {
        ctx.save();
        ctx.translate(30, 40);
        ctx.scale(scoreScale, scoreScale);
        ctx.fillStyle = scoreScale > 1.1 ? '#FFD700' : '#000';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`スコア: ${score}`, 0, 0);
        ctx.restore();

        if (isGameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, baseWidth, window.innerHeight / renderScale);
            ctx.fillStyle = '#FFF';
            ctx.textAlign = 'center';
            ctx.font = 'bold 60px sans-serif';
            ctx.fillText('ゲームオーバー', baseWidth / 2, (window.innerHeight / renderScale) / 2 - 40);
            ctx.font = '30px sans-serif';
            ctx.fillText(`最終スコア: ${score}`, baseWidth / 2, (window.innerHeight / renderScale) / 2 + 30);
            ctx.fillText('タップしてリトライ', baseWidth / 2, (window.innerHeight / renderScale) / 2 + 100);
        }
    }
    ctx.restore();
}

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

function init() {
    resize(); resetGame();
    for (let i = 0; i < 8; i++) {
        clouds.push(new Cloud(Math.random() * (baseWidth / worldScale), Math.random() * 300 + 50));
    }
    window.addEventListener('resize', () => { resize(); });
    const trigger = (e) => { if (e.type === 'touchstart') e.preventDefault(); handleAction(); };
    window.addEventListener('touchstart', trigger, { passive: false });
    window.addEventListener('keydown', (e) => { if (e.code === 'Space') handleAction(); });
    requestAnimationFrame(gameLoop);
}

init();