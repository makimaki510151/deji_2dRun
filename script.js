const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let audioCtx = null;
let platforms = [];
let particles = [];
let clouds = [];
let playerX = 80; 
let playerY, playerVY;
let playerSize = 35;
let scrollX = 0;
let score = 0;
let lastMilestone = 0;
let jumpCount = 0;
let rotation = 0;
let isGameOver = false;
let isStarted = false; // スタート画面フラグ
let scoreScale = 1; 

const gravity = 0.8;
const jumpPower = -15; 
const gameSpeed = 14;  
const worldScale = 0.7;

// --- 雲クラス ---
class Cloud {
    constructor(x, y) {
        this.x = x; this.y = y; this.baseY = y;
        this.speed = Math.random() * 0.5 + 0.2;
        this.offset = Math.random() * Math.PI * 2;
    }
    update() {
        const viewW = canvas.width / worldScale;
        this.x -= this.speed;
        if (this.x < -150) {
            this.x = viewW + 150;
            this.baseY = Math.random() * 250 + 50;
        }
        this.y = this.baseY + Math.sin(Date.now() * 0.002 + this.offset) * 15;
    }
    draw(ctx) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, 40, 25, 0, 0, Math.PI * 2);
        ctx.ellipse(this.x + 20, this.y + 10, 35, 20, 0, 0, Math.PI * 2);
        ctx.ellipse(this.x - 20, this.y + 10, 35, 20, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

// --- 音声生成 ---
function playSound(type) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);

    if (type === 'jump1') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(500, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(); osc.stop(now + 0.08);
    } else if (type === 'jump2') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(); osc.stop(now + 0.15);
    } else if (type === 'land') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(100, now);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.05);
        osc.start(); osc.stop(now + 0.05);
    } else if (type === 'milestone100') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.exponentialRampToValueAtTime(659, now + 0.1);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(); osc.stop(now + 0.2);
    } else if (type === 'milestone1000') {
        [523, 659, 783, 1046].forEach((f, i) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.connect(g); g.connect(audioCtx.destination);
            o.frequency.setValueAtTime(f, now + i * 0.08);
            g.gain.setValueAtTime(0.06, now + i * 0.08);
            g.gain.linearRampToValueAtTime(0, now + i * 0.08 + 0.3);
            o.start(now + i * 0.08); o.stop(now + i * 0.08 + 0.3);
        });
    } else if (type === 'gameover') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(55, now + 0.5);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(); osc.stop(now + 0.5);
    }
}

class Particle {
    constructor(x, y, color, type) {
        this.x = x; this.y = y;
        const speedMult = type === '1000' ? 1 : 0.4;
        this.vx = (Math.random() - 0.5) * 20 * speedMult;
        this.vy = (Math.random() - 0.5) * 20 * speedMult;
        this.size = Math.random() * (type === '1000' ? 10 : 5) + 2;
        this.color = color;
        this.life = 1.0;
    }
    update() { this.x += this.vx; this.y += this.vy; this.vy += 0.4; this.life -= 0.025; }
    draw(ctx) {
        ctx.save(); ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
    }
}

function spawnCelebration(type) {
    const colors = type === '1000' ? ['#FFD700', '#FF69B4', '#00FF7F', '#1E90FF'] : ['#FFF'];
    const count = type === '1000' ? 80 : 12;
    const viewW = canvas.width / worldScale;
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(
            type === '1000' ? Math.random() * viewW : playerX + scrollX,
            type === '1000' ? -20 : playerY,
            colors[Math.floor(Math.random() * colors.length)],
            type
        ));
    }
}

class Platform { constructor(x, y, w) { this.x = x; this.y = y; this.w = w; } }

function init() {
    resize(); resetGame();
    for (let i = 0; i < 8; i++) {
        clouds.push(new Cloud(Math.random() * (canvas.width / worldScale), Math.random() * 250 + 50));
    }
    window.addEventListener('resize', resize);
    const triggerInput = (e) => { 
        if (e.type === 'touchstart') e.preventDefault(); 
        handleAction(); 
    };
    window.addEventListener('touchstart', triggerInput, { passive: false });
    window.addEventListener('keydown', (e) => { if (e.code === 'Space') handleAction(); });
    requestAnimationFrame(gameLoop);
}

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }

function resetGame() {
    scrollX = 0; score = 0; lastMilestone = 0;
    scoreScale = 1; 
    platforms = []; particles = [];
    const viewH = canvas.height / worldScale;
    platforms.push(new Platform(0, viewH - 150, (canvas.width / worldScale) + 500));
    playerY = viewH - 150 - playerSize / 2;
    playerVY = 0; jumpCount = 0; isGameOver = false;
    for (let i = 0; i < 5; i++) generatePlatform();
}

