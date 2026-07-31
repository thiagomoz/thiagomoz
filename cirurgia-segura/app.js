/* =========================================================
   Cirurgia Segura — Protótipo funcional (dados fictícios)
   PWA client-side: os dados vivem em localStorage,
   simulando o backend (Supabase) previsto no PRD.
   ========================================================= */
'use strict';

/* ---------------- Persistência ---------------- */
const DB_KEY = 'cirurgia_segura_v1';
let DB = null;

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) { DB = JSON.parse(raw); return; }
  } catch (e) { /* seed abaixo */ }
  DB = buildSeed();
  saveDB();
}
function saveDB() { localStorage.setItem(DB_KEY, JSON.stringify(DB)); }
function nextId(prefix, counterKey) {
  DB.counters[counterKey] = (DB.counters[counterKey] || 0) + 1;
  return `${prefix}-${String(DB.counters[counterKey]).padStart(3, '0')}`;
}

/* ---------------- Sessão / Auth (RF-01) ---------------- */
const SESSION_KEY = 'cirurgia_segura_sessao';
const LOCK_MS = 15 * 60 * 1000;          // 15 min de inatividade → PIN
const MAX_TENTATIVAS = 5;
const BLOQUEIO_MS = 5 * 60 * 1000;       // 5 min após 5 erros

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
}
function setSession(s) {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
}
function currentUser() {
  const s = getSession();
  if (!s) return null;
  const u = DB.users.find((x) => x.id === s.userId);
  if (!u || !u.ativo) { setSession(null); return null; } // usuário desativado → sessão cai
  return u;
}
const NIVEL = { enfermeiro: 1, gestor: 2, admin: 3 };
function temPerfil(minimo) {
  const u = currentUser();
  return u && NIVEL[u.perfil] >= NIVEL[minimo];
}

function touchActivity() {
  const s = getSession();
  if (s && !s.locked) { s.lastActivity = Date.now(); setSession(s); }
}
function checkIdleLock() {
  const s = getSession();
  if (s && !s.locked && Date.now() - s.lastActivity > LOCK_MS) {
    s.locked = true; setSession(s); render();
  }
}
setInterval(checkIdleLock, 15000);
['click', 'keydown', 'touchstart'].forEach((ev) =>
  document.addEventListener(ev, () => touchActivity(), { passive: true }));

/* ---------------- Auditoria (RF-10, append-only) ---------------- */
function dispositivo() {
  return /Mobi|Android|iPad|Tablet/i.test(navigator.userAgent) ? 'Tablet/Móvel' : 'Desktop';
}
function audit(acao, entidade, entidadeId, payload) {
  const u = currentUser();
  DB.audit.push({
    id: nextId('aud', 'aud'),
    user_id: u ? u.id : null,
    acao, entidade, entidade_id: entidadeId || null,
    payload: payload || null,
    dispositivo: dispositivo(),
    criado_em: new Date().toISOString(),
  });
  saveDB();
}

/* ---------------- Rede / sincronização simulada (RF-11) ---------------- */
let syncTimer = null;
function pendingCount() {
  return DB.procedures.filter((p) => p.sync === 'pending').length +
         DB.stages.filter((s) => s.sync === 'pending').length;
}
function updateNetIndicator(state) {
  const el = document.getElementById('net-indicator');
  const pend = pendingCount();
  let cls = '', label = 'Online';
  if (state === 'syncing') { cls = 'syncing'; label = 'Sincronizando…'; }
  else if (!navigator.onLine) { cls = 'offline'; label = pend ? `Offline · ${pend} pendente(s)` : 'Offline — salvo no aparelho'; }
  else if (pend) { cls = 'syncing'; label = `${pend} pendente(s)`; }
  el.className = cls;
  el.innerHTML = `<span class="net-label">${esc(label)}</span>`;
  el.title = label;
}
function marcarSync(obj) { obj.sync = navigator.onLine ? 'synced' : 'pending'; }
function sincronizarPendentes() {
  if (!navigator.onLine || pendingCount() === 0) { updateNetIndicator(); return; }
  updateNetIndicator('syncing');
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    let n = 0;
    DB.procedures.forEach((p) => { if (p.sync === 'pending') { p.sync = 'synced'; n++; } });
    DB.stages.forEach((s) => { if (s.sync === 'pending') { s.sync = 'synced'; n++; } });
    saveDB();
    audit('sincronizou_pendencias', 'sync', null, { registros: n });
    updateNetIndicator();
    toast(`Sincronização concluída (${n} registro(s)) — timestamps originais preservados`);
    render();
  }, 1200);
}
window.addEventListener('online', sincronizarPendentes);
window.addEventListener('offline', () => updateNetIndicator());

/* ---------------- Utilidades ---------------- */
const $ = (sel) => document.querySelector(sel);
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDataHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function fmtData(iso) { return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'; }
function nomeUsuario(id) { const u = DB.users.find((x) => x.id === id); return u ? u.nome : '—'; }
function paciente(id) { return DB.patients.find((p) => p.id === id); }
function itemLabel(etapa, key) {
  const it = WHO_CHECKLIST[etapa].itens.find((i) => i.key === key);
  return it ? it.label : key;
}
function catLabel(key) { const c = NC_CATEGORIAS.find((x) => x.key === key); return c ? c.label : key; }
let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}
function idadeAnos(nasc) {
  const n = new Date(nasc), h = new Date();
  let a = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) a--;
  return a;
}

