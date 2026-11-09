const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { Api } = require("telegram");
require('dotenv').config();

const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
const stringSession = new StringSession(""); 

// Telefon nömrəsinə kod göndərmə
async function startUserbotLogin(phoneNumber) {
    const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });
    await client.connect();
    
    const { phoneCodeHash } = await client.sendCode({ apiId, apiHash }, phoneNumber);
    // Diqqət: Hər istifadəçi üçün ayrıca sessiya saxlanmalıdır. 
    // Nümunə üçün sadəcə hash qaytarırıq.
    return { phoneCodeHash, client };
}

// Kodu təsdiqləyib StringSession yaratmaq
async function verifyUserbotCode(phoneNumber, code, phoneCodeHash) {
    const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });
    await client.connect();
    try {
        await client.invoke(new Api.auth.SignIn({
            phoneNumber: phoneNumber,
            phoneCodeHash: phoneCodeHash,
            phoneCode: code
        }));
        return client.session.save(); // Bu sessiya stringini bazada saxlayırıq
    } catch (e) {
        if (e.errorMessage === 'SESSION_PASSWORD_NEEDED') {
            throw new Error("İki mərhələli şifrə tələb olunur (2FA).");
        }
        throw new Error("Kod yanlışdır.");
    }
}

module.exports = { startUserbotLogin, verifyUserbotCode };