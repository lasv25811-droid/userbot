const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const initData = tg.initData;
let currentUserId = null;
let currentPhoneHash = null;

function postJSON(url, body) {
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }).then(res => res.json());
}

// İlk yüklənmədə istifadəçini yoxla
postJSON('/api/auth', { initData })
.then(data => {
    if (data.userId) currentUserId = data.userId;
    if (data.isAdmin) {
        document.getElementById('admin-panel').style.display = 'block';
        document.getElementById('auth-section').style.display = 'none';
    }
})
.catch(() => {});

// Kod göndərmə
function sendCode() {
    const phone = document.getElementById('phone').value.trim();
    postJSON('/api/userbot/send-code', { phone }).then(data => {
        if (data.success) {
            currentPhoneHash = data.phoneHash;
            document.getElementById('code-section').style.display = 'block';
            alert("Telegramdan kod göndərildi!");
        } else {
            alert("Xəta: " + data.error);
        }
    }).catch(e => alert("Xəta: " + e.message));
}

// Kodu təsdiqləmə
function verifyCode() {
    const phone = document.getElementById('phone').value.trim();
    const code = document.getElementById('code').value.trim();
    const passEl = document.getElementById('password');
    const password = passEl ? passEl.value : '';
    postJSON('/api/userbot/verify', { phone, code, phoneCodeHash: currentPhoneHash, password, initData })
    .then(data => {
        if (data.success) alert("Hesab uğurla qoşuldu!");
        else if (data.needPassword) {
            if (passEl) passEl.style.display = 'block';
            alert(data.error);
        } else alert("Xəta: " + data.error);
    }).catch(e => alert("Xəta: " + e.message));
}

// Admin panel statistikası
function loadDashboard() {
    postJSON('/api/admin/dashboard', { initData }).then(data => {
        const box = document.getElementById('stats-box');
        if (data.error) { box.textContent = "Xəta: " + data.error; return; }
        box.textContent = "İstifadəçi sayı: " + data.users.length;
    }).catch(e => alert("Xəta: " + e.message));
}
