/* ═══════════════════════════════════════════
   DISEASE PREDICTOR — SCRIPT
   Dark/Light Theme + PDF Receipt
   ═══════════════════════════════════════════ */

const API = 'http://127.0.0.1:5000';

// ── State ────────────────────────────────────────────────────────────────────
let allCategories  = {};
let selectedCat    = null;
let selectedSyms   = new Set();
let lastData       = null;   // last predict response
let aiAdviceData   = null;   // last AI advice

// ── DOM ───────────────────────────────────────────────────────────────────────
const catGrid    = document.getElementById('cat-grid');
const symWrap    = document.getElementById('sym-wrap');
const selCount   = document.getElementById('sel-count');
const cntEl      = document.getElementById('cnt');
const predBtn    = document.getElementById('predict-btn');

const rEmpty     = document.getElementById('r-empty');
const rLoad      = document.getElementById('r-load');
const rContent   = document.getElementById('r-content');
const rTime      = document.getElementById('r-time');
const topRes     = document.getElementById('top-res');
const otherList  = document.getElementById('other-list');

const aiBtn      = document.getElementById('ai-btn');
const aiPanel    = document.getElementById('ai-panel');
const aiLoad     = document.getElementById('ai-load');
const aiContent  = document.getElementById('ai-content');

const pdfBtn     = document.getElementById('pdf-btn');
const themeBtn   = document.getElementById('themeToggle');

