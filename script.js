const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let audioCtx = null;
let platforms = [];
let particles = [];
let clouds = [];
let shootingStars = [];
let ufos = [];

// 基準となる幅（この値を小さくするか、計算後のスケールを倍にすることでサイズ感を調整）
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
let flashAlpha = 0;

const initialSpeed = 550;
let currentSpeed = initialSpeed;
const acceleration = 0.15;
const maxSpeed = 1200;

const gravity = 1800;
const jumpPower = -750;
const worldScale = 0.7;

const playerImage = new Image();
playerImage.src = 'player.png';

function getSkyColor(currentScore) {
    const cycle = 2000;
    const s = currentScore % cycle;
    if (s < 500) return '#87CEEB';
    if (s < 1000) return '#FF8C00';
    if (s < 1500) return '#191970';
    return '#E0FFFF';
}

class UFO {
    constructor() {
        const virtualWidth = (baseWidth / worldScale);
        this.x = virtualWidth + 100;
        this.y = Math.random() * 200 + 50;
        this.speed = Math.random() * 150 + 100;
        this.active = true;
        this.time = 0;
    }
    update(dt) {
        this.x -= this.speed * dt;
        this.time += dt;
        this.offsetY = Math.sin(this.time * 3) * 15;
        if (this.x < -150) this.active = false;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y + this.offsetY);
        ctx.fillStyle = '#C0C0C0';
        ctx.beginPath();
        ctx.ellipse(0, 0, 40, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(135, 206, 250, 0.8)';
        ctx.beginPath();
        ctx.ellipse(0, -5, 15, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        const colors = ['#FF0000', '#00FF00', '#FFFF00'];
        const color = colors[Math.floor(Date.now() / 200) % 3];
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(-15, 5, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, 7, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(15, 5, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}

class ShootingStar {
    constructor() {
        this.reset();
    }
    reset() {
        const virtualWidth = (baseWidth / worldScale);
        this.x = Math.random() * (virtualWidth + 400);
        this.y = Math.random() * -200;
        this.len = Math.random() * 80 + 40;
        this.speed = Math.random() * 800 + 600;
        this.vX = -this.speed;
        this.vY = this.speed * 0.5;
        this.active = true;
    }
    update(dt) {
        this.x += this.vX * dt;
        this.y += this.vY * dt;
        if (this.y > 600 || this.x < -100) this.active = false;
    }
    draw(ctx) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.vX * 0.05, this.y - this.vY * 0.05);
        ctx.stroke();
    }
}

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

class Particle {
    constructor(x, y, color, type) {
        this.x = x; this.y = y;
        const isSuper = type === '1000';
        const speedMult = isSuper ? 2.5 : 0.6;
        this.vx = (Math.random() - 0.5) * 1000 * speedMult;
        this.vy = isSuper ? (Math.random() * -1800 - 500) : (Math.random() - 0.5) * 800;
        this.size = isSuper ? Math.random() * 15 + 5 : Math.random() * 10 + 4;
        this.color = color;
        this.life = 1.0;
        this.rotation = Math.random() * Math.PI * 2;
        this.type = type;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vy += 1500 * dt;
        this.life -= (this.type === '1000' ? 0.4 : 1.2) * dt;
        this.rotation += 5 * dt;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
    }
}

function playSound(type) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    if (type === 'jump1') {
        osc.type = 'square'; osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(550, now + 0.1);
        gain.gain.setValueAtTime(0.08, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(); osc.stop(now + 0.1);
    } else if (type === 'jump2') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.08, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(); osc.stop(now + 0.15);
    } else if (type === 'land') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(120, now);
        gain.gain.setValueAtTime(0.04, now); gain.gain.linearRampToValueAtTime(0, now + 0.06);
        osc.start(); osc.stop(now + 0.06);
    } else if (type === 'milestone100') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1);
        gain.gain.setValueAtTime(0.06, now); gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(); osc.stop(now + 0.2);
    } else if (type === 'milestone1000') {
        osc.type = 'square';
        [523.25, 659.25, 783.99].forEach((f, i) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.type = 'square'; o.frequency.setValueAtTime(f, now + i * 0.1);
            g.gain.setValueAtTime(0.05, now + i * 0.1); g.gain.linearRampToValueAtTime(0, now + i * 0.1 + 0.2);
            o.connect(g); g.connect(audioCtx.destination);
            o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.2);
        });
    } else if (type === 'gameover') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(55, now + 0.6);
        gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.6);
        osc.start(); osc.stop(now + 0.6);
    }
}

