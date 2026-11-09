const express = require('express');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const crypto = require('crypto');
require('dotenv').config();

// Firebase Bağlantısı
let serviceAccount;
try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
} catch (e) {
    console.error("❌ FIREBASE_SERVICE_ACCOUNT düzgün JSON deyil. Bütün JSON-u TƏK sətirdə yazın.");
    process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Express və Bot Qurulması
const app = express();
app.use(cors());
app.use(express.json());

// 🟢 Kök qovluqdan YALNIZ lazımi fayllar verilir (server.js, .env və s. gizli qalır)
const ROOT = __dirname;
app.get('/', (req, res) => res.sendFile(path.join(ROOT, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(ROOT, 'index.html')));
app.get('/app.js', (req, res) => res.sendFile(path.join(ROOT, 'app.js')));
app.get('/style.css', (req, res) => res.sendFile(path.join(ROOT, 'style.css')));

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
bot.on('polling_error', (err) => console.error('Polling xətası:', err.message));

// Telegram Bot /start
bot.onText(/\/start/, (msg) => {
    const url = (process.env.MINI_APP_URL || '').trim();
    bot.sendMessage(msg.chat.id, "Xoş gəlmisiniz! Reklam İdarəetmə Sisteminə daxil olmaq üçün aşağıdakı düyməyə basın:", {
        reply_markup: {
            inline_keyboard: [[{ text: "🚀 Mini App-i Aç", web_app: { url } }]]
        }
    }).catch(err => console.error('sendMessage xətası:', err.message));
});

// initData Yoxlanışı (Təhlükəsizlik)
function validateInitData(initData) {
    try {
        if (!initData) return null;
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');
        const dataCheckString = Array.from(urlParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`).join('\n');
        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN).digest();
        const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
        if (calculatedHash === hash) return JSON.parse(urlParams.get('user'));
        return null;
    } catch (e) { return null; }
}

function isAdminUser(user) {
    return user && user.id.toString() === (process.env.ADMIN_ID || '').trim();
}

// 🟢 API: Giriş və İstifadəçi Yoxlaması
app.post('/api/auth', async (req, res) => {
    try {
        const user = validateInitData(req.body.initData);
        if (!user) return res.status(401).json({ error: "Təhlükəsizlik xətası" });

        const userRef = db.collection('users').doc(user.id.toString());
        const doc = await userRef.get();

        if (!doc.exists) {
            await userRef.set({ id: user.id, firstName: user.first_name, username: user.username || "", status: 'pending', isActive: true });
        }
        res.json({ success: true, userId: user.id, isAdmin: isAdminUser(user) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 🟢 API: Userbot - Telefon Nömrəsi Göndər (Kod almaq üçün)
const { startUserbotLogin, verifyUserbotCode } = require('./userbot');

app.post('/api/userbot/send-code', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: "Telefon nömrəsi yazılmayıb" });
        const sessionInfo = await startUserbotLogin(phone.trim());
        res.json({ success: true, message: "Kod göndərildi", phoneHash: sessionInfo.phoneCodeHash });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 🟢 API: Userbot - Kodu Təsdiqlə və Sessiyanı Yadda Saxla
app.post('/api/userbot/verify', async (req, res) => {
    try {
        const { phone, code, phoneCodeHash, password, initData } = req.body;
        const user = validateInitData(initData);
        if (!user) return res.status(401).json({ error: "Təhlükəsizlik xətası" });

        const sessionString = await verifyUserbotCode(phone.trim(), code, phoneCodeHash, password);

        await db.collection('accounts').add({
            userId: user.id.toString(),
            phone: phone.trim(),
            session: sessionString,
            isRunning: false,
            createdAt: new Date()
        });
        res.json({ success: true, message: "Hesab uğurla qoşuldu!" });
    } catch (e) {
        if (e.needPassword) return res.status(200).json({ success: false, needPassword: true, error: e.message });
        res.status(500).json({ error: e.message });
    }
});

// 🟢 API: Admin - Bütün İstifadəçiləri və Statistikaları Gətir
app.post('/api/admin/dashboard', async (req, res) => {
    try {
        const user = validateInitData(req.body.initData);
        if (!isAdminUser(user)) return res.status(403).json({ error: "İcazə yoxdur" });

        const usersSnap = await db.collection('users').get();
        const users = usersSnap.docs.map(d => d.data());
        const statsDoc = await db.collection('stats').doc('global').get();
        res.json({ users, stats: statsDoc.exists ? statsDoc.data() : {} });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 🟢 Cron Job Ping (Render yatmasın deyə)
app.get('/ping', (req, res) => res.send('Alive'));

// 🟢 Bütün digər sorğuları index.html-ə yönləndirir
app.get('*', (req, res) => res.sendFile(path.join(ROOT, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server ${PORT} portunda işləyir`));
