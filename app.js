// ============================================================
//  REQUISIÇÕES DIGITAL — app.js v5.2 (Catálogo Refinado)
//  Grupo Carlos Vaz — CRV/LAS
// ============================================================

var API_URL = 'https://script.google.com/macros/s/AKfycbzXuhmVkTDsMGotRuG3-i-YYnx0_nLFWDWjb7hNsTZ2HUg5SzWKDK6jbad_HqOEsnxt/exec';
var SESSION_KEY = 'cv_requisicoes_sessao';

var sessao = null;
var dadosCompletos = null;
var catalogo = [];
var autoRefreshTimer = null;

// ══════════════════════════════════════════════════════════════
//  INIT & LOGIN
// ══════════════════════════════════════════════════════════════
(function () {
  var s = localStorage.getItem(SESSION_KEY);
  if (s) {
    try {
      sessao = JSON.parse(s);
      if (sessao && sessao.nome) { esconderLogin(); iniciarApp(); return; }
    } catch (e) { }
  }
})();

function toggleSenha() {
  var input = document.getElementById('loginPass');
  var icon = document.getElementById('eyeIcon');
  if (input.type === 'password') { input.type = 'text'; icon.textContent = '🙈'; }
  else { input.type = 'password'; icon.textContent = '👁️'; }
}

async function fazerLogin() {
  var user = document.getElementById('loginUser').value.trim().toUpperCase();
  var pass = document.getElementById('loginPass').value.trim();
  var err = document.getElementById('loginError');
  var btn = document.getElementById('loginBtn');
  var lgpd = document.getElementById('lgpdCheck');

  err.textContent = '';
  if (!user || !pass) { err.textContent = 'Preencha todos os campos'; shakeLogin(); return; }
  if (lgpd && !lgpd.checked) { err.textContent = 'Aceite os termos da LGPD'; shakeLogin(); return; }

  btn.disabled = true; btn.textContent = 'Autenticando...';

  try {
    var senhaHash = await gerarHash(pass);

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ acao: 'login', usuario: user, senha: senhaHash }),
      redirect: 'follow'
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.status === 'ok') {
          sessao = { nome: d.nome, nivel: d.nivel, hash: senhaHash };
          localStorage.setItem(SESSION_KEY, JSON.stringify(sessao));
          esconderLogin(); iniciarApp();
        } else {
          err.textContent = d.msg || 'Credenciais inválidas'; shakeLogin();
        }
      })
      .catch(function () { err.textContent = 'Sem conexão'; shakeLogin(); })
      .finally(function () { btn.disabled = false; btn.textContent = 'Entrar'; });
  } catch (e) {
    err.textContent = 'Erro de segurança'; shakeLogin();
    btn.disabled = false; btn.textContent = 'Entrar';
  }
}

async function gerarHash(texto) {
  var msgBuffer = new TextEncoder().encode(texto);
  var hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  var hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}

function shakeLogin() {
  var c = document.querySelector('.login-card');
  c.classList.add('shake');
  setTimeout(function () { c.classList.remove('shake'); }, 500);
}
function esconderLogin() { document.getElementById('loginScreen').classList.add('hidden'); }

function logout() {
  sessao = null; dadosCompletos = null; catalogo = [];
  localStorage.removeItem(SESSION_KEY);
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  document.getElementById('loginPass').type = 'password';
  document.getElementById('eyeIcon').textContent = '👁️';
  document.getElementById('loginError').textContent = '';
  var lgpd = document.getElementById('lgpdCheck'); if (lgpd) lgpd.checked = false;
}

document.addEventListener('DOMContentLoaded', function () {
  var passField = document.getElementById('loginPass');
  if (passField) passField.addEventListener('keydown', function (e) { if (e.key === 'Enter') fazerLogin(); });
});

// ══════════════════════════════════════════════════════════════
//  CARREGAR DADOS
// ══════════════════════════════════════════════════════════════
function iniciarApp() {
  document.getElementById('ldScreen').classList.remove('hidden');
  document.getElementById('mainApp').style.display = 'block';
  document.getElementById('userBadge').textContent = sessao.nome;
  carregarDados();
  autoRefreshTimer = setInterval(carregarDados, 300000);
}

function carregarDados() {
  if (!dadosCompletos) {
    var grid = document.getElementById('cidadesGrid');
    if (grid && !grid.dataset.skeleton) {
      grid.innerHTML = renderSkeleton(3);
      grid.dataset.skeleton = '1';
    }
  }

  fetch(API_URL + '?senha=GP.Carlos2026&dados=todos')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      document.getElementById('ldScreen').classList.add('hidden');
      var g = document.getElementById('cidadesGrid');
      if (g) delete g.dataset.skeleton;
      dadosCompletos = d;
      renderPainel();
      var hoje = new Date();
      document.getElementById('syncTime').textContent =
        'Sincronizado às ' + String(hoje.getHours()).padStart(2, '0') + ':' +
        String(hoje.getMinutes()).padStart(2, '0');
      setBadge(true);
    })
    .catch(function () {
      document.getElementById('ldScreen').classList.add('hidden');
      toast('Erro de conexão');
      setBadge(false);
    });
}

