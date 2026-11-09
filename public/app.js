const tg = window.Telegram.WebApp;
tg.expand();

const initData = tg.initData;
let currentUserId = null;

// İlk yüklənmədə istifadəçini yoxla
fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData })
})
.then(res => res.json())
.then(data => {
    if (data.isAdmin) {
        document.getElementById('admin-panel').style.display = 'block';
        document.getElementById('auth-section').style.display = 'none';
    }
});

// Kod göndərmə
function sendCode() {
    const phone = document.getElementById('phone').value;
    fetch('/api/userbot/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
    }).then(res => res.json()).then(data => {
        if (data.success) {
            document.getElementById('code-section').style.display = 'block';
            alert("Telegramdan kod göndərildi!");
        } else {
            alert("Xəta: " + data.error);
        }
    });
}

// Kodu təsdiqləmə
function verifyCode() {
    const phone = document.getElementById('phone').value;
    const code = document.getElementById('code').value;
    // Nümunə olaraq phoneCodeHash-i frontend-də saxlamırıq, 
    // realda backend sessiya ilə idarə edir. (Test üçün sadələşdirilmişdir)
    fetch('/api/userbot/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, userId: currentUserId })
    }).then(res => res.json()).then(data => {
        if (data.success) alert("Hesab uğurla qoşuldu!");
        else alert("Xəta: " + data.error);
    });
}