function generatePlatform() {
    let last = platforms[platforms.length - 1];
    const viewH = canvas.height / worldScale;
    let gap = Math.random() * 300 + 150;
    let newX = last.x + last.w + gap;
    let newW = Math.random() * 400 + 200;
    let newY = Math.max(viewH * 0.3, Math.min(viewH - 150, last.y + (Math.random() * 250 - 125)));
    platforms.push(new Platform(newX, newY, newW));
}

function handleAction() {
    if (!isStarted) {
        // スタート！最初のジャンプを兼ねる
        isStarted = true;
        playerVY = jumpPower;
        jumpCount = 1;
        playSound('jump1');
    } else if (isGameOver) {
        resetGame();
    } else if (jumpCount < 2) {
        playerVY = jumpPower;
        jumpCount++;
        playSound(jumpCount === 1 ? 'jump1' : 'jump2');
    }
}

function update() {
    // 雲は常に動かす
    clouds.forEach(c => c.update());

    if (!isStarted || isGameOver) return;

    scrollX += gameSpeed;
    score = Math.floor(scrollX / 10);

    if (Math.floor(score / 1000) > Math.floor(lastMilestone / 1000)) {
        playSound('milestone1000'); spawnCelebration('1000');
        scoreScale = 1.8; lastMilestone = score;
    } else if (Math.floor(score / 100) > Math.floor(lastMilestone / 100)) {
        playSound('milestone100'); spawnCelebration('100');
        scoreScale = 1.3; lastMilestone = score;
    }
    scoreScale += (1 - scoreScale) * 0.1; 

    playerVY += gravity;
    playerY += playerVY;
    rotation = jumpCount === 2 ? rotation + 0.4 : 0;

    const viewH = canvas.height / worldScale;
    platforms.forEach(p => {
        let px = p.x - scrollX;
        if (playerX + playerSize/2 > px && playerX - playerSize/2 < px + p.w) {
            if (playerVY >= 0 && playerY + playerSize/2 <= p.y + playerVY + 12 && playerY + playerSize/2 >= p.y - 12) {
                if (playerVY > 0) playSound('land');
                playerY = p.y - playerSize/2; playerVY = 0; jumpCount = 0;
            }
        }
    });

    if (playerY > viewH + 100) {
        isGameOver = true;
        playSound('gameover');
    }
    if (platforms[platforms.length - 1].x - scrollX < (canvas.width / worldScale)) generatePlatform();
    particles = particles.filter(p => { p.update(); return p.life > 0; });
}

function draw() {
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(worldScale, worldScale);
    clouds.forEach(c => c.draw(ctx));

    ctx.save();
    ctx.translate(-scrollX, 0);
    ctx.fillStyle = '#649664';
    platforms.forEach(p => ctx.fillRect(p.x, p.y, p.w, (canvas.height / worldScale) - p.y + 500));
    particles.forEach(p => p.draw(ctx));
    ctx.restore();

    ctx.save();
    ctx.translate(playerX, playerY);
    ctx.rotate(rotation);
    ctx.fillStyle = '#FF6464';
    ctx.fillRect(-playerSize / 2, -playerSize / 2, playerSize, playerSize);
    ctx.restore();
    ctx.restore();

    // UIレイヤー
    if (!isStarted) {
        // スタート画面
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFF';
        ctx.textAlign = 'center';
        ctx.font = 'bold 54px sans-serif';
        ctx.fillText('箱跳び', canvas.width / 2, canvas.height / 2 - 40);
        ctx.font = '24px sans-serif';
        ctx.fillText('タップしてスタート', canvas.width / 2, canvas.height / 2 + 40);
    } else {
        // スコア表示
        ctx.save();
        ctx.fillStyle = scoreScale > 1.1 ? '#FFD700' : '#000';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.translate(20, 30);
        ctx.scale(scoreScale, scoreScale);
        ctx.fillText(`スコア: ${score}`, 0, 0);
        ctx.restore();

        if (isGameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#FFF';
            ctx.textAlign = 'center';
            ctx.font = 'bold 48px sans-serif';
            ctx.fillText('ゲームオーバー', canvas.width / 2, canvas.height / 2 - 30);
            ctx.font = '24px sans-serif';
            ctx.fillText(`最終スコア: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
            ctx.fillText('タップしてリトライ', canvas.width / 2, canvas.height / 2 + 80);
        }
    }
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }
init();