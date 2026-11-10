const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { Api } = require("telegram");

const apiId = parseInt(process.env.API_ID, 10);
const apiHash = String(process.env.API_HASH || "").trim();

if (!apiId || isNaN(apiId) || apiId === 0) {
    console.error('❌ API_ID hatalıdır! .env faylını yoxlayın.');
}
if (!apiHash || apiHash.length !== 32) {
    console.error('❌ API_HASH hatalıdır! 32 simvollu olmalıdır.');
}
console.log(`🔑 API_ID: ${apiId} · API_HASH uzunluğu: ${apiHash.length} (32 olmalı)`);

const pendingClients = new Map();

async function startUserbotLogin(phoneNumber) {
    const old = pendingClients.get(phoneNumber);
    if (old) { try { await old.disconnect(); } catch (e) {} }

    const client = new TelegramClient(new StringSession(""), apiId, apiHash, { connectionRetries: 5 });
    await client.connect();
    const { phoneCodeHash } = await client.sendCode({ apiId, apiHash }, phoneNumber);
    pendingClients.set(phoneNumber, client);

    setTimeout(async () => {
        if (pendingClients.get(phoneNumber) === client) {
            pendingClients.delete(phoneNumber);
            try { await client.disconnect(); } catch (e) {}
        }
    }, 10 * 60 * 1000);

    return { phoneCodeHash };
}

async function verifyUserbotCode(phoneNumber, code, phoneCodeHash, password) {
    const client = pendingClients.get(phoneNumber);
    if (!client) throw new Error("Oturum tapılmadı. Yenidən 'Kod Göndər' düyməsinə basın.");

    try {
        if (password) {
            await client.signInWithPassword({ apiId, apiHash }, {
                password: async () => password,
                onError: async (err) => { throw err; }
            });
        } else {
            await client.invoke(new Api.auth.SignIn({
                phoneNumber, phoneCodeHash, phoneCode: code
            }));
        }
        const session = client.session.save();
        pendingClients.delete(phoneNumber);
        try { await client.disconnect(); } catch (e) {}
        return session;
    } catch (e) {
        if (e.errorMessage === 'SESSION_PASSWORD_NEEDED') {
            const err = new Error("İki addımlı doğrulama (2FA) şifrəsi tələb olunur.");
            err.needPassword = true;
            throw err;
        }
        if (e.errorMessage === 'PHONE_CODE_EXPIRED') throw new Error("Kodun vaxtı bitib.");
        if (e.errorMessage === 'PHONE_CODE_INVALID') throw new Error("Kod yanlışdır.");
        throw new Error(e.errorMessage || e.message || "Xəta");
    }
}

async function fetchGroups(sessionString) {
    const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, { connectionRetries: 3 });
    await client.connect();
    try {
        const dialogs = await client.getDialogs({ limit: 300 });
        return dialogs
            .filter(d => (d.isGroup || d.isChannel) && !d.entity?.migratedTo)
            .map(d => ({
                id: d.id.toString(),
                title: d.title || 'Adsız',
                isChannel: !!d.isChannel,
                isGroup: !!d.isGroup
            }));
    } finally {
        try { await client.disconnect(); } catch (e) {}
    }
}

async function sendAdToGroups(sessionString, groupIds, ad) {
    const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, { connectionRetries: 3 });
    await client.connect();
    const results = [];
    try {
        for (const gid of groupIds) {
            try {
                const entity = await client.getEntity(gid);
                if (ad.type === 'text') {
                    await client.sendMessage(entity, { message: ad.text || '' });
                } else {
                    await client.sendMessage(entity, {
                        file: ad.mediaUrl,
                        message: ad.text || ''
                    });
                }
                results.push({ groupId: gid, success: true });
            } catch (e) {
                results.push({ groupId: gid, success: false, error: e.message });
            }
            await new Promise(r => setTimeout(r, 1500 + Math.random() * 2500));
        }
    } finally {
        try { await client.disconnect(); } catch (e) {}
    }
    return results;
}

module.exports = { startUserbotLogin, verifyUserbotCode, fetchGroups, sendAdToGroups };