// ══════════════════════════════════════════════════════════════════════════════
// THEME TOGGLE
// ══════════════════════════════════════════════════════════════════════════════
(function initTheme() {
    const saved = localStorage.getItem('dp-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
})();

themeBtn.addEventListener('click', () => {
    const cur  = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('dp-theme', next);
});

// ══════════════════════════════════════════════════════════════════════════════
// INIT — load categories from backend
// ══════════════════════════════════════════════════════════════════════════════
async function init() {
    try {
        const res = await fetch(`${API}/symptoms`);
        allCategories = await res.json();
        renderCategories();
    } catch {
        catGrid.innerHTML = `<p style="color:#ef4444;font-size:13px;grid-column:1/-1;padding:8px 0">
            ⚠️ Cannot connect to backend. Make sure Flask is running on port 5000.</p>`;
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// RENDER CATEGORIES
// ══════════════════════════════════════════════════════════════════════════════
function renderCategories() {
    catGrid.innerHTML = '';
    Object.entries(allCategories).forEach(([name, data]) => {
        const btn = document.createElement('button');
        btn.className = 'cat-pill';
        btn.dataset.name = name;
        btn.innerHTML = `<span class="cat-icon">${data.icon || '🩺'}</span><span>${name.split('(')[0].trim()}</span>`;
        btn.addEventListener('click', () => selectCat(name, btn));
        catGrid.appendChild(btn);
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// SELECT CATEGORY
// ══════════════════════════════════════════════════════════════════════════════
function selectCat(name, el) {
    document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    selectedCat = name;
    selectedSyms.clear();
    updateCount();
    renderSyms(allCategories[name].symptoms);
}

// ══════════════════════════════════════════════════════════════════════════════
// RENDER SYMPTOMS
// ══════════════════════════════════════════════════════════════════════════════
function renderSyms(syms) {
    symWrap.innerHTML = '';
    syms.forEach(s => {
        const btn = document.createElement('button');
        btn.className = 'sym-pill';
        btn.dataset.sym = s;
        btn.textContent = fmt(s);
        btn.addEventListener('click', () => toggleSym(s, btn));
        symWrap.appendChild(btn);
    });
    updatePredBtn();
}

function toggleSym(s, el) {
    if (selectedSyms.has(s)) { selectedSyms.delete(s); el.classList.remove('active'); }
    else { selectedSyms.add(s); el.classList.add('active'); }
    updateCount();
    updatePredBtn();
}

function updateCount() {
    const n = selectedSyms.size;
    cntEl.textContent = n;
    n > 0 ? selCount.classList.remove('hidden') : selCount.classList.add('hidden');
}

function updatePredBtn() { predBtn.disabled = selectedSyms.size === 0; }

function fmt(s) {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ══════════════════════════════════════════════════════════════════════════════
// PREDICT
// ══════════════════════════════════════════════════════════════════════════════
predBtn.addEventListener('click', async () => {
    if (!selectedSyms.size) return;

    // Build payload
    const payload = {};
    Object.values(allCategories).forEach(c => c.symptoms.forEach(s => { payload[s] = 0; }));
    selectedSyms.forEach(s => { payload[s] = 1; });

    showPanel('load');

    try {
        const res  = await fetch(`${API}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        lastData   = data;
        aiAdviceData = null; // reset advice
        renderResults(data);
    } catch {
        showPanel('empty');
        alert('⚠️ Error connecting to backend. Make sure Flask is running!');
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// RENDER RESULTS
// ══════════════════════════════════════════════════════════════════════════════
function renderResults(data) {
    const preds = data.predictions || [];
    if (!preds.length) { showPanel('empty'); return; }

    const [primary, ...others] = preds;

    // Timestamp
    rTime.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Top result
    topRes.innerHTML = `
        <div class="tr-label">Most Likely Condition</div>
        <div class="tr-name">${primary.disease}</div>
        <div class="tr-meta">
            <span class="sev sev-${(primary.severity||'unknown').toLowerCase()}">${primary.severity||'Unknown'}</span>
            <span class="cat-tag">${primary.category||''}</span>
        </div>
        <div class="prob-row"><span>Match Probability</span><span class="prob-val">${primary.probability}%</span></div>
        <div class="bar-track"><div class="bar-fill" id="pri-bar" style="width:0%"></div></div>
    `;

    // Other results
    otherList.innerHTML = others.map(p => `
        <div class="oi">
            <span class="oi-name">${p.disease}</span>
            <div class="oi-bar"><div class="oi-track"><div class="oi-fill" data-w="${p.probability}" style="width:0%"></div></div></div>
            <span class="oi-val">${p.probability}%</span>
        </div>
    `).join('');

    // Reset AI
    aiPanel.classList.add('hidden');
    aiContent.innerHTML = '';

    showPanel('results');

    // Animate bars
    requestAnimationFrame(() => {
        setTimeout(() => {
            const pb = document.getElementById('pri-bar');
            if (pb) pb.style.width = primary.probability + '%';
            document.querySelectorAll('.oi-fill').forEach(b => { b.style.width = b.dataset.w + '%'; });
        }, 120);
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// AI ADVICE
// ══════════════════════════════════════════════════════════════════════════════
aiBtn.addEventListener('click', async () => {
    if (!lastData) return;
    const primary = lastData.predictions[0];

    aiPanel.classList.remove('hidden');
    aiLoad.classList.remove('hidden');
    aiContent.innerHTML = '';

    try {
        const res = await fetch(`${API}/ai-advice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                disease:  primary.disease,
                severity: primary.severity,
                symptoms: [...selectedSyms],
                age:      document.getElementById('age').value    || 'Unknown',
                gender:   document.getElementById('gender').value || 'Unknown',
                history:  document.getElementById('history').value || 'None'
            })
        });
        const d = await res.json();
        aiLoad.classList.add('hidden');

        if (d.error) { aiContent.innerHTML = `<p style="color:#ef4444;font-size:13px">${d.error}</p>`; return; }

        aiAdviceData = d.advice;
        renderAdvice(d.advice);
    } catch {
        aiLoad.classList.add('hidden');
        aiContent.innerHTML = `<p style="color:#ef4444;font-size:13px">⚠️ Could not fetch AI advice. Check your Gemini API key in .env</p>`;
    }
});

function renderAdvice(a) {
    const urgCls = urgClass(a.urgency || '');
    aiContent.innerHTML = `
        <div class="adv-sec"><div class="adv-title green">✅ What You Should Do</div><ul class="adv-list">${(a.do_list||[]).map(i=>`<li>${i}</li>`).join('')}</ul></div>
        <div class="adv-sec"><div class="adv-title red">🚫 What To Avoid</div><ul class="adv-list">${(a.dont_list||[]).map(i=>`<li>${i}</li>`).join('')}</ul></div>
        <div class="adv-sec"><div class="adv-title blue">🏠 Home Care Tips</div><ul class="adv-list">${(a.home_remedies||[]).map(i=>`<li>${i}</li>`).join('')}</ul></div>
        <div class="adv-sec"><div class="adv-title yellow">🚨 See a Doctor When</div><ul class="adv-list">${(a.see_doctor_when||[]).map(i=>`<li>${i}</li>`).join('')}</ul></div>
        <div class="adv-sec"><div class="adv-title yellow">⏰ Urgency Level</div><span class="urg-badge ${urgCls}">${(a.urgency||'routine checkup').replace(/_/g,' ')}</span></div>
    `;
}

function urgClass(u) {
    u = u.toLowerCase();
    if (u.includes('immediate')) return 'urg-imm';
    if (u.includes('24'))        return 'urg-24h';
    if (u.includes('week'))      return 'urg-week';
    return 'urg-rout';
}

// ══════════════════════════════════════════════════════════════════════════════
// PANEL SWITCHER
// ══════════════════════════════════════════════════════════════════════════════
function showPanel(s) {
    rEmpty.classList.add('hidden');
    rLoad.classList.add('hidden');
    rContent.classList.add('hidden');
    if (s === 'empty')   rEmpty.classList.remove('hidden');
    if (s === 'load')    rLoad.classList.remove('hidden');
    if (s === 'results') rContent.classList.remove('hidden');
}

// ══════════════════════════════════════════════════════════════════════════════
// PDF RECEIPT GENERATOR
// ══════════════════════════════════════════════════════════════════════════════
pdfBtn.addEventListener('click', generatePDF);

function generatePDF() {
    if (!lastData) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const W = 210;   // page width
    const M = 18;    // margin
    const CW = W - M * 2; // content width

    const preds   = lastData.predictions || [];
    const primary = preds[0] || {};

    // Patient info
    const patAge     = document.getElementById('age').value    || '—';
    const patGender  = document.getElementById('gender').value || '—';
    const patHistory = document.getElementById('history').value || 'None';
    const now        = new Date();
    const dateStr    = now.toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' });
    const timeStr    = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
    const receiptID  = 'DP-' + now.getTime().toString().slice(-8).toUpperCase();

    let y = 0; // current Y cursor

    // ── HEADER BANNER ──────────────────────────────────────────────────────
    doc.setFillColor(5, 13, 26);
    doc.rect(0, 0, W, 44, 'F');

    // Accent bar top
    doc.setFillColor(14, 165, 233);
    doc.rect(0, 0, W, 3, 'F');

    // Logo cross icon
    doc.setDrawColor(14, 165, 233);
    doc.setLineWidth(1);
    doc.circle(M + 8, 22, 7, 'S');
    doc.setLineWidth(1.2);
    doc.line(M + 8, 17, M + 8, 27); // vertical
    doc.line(M + 3, 22, M + 13, 22); // horizontal

    // App name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.text('Disease', M + 20, 19);

    doc.setTextColor(14, 165, 233);
    doc.text('Predictor', M + 20 + doc.getTextWidth('Disease') + 1, 19);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('AI-Powered Diagnostic System', M + 20, 26);

    // Receipt ID & date (right side)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Receipt ID: ${receiptID}`, W - M, 17, { align: 'right' });
    doc.text(`Date: ${dateStr}`, W - M, 23, { align: 'right' });
    doc.text(`Time: ${timeStr}`, W - M, 29, { align: 'right' });

    y = 52;

    // ── SECTION HELPER ─────────────────────────────────────────────────────
    function sectionTitle(title, icon = '') {
        doc.setFillColor(14, 165, 233);
        doc.rect(M, y, 3, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(`${icon}  ${title}`, M + 7, y + 4.5);
        y += 12;
    }

    function card(bgR, bgG, bgB, borderR, borderG, borderB, height) {
        doc.setFillColor(bgR, bgG, bgB);
        doc.setDrawColor(borderR, borderG, borderB);
        doc.setLineWidth(0.4);
        doc.roundedRect(M, y, CW, height, 3, 3, 'FD');
    }

    function fieldRow(label, value, indent = 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(label.toUpperCase(), M + 8 + indent, y);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(String(value || '—'), M + 8 + indent, y + 5.5);
        y += 12;
    }

    function listItem(text, dotColor = [14, 165, 233]) {
        doc.setFillColor(...dotColor);
        doc.circle(M + 10, y - 0.5, 1, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(30, 41, 59);
        const lines = doc.splitTextToSize(text, CW - 20);
        doc.text(lines, M + 14, y);
        y += lines.length * 5 + 2;
    }

    function divider() {
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(M, y, W - M, y);
        y += 6;
    }

    // ── PATIENT INFORMATION ────────────────────────────────────────────────
    sectionTitle('Patient Information', '👤');

    card(239, 246, 255, 191, 219, 254, 28);
    y += 7;

    // row 1 — age, gender
    const col2 = M + CW / 2;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
    doc.text('AGE', M + 8, y);
    doc.text('GENDER', col2, y);
    y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(15, 23, 42);
    doc.text(patAge + ' years', M + 8, y);
    doc.text(patGender, col2, y);
    y += 7;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
    doc.text('EXISTING CONDITIONS', M + 8, y);
    y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(15, 23, 42);
    doc.text(patHistory, M + 8, y);
    y += 12;

    // ── SELECTED SYMPTOMS ──────────────────────────────────────────────────
    sectionTitle('Reported Symptoms', '🩺');

    const symList = [...selectedSyms].map(fmt);
    const symPerRow = 3;
    const symRows   = Math.ceil(symList.length / symPerRow);
    const symCardH  = symRows * 8 + 10;

    card(240, 253, 244, 167, 243, 208, symCardH);
    y += 7;

    // Pill-style symptom layout
    let sx = M + 8;
    const pillH = 6;
    const pillPadX = 4;
    symList.forEach((sym, i) => {
        if (i > 0 && i % 4 === 0) { y += 9; sx = M + 8; }
        const tw = doc.getTextWidth(sym) + pillPadX * 2;
        doc.setFillColor(187, 247, 208);
        doc.setDrawColor(134, 239, 172);
        doc.setLineWidth(0.3);
        doc.roundedRect(sx, y - 4.5, tw, pillH, 1.5, 1.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(21, 128, 61);
        doc.text(sym, sx + pillPadX, y);
        sx += tw + 4;
        if (sx > W - M - 30) { y += 9; sx = M + 8; }
    });

    y += 14;

    // ── PRIMARY DIAGNOSIS ──────────────────────────────────────────────────
    sectionTitle('AI Diagnosis Results', '🤖');

    // Primary result highlight card
    doc.setFillColor(8, 47, 73);
    doc.setDrawColor(14, 165, 233);
    doc.setLineWidth(0.5);
    doc.roundedRect(M, y, CW, 38, 3, 3, 'FD');

    // Left accent bar
    doc.setFillColor(14, 165, 233);
    doc.roundedRect(M, y, 4, 38, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(14, 165, 233);
    doc.text('MOST LIKELY CONDITION', M + 10, y + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(primary.disease || '—', M + 10, y + 17);

    // Severity badge
    const sev = (primary.severity || 'Unknown').toUpperCase();
    const sevColors = {
        'LOW':      [16, 185, 129, 6, 78, 59],
        'MILD':     [16, 185, 129, 6, 78, 59],
        'MODERATE': [245, 158, 11, 120, 53, 15],
        'HIGH':     [239, 68, 68, 127, 29, 29],
        'CRITICAL': [239, 68, 68, 127, 29, 29],
        'UNKNOWN':  [100, 116, 139, 51, 65, 85]
    };
    const sc = sevColors[sev] || sevColors['UNKNOWN'];
    const sevW = doc.getTextWidth(sev) + 8;
    doc.setFillColor(sc[0], sc[1], sc[2]);
    doc.roundedRect(M + 10, y + 21, sevW, 7, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(sev, M + 10 + 4, y + 26);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text(primary.category || '', M + 10 + sevW + 6, y + 26);

    // Probability bar
    const prob = primary.probability || 0;
    const barX = M + 10;
    const barW = CW - 20;
    const barY = y + 31;

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Match Probability', barX, barY - 1);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(14, 165, 233);
    doc.text(`${prob}%`, W - M - 8, barY - 1, { align: 'right' });

    // Bar background
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(barX, barY + 1, barW, 3, 1.5, 1.5, 'F');
    // Bar fill
    doc.setFillColor(14, 165, 233);
    doc.roundedRect(barX, barY + 1, barW * (prob / 100), 3, 1.5, 1.5, 'F');

    y += 46;

    // ── OTHER CONDITIONS ───────────────────────────────────────────────────
    if (preds.length > 1) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text('OTHER POSSIBLE CONDITIONS', M, y);
        y += 6;

        preds.slice(1).forEach(p => {
            const pb = p.probability || 0;
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.roundedRect(M, y, CW, 12, 2, 2, 'FD');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(30, 41, 59);
            doc.text(p.disease, M + 6, y + 7.5);

            const obw = 60;
            const obx = W - M - 8 - obw - 14;
            doc.setFillColor(226, 232, 240);
            doc.roundedRect(obx, y + 4.5, obw, 3, 1.5, 1.5, 'F');
            doc.setFillColor(99, 102, 241);
            doc.roundedRect(obx, y + 4.5, obw * (pb / 100), 3, 1.5, 1.5, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(99, 102, 241);
            doc.text(`${pb}%`, W - M - 6, y + 7.5, { align: 'right' });

            y += 15;
        });
    }

    y += 4;

    // ── AI ADVICE (if available) ───────────────────────────────────────────
    if (aiAdviceData) {
        divider();
        sectionTitle('AI Medical Advice (Gemini)', '💡');

        const sections = [
            { key: 'do_list',        label: 'WHAT TO DO',       dot: [16, 185, 129] },
            { key: 'dont_list',      label: 'WHAT TO AVOID',    dot: [239, 68, 68] },
            { key: 'home_remedies',  label: 'HOME CARE',        dot: [14, 165, 233] },
            { key: 'see_doctor_when',label: 'SEE A DOCTOR WHEN',dot: [245, 158, 11] },
        ];

        sections.forEach(sec => {
            const items = aiAdviceData[sec.key] || [];
            if (!items.length) return;

            // Check page break
            if (y > 250) { doc.addPage(); y = 20; }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(sec.dot[0], sec.dot[1], sec.dot[2]);
            doc.text(sec.label, M, y);
            y += 6;

            items.forEach(item => {
                if (y > 270) { doc.addPage(); y = 20; }
                listItem(item, sec.dot);
            });
            y += 3;
        });

        // Urgency
        if (aiAdviceData.urgency) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(245, 158, 11);
            doc.text('URGENCY LEVEL', M, y);
            y += 5;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(30, 41, 59);
            doc.text(aiAdviceData.urgency.replace(/_/g, ' '), M, y);
            y += 10;
        }
    }

    // ── FOOTER ─────────────────────────────────────────────────────────────
    // Draw on last page bottom
    const totalPages = doc.internal.getNumberOfPages();
    for (let pg = 1; pg <= totalPages; pg++) {
        doc.setPage(pg);
        const fy = 285;
        doc.setFillColor(5, 13, 26);
        doc.rect(0, fy - 4, W, 15, 'F');
        doc.setFillColor(14, 165, 233);
        doc.rect(0, 293, W, 4, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('DiseasePredictor — AI-Powered Health Insights', M, fy + 2);

        doc.setFont('helvetica', 'normal');
        doc.text('⚠️ For educational purposes only. Not a substitute for professional medical advice.', M, fy + 7);

        doc.setTextColor(100, 116, 139);
        doc.text(`Page ${pg} of ${totalPages}`, W - M, fy + 2, { align: 'right' });
        doc.text(receiptID, W - M, fy + 7, { align: 'right' });
    }

    // ── SAVE ───────────────────────────────────────────────────────────────
    const fname = `DiseasePredictor_Receipt_${receiptID}.pdf`;
    doc.save(fname);
}

// ══════════════════════════════════════════════════════════════════════════════
// START
// ══════════════════════════════════════════════════════════════════════════════
init();