function renderSkeleton(n) {
  var h = '';
  for (var i = 0; i < n; i++) h += '<div class="skeleton-card"></div>';
  return h;
}

function setBadge(on) {
  var b = document.getElementById('badgeStatus');
  b.textContent = on ? 'Online' : 'Offline';
  b.className = 'badge ' + (on ? 'badge-online' : 'badge-offline');
}

// ══════════════════════════════════════════════════════════════
//  DASHBOARD & RANKINGS
// ══════════════════════════════════════════════════════════════
function renderPainel() {
  if (!dadosCompletos || !dadosCompletos.cidades) return;
  var grid = document.getElementById('cidadesGrid');
  var htmlCards = '';
  var arrayCidades = [];
  var mapSetores = {};

  dadosCompletos.cidades.forEach(function (cid) {
    arrayCidades.push({ nome: cid.nome, total: cid.total, itens: cid.itens });

    htmlCards += '<div class="cidade-card" onclick="abrirCidade(\'' + escapeHtml(cid.nome) + '\')">';
    htmlCards += '<div class="cidade-icon">🏙️</div>';
    htmlCards += '<div class="cidade-info"><div class="cidade-nome">' + escapeHtml(cid.nome) +
                 '</div><div class="cidade-meta">' + cid.setores.length + ' setores · ' + cid.itens + ' itens</div></div>';
    htmlCards += '<div class="cidade-valor">' + formatCurrency(cid.total) + '</div>';
    htmlCards += '</div>';

    cid.setores.forEach(function (setor) {
      if (!mapSetores[setor.nome]) mapSetores[setor.nome] = { nome: setor.nome, total: 0, itens: 0 };
      mapSetores[setor.nome].total += setor.total;
      mapSetores[setor.nome].itens += setor.itens.length;
    });
  });

  grid.innerHTML = htmlCards;
  document.getElementById('statTotal').textContent = formatCurrency(dadosCompletos.totalGeral || 0);
  renderRankings(arrayCidades, mapSetores);
}

function renderRankings(arrayCidades, mapSetores) {
  arrayCidades.sort(function (a, b) { return b.total - a.total; });
  var arraySetores = Object.values(mapSetores).sort(function (a, b) { return b.total - a.total; });
  var maxC = arrayCidades.length && arrayCidades[0].total > 0 ? arrayCidades[0].total : 1;
  var maxS = arraySetores.length && arraySetores[0].total > 0 ? arraySetores[0].total : 1;

  var htmlCid = '';
  arrayCidades.forEach(function (cid, idx) {
    if (cid.total === 0) return;
    var pct = (cid.total / maxC) * 100;
    htmlCid += '<div class="ranking-item"><div class="r-left"><span class="r-pos">' + (idx + 1) +
               '</span><div class="r-info"><span class="r-nome">' + escapeHtml(cid.nome) +
               '</span><span class="r-meta">' + cid.itens + ' itens</span></div></div>' +
               '<div class="r-right"><span class="r-valor">' + formatCurrency(cid.total) +
               '</span><div class="r-bar-bg"><div class="r-bar-fill blue" style="width:' + pct + '%"></div></div></div></div>';
  });
  document.getElementById('rankingCidades').innerHTML = htmlCid ||
    '<div class="empty-state"><div class="empty-text">Sem dados</div></div>';

  var htmlSet = '';
  arraySetores.forEach(function (s, idx) {
    if (s.total === 0) return;
    var pct = (s.total / maxS) * 100;
    htmlSet += '<div class="ranking-item"><div class="r-left"><span class="r-pos">' + (idx + 1) +
               '</span><div class="r-info"><span class="r-nome">' + escapeHtml(s.nome) +
               '</span><span class="r-meta">' + s.itens + ' itens</span></div></div>' +
               '<div class="r-right"><span class="r-valor">' + formatCurrency(s.total) +
               '</span><div class="r-bar-bg"><div class="r-bar-fill purple" style="width:' + pct + '%"></div></div></div></div>';
  });
  document.getElementById('rankingSetores').innerHTML = htmlSet ||
    '<div class="empty-state"><div class="empty-text">Sem dados</div></div>';
}