function spawnCelebration(type) {
    const isSuper = type === '1000';
    const colors = isSuper ? ['#FFD700', '#FF69B4', '#00FF7F', '#1E90FF', '#FFFFFF'] : ['#FFF'];
    const count = isSuper ? 120 : 15;
    const virtualHeight = (window.innerHeight / renderScale) / worldScale;
    for (let i = 0; i < count; i++) {
        const x = isSuper ? (Math.random() * (baseWidth / worldScale)) : playerX + scrollX;
        const y = isSuper ? virtualHeight : playerY;
        particles.push(new Particle(x, y, colors[Math.floor(Math.random() * colors.length)], type));
    }
}

class Platform { constructor(x, y, w) { this.x = x; this.y = y; this.w = w; } }

function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    // 前回のサイズ感の2倍にするため、baseWidthに対する比率を2倍にする
    renderScale = ((canvas.width / dpr) / baseWidth) * 2;
}

function resetGame() {
    scrollX = 0; score = 0; lastMilestone = 0;
    currentSpeed = initialSpeed;
    scoreScale = 1; platforms = []; particles = []; flashAlpha = 0; shootingStars = []; ufos = [];
    const virtualHeight = (window.innerHeight / renderScale) / worldScale;
    const centerY = virtualHeight / 2;
    platforms.push(new Platform(0, centerY, (baseWidth / worldScale) + 600));
    playerY = centerY - playerSize / 2;
    playerVY = 0; jumpCount = 0; isGameOver = false;
    for (let i = 0; i < 5; i++) generatePlatform();
}

function generatePlatform() {
    let last = platforms[platforms.length - 1];
    const virtualHeight = (window.innerHeight / renderScale) / worldScale;
    const centerY = virtualHeight / 2;
    const speedFactor = currentSpeed / initialSpeed;
    let gap = (Math.random() * 320 + 180) * speedFactor;
    let newX = last.x + last.w + gap;
    let newW = Math.random() * 450 + 200;
    let range = virtualHeight * 0.2;
    let newY = Math.max(centerY - range, Math.min(centerY + range, last.y + (Math.random() * 260 - 130)));
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
    
    const s = score % 2000;
    if (s >= 1100 && s <= 1400) {
        if (Math.random() < 0.08) shootingStars.push(new ShootingStar());
    }
    shootingStars.forEach(star => star.update(dt));
    shootingStars = shootingStars.filter(star => star.active);

    if (score >= 3100 && score <= 3400) {
        if (ufos.length === 0 && Math.random() < 0.02) {
            ufos.push(new UFO());
        }
    }
    ufos.forEach(u => u.update(dt));
    ufos = ufos.filter(u => u.active);

    if (currentSpeed < maxSpeed) currentSpeed += acceleration;
    scrollX += currentSpeed * dt;
    score = Math.floor(scrollX / 10);
    if (Math.floor(score / 1000) > Math.floor(lastMilestone / 1000)) {
        playSound('milestone1000'); spawnCelebration('1000');
        scoreScale = 2.0; lastMilestone = score;
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
        if (playerX + playerSize / 2 > px && playerX - playerSize / 2 < px + p.w) {
            if (playerVY >= 0 && playerY + playerSize / 2 <= p.y + playerVY * dt + 20 && playerY + playerSize / 2 >= p.y - 20) {
                if (playerVY > 0) playSound('land');
                playerY = p.y - playerSize / 2; playerVY = 0; jumpCount = 0;
            }
        }
    });
    if (playerY > virtualHeight + 200) { isGameOver = true; playSound('gameover'); }
    if (platforms[platforms.length - 1].x - scrollX < (baseWidth / worldScale)) generatePlatform();
    particles = particles.filter(p => { p.update(dt); return p.life > 0; });
    if (flashAlpha > 0) flashAlpha -= 1.5 * dt;
}

