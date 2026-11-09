const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { Api } = require("telegram");
require('dotenv').config();

const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;

// Kod göndərilən müştərilər yaddaşda saxlanır (kodu təsdiqləyərkən EYNİ müştəri lazımdır)
const pendingClients = new Map();

// Telefon nömrəsinə kod göndərmə
async function startUserbotLogin(phoneNumber) {
    const old = pendingClients.get(phoneNumber);
    if (old) { try { await old.disconnect(); } catch (e) {} }

    const client = new TelegramClient(new StringSession(""), apiId, apiHash, { connectionRetries: 5 });
    await client.connect();

    const { phoneCodeHash } = await client.sendCode({ apiId, apiHash }, phoneNumber);
    pendingClients.set(phoneNumber, client);

    // 10 dəqiqə sonra təmizlə
    setTimeout(async () => {
        if (pendingClients.get(phoneNumber) === client) {
            pendingClients.delete(phoneNumber);
            try { await client.disconnect(); } catch (e) {}
        }
    }, 10 * 60 * 1000);

    return { phoneCodeHash };
}

// Kodu təsdiqləyib StringSession yaratmaq
async function verifyUserbotCode(phoneNumber, code, phoneCodeHash, password) {
    const client = pendingClients.get(phoneNumber);
    if (!client) throw new Error("Sessiya tapılmadı. Yenidən 'Kod Göndər' basın.");

    try {
        if (password) {
            // 2FA şifrəsi ilə giriş
            await client.signInWithPassword(
                { apiId, apiHash },
                {
                    password: async () => password,
                    onError: async (err) => { throw err; }
                }
            );
        } else {
            await client.invoke(new Api.auth.SignIn({
                phoneNumber: phoneNumber,
                phoneCodeHash: phoneCodeHash,
                phoneCode: code
            }));
        }
        const session = client.session.save(); // Bu sessiya stringini bazada saxlayırıq
        pendingClients.delete(phoneNumber);
        try { await client.disconnect(); } catch (e) {}
        return session;
    } catch (e) {
        if (e.errorMessage === 'SESSION_PASSWORD_NEEDED') {
            const err = new Error("İki mərhələli şifrə (2FA) tələb olunur. Şifrəni yazıb yenidən təsdiqləyin.");
            err.needPassword = true;
            throw err;
        }
        if (e.errorMessage === 'PHONE_CODE_EXPIRED') throw new Error("Kodun vaxtı bitib. Yenidən kod göndərin.");
        if (e.errorMessage === 'PHONE_CODE_INVALID') throw new Error("Kod yanlışdır.");
        throw new Error(e.errorMessage || e.message || "Kod yanlışdır.");
    }
}

module.exports = { startUserbotLogin, verifyUserbotCode };