// ══════════════════════════════════════════════════════════════
//  MODAL CIDADE
// ══════════════════════════════════════════════════════════════
function abrirCidade(nome) {
  var cid = dadosCompletos.cidades.find(function (c) { return c.nome === nome; });
  if (!cid) return;
  document.getElementById('cidadeModalTitle').textContent = '🏙️ ' + cid.nome;

  var h = '<div class="cidade-header"><div class="ch-total">' + formatCurrency(cid.total) +
          '</div><div style="color:var(--text-tertiary);font-size:0.8rem;margin-top:5px;">' +
          cid.itens + ' itens faturados</div></div>';

  if (!cid.setores.length) {
    h += '<div class="empty-state"><div class="empty-text">Nenhuma requisição.</div></div>';
  } else {
    cid.setores.forEach(function (setor) {
      h += '<div class="setor-block"><div class="setor-header"><div class="sh-left">' +
           '<div class="sh-badge ' + getSetorClass(setor.nome) + '">📂</div>' +
           '<div class="sh-nome">' + escapeHtml(setor.nome) + '</div></div>' +
           '<div class="sh-total">' + formatCurrency(setor.total) + '</div></div>' +
           '<div class="setor-items">';
      setor.itens.forEach(function (it) {
        h += '<div class="item-row"><div class="item-id">' + escapeHtml(it.requisicao || '-') +
             '</div><div class="item-desc">' + escapeHtml(it.descricao) +
             ' <span style="color:var(--text-tertiary);font-size:0.7rem;">(x' + it.quantidade + ')</span></div>' +
             '<div class="item-valor">' + formatCurrency(it.total) + '</div></div>';
      });
      h += '</div></div>';
    });
  }

  document.getElementById('cidadeBody').innerHTML = h;
  document.getElementById('cidadeModal').classList.add('show');
}
function fecharCidade() { document.getElementById('cidadeModal').classList.remove('show'); }

// ══════════════════════════════════════════════════════════════
//  CATÁLOGO
// ══════════════════════════════════════════════════════════════
function abrirCatalogo() {
  document.getElementById('catalogoModal').classList.add('show');
  document.getElementById('catalogoBody').innerHTML =
    '<div style="text-align:center;padding:40px 20px;"><div class="ld-spinner" style="margin:0 auto 16px;"></div>' +
    '<div class="empty-text">Carregando catálogo...</div></div>';
  document.getElementById('catalogoSearch').value = '';

  fetch(API_URL + '?senha=GP.Carlos2026&acao=catalogo')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.status !== 'ok') { toast(d.msg || 'Erro ao carregar catálogo'); return; }
      catalogo = d.itens || [];
      renderCatalogo('');
    })
    .catch(function () { toast('Erro de conexão'); });
}

function fecharCatalogo() { document.getElementById('catalogoModal').classList.remove('show'); }

function filtrarCatalogo() {
  var q = document.getElementById('catalogoSearch').value.toLowerCase().trim();
  renderCatalogo(q);
}

function renderCatalogo(filtro) {
  var lista = catalogo;
  if (filtro) {
    lista = catalogo.filter(function (it) {
      return it.descricao.toLowerCase().indexOf(filtro) > -1 ||
             (it.codigo || '').toLowerCase().indexOf(filtro) > -1;
    });
  }

  if (!lista.length) {
    document.getElementById('catalogoBody').innerHTML =
      '<div class="empty-state"><div class="empty-text">' +
      (filtro ? 'Nenhum item para "' + escapeHtml(filtro) + '"' : 'Catálogo vazio') +
      '</div></div>';
    return;
  }

  var h = '<div class="cat-meta">' + lista.length + ' ' +
          (lista.length === 1 ? 'item' : 'itens') +
          ' · toque no preço para editar</div>';

  lista.forEach(function (it) {
    var codigoHtml = it.codigo
      ? '<span class="cat-cod">' + escapeHtml(it.codigo) + '</span>' +
        '<span class="cat-sep">·</span>'
      : '';

    h += '<div class="cat-item">' +
         '<div class="cat-info">' +
         codigoHtml +
         '<span class="cat-desc">' + escapeHtml(it.descricao) + '</span>' +
         '</div>' +
         '<div class="cat-valor-wrap">' +
         '<span class="cat-prefix">R$</span>' +
         '<input type="text" inputmode="decimal" class="cat-input" ' +
         'value="' + formatNum(it.valor) + '" ' +
         'data-linha="' + it.linha + '" ' +
         'data-original="' + it.valor + '" ' +
         'data-desc="' + escapeHtml(it.descricao) + '" ' +
         'onfocus="this.select()" ' +
         'onblur="salvarItemCatalogo(this)">' +
         '</div></div>';
  });

  document.getElementById('catalogoBody').innerHTML = h;
}