/* ---------------- Router ---------------- */
const routes = [];
function route(pattern, minPerfil, handler) { routes.push({ pattern, minPerfil, handler }); }
function navigate(hash) { location.hash = hash; }
let ultimaRota = null;
function render() {
  const app = $('#app');
  const sess = getSession();
  const user = currentUser();
  const hash = location.hash.replace(/^#/, '') || '/procedimentos';
  if (hash !== ultimaRota) { window.scrollTo(0, 0); ultimaRota = hash; }

  // modo foco: durante a execução de uma etapa a navegação some — só o checklist
  document.body.classList.toggle('focus-mode', /\/etapa\//.test(hash));

  if (!user) { $('#topbar').hidden = true; $('#tabbar').hidden = true; viewLogin(app); return; }
  if (sess.locked) { $('#topbar').hidden = true; $('#tabbar').hidden = true; viewPinLock(app); return; }

  $('#topbar').hidden = false;
  $('#tabbar').hidden = false;
  const nomeCurto = user.nome.split(' ')[0];
  $('#topbar-user').textContent = `${nomeCurto} · ${user.perfil}`;
  renderNav(user);

  for (const r of routes) {
    const m = hash.match(r.pattern);
    if (m) {
      if (r.minPerfil && !temPerfil(r.minPerfil)) { viewAcessoNegado(app); return; }
      r.handler(app, ...m.slice(1));
      app.focus();
      return;
    }
  }
  navigate('/procedimentos');
}
window.addEventListener('hashchange', render);

// máx. 5 destinos (Hick); ícone + rótulo, ativos destacados (Jakob: padrão tab bar)
const NAV_LINKS = [
  ['/procedimentos', '🩺', 'Sala', 'enfermeiro'],
  ['/pacientes', '🪪', 'Pacientes', 'enfermeiro'],
  ['/painel', '📊', 'Painel', 'gestor'],
  ['/auditoria', '🧾', 'Auditoria', 'gestor'],
  ['/admin', '⚙️', 'Ajustes', 'admin'],
];
function renderNav(user) {
  const hash = location.hash.replace(/^#/, '') || '/procedimentos';
  const ativos = NAV_LINKS.filter(([, , , min]) => NIVEL[user.perfil] >= NIVEL[min]);
  const isActive = (href) =>
    hash.startsWith(href) ||
    (href === '/procedimentos' && hash.startsWith('/procedimento')) ||
    (href === '/pacientes' && hash.startsWith('/paciente'));
  $('#mainnav').innerHTML = ativos.map(([href, ic, label]) =>
    `<a href="#${href}" class="${isActive(href) ? 'active' : ''}">${ic} ${label}</a>`).join('');
  $('#tabbar').innerHTML = ativos.map(([href, ic, label]) =>
    `<a href="#${href}" class="${isActive(href) ? 'active' : ''}" aria-label="${label}">
      <span class="t-ic" aria-hidden="true">${ic}</span>${label}</a>`).join('');
}
$('#btn-lock').addEventListener('click', () => {
  const s = getSession();
  if (s) { s.locked = true; setSession(s); audit('bloqueou_sessao', 'session', null); render(); }
});

/* =========================================================
   LOGIN (RF-01)
   ========================================================= */
function loginBloqueado(email) {
  const raw = localStorage.getItem('cs_lockout_' + email);
  if (!raw) return 0;
  const { ate } = JSON.parse(raw);
  return ate > Date.now() ? ate : 0;
}
function registrarFalha(email) {
  const key = 'cs_lockout_' + email;
  const cur = JSON.parse(localStorage.getItem(key) || '{"n":0}');
  cur.n = (cur.n || 0) + 1;
  if (cur.n >= MAX_TENTATIVAS) { cur.ate = Date.now() + BLOQUEIO_MS; cur.n = 0; }
  localStorage.setItem(key, JSON.stringify(cur));
  return cur.ate || 0;
}

const PERFIL_LABEL = { enfermeiro: 'Enfermagem — executa o checklist', gestor: 'Gestão — painel e relatórios', admin: 'Administração — configurações' };
const PERFIL_COR = { enfermeiro: '#0f4c81', gestor: '#6a4fa3', admin: '#3d6b4f' };

function viewLogin(app, emailPreservado) {
  const iniciais = (nome) => nome.split(' ').map((p) => p[0]).slice(0, 2).join('');
  app.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-logo">🏥</div>
      <h1 style="text-align:center">Cirurgia Segura</h1>
      <p class="sub" style="text-align:center">Checklist OMS digital + indicadores</p>
      <h2>Entrar como</h2>
      ${DB.users.filter((u) => u.ativo).map((u) => `
        <button class="persona-card" data-persona="${u.id}">
          <span class="persona-avatar" style="background:${PERFIL_COR[u.perfil]}">${esc(iniciais(u.nome))}</span>
          <span><span class="p-nome">${esc(u.nome)}</span><br>
          <span class="p-perfil">${PERFIL_LABEL[u.perfil]}</span></span>
          <span class="chevron">›</span>
        </button>`).join('')}
      <details class="manual-login" ${emailPreservado ? 'open' : ''}>
        <summary>Entrar com e-mail e senha</summary>
        <div class="card">
          <form id="form-login" novalidate>
            <label class="field">E-mail
              <input type="email" name="email" required autocomplete="username" inputmode="email" value="${esc(emailPreservado || '')}">
            </label>
            <label class="field">Senha
              <input type="password" name="senha" required autocomplete="current-password">
            </label>
            <div class="field-error" id="login-error" role="alert"></div>
            <button class="btn block" type="submit">Entrar</button>
          </form>
          <p class="credencial-hint" style="margin:10px 0 0">Simulação: senha <code>demo123</code> · PIN <code>1234</code></p>
        </div>
      </details>
    </div>`;
  app.querySelectorAll('[data-persona]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const u = DB.users.find((x) => x.id === btn.dataset.persona);
      if (!u || !u.ativo) return;
      setSession({ userId: u.id, lastActivity: Date.now(), locked: false });
      audit('login', 'users', u.id, { metodo: 'persona_simulacao' });
      navigate('/procedimentos'); render();
    });
  });
  $('#form-login').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const email = ev.target.email.value.trim().toLowerCase();
    const senha = ev.target.senha.value;
    const errEl = $('#login-error');
    const bloqueadoAte = loginBloqueado(email);
    if (bloqueadoAte) {
      errEl.textContent = `Acesso temporariamente bloqueado após ${MAX_TENTATIVAS} tentativas. Tente novamente às ${new Date(bloqueadoAte).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`;
      return;
    }
    const u = DB.users.find((x) => x.email.toLowerCase() === email);
    if (!u || u.senha !== senha) {
      const ate = registrarFalha(email);
      errEl.textContent = ate
        ? `Credenciais inválidas. Acesso bloqueado por 5 minutos.`
        : 'E-mail ou senha incorretos. O e-mail digitado foi preservado.';
      viewLogin(app, email); // preserva e-mail (RF-01)
      $('#login-error').textContent = errEl.textContent;
      return;
    }
    if (!u.ativo) { errEl.textContent = 'Usuário desativado pelo administrador.'; return; }
    setSession({ userId: u.id, lastActivity: Date.now(), locked: false });
    audit('login', 'users', u.id);
    navigate('/procedimentos'); render();
  });
}

function viewPinLock(app) {
  const user = DB.users.find((x) => x.id === getSession().userId);
  let digitado = '';
  app.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-logo">🔒</div>
      <h1 style="text-align:center">Sessão bloqueada</h1>
      <p class="sub" style="text-align:center">${esc(user.nome)} — digite seu PIN para continuar</p>
      <div class="pin-display" id="pin-display"></div>
      <div class="pin-pad" id="pin-pad"></div>
      <div class="field-error" id="pin-error" style="text-align:center;margin-top:10px"></div>
      <p style="text-align:center;margin-top:16px">
        <button class="btn secondary small" id="btn-sair">Sair e entrar com outro usuário</button>
      </p>
    </div>`;
  const desenharDots = () => {
    $('#pin-display').innerHTML = Array.from({ length: Math.max(4, user.pin.length) },
      (_, i) => `<span class="pin-dot ${i < digitado.length ? 'filled' : ''}"></span>`).join('');
  };
  desenharDots();
  $('#pin-pad').innerHTML =
    [1,2,3,4,5,6,7,8,9,'⌫',0,'OK'].map((k) => `<button class="pin-key" data-k="${k}">${k}</button>`).join('');
  $('#pin-pad').addEventListener('click', (ev) => {
    const k = ev.target.dataset.k;
    if (!k) return;
    if (k === '⌫') digitado = digitado.slice(0, -1);
    else if (k === 'OK') {
      if (digitado === user.pin) {
        const s = getSession(); s.locked = false; s.lastActivity = Date.now(); setSession(s);
        audit('desbloqueou_por_pin', 'session', null);
        render(); return;
      }
      $('#pin-error').textContent = 'PIN incorreto. Tente novamente.'; digitado = '';
      const disp = $('#pin-display');
      disp.classList.remove('pin-shake'); void disp.offsetWidth; disp.classList.add('pin-shake');
    } else if (digitado.length < 6) digitado += k;
    desenharDots();
  });
  $('#btn-sair').addEventListener('click', () => {
    audit('logout', 'users', user.id); setSession(null); render();
  });
}

function viewAcessoNegado(app) {
  app.innerHTML = `
    <div class="card acesso-negado">
      <div class="ic">⛔</div>
      <h1>Acesso negado</h1>
      <p class="sub">Seu perfil não tem permissão para esta área. No produto final este bloqueio
      também é aplicado no banco de dados via RLS — nunca apenas na interface.</p>
      <a class="btn secondary" href="#/procedimentos">Voltar aos procedimentos</a>
    </div>`;
}

/* =========================================================
   PROCEDIMENTOS (RF-03) + fluxo do checklist
   ========================================================= */
// progresso das 3 etapas de um procedimento (Zeigarnik: o que falta puxa a ação)
function etapasFeitas(procId) {
  return ETAPAS_ORDEM.filter((e) =>
    DB.stages.some((s) => s.procedure_id === procId && s.etapa === e && s.confirmado_em));
}
function stageDotsHtml(procId, status) {
  const feitas = etapasFeitas(procId);
  const atualIdx = status === 'cancelado' ? -1 : feitas.length;
  return `<span class="stage-dots" aria-label="${feitas.length} de 3 etapas concluídas">
    ${ETAPAS_ORDEM.map((e, i) =>
      `<span class="dot ${i < feitas.length ? 'done' : i === atualIdx ? 'current' : ''}"></span>`).join('')}
  </span>`;
}
function proximaEtapa(procId) {
  const feitas = etapasFeitas(procId);
  return ETAPAS_ORDEM.find((e) => !feitas.includes(e));
}

route(/^\/procedimentos$/, 'enfermeiro', (app) => {
  const pesoStatus = { em_cirurgia: 3, aguardando_time_out: 2, aguardando_sign_in: 1 };
  const ativos = DB.procedures
    .filter((p) => !['concluido', 'cancelado'].includes(p.status))
    .sort((a, b) => (pesoStatus[b.status] - pesoStatus[a.status]) || a.data_prevista.localeCompare(b.data_prevista));
  const finalizados = DB.procedures.filter((p) => ['concluido', 'cancelado'].includes(p.status))
    .sort((a, b) => b.data_prevista.localeCompare(a.data_prevista)).slice(0, 5);

  // aviso de sala com 2 procedimentos ativos simultâneos
  const porSala = {};
  ativos.forEach((p) => { porSala[p.sala] = (porSala[p.sala] || 0) + 1; });

  // a próxima ação da sala: o procedimento mais avançado (Von Restorff — um só destaque)
  const destaque = ativos[0];
  const restantes = ativos.slice(1);

  const heroHtml = () => {
    if (!destaque) return '';
    const pac = paciente(destaque.patient_id);
    const etapa = proximaEtapa(destaque.id);
    const jaComecou = etapasFeitas(destaque.id).length > 0;
    return `
      <div class="hero-next">
        <div class="eyebrow">Próxima ação · ${esc(destaque.sala)}</div>
        <div class="nome">${esc(pac.nome)}</div>
        <div class="meta">${esc(destaque.tipo)} · ${fmtDataHora(destaque.data_prevista)}
          ${porSala[destaque.sala] > 1 ? ' · ⚠ 2 procedimentos nesta sala' : ''}</div>
        <div class="row" style="margin-bottom:12px">${stageDotsHtml(destaque.id, destaque.status)}
          <span style="font-size:.82rem;opacity:.9">${WHO_CHECKLIST[etapa].titulo} — ${WHO_CHECKLIST[etapa].subtitulo.toLowerCase()}</span></div>
        <a class="btn" href="#/procedimento/${destaque.id}/etapa/${etapa}">
          ${jaComecou ? 'Continuar' : 'Iniciar'} ${WHO_CHECKLIST[etapa].titulo} →</a>
      </div>`;
  };

  const cardProc = (p) => {
    const pac = paciente(p.patient_id);
    const encerrado = ['concluido', 'cancelado'].includes(p.status);
    return `
      <div class="card proc-item" data-goto="/procedimento/${p.id}" role="button" tabindex="0">
        <div class="proc-main">
          <div class="nome">${esc(pac ? pac.nome : '?')}</div>
          <div class="meta">${esc(p.tipo)} · ${esc(p.sala)} · ${fmtDataHora(p.data_prevista)}</div>
          <div class="row" style="gap:8px">
            ${stageDotsHtml(p.id, p.status)}
            <span class="badge st-${p.status}">${STATUS_LABELS[p.status]}</span>
            ${p.sync === 'pending' ? '<span class="badge pending-sync">⟳ pendente</span>' : ''}
            ${!encerrado && porSala[p.sala] > 1 ? '<span class="badge warn-room">⚠ sala ocupada</span>' : ''}
          </div>
        </div>
        <span class="chevron" aria-hidden="true">›</span>
      </div>`;
  };

  app.innerHTML = `
    <h1>Minha sala</h1>
    <p class="sub">Fila da sala operatória — toque em um procedimento para abrir</p>
    ${heroHtml()}
    ${restantes.length ? `<h2>Na fila (${restantes.length})</h2>${restantes.map(cardProc).join('')}` : ''}
    ${!ativos.length ? '<div class="card empty-state"><div class="big">🕊</div>Nenhum procedimento ativo.<br>Toque em <strong>＋ Novo</strong> para iniciar um checklist.</div>' : ''}
    <h2>Encerrados recentes</h2>
    ${finalizados.length ? finalizados.map(cardProc).join('') : '<div class="card empty-state">Nenhum procedimento encerrado.</div>'}
    <a class="btn fab" href="#/procedimento/novo">＋ Novo</a>`;
  bindGoto(app);
});

function bindGoto(app) {
  app.querySelectorAll('[data-goto]').forEach((el) => {
    const go = () => navigate(el.dataset.goto);
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
}

route(/^\/procedimento\/novo$/, 'enfermeiro', (app) => {
  if (!DB.patients.length) { navigate('/pacientes'); return; }
  app.innerHTML = `
    <h1>Novo procedimento</h1>
    <div class="card">
      <form id="form-proc" novalidate>
        <label class="field">Paciente *
          <select name="patient_id" required>
            <option value="">Selecione…</option>
            ${DB.patients.map((p) => `<option value="${p.id}">${esc(p.nome)} — ${esc(p.identificador)}</option>`).join('')}
          </select>
        </label>
        <label class="field">Tipo de cirurgia *
          <select name="tipo" required>
            <option value="">Selecione…</option>
            ${DB.tiposProcedimento.map((t) => `<option>${esc(t)}</option>`).join('')}
          </select>
        </label>
        <div class="grid-2">
          <label class="field">Sala *
            <select name="sala" required>${DB.salas.map((s) => `<option>${esc(s)}</option>`).join('')}</select>
          </label>
          <label class="field">Caráter *
            <select name="carater"><option value="eletiva">Eletiva</option><option value="urgencia">Urgência</option></select>
          </label>
        </div>
        <label class="field">Data e hora previstas *
          <input type="datetime-local" name="data_prevista" required>
        </label>
        <label class="field">Equipe (texto livre)
          <textarea name="equipe_texto" placeholder="Cirurgião, anestesista, instrumentador…"></textarea>
        </label>
        <div class="field-error" id="proc-error" role="alert"></div>
        <div class="row">
          <button class="btn" type="submit">Criar procedimento</button>
          <a class="btn secondary" href="#/procedimentos">Cancelar</a>
        </div>
      </form>
    </div>`;
  const inp = app.querySelector('[name=data_prevista]');
  const agora = new Date(); agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
  inp.value = agora.toISOString().slice(0, 16);

  $('#form-proc').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = ev.target;
    if (!f.patient_id.value) { $('#proc-error').textContent = 'Paciente é obrigatório.'; return; }
    if (!f.tipo.value || !f.data_prevista.value) { $('#proc-error').textContent = 'Preencha os campos obrigatórios.'; return; }
    const id = nextId('proc', 'proc');
    const proc = {
      id, patient_id: f.patient_id.value, tipo: f.tipo.value, sala: f.sala.value,
      carater: f.carater.value, data_prevista: new Date(f.data_prevista.value).toISOString(),
      status: 'aguardando_sign_in', equipe_texto: f.equipe_texto.value.trim(),
      criado_por: currentUser().id, criado_em: new Date().toISOString(),
      cancelamento: null, adendos: [],
    };
    marcarSync(proc);
    DB.procedures.push(proc);
    saveDB();
    audit('criou_procedimento', 'procedures', id, { tipo: proc.tipo, sala: proc.sala });
    updateNetIndicator(); sincronizarPendentes();
    toast('Procedimento criado — Aguardando Sign In');
    navigate(`/procedimento/${id}`);
  });
});

route(/^\/procedimento\/(proc-\d+)$/, 'enfermeiro', (app, id) => {
  const p = DB.procedures.find((x) => x.id === id);
  if (!p) { navigate('/procedimentos'); return; }
  const pac = paciente(p.patient_id);
  const stagesDoProc = DB.stages.filter((s) => s.procedure_id === id);
  const stageDe = (etapa) => stagesDoProc.find((s) => s.etapa === etapa);
  const proxima = ETAPAS_ORDEM.find((e) => !(stageDe(e) && stageDe(e).confirmado_em));

  const linhaEtapa = (etapa) => {
    const st = stageDe(etapa);
    const done = st && st.confirmado_em;
    const podeAbrir = etapa === proxima && !['concluido', 'cancelado'].includes(p.status);
    return `
      <div class="card row">
        <div class="grow">
          <strong>${WHO_CHECKLIST[etapa].titulo}</strong>
          <div class="sub" style="margin:0">${WHO_CHECKLIST[etapa].subtitulo}</div>
          ${done ? `<div class="sub" style="margin:0">✔ Confirmado por ${esc(nomeUsuario(st.confirmado_por))} em ${fmtDataHora(st.confirmado_em)}
            ${st.sync === 'pending' ? ' <span class="badge pending-sync">⟳ pendente</span>' : ''}</div>` : ''}
        </div>
        ${done
          ? '<span class="badge st-concluido">Concluída</span>'
          : podeAbrir
            ? `<a class="btn small" href="#/procedimento/${id}/etapa/${etapa}">Executar</a>`
            : '<span class="badge st-cancelado">Bloqueada — siga a sequência</span>'}
      </div>`;
  };

  app.innerHTML = `
    <h1>${esc(pac.nome)}</h1>
    <p class="sub">${esc(p.tipo)} · ${esc(p.sala)} · ${fmtDataHora(p.data_prevista)} ·
      ${p.carater === 'urgencia' ? 'Urgência' : 'Eletiva'} ·
      <span class="badge st-${p.status}">${STATUS_LABELS[p.status]}</span></p>
    <div class="card">
      <strong>Paciente (fictício)</strong>
      <div class="sub" style="margin:0">Nascimento: ${fmtData(pac.nascimento)} (${idadeAnos(pac.nascimento)} anos) ·
        Identificador: ${esc(pac.identificador)} · Alergias: ${esc(pac.alergias || 'não declaradas')}</div>
      ${p.equipe_texto ? `<div class="sub" style="margin:4px 0 0">Equipe: ${esc(p.equipe_texto)}</div>` : ''}
    </div>
    ${p.status === 'cancelado' ? `
      <div class="card" style="border-color:var(--nc)">
        <strong style="color:var(--nc)">Procedimento cancelado</strong>
        <div class="sub" style="margin:0">${esc(p.cancelamento.motivo)} — ${esc(nomeUsuario(p.cancelamento.por))}, ${fmtDataHora(p.cancelamento.em)}</div>
      </div>` : ''}
    <h2>Etapas do checklist</h2>
    ${ETAPAS_ORDEM.map(linhaEtapa).join('')}
    ${p.status === 'concluido' || stagesDoProc.some((s) => s.confirmado_em) ? renderConsolidado(p, stagesDoProc) : ''}
    ${p.status === 'concluido' ? renderAdendos(p) : ''}
    <div class="row" style="margin-top:16px">
      <a class="btn secondary" href="#/procedimentos">← Voltar</a>
      ${!['concluido', 'cancelado'].includes(p.status)
        ? '<button class="btn danger" id="btn-cancelar">Cancelar procedimento</button>' : ''}
    </div>`;

  const btnCanc = $('#btn-cancelar');
  if (btnCanc) btnCanc.addEventListener('click', () => {
    abrirSheet(`
      <h2>Cancelar procedimento</h2>
      <p class="sub">O procedimento sai da fila ativa mas permanece nos relatórios como "cancelado".</p>
      <label class="field">Motivo *<textarea id="canc-motivo"></textarea></label>
      <div class="field-error" id="canc-err"></div>
      <div class="row">
        <button class="btn danger" id="canc-ok">Confirmar cancelamento</button>
        <button class="btn secondary" id="canc-nao">Voltar</button>
      </div>`);
    $('#canc-nao').addEventListener('click', fecharSheet);
    $('#canc-ok').addEventListener('click', () => {
      const motivo = $('#canc-motivo').value.trim();
      if (!motivo) { $('#canc-err').textContent = 'Informe o motivo.'; return; }
      p.status = 'cancelado';
      p.cancelamento = { motivo, por: currentUser().id, em: new Date().toISOString() };
      saveDB();
      audit('cancelou_procedimento', 'procedures', p.id, { motivo });
      fecharSheet(); toast('Procedimento cancelado'); render();
    });
  });

  const btnAdendo = $('#btn-adendo');
  if (btnAdendo) btnAdendo.addEventListener('click', () => {
    abrirSheet(`
      <h2>Registrar adendo</h2>
      <p class="sub">O procedimento concluído é imutável: correções viram adendos no log de auditoria,
      nunca sobrescrevem o registro original.</p>
      <label class="field">Texto do adendo *<textarea id="ad-texto"></textarea></label>
      <div class="field-error" id="ad-err"></div>
      <div class="row">
        <button class="btn" id="ad-ok">Registrar</button>
        <button class="btn secondary" id="ad-nao">Voltar</button>
      </div>`);
    $('#ad-nao').addEventListener('click', fecharSheet);
    $('#ad-ok').addEventListener('click', () => {
      const texto = $('#ad-texto').value.trim();
      if (!texto) { $('#ad-err').textContent = 'Escreva o adendo.'; return; }
      p.adendos = p.adendos || [];
      p.adendos.push({ texto, por: currentUser().id, em: new Date().toISOString() });
      saveDB();
      audit('registrou_adendo', 'procedures', p.id, { texto });
      fecharSheet(); toast('Adendo registrado no log de auditoria'); render();
    });
  });
});

function renderConsolidado(p, stagesDoProc) {
  const linhas = [];
  ETAPAS_ORDEM.forEach((etapa) => {
    const st = stagesDoProc.find((s) => s.etapa === etapa && s.confirmado_em);
    if (!st) return;
    DB.stageItems.filter((i) => i.stage_id === st.id).forEach((i) => {
      const nc = DB.ncs.find((n) => n.stage_item_id === i.id);
      linhas.push(`<tr>
        <td>${WHO_CHECKLIST[etapa].titulo}</td>
        <td>${esc(itemLabel(etapa, i.item_key))}</td>
        <td class="resp-${i.resposta}">${i.resposta === 'conforme' ? 'Conforme' : i.resposta === 'nc' ? 'Não conforme' : 'N/A'}</td>
        <td>${nc ? esc(catLabel(nc.categoria)) + (nc.observacao ? ' — ' + esc(nc.observacao) : '') : '—'}</td>
        <td>${esc(nomeUsuario(st.confirmado_por))}</td>
        <td>${fmtDataHora(st.confirmado_em)}</td>
      </tr>`);
    });
  });
  if (!linhas.length) return '';
  return `
    <h2>Registro consolidado ${p.status === 'concluido' ? '(somente leitura)' : '(parcial)'}</h2>
    <div class="card table-wrap">
      <table class="data">
        <thead><tr><th>Etapa</th><th>Item</th><th>Resposta</th><th>Não conformidade</th><th>Autor</th><th>Confirmado em</th></tr></thead>
        <tbody>${linhas.join('')}</tbody>
      </table>
    </div>`;
}

function renderAdendos(p) {
  const ads = p.adendos || [];
  return `
    <h2>Adendos</h2>
    ${ads.length ? ads.map((a) => `
      <div class="card"><strong>${esc(nomeUsuario(a.por))}</strong> — ${fmtDataHora(a.em)}
      <div class="sub" style="margin:4px 0 0">${esc(a.texto)}</div></div>`).join('')
      : '<div class="card empty-state">Nenhum adendo registrado.</div>'}
    <button class="btn secondary small" id="btn-adendo">＋ Registrar adendo</button>`;
}

/* =========================================================
   EXECUÇÃO DE ETAPA (RF-04/05/06) — tela única
   ========================================================= */
const DRAFT_KEY = 'cs_draft_';

route(/^\/procedimento\/(proc-\d+)\/etapa\/(sign_in|time_out|sign_out)$/, 'enfermeiro', (app, procId, etapa) => {
  const p = DB.procedures.find((x) => x.id === procId);
  if (!p) { navigate('/procedimentos'); return; }

  // sequência obrigatória
  const idx = ETAPAS_ORDEM.indexOf(etapa);
  const anteriores = ETAPAS_ORDEM.slice(0, idx);
  const feitas = DB.stages.filter((s) => s.procedure_id === procId && s.confirmado_em).map((s) => s.etapa);
  if (anteriores.some((e) => !feitas.includes(e)) || feitas.includes(etapa) || ['concluido', 'cancelado'].includes(p.status)) {
    toast('A sequência das etapas é obrigatória.');
    navigate(`/procedimento/${procId}`);
    return;
  }

  const def = WHO_CHECKLIST[etapa];
  const pac = paciente(p.patient_id);
  const draftKey = DRAFT_KEY + procId + '_' + etapa;

  // rascunho local: restaura respostas parciais (tablet reiniciado, RF-04)
  let draft;
  try { draft = JSON.parse(localStorage.getItem(draftKey)) || {}; } catch (e) { draft = {}; }
  if (!draft.iniciado_em) draft.iniciado_em = new Date().toISOString();
  draft.respostas = draft.respostas || {};
  draft.ncs = draft.ncs || {};
  const salvarDraft = () => localStorage.setItem(draftKey, JSON.stringify(draft));
  salvarDraft();

  let confirmando = false; // idempotência do duplo toque

  const idxEtapa = ETAPAS_ORDEM.indexOf(etapa);
  const stepperHtml = () => `
    <div class="stepper" aria-label="Etapa ${idxEtapa + 1} de 3">
      ${ETAPAS_ORDEM.map((e, i) => `
        ${i > 0 ? `<span class="bar ${i <= idxEtapa ? 'done' : ''}"></span>` : ''}
        <span class="step ${i < idxEtapa ? 'done' : i === idxEtapa ? 'current' : ''}">
          <span class="n">${i < idxEtapa ? '✓' : i + 1}</span>${WHO_CHECKLIST[e].titulo}
        </span>`).join('')}
    </div>`;

  // rola até o próximo item sem resposta (reduz custo de interação em tela pequena)
  const scrollProximoPendente = (aposKey) => {
    const keys = def.itens.map((i) => i.key);
    const inicio = aposKey ? keys.indexOf(aposKey) + 1 : 0;
    const proxKey = [...keys.slice(inicio), ...keys.slice(0, inicio)].find((k) => !draft.respostas[k]);
    if (!proxKey) return;
    const el = app.querySelector(`[data-item="${proxKey}"]`);
    if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  };

  const desenhar = () => {
    const respondidos = def.itens.filter((i) => draft.respostas[i.key]).length;
    const completo = respondidos === def.itens.length;
    app.innerHTML = `
      ${stepperHtml()}
      <div class="stage-context">
        <div class="nome">${esc(pac.nome)}</div>
        <div class="meta">${esc(p.tipo)} · ${esc(p.sala)}
          ${pac.alergias ? ` · <span class="alergia">⚠ Alergias: ${esc(pac.alergias)}</span>` : ''}</div>
        <div class="stage-progress">
          <div class="track"><div class="fill ${completo ? 'complete' : ''}" style="width:${(respondidos / def.itens.length) * 100}%"></div></div>
          <span class="num">${respondidos}/${def.itens.length}</span>
        </div>
      </div>
      <h1>${def.titulo}</h1>
      <p class="sub">${def.subtitulo}. Conduza a verificação em voz alta.</p>
      <div id="itens">
        ${def.itens.map((item) => {
          const r = draft.respostas[item.key];
          const nc = draft.ncs[item.key];
          return `
          <div class="card chk-item ${r ? 'respondido' : ''}" data-item="${item.key}">
            <div class="texto">${esc(item.label)}
              ${item.critico ? '<span class="critico">Item crítico — NC exige justificativa</span>' : ''}
              ${r === 'nc' && nc ? `<span class="nc-tag">NC: ${esc(catLabel(nc.categoria))}${nc.observacao ? ' — ' + esc(nc.observacao) : ''}</span>` : ''}
            </div>
            <div class="chk-opts" role="group" aria-label="Resposta">
              <button class="chk-opt opt-conforme" data-r="conforme" aria-pressed="${r === 'conforme'}"><span class="ic">✓</span>Conforme</button>
              <button class="chk-opt opt-nc" data-r="nc" aria-pressed="${r === 'nc'}"><span class="ic">✕</span>Não conforme</button>
              <button class="chk-opt opt-na" data-r="na" aria-pressed="${r === 'na'}"><span class="ic">—</span>N/A</button>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div style="height:78px"></div>
      <div class="confirm-bar"><div class="inner">
        <a class="btn secondary small" href="#/procedimento/${procId}">Pausar</a>
        <button class="btn" id="btn-confirmar" ${completo ? '' : 'disabled'}>
          ${completo ? `Confirmar ${def.titulo} ✓` : `Faltam ${def.itens.length - respondidos} item(ns)`}
        </button>
      </div></div>`;

    app.querySelectorAll('.chk-item').forEach((card) => {
      const key = card.dataset.item;
      card.querySelectorAll('.chk-opt').forEach((btn) => {
        btn.addEventListener('click', () => {
          const r = btn.dataset.r;
          if (r === 'nc') {
            abrirSheetNC(etapa, key, draft.ncs[key], (nc) => {
              draft.respostas[key] = 'nc';
              draft.ncs[key] = nc;
              salvarDraft(); desenhar(); scrollProximoPendente(key);
            });
          } else {
            draft.respostas[key] = r;
            delete draft.ncs[key];
            salvarDraft(); desenhar(); scrollProximoPendente(key);
          }
        });
      });
    });

    $('#btn-confirmar').addEventListener('click', () => {
      if (confirmando) return; // duplo toque → grava uma única vez
      const pendentes = def.itens.filter((i) => !draft.respostas[i.key]);
      if (pendentes.length) {
        desenhar();
        pendentes.forEach((i) => app.querySelector(`[data-item="${i.key}"]`).classList.add('pendente-erro'));
        scrollProximoPendente(null);
        toast('Responda os itens destacados antes de confirmar.');
        return;
      }
      confirmando = true;
      confirmarEtapa(p, etapa, draft, draftKey);
    });
  };
  desenhar();
});

const NC_ICONES = {
  material_indisponivel: '📦', divergencia_identificacao: '🪪', falha_equipamento: '🔌',
  medicacao: '💊', contagem_divergente: '🔢', outro: '✏️',
};
function abrirSheetNC(etapa, itemKey, atual, onConfirm) {
  const item = WHO_CHECKLIST[etapa].itens.find((i) => i.key === itemKey);
  const obrigatoriaJustificativa = !!item.critico; // contagem no Sign Out (RF-06)
  let categoria = (atual && atual.categoria) || (itemKey === 'contagem' ? 'contagem_divergente' : null);
  abrirSheet(`
    <h2>Não conformidade</h2>
    <p class="sub">${esc(item.label)}</p>
    <div class="cat-grid" id="nc-cats">
      ${NC_CATEGORIAS.map((c) =>
        `<button class="cat-btn" data-cat="${c.key}" aria-pressed="${categoria === c.key}">
          <span class="c-ic" aria-hidden="true">${NC_ICONES[c.key] || '▪'}</span>${c.label}</button>`).join('')}
    </div>
    <label class="field">Observação${obrigatoriaJustificativa ? ' * (obrigatória: divergência de contagem é evento crítico)' : ' (opcional)'}
      <textarea id="nc-obs">${esc(atual ? atual.observacao : '')}</textarea>
    </label>
    <label class="field">Ação tomada (opcional)
      <input id="nc-acao" value="${esc(atual ? atual.acao_tomada : '')}">
    </label>
    <div class="field-error" id="nc-err" role="alert"></div>
    <div class="row">
      <button class="btn" id="nc-ok">Registrar NC</button>
      <button class="btn secondary" id="nc-cancel">Cancelar</button>
    </div>`);
  $('#nc-cats').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-cat]');
    if (!b) return;
    categoria = b.dataset.cat;
    document.querySelectorAll('#nc-cats .cat-btn').forEach((x) => x.setAttribute('aria-pressed', x === b));
  });
  if (obrigatoriaJustificativa) $('#nc-obs').focus();
  $('#nc-cancel').addEventListener('click', fecharSheet);
  $('#nc-ok').addEventListener('click', () => {
    const obs = $('#nc-obs').value.trim();
    if (!categoria) { $('#nc-err').textContent = 'Selecione uma categoria.'; return; }
    if (obrigatoriaJustificativa && !obs) { $('#nc-err').textContent = 'Justificativa obrigatória para divergência de contagem.'; return; }
    fecharSheet();
    onConfirm({ categoria, observacao: obs, acao_tomada: $('#nc-acao').value.trim() });
  });
}

function confirmarEtapa(p, etapa, draft, draftKey) {
  const user = currentUser();
  const agora = new Date().toISOString();
  const stageId = nextId('stg', 'stg');
  const stage = {
    id: stageId, procedure_id: p.id, etapa,
    iniciado_em: draft.iniciado_em, confirmado_em: agora, confirmado_por: user.id,
  };
  marcarSync(stage);
  DB.stages.push(stage);

  WHO_CHECKLIST[etapa].itens.forEach((item) => {
    const itemId = nextId('itm', 'itm');
    DB.stageItems.push({ id: itemId, stage_id: stageId, item_key: item.key, resposta: draft.respostas[item.key] });
    const nc = draft.ncs[item.key];
    if (draft.respostas[item.key] === 'nc' && nc) {
      const ncId = nextId('nc', 'nc');
      DB.ncs.push({
        id: ncId, stage_item_id: itemId, procedure_id: p.id, etapa, item_key: item.key,
        categoria: nc.categoria, observacao: nc.observacao, acao_tomada: nc.acao_tomada,
        registrado_por: user.id, registrado_em: agora,
      });
      audit('registrou_nc', 'nonconformities', ncId, { categoria: nc.categoria, item: item.key });
    }
  });

  p.status = etapa === 'sign_in' ? 'aguardando_time_out' : etapa === 'time_out' ? 'em_cirurgia' : 'concluido';
  saveDB();
  audit('confirmou_etapa', 'checklist_stages', stageId, { etapa, procedimento: p.id });
  localStorage.removeItem(draftKey);
  updateNetIndicator(); sincronizarPendentes();
  const msg = etapa === 'sign_out'
    ? 'Checklist completo — procedimento concluído'
    : navigator.onLine ? `${WHO_CHECKLIST[etapa].titulo} confirmado` : `${WHO_CHECKLIST[etapa].titulo} salvo no aparelho — sincroniza ao reconectar`;
  mostrarSucesso(msg, () => navigate(`/procedimento/${p.id}`));
}

// confirmação visual clara e breve ao fim de cada etapa (peak-end + Doherty)
function mostrarSucesso(msg, depois) {
  const ov = $('#success-overlay');
  ov.querySelector('.success-msg').textContent = msg;
  ov.hidden = false;
  setTimeout(() => { ov.hidden = true; depois(); },
    matchMedia('(prefers-reduced-motion: reduce)').matches ? 350 : 850);
}

/* ---------------- bottom sheet genérico ---------------- */
function abrirSheet(html) {
  $('#bottom-sheet').innerHTML = html;
  $('#bottom-sheet').hidden = false;
  $('#sheet-backdrop').hidden = false;
}
function fecharSheet() {
  $('#bottom-sheet').hidden = true;
  $('#sheet-backdrop').hidden = true;
}
$('#sheet-backdrop').addEventListener('click', fecharSheet);

/* =========================================================
   PACIENTES (RF-02)
   ========================================================= */
route(/^\/pacientes$/, 'enfermeiro', (app) => {
  app.innerHTML = `
    <h1>Pacientes fictícios</h1>
    <p class="sub">Cadastro simplificado para o ambiente de simulação</p>
    <div class="row" style="margin-bottom:12px">
      <input id="busca-pac" class="grow" style="min-height:48px;padding:10px 12px;font-size:1rem;border:1px solid var(--axis);border-radius:10px;background:var(--surface);color:var(--ink)"
        placeholder="Buscar por nome ou identificador…" aria-label="Buscar paciente">
      <a class="btn" href="#/paciente/novo">＋ Cadastrar</a>
    </div>
    <div id="lista-pac"></div>`;
  const desenhar = (filtro) => {
    const f = (filtro || '').toLowerCase();
    const lista = DB.patients.filter((p) =>
      !f || p.nome.toLowerCase().includes(f) || p.identificador.toLowerCase().includes(f));
    $('#lista-pac').innerHTML = lista.length
      ? lista.map((p) => `
        <div class="card">
          <strong>${esc(p.nome)}</strong>
          <div class="sub" style="margin:0">Nascimento: ${fmtData(p.nascimento)} · Identificador: ${esc(p.identificador)} ·
          Alergias: ${esc(p.alergias || 'não declaradas')}</div>
        </div>`).join('')
      : `<div class="card empty-state"><div class="big">🔍</div>Nenhum paciente encontrado.<br><br>
         <a class="btn" href="#/paciente/novo">＋ Cadastrar paciente</a></div>`;
  };
  desenhar('');
  $('#busca-pac').addEventListener('input', (e) => desenhar(e.target.value));
});

route(/^\/paciente\/novo$/, 'enfermeiro', (app) => {
  app.innerHTML = `
    <h1>Cadastrar paciente fictício</h1>
    <div class="card">
      <form id="form-pac" novalidate>
        <label class="field">Nome completo *<input name="nome" required></label>
        <div class="grid-2">
          <label class="field">Data de nascimento *<input type="date" name="nascimento" required></label>
          <label class="field">Identificador interno *<input name="identificador" required placeholder="ex.: SIM-0007"></label>
        </div>
        <label class="field">Alergias declaradas<input name="alergias" placeholder="ex.: Dipirona, látex"></label>
        <div class="field-error" id="pac-error" role="alert"></div>
        <div class="row">
          <button class="btn" type="submit">Salvar</button>
          <a class="btn secondary" href="#/pacientes">Cancelar</a>
        </div>
      </form>
    </div>`;
  $('#form-pac').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const nome = f.nome.value.trim();
    const nasc = f.nascimento.value;
    const ident = f.identificador.value.trim();
    const err = $('#pac-error');
    if (!nome || !nasc || !ident) { err.textContent = 'Preencha os campos obrigatórios.'; return; }
    if (new Date(nasc) > new Date()) { err.textContent = 'Data de nascimento não pode ser futura.'; return; }
    if (DB.patients.some((p) => p.identificador.toLowerCase() === ident.toLowerCase())) {
      err.textContent = 'Identificador já cadastrado.'; return;
    }
    const id = nextId('pac', 'pac');
    DB.patients.push({ id, nome, nascimento: nasc, identificador: ident, alergias: f.alergias.value.trim(), ficticio: true });
    saveDB();
    audit('cadastrou_paciente', 'patients', id, { identificador: ident });
    toast('Paciente cadastrado');
    navigate('/pacientes');
  });
});

/* =========================================================
   PAINEL DE INDICADORES (RF-08) + EXPORT (RF-09)
   ========================================================= */
const filtroPainel = { periodo: '30', sala: '', tipo: '', carater: '' };

function procedimentosFiltrados() {
  const dias = parseInt(filtroPainel.periodo, 10);
  const desde = Date.now() - dias * 24 * 3600 * 1000;
  return DB.procedures.filter((p) => {
    if (new Date(p.data_prevista).getTime() < desde) return false;
    if (filtroPainel.sala && p.sala !== filtroPainel.sala) return false;
    if (filtroPainel.tipo && p.tipo !== filtroPainel.tipo) return false;
    if (filtroPainel.carater && p.carater !== filtroPainel.carater) return false;
    return true;
  });
}

function hbarChart(rows, formatValue) {
  if (!rows.length) return '<div class="empty-state">Sem dados no período.</div>';
  const max = Math.max(...rows.map((r) => r.value), 1);
  return `<div class="hbar-chart">
    ${rows.map((r) => `
      <div class="hbar-label" title="${esc(r.label)}">${esc(r.label)}</div>
      <div class="hbar-track">
        <div class="hbar-bar" style="width:${(r.value / max) * 100}%"></div>
        <span class="hbar-value">${formatValue ? formatValue(r.value) : r.value}</span>
      </div>`).join('')}
  </div>`;
}

route(/^\/painel$/, 'gestor', (app) => {
  const procs = procedimentosFiltrados();
  const validos = procs.filter((p) => p.status !== 'cancelado');
  const ids = new Set(validos.map((p) => p.id));
  const stagesF = DB.stages.filter((s) => ids.has(s.procedure_id) && s.confirmado_em);
  const ncsF = DB.ncs.filter((n) => ids.has(n.procedure_id));

  const completos = validos.filter((p) =>
    ETAPAS_ORDEM.every((e) => stagesF.some((s) => s.procedure_id === p.id && s.etapa === e))).length;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  const etapaStats = ETAPAS_ORDEM.map((e) => ({
    label: WHO_CHECKLIST[e].titulo,
    value: pct(stagesF.filter((s) => s.etapa === e).length, validos.length),
  }));

  const tempoMedio = ETAPAS_ORDEM.map((e) => {
    const ds = stagesF.filter((s) => s.etapa === e && s.iniciado_em)
      .map((s) => (new Date(s.confirmado_em) - new Date(s.iniciado_em)) / 60000);
    return { label: WHO_CHECKLIST[e].titulo, value: ds.length ? +(ds.reduce((a, b) => a + b, 0) / ds.length).toFixed(1) : 0 };
  });

  const porCategoria = NC_CATEGORIAS.map((c) => ({
    label: c.label, value: ncsF.filter((n) => n.categoria === c.key).length,
  })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value);

  const porItem = {};
  ncsF.forEach((n) => {
    const k = `${WHO_CHECKLIST[n.etapa].titulo}: ${itemLabel(n.etapa, n.item_key)}`;
    porItem[k] = (porItem[k] || 0) + 1;
  });
  const rankingItens = Object.entries(porItem).map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value).slice(0, 6);

  const opcoes = (arr, sel) => arr.map((v) => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');

  app.innerHTML = `
    <h1>Painel de indicadores</h1>
    <p class="sub">Cada checklist confirmado alimenta os indicadores automaticamente — zero tabulação manual.</p>
    <div class="card" id="filtros">
      <div class="row" style="justify-content:space-between">
        <div class="seg-control" role="group" aria-label="Período">
          ${['7', '30', '90'].map((d) =>
            `<button data-periodo="${d}" aria-pressed="${filtroPainel.periodo === d}">${d} dias</button>`).join('')}
        </div>
        <div class="row" style="gap:8px">
          <button class="btn secondary small" id="btn-csv">⬇ CSV</button>
          <button class="btn secondary small" id="btn-print">🖨 Relatório</button>
        </div>
      </div>
      <div class="filtro-selects">
        <select data-f="sala" aria-label="Sala"><option value="">Todas as salas</option>${opcoes(DB.salas, filtroPainel.sala)}</select>
        <select data-f="tipo" aria-label="Tipo"><option value="">Todos os tipos</option>${opcoes(DB.tiposProcedimento, filtroPainel.tipo)}</select>
        <select data-f="carater" aria-label="Caráter">
          <option value="">Eletiva + urgência</option>
          <option value="eletiva" ${filtroPainel.carater === 'eletiva' ? 'selected' : ''}>Eletiva</option>
          <option value="urgencia" ${filtroPainel.carater === 'urgencia' ? 'selected' : ''}>Urgência</option>
        </select>
      </div>
    </div>
    ${!procs.length ? `
      <div class="card empty-state viz-root"><div class="big">📭</div>
        <strong>Sem procedimentos no período</strong><br>Ajuste os filtros acima.</div>` : `
    <div class="grid-tiles" style="margin-bottom:12px">
      <div class="card stat-tile viz-root"><div class="valor">${procs.length}</div>
        <div class="rotulo">Procedimentos</div><div class="detalhe">${procs.length - validos.length} cancelado(s)</div></div>
      <div class="card stat-tile viz-root"><div class="valor">${pct(completos, validos.length)}%</div>
        <div class="rotulo">Checklists completos (3/3)</div><div class="detalhe">${completos} de ${validos.length} procedimentos</div></div>
      <div class="card stat-tile viz-root"><div class="valor">${ncsF.length}</div>
        <div class="rotulo">Não conformidades</div><div class="detalhe">no período filtrado</div></div>
      <div class="card stat-tile viz-root"><div class="valor">${stagesF.length}</div>
        <div class="rotulo">Etapas confirmadas</div><div class="detalhe">com timestamp e autor</div></div>
    </div>
    <div class="grid-2">
      <div class="card viz-root"><h2 style="margin-top:0">Completude por etapa</h2>
        ${hbarChart(etapaStats, (v) => v + '%')}</div>
      <div class="card viz-root"><h2 style="margin-top:0">Tempo médio por etapa</h2>
        ${hbarChart(tempoMedio, (v) => v + ' min')}</div>
      <div class="card viz-root"><h2 style="margin-top:0">NCs por categoria</h2>
        ${porCategoria.length ? hbarChart(porCategoria) : '<div class="empty-state">Nenhuma NC no período. 🎉</div>'}</div>
      <div class="card viz-root"><h2 style="margin-top:0">Itens mais não conformes</h2>
        ${rankingItens.length ? hbarChart(rankingItens) : '<div class="empty-state">Nenhuma NC no período. 🎉</div>'}</div>
    </div>`}
  `;

  app.querySelectorAll('#filtros select').forEach((sel) => {
    sel.addEventListener('change', () => { filtroPainel[sel.dataset.f] = sel.value; render(); });
  });
  app.querySelectorAll('#filtros [data-periodo]').forEach((b) => {
    b.addEventListener('click', () => { filtroPainel.periodo = b.dataset.periodo; render(); });
  });
  const btnCsv = $('#btn-csv');
  if (btnCsv) btnCsv.addEventListener('click', exportarCSV);
  const btnPrint = $('#btn-print');
  if (btnPrint) btnPrint.addEventListener('click', () => {
    audit('emitiu_relatorio', 'reports', null, { formato: 'impressao', filtros: { ...filtroPainel } });
    window.print();
  });
});

function exportarCSV() {
  const procs = procedimentosFiltrados();
  const ids = new Set(procs.map((p) => p.id));
  const linhas = [[
    'procedimento_id', 'paciente', 'identificador', 'tipo', 'sala', 'carater', 'status',
    'etapa', 'item_key', 'item', 'resposta', 'nc_categoria', 'nc_observacao', 'nc_acao_tomada',
    'autor', 'iniciado_em', 'confirmado_em',
  ]];
  DB.stages.filter((s) => ids.has(s.procedure_id) && s.confirmado_em).forEach((s) => {
    const p = DB.procedures.find((x) => x.id === s.procedure_id);
    const pac = paciente(p.patient_id);
    DB.stageItems.filter((i) => i.stage_id === s.id).forEach((i) => {
      const nc = DB.ncs.find((n) => n.stage_item_id === i.id);
      linhas.push([
        p.id, pac.nome, pac.identificador, p.tipo, p.sala, p.carater, STATUS_LABELS[p.status],
        s.etapa, i.item_key, itemLabel(s.etapa, i.item_key), i.resposta,
        nc ? nc.categoria : '', nc ? nc.observacao : '', nc ? nc.acao_tomada : '',
        nomeUsuario(s.confirmado_por), s.iniciado_em || '', s.confirmado_em,
      ]);
    });
  });
  const csv = '﻿' + linhas.map((l) =>
    l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cirurgia-segura_export_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  audit('exportou_csv', 'reports', null, { linhas: linhas.length - 1, filtros: { ...filtroPainel } });
  toast(`CSV exportado (${linhas.length - 1} linhas) — evento registrado na auditoria`);
}

/* =========================================================
   AUDITORIA (RF-10)
   ========================================================= */
route(/^\/auditoria$/, 'gestor', (app) => {
  const usuarios = [...new Set(DB.audit.map((a) => a.user_id).filter(Boolean))];
  app.innerHTML = `
    <h1>Trilha de auditoria</h1>
    <p class="sub">Log imutável (append-only): não existe edição nem exclusão de eventos, em nenhuma interface.</p>
    <div class="card row">
      <label class="field" style="margin:0">Usuário
        <select id="aud-user"><option value="">Todos</option>
        ${usuarios.map((u) => `<option value="${u}">${esc(nomeUsuario(u))}</option>`).join('')}</select></label>
      <label class="field" style="margin:0">Ação
        <select id="aud-acao"><option value="">Todas</option>
        ${[...new Set(DB.audit.map((a) => a.acao))].map((a) => `<option>${esc(a)}</option>`).join('')}</select></label>
      <label class="field" style="margin:0">Período
        <select id="aud-dias"><option value="7">7 dias</option><option value="30" selected>30 dias</option><option value="90">90 dias</option></select></label>
    </div>
    <div class="card table-wrap" style="max-height:60dvh;overflow:auto">
      <table class="data">
        <thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>Detalhes</th><th>Dispositivo</th></tr></thead>
        <tbody id="aud-body"></tbody>
      </table>
    </div>`;
  const desenhar = () => {
    const fu = $('#aud-user').value, fa = $('#aud-acao').value;
    const desde = Date.now() - parseInt($('#aud-dias').value, 10) * 24 * 3600 * 1000;
    const rows = DB.audit
      .filter((a) => new Date(a.criado_em).getTime() >= desde)
      .filter((a) => (!fu || a.user_id === fu) && (!fa || a.acao === fa))
      .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
      .slice(0, 300);
    $('#aud-body').innerHTML = rows.length ? rows.map((a) => `
      <tr>
        <td>${fmtDataHora(a.criado_em)}</td>
        <td>${esc(a.user_id ? nomeUsuario(a.user_id) : 'sistema')}</td>
        <td>${esc(a.acao)}</td>
        <td>${esc(a.entidade)}${a.entidade_id ? ' · ' + esc(a.entidade_id) : ''}</td>
        <td>${a.payload ? esc(JSON.stringify(a.payload)) : '—'}</td>
        <td>${esc(a.dispositivo)}</td>
      </tr>`).join('')
      : '<tr><td colspan="6"><div class="empty-state">Nenhum evento no filtro.</div></td></tr>';
  };
  desenhar();
  ['aud-user', 'aud-acao', 'aud-dias'].forEach((id) => $('#' + id).addEventListener('change', desenhar));
});

/* =========================================================
   ADMINISTRAÇÃO (RF-01/RF-09 apoio)
   ========================================================= */
route(/^\/admin$/, 'admin', (app) => {
  app.innerHTML = `
    <h1>Administração</h1>
    <p class="sub">Usuários, salas e tipos de procedimento para o ambiente de simulação</p>

    <h2>Usuários</h2>
    <div class="card table-wrap">
      <table class="data">
        <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${DB.users.map((u) => `<tr>
            <td>${esc(u.nome)}</td><td>${esc(u.email)}</td><td>${esc(u.perfil)}</td>
            <td>${u.ativo ? '<span class="badge st-concluido">ativo</span>' : '<span class="badge st-cancelado">desativado</span>'}</td>
            <td>${u.id !== currentUser().id
              ? `<button class="btn secondary small" data-toggle-user="${u.id}">${u.ativo ? 'Desativar' : 'Reativar'}</button>` : '<em>você</em>'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="card">
      <strong>Novo usuário</strong>
      <form id="form-user" class="row" style="margin-top:10px" novalidate>
        <label class="field grow" style="margin:0">Nome<input name="nome" required></label>
        <label class="field grow" style="margin:0">E-mail<input type="email" name="email" required></label>
        <label class="field" style="margin:0">Perfil
          <select name="perfil"><option value="enfermeiro">Enfermeiro</option><option value="gestor">Gestor</option><option value="admin">Admin</option></select>
        </label>
        <button class="btn small" type="submit">Adicionar</button>
      </form>
      <div class="field-error" id="user-err"></div>
      <div class="credencial-hint" style="margin-top:6px">Senha inicial <code>demo123</code>, PIN <code>1234</code> (protótipo).</div>
    </div>

    <h2>Salas cirúrgicas</h2>
    <div class="card">
      <div class="row" style="margin-bottom:8px">${DB.salas.map((s) => `<span class="badge st-aguardando_sign_in">${esc(s)}</span>`).join(' ')}</div>
      <form id="form-sala" class="row" novalidate>
        <label class="field grow" style="margin:0">Nova sala<input name="sala" placeholder="ex.: Sala 04"></label>
        <button class="btn small" type="submit">Adicionar</button>
      </form>
    </div>

    <h2>Tipos de procedimento</h2>
    <div class="card">
      <div class="row" style="margin-bottom:8px">${DB.tiposProcedimento.map((t) => `<span class="badge st-aguardando_sign_in">${esc(t)}</span>`).join(' ')}</div>
      <form id="form-tipo" class="row" novalidate>
        <label class="field grow" style="margin:0">Novo tipo<input name="tipo" placeholder="ex.: Tireoidectomia"></label>
        <button class="btn small" type="submit">Adicionar</button>
      </form>
    </div>

    <h2>Checklist OMS</h2>
    <div class="card">
      <p class="sub" style="margin:0">Na V1 o checklist OMS é fixo (núcleo imutável — RF-12 fica para a V2).
      Itens institucionais complementares poderão ser criados sem remover itens da lista original.</p>
    </div>

    <h2>Dados de simulação</h2>
    <div class="card row">
      <span class="grow sub" style="margin:0">Restaura o banco fictício ao estado inicial (útil entre sessões de avaliação de usabilidade).</span>
      <button class="btn danger small" id="btn-reset">Restaurar seed</button>
    </div>`;

  app.querySelectorAll('[data-toggle-user]').forEach((b) => {
    b.addEventListener('click', () => {
      const u = DB.users.find((x) => x.id === b.dataset.toggleUser);
      u.ativo = !u.ativo;
      saveDB();
      audit(u.ativo ? 'reativou_usuario' : 'desativou_usuario', 'users', u.id);
      toast(u.ativo ? 'Usuário reativado' : 'Usuário desativado — sessões existentes serão invalidadas');
      render();
    });
  });
  $('#form-user').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const email = f.email.value.trim().toLowerCase();
    if (!f.nome.value.trim() || !email) { $('#user-err').textContent = 'Preencha nome e e-mail.'; return; }
    if (DB.users.some((u) => u.email.toLowerCase() === email)) { $('#user-err').textContent = 'E-mail já cadastrado.'; return; }
    const id = nextId('usr', 'usr');
    DB.users.push({ id, nome: f.nome.value.trim(), email, senha: 'demo123', pin: '1234', perfil: f.perfil.value, ativo: true });
    saveDB();
    audit('criou_usuario', 'users', id, { perfil: f.perfil.value });
    toast('Usuário criado'); render();
  });
  $('#form-sala').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const v = ev.target.sala.value.trim();
    if (v && !DB.salas.includes(v)) { DB.salas.push(v); saveDB(); audit('criou_sala', 'config', null, { sala: v }); render(); }
  });
  $('#form-tipo').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const v = ev.target.tipo.value.trim();
    if (v && !DB.tiposProcedimento.includes(v)) { DB.tiposProcedimento.push(v); saveDB(); audit('criou_tipo', 'config', null, { tipo: v }); render(); }
  });
  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('Restaurar todos os dados fictícios ao estado inicial?')) return;
    const sessao = getSession();
    localStorage.removeItem(DB_KEY);
    Object.keys(localStorage).filter((k) => k.startsWith(DRAFT_KEY)).forEach((k) => localStorage.removeItem(k));
    loadDB();
    setSession(sessao);
    audit('restaurou_seed', 'system', null);
    toast('Dados de simulação restaurados'); render();
  });
});

/* ---------------- Service worker (PWA / RF-11) ---------------- */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

/* ---------------- Boot ---------------- */
loadDB();
updateNetIndicator();
sincronizarPendentes();
render();
