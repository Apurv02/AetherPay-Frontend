const API = 'https://aetherpay.onrender.com';
let duplicatesBlocked = 0;
let lastPaymentId = null;

// ===== PARTICLES =====
function initParticles() {
    const canvas = document.getElementById('particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = Array.from({length: 60}, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        r: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.4 + 0.1
    }));
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(108,99,255,${p.alpha})`;
            ctx.fill();
        });
        requestAnimationFrame(draw);
    }
    draw();
}

// ===== TOAST =====
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ===== LOGIN =====
async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('error-msg');
    const btnText = document.getElementById('login-text');
    btnText.textContent = 'Logging in...';
    try {
        const res = await fetch(`${API}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) throw new Error('Invalid credentials');
        const data = await res.json();
        localStorage.setItem('token', data.token);
        showToast('✅ Login successful!', 'success');
        setTimeout(() => window.location.href = 'dashboard.html', 800);
    } catch (err) {
        errorMsg.textContent = '❌ ' + err.message;
        errorMsg.classList.remove('hidden');
        btnText.textContent = 'Login →';
        showToast('❌ Login failed!', 'error');
    }
}

function getToken() { return localStorage.getItem('token'); }
function authHeaders() { return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }; }
function logout() { localStorage.removeItem('token'); window.location.href = 'index.html'; }

// ===== LOAD ACCOUNTS =====
async function loadAccounts() {
    try {
        const res = await fetch(`${API}/api/accounts`, { headers: authHeaders() });
        const accounts = await res.json();
        const total = accounts.reduce((s, a) => s + a.balance, 0);
        if (document.getElementById('total-accounts')) document.getElementById('total-accounts').textContent = accounts.length;
        if (document.getElementById('total-balance')) animateCounter('total-balance', total, '₹');
        const senderSelect = document.getElementById('senderId');
        const receiverSelect = document.getElementById('receiverId');
        if (senderSelect && receiverSelect) {
            senderSelect.innerHTML = accounts.map(a => `<option value="${a.id}">${a.name} (₹${a.balance})</option>`).join('');
            receiverSelect.innerHTML = accounts.map(a => `<option value="${a.id}">${a.name} (₹${a.balance})</option>`).join('');
        }
        const tbody = document.getElementById('accounts-tbody');
        if (tbody) tbody.innerHTML = accounts.map(a => `
            <tr>
                <td>#${a.id}</td>
                <td>${a.name}</td>
                <td>${a.phoneNumber}</td>
                <td style="color:var(--success)">₹${a.balance.toLocaleString()}</td>
            </tr>`).join('');
    } catch (err) { showToast('❌ Failed to load accounts', 'error'); }
}

// ===== ANIMATE COUNTER =====
function animateCounter(id, target, prefix = '') {
    const el = document.getElementById(id);
    if (!el) return;
    let current = 0;
    const step = target / 40;
    const timer = setInterval(() => {
        current += step;
        if (current >= target) { current = target; clearInterval(timer); }
        el.textContent = prefix + Math.floor(current).toLocaleString();
    }, 30);
}

// ===== SEND PAYMENT =====
async function sendPayment() {
    const senderId = document.getElementById('senderId').value;
    const receiverId = document.getElementById('receiverId').value;
    const amount = document.getElementById('amount').value;
    const resultDiv = document.getElementById('payment-result');
    const payBtn = document.getElementById('pay-btn');

    if (senderId === receiverId) {
        showToast('❌ Cannot send to same account!', 'error');
        return;
    }
    if (!amount || amount <= 0) {
        showToast('❌ Enter valid amount!', 'error');
        return;
    }

    const paymentId = 'PAY-' + Date.now();
    lastPaymentId = paymentId;

    payBtn.textContent = 'Processing...';
    payBtn.disabled = true;

    // Show mesh animation
    const meshCard = document.getElementById('mesh-animation-card');
    meshCard.style.display = 'block';
    await runMeshAnimation(senderId);

    try {
        const res = await fetch(`${API}/api/payment/send`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                paymentId,
                senderId: parseInt(senderId),
                receiverId: parseInt(receiverId),
                amount: parseFloat(amount)
            })
        });
        const msg = await res.text();
        if (msg.includes('success') || msg.includes('Success')) {
            resultDiv.className = 'success-msg';
            resultDiv.textContent = '✅ ' + msg;
            showToast('✅ Payment Successful! 🔐 AES Encrypted', 'success');
            loadAccounts();
            loadTransactions();
        } else {
            resultDiv.className = 'error-msg';
            resultDiv.textContent = '❌ ' + msg;
            showToast('❌ ' + msg, 'error');
        }
        resultDiv.classList.remove('hidden');
    } catch (err) {
        showToast('❌ Payment failed!', 'error');
    }

    payBtn.textContent = 'Send Payment →';
    payBtn.disabled = false;
}