function formatNum(v) {
  return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseValorBR(str) {
  var s = String(str || '').trim().replace(/\s/g, '').replace(/R\$/g, '');
  if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
  var n = parseFloat(s);
  return isNaN(n) ? null : n;
}

async function salvarItemCatalogo(input) {
  var linha = parseInt(input.dataset.linha);
  var original = parseFloat(input.dataset.original);
  var desc = input.dataset.desc;
  var novo = parseValorBR(input.value);

  if (novo === null || novo < 0) {
    toast('Valor inválido');
    input.value = formatNum(original);
    return;
  }
  if (Math.abs(novo - original) < 0.001) {
    input.value = formatNum(original);
    return;
  }

  var msg = 'Atualizar "' + desc + '" para R$ ' + formatNum(novo) +
            '?\n\nAtualizar também as requisições já APROVADAS/ENTREGUES/NEGADAS deste mês?\n\n' +
            'OK = sim · Cancelar = só pendentes';
  var atualizarAntigas = confirm(msg);

  input.disabled = true;
  input.style.opacity = '0.5';

  try {
    var resp = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        acao: 'salvarprecoitem',
        usuario: sessao.nome,
        senha: sessao.hash,
        linha: linha,
        valor: novo,
        atualizarAntigas: atualizarAntigas
      }),
      redirect: 'follow'
    });
    var d = await resp.json();

    if (d.status === 'ok') {
      input.dataset.original = novo;
      input.value = formatNum(novo);

      for (var i = 0; i < catalogo.length; i++) {
        if (catalogo[i].linha === linha) { catalogo[i].valor = novo; break; }
      }

      var detail = '';
      if (d.atualizadosPendentes > 0) detail += d.atualizadosPendentes + ' pendente(s)';
      if (d.atualizadosAntigos > 0) detail += (detail ? ' · ' : '') + d.atualizadosAntigos + ' antiga(s)';
      if (!detail) detail = 'Apenas catálogo';

      showSuccess('✅', 'Preço atualizado', detail);

      if (d.atualizadosPendentes > 0 || d.atualizadosAntigos > 0) {
        setTimeout(carregarDados, 1500);
      }
    } else {
      toast(d.msg || 'Erro ao salvar');
      input.value = formatNum(original);
    }
  } catch (e) {
    toast('Erro de conexão');
    input.value = formatNum(original);
  } finally {
    input.disabled = false;
    input.style.opacity = '1';
  }
}

// ══════════════════════════════════════════════════════════════
//  RESUMO WHATSAPP
// ══════════════════════════════════════════════════════════════
function toggleRelatorio() {
  var btn = document.getElementById('switchRelatorio');
  if (btn) { btn.classList.add('on'); setTimeout(function () { btn.classList.remove('on'); }, 1000); }

  if (!dadosCompletos) { toast('Carregue os dados primeiro'); return; }

  var texto = '📋 *ORÇAMENTO DE REQUISIÇÕES*\n';
  var d = new Date();
  texto += '📅 ' + String(d.getDate()).padStart(2, '0') + '/' +
           String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear() + '\n';
  texto += '━━━━━━━━━━━━━━━━━━━━\n\n';

  var total = 0;
  var ord = [].concat(dadosCompletos.cidades).sort(function (a, b) { return b.total - a.total; });
  ord.forEach(function (cid) {
    if (cid.itens > 0) {
      texto += '🏙️ *' + cid.nome.toUpperCase() + '*\n';
      texto += '   💰 ' + formatCurrency(cid.total) + ' (' + cid.itens + ' itens)\n\n';
      total += cid.total;
    }
  });

  texto += '━━━━━━━━━━━━━━━━━━━━\n';
  texto += '📊 *TOTAL GERAL: ' + formatCurrency(total) + '*\n\n';
  texto += '_Requisições Digital — CRV/LAS_';

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(function () {
      showSuccess('✅', 'Resumo Copiado!', 'Cole no WhatsApp');
    }).catch(function () { toast('Erro ao copiar'); });
  } else { toast('Copie manualmente'); }
}

// ══════════════════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════════════════
function getSetorClass(nome) {
  var n = (nome || '').toUpperCase();
  if (n.indexOf('EDUCAÇÃO') > -1) return 'edu';
  if (n.indexOf('SAÚDE') > -1) return 'sau';
  if (n.indexOf('ASSISTÊNCIA') > -1) return 'ass';
  if (n.indexOf('ADMINISTRAÇÃO') > -1) return 'adm';
  if (n.indexOf('INFRAESTRUTURA') > -1) return 'inf';
  return 'adm';
}

function formatCurrency(v) {
  if (typeof v !== 'number' || isNaN(v)) v = 0;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function escapeHtml(str) {
  if (!str && str !== 0) return '';
  return str.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showSuccess(icon, msg, detail) {
  document.getElementById('successIcon').textContent = icon;
  document.getElementById('successMsg').textContent = msg;
  document.getElementById('successDetail').textContent = detail || '';
  var ov = document.getElementById('successOverlay');
  ov.classList.add('show');
  setTimeout(function () { ov.classList.remove('show'); }, 2200);
}

function toast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function () { t.classList.remove('show'); }, 3500);
}
