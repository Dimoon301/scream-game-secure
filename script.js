// ==== БЕЗОПАСНАЯ ЗАГРУЗКА КОНФИГА ====
let BOT_TOKEN = null;
let CHAT_ID = null;

// Пытаемся загрузить конфиг (будет работать только локально)
try {
    // Эта проверка нужна, чтобы на GitHub Pages не было ошибок
    if (window.BOT_TOKEN && window.BOT_TOKEN.includes('ВАШ_')) {
        console.log('Используется локальный конфиг');
        BOT_TOKEN = window.BOT_TOKEN;
        CHAT_ID = window.CHAT_ID;
    }
} catch (e) {
    console.log('Конфиг не загружен, используем резервный режим');
}

// ==== ИГРА (упрощённая версия для примера) ====
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ==== СИСТЕМА ЗАПИСИ (упрощённо) ====
let mediaRecorder = null;
let audioChunks = [];

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        mediaRecorder.start();
        
        console.log('Запись начата');
    } catch (err) {
        console.error('Ошибка микрофона:', err);
        alert('Разрешите доступ к микрофону!');
    }
}

async function stopRecordingAndSend() {
    if (!mediaRecorder) return;
    
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    
    mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        // ПРОВЕРКА: есть ли токен для отправки в Telegram?
        if (BOT_TOKEN && !BOT_TOKEN.includes('ВАШ_')) {
            await sendToTelegram(audioBlob); // Отправляем в Telegram
        } else {
            downloadAudio(audioBlob); // Скачиваем локально
        }
    };
}

// ==== ОТПРАВКА В TELEGRAM (работает только с валидным токеном) ====
async function sendToTelegram(audioBlob) {
    console.log('Попытка отправки в Telegram...');
    
    const formData = new FormData();
    formData.append('chat_id', CHAT_ID);
    formData.append('voice', audioBlob, 'scream.ogg');
    formData.append('caption', 'Крик из игры!');
    
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendVoice`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        if (result.ok) {
            alert('✅ Крик отправлен в Telegram!');
        } else {
            throw new Error(result.description);
        }
    } catch (error) {
        console.error('Ошибка отправки:', error);
        downloadAudio(audioBlob); // Резервное скачивание
    }
}

// ==== РЕЗЕРВНЫЙ ВАРИАНТ: скачивание файла ====
function downloadAudio(audioBlob) {
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scream_${Date.now()}.ogg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('🔇 Telegram не настроен. Аудио скачано на ваше устройство.');
}

// ==== ТЕСТОВЫЕ КНОПКИ (для проверки) ====
document.addEventListener('DOMContentLoaded', () => {
    // Кнопка начала записи
    document.getElementById('btnJump').addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
            startRecording();
            alert('🎤 Запись начата!');
        }
    });
    
    // Кнопка остановки и отправки
    document.getElementById('btnLeft').addEventListener('touchstart', async (e) => {
        e.preventDefault();
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            await stopRecordingAndSend();
        }
    });
});