// ===== MESH ANIMATION =====
async function runMeshAnimation(senderId) {
    const statusEl = document.getElementById('mesh-status');
    const progressBar = document.getElementById('mesh-progress-bar');
    const steps = [
        { status: '📱 Sender: Encrypting payment with AES-256...', progress: 20, node: 'node-sender', arrow: null },
        { status: '📡 Hop 1: Relaying to Node 1...', progress: 40, node: 'node-1', arrow: 'arrow1' },
        { status: '📡 Hop 2: Relaying to Node 2...', progress: 65, node: 'node-2', arrow: 'arrow2' },
        { status: '🖥️ Server: Internet detected! Settling payment...', progress: 85, node: 'node-server', arrow: 'arrow3' },
        { status: '✅ Payment settled successfully!', progress: 100, node: null, arrow: null },
    ];

    // Reset
    document.querySelectorAll('.node-icon').forEach(n => { n.classList.remove('active', 'done'); });
    document.querySelectorAll('.arrow-line').forEach(a => a.classList.remove('active'));

    for (const step of steps) {
        statusEl.textContent = step.status;
        progressBar.style.width = step.progress + '%';
        if (step.node) {
            const nodeEl = document.querySelector(`#${step.node} .node-icon`);
            if (nodeEl) nodeEl.classList.add('active');
        }
        if (step.arrow) {
            const arrowEl = document.querySelector(`#${step.arrow} .arrow-line`);
            if (arrowEl) arrowEl.classList.add('active');
        }
        await sleep(700);
        if (step.node) {
            const nodeEl = document.querySelector(`#${step.node} .node-icon`);
            if (nodeEl) { nodeEl.classList.remove('active'); nodeEl.classList.add('done'); }
        }
    }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== TEST IDEMPOTENCY =====
async function testIdempotency() {
    if (!lastPaymentId) {
        showToast('⚠️ Send a payment first!', 'info');
        return;
    }
    showToast('🔁 Sending duplicate payment...', 'info');
    try {
        const res = await fetch(`${API}/api/payment/send`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                paymentId: lastPaymentId,
                senderId: 1,
                receiverId: 2,
                amount: 1
            })
        });
        const msg = await res.text();
        if (msg.toLowerCase().includes('duplicate')) {
            duplicatesBlocked++;
            if (document.getElementById('duplicates-blocked'))
                document.getElementById('duplicates-blocked').textContent = duplicatesBlocked;
            showToast('🔁 Duplicate Payment Rejected! Idempotency Working ✅', 'error');
        } else {
            showToast(msg, 'info');
        }
    } catch (err) { showToast('❌ Error', 'error'); }
}

// ===== LOAD TRANSACTIONS =====
async function loadTransactions() {
    try {
        const res = await fetch(`${API}/api/transactions`, { headers: authHeaders() });
        const transactions = await res.json();
        if (document.getElementById('total-tx')) document.getElementById('total-tx').textContent = transactions.length;

        const recentTbody = document.getElementById('recent-tx-tbody');
        const txTbody = document.getElementById('tx-tbody');
        const rows = transactions.slice(-10).reverse().map(t => `
            <tr>
                <td style="font-size:0.75rem;color:var(--text-muted)">${t.paymentId}</td>
                <td>#${t.senderId}</td>
                <td>#${t.receiverId}</td>
                <td style="color:var(--success)">₹${t.amount}</td>
                <td><span class="badge-success">${t.status || 'SUCCESS'}</span></td>
                <td style="font-size:0.8rem;color:var(--text-muted)">${new Date(t.timestamp).toLocaleString()}</td>
            </tr>`).join('');

        if (recentTbody) recentTbody.innerHTML = rows || '<tr><td colspan="5" style="color:var(--text-muted)">No transactions yet</td></tr>';
        if (txTbody) txTbody.innerHTML = rows || '<tr><td colspan="6" style="color:var(--text-muted)">No transactions yet</td></tr>';
    } catch (err) { console.error(err); }
}

// ===== SHOW SECTION =====
function showSection(name, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(name).classList.remove('hidden');
    if (el) el.classList.add('active');
}

// ===== INIT =====
window.onload = function () {
    initParticles();
    if (window.location.pathname.includes('dashboard')) {
        if (!getToken()) { window.location.href = 'index.html'; return; }
        loadAccounts();
        loadTransactions();
        setInterval(() => { loadAccounts(); loadTransactions(); }, 30000);
    }
};