function draw() {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.fillStyle = getSkyColor(score);
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.save();
    ctx.scale(renderScale, renderScale);
    ctx.scale(worldScale, worldScale);
    
    shootingStars.forEach(star => star.draw(ctx));
    ufos.forEach(u => u.draw(ctx));
    
    clouds.forEach(c => c.draw(ctx));
    ctx.save();
    ctx.translate(-scrollX, 0);
    const virtualHeight = (window.innerHeight / renderScale) / worldScale;
    platforms.forEach(p => {
        ctx.fillStyle = '#649664';
        ctx.fillRect(p.x, p.y, p.w, virtualHeight - p.y + 1000);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        for (let ix = 0; ix < p.w; ix += 14) {
            for (let iy = 0; iy < (virtualHeight - p.y + 200); iy += 14) {
                if ((Math.sin(p.x + ix) * Math.cos(p.y + iy) * 10000 % 1) > 0.4) {
                    ctx.fillRect(p.x + ix, p.y + iy, 4, 4);
                }
            }
        }
    });
    particles.forEach(p => p.draw(ctx));
    ctx.restore();
    ctx.save();
    ctx.translate(playerX, playerY);
    ctx.rotate(rotation);
    if (playerImage.complete) {
        ctx.drawImage(playerImage, -playerSize / 2, -playerSize / 2, playerSize, playerSize);
    } else {
        ctx.fillStyle = '#FF6464';
        ctx.fillRect(-playerSize / 2, -playerSize / 2, playerSize, playerSize);
    }
    ctx.restore();
    ctx.restore();

    // UIのスケールは元の基準（画面幅に合わせる）に戻して描画
    const uiScale = renderScale / 2;
    ctx.save();
    ctx.scale(uiScale, uiScale);
    if (!isStarted) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, baseWidth, window.innerHeight / uiScale);
        ctx.fillStyle = '#FFF';
        ctx.textAlign = 'center';
        ctx.font = 'bold 80px sans-serif';
        ctx.fillText('箱跳び', baseWidth / 2, (window.innerHeight / uiScale) / 2 - 40);
        ctx.font = '30px sans-serif';
        ctx.fillText('タップしてスタート', baseWidth / 2, (window.innerHeight / uiScale) / 2 + 60);
    } else {
        ctx.save();
        ctx.translate(30, 40);
        ctx.scale(scoreScale, scoreScale);
        const s = score % 2000;
        ctx.fillStyle = scoreScale > 1.1 ? '#FFD700' : (s >= 1000 && s < 1500 ? '#FFF' : '#000');
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`スコア: ${score}`, 0, 0);
        ctx.restore();
        if (isGameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, baseWidth, window.innerHeight / uiScale);
            ctx.fillStyle = '#FFF';
            ctx.textAlign = 'center';
            ctx.font = 'bold 60px sans-serif';
            ctx.fillText('ゲームオーバー', baseWidth / 2, (window.innerHeight / uiScale) / 2 - 40);
            ctx.font = '30px sans-serif';
            ctx.fillText(`最終スコア: ${score}`, baseWidth / 2, (window.innerHeight / uiScale) / 2 + 30);
            ctx.fillText('タップしてリトライ', baseWidth / 2, (window.innerHeight / uiScale) / 2 + 100);
        }
    }
    ctx.restore();
}

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;
    update(dt); draw();
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