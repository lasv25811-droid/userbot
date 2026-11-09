const express = require('express');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const crypto = require('crypto');
require('dotenv').config();

// Firebase Bağlantısı
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Express və Bot Qurulması
const app = express();
app.use(cors());
app.use(express.json());

// 🟢 DİQQƏT: Artıq 'public' qovluğu yoxdur, birbaşa kök qovluğu oxuyur
app.use(express.static(path.join(__dirname))); 

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Telegram Bot /start
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Xoş gəlmisiniz! Reklam İdarəetmə Sisteminə daxil olmaq üçün aşağıdakı düyməyə basın:", {
        reply_markup: {
            inline_keyboard: [[{ text: "🚀 Mini App-i Aç", web_app: { url: process.env.MINI_APP_URL } }]]
        }
    });
});

// initData Yoxlanışı (Təhlükəsizlik)
function validateInitData(initData) {
    try {
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

// 🟢 API: Giriş və İstifadəçi Yoxlaması
app.post('/api/auth', async (req, res) => {
    const user = validateInitData(req.body.initData);
    if (!user) return res.status(401).json({ error: "Təhlükəsizlik xətası" });

    const userRef = db.collection('users').doc(user.id.toString());
    const doc = await userRef.get();

    if (!doc.exists) {
        await userRef.set({ id: user.id, firstName: user.first_name, username: user.username || "", status: 'pending', isActive: true });
    }
    res.json({ success: true, isAdmin: user.id.toString() === process.env.ADMIN_ID });
});

// 🟢 API: Userbot - Telefon Nömrəsi Göndər (Kod almaq üçün)
const { startUserbotLogin, verifyUserbotCode } = require('./userbot');

app.post('/api/userbot/send-code', async (req, res) => {
    try {
        const { phone } = req.body;
        const sessionInfo = await startUserbotLogin(phone);
        res.json({ success: true, message: "Kod göndərildi", phoneHash: sessionInfo.phoneCodeHash });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 🟢 API: Userbot - Kodu Təsdiqlə və Sessiyanı Yadda Saxla
app.post('/api/userbot/verify', async (req, res) => {
    try {
        const { phone, code, phoneCodeHash, userId } = req.body;
        const sessionString = await verifyUserbotCode(phone, code, phoneCodeHash);
        
        await db.collection('accounts').add({
            userId: userId,
            phone: phone,
            session: sessionString,
            isRunning: false,
            createdAt: new Date()
        });
        res.json({ success: true, message: "Hesab uğurla qoşuldu!" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 🟢 API: Admin - Bütün İstifadəçiləri və Statistikaları Gətir
app.get('/api/admin/dashboard', async (req, res) => {
    const usersSnap = await db.collection('users').get();
    const users = usersSnap.docs.map(d => d.data());
    const statsDoc = await db.collection('stats').doc('global').get();
    res.json({ users, stats: statsDoc.exists ? statsDoc.data() : {} });
});

// 🟢 Cron Job Ping (Render yatmasın deyə)
app.get('/ping', (req, res) => res.send('Alive'));

// 🟢 DİQQƏT: Bütün digər sorğuları birbaşa kökdəki index.html-ə yönləndirir
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(process.env.PORT, () => console.log(`Server ${process.env.PORT} portunda işləyir`));