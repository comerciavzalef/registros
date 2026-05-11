// ============================================================
//  REQUISIÇÕES DIGITAL — app.js v7.0
//  Grupo Carlos Vaz — CRV/LAS
// ============================================================

var API_URL = 'https://script.google.com/macros/s/AKfycbzXuhmVkTDsMGotRuG3-i-YYnx0_nLFWDWjb7hNsTZ2HUg5SzWKDK6jbad_HqOEsnxt/exec';
var SESSION_KEY = 'cv_requisicoes_sessao';

var sessao = null;
var dadosCompletos = null;
var catalogo = [];
var comandosIA = [];
var autoRefreshTimer = null;
var _insidePopstate = false;                                  // ✏️ v6.7 — Tarefa 6
var iaAtualizacaoTemp = null;                                 // ✏️ v6.7 — Tarefa 3

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
  sessao = null; dadosCompletos = null; catalogo = []; comandosIA = [];
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
  fecharMenuLateral();
}

document.addEventListener('DOMContentLoaded', function () {
  var passField = document.getElementById('loginPass');
  if (passField) passField.addEventListener('keydown', function (e) { if (e.key === 'Enter') fazerLogin(); });
});

// ══════════════════════════════════════════════════════════════
//  MENU LATERAL (drawer)
// ══════════════════════════════════════════════════════════════
// ✏️ v6.7 — Tarefa 6 — History API (botão voltar Android)
window.addEventListener('popstate', function () {
  _insidePopstate = true;
  if (document.getElementById('iaModal').classList.contains('show')) fecharAssistenteIA();
  else if (document.getElementById('importarModal').classList.contains('show')) fecharImportar();
  else if (document.getElementById('catalogoModal').classList.contains('show')) fecharCatalogo();
  else if (document.getElementById('cidadeModal').classList.contains('show')) fecharCidade();
  else if (document.getElementById('menuLateral').classList.contains('show')) fecharMenuLateral();
  _insidePopstate = false;
});

function abrirMenuLateral() {
  document.getElementById('menuLateral').classList.add('show');
  document.getElementById('menuOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
  history.pushState({ modal: 'menu' }, '', '');               // ✏️ v6.7 — Tarefa 6
}

function fecharMenuLateral() {
  var el = document.getElementById('menuLateral');
  var ov = document.getElementById('menuOverlay');
  var wasOpen = el && el.classList.contains('show');
  if (el) el.classList.remove('show');
  if (ov) ov.classList.remove('show');
  document.body.style.overflow = '';
  if (wasOpen && !_insidePopstate) history.back();             // ✏️ v6.7 — Tarefa 6
}

function menuAcao(acao) {
  fecharMenuLateral();
  setTimeout(function() {
    if (acao === 'ia') abrirAssistenteIA();
    else if (acao === 'importar') abrirImportar();
    else if (acao === 'catalogo') abrirCatalogo();
    else if (acao === 'logout') logout();
  }, 250);
}

// ══════════════════════════════════════════════════════════════
//  CARREGAR DADOS
// ══════════════════════════════════════════════════════════════
function iniciarApp() {
  document.getElementById('ldScreen').classList.remove('hidden');
  document.getElementById('mainApp').style.display = 'block';
  document.getElementById('userBadge').textContent = sessao.nome;
  document.getElementById('menuUserName').textContent = sessao.nome;
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

  var bar = document.getElementById('ldBarTop');
  bar.style.transition = 'width 2s ease';
  bar.style.width = '70%';

  fetch(API_URL + '?userHash=' + sessao.hash + '&dados=todos')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      bar.style.transition = 'width .3s ease';
      bar.style.width = '100%';
      setTimeout(function() { bar.style.transition = 'width .3s ease, opacity .3s'; bar.style.opacity = '0'; setTimeout(function(){ bar.style.width = '0'; bar.style.opacity = '1'; }, 300); }, 200);

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
      bar.style.width = '0';
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
  history.pushState({ modal: 'cidade' }, '', '');              // ✏️ v6.7 — Tarefa 6
}
function fecharCidade() {
  var wasOpen = document.getElementById('cidadeModal').classList.contains('show');
  document.getElementById('cidadeModal').classList.remove('show');
  if (wasOpen && !_insidePopstate) history.back();             // ✏️ v6.7 — Tarefa 6
}

// ══════════════════════════════════════════════════════════════
//  CATÁLOGO
// ══════════════════════════════════════════════════════════════
function abrirCatalogo() {
  document.body.style.overflow = 'hidden';
  document.getElementById('catalogoModal').classList.add('show');
  history.pushState({ modal: 'catalogo' }, '', '');            // ✏️ v6.7 — Tarefa 6
  document.getElementById('catalogoBody').innerHTML =
    '<div style="text-align:center;padding:40px 20px;"><div class="ld-spinner" style="margin:0 auto 16px;"></div>' +
    '<div class="empty-text">Carregando catálogo...</div></div>';
  document.getElementById('catalogoSearch').value = '';

  fetch(API_URL + '?userHash=' + sessao.hash + '&acao=catalogo')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.status !== 'ok') { toast(d.msg || 'Erro ao carregar catálogo'); return; }
      catalogo = d.itens || [];
      renderCatalogo('');
    })
    .catch(function () { toast('Erro de conexão'); });
}

function fecharCatalogo() {
  var wasOpen = document.getElementById('catalogoModal').classList.contains('show');
  document.body.style.overflow = '';
  document.getElementById('catalogoModal').classList.remove('show');
  if (wasOpen && !_insidePopstate) history.back();             // ✏️ v6.7 — Tarefa 6
}

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
         '<div class="cat-action-wrap">' +
         '<div class="cat-valor-wrap">' +
         '<span class="cat-prefix">R$</span>' +
         '<input type="text" inputmode="decimal" class="cat-input" ' +
         'id="input_cat_' + it.linha + '" ' +
         'value="' + formatNum(it.valor) + '" ' +
         'data-linha="' + it.linha + '" ' +
         'data-original="' + it.valor + '" ' +
         'data-desc="' + escapeHtml(it.descricao) + '" ' +
         'onfocus="this.select()" ' +
         'onkeydown="if(event.key === \'Enter\') dispararSalvar(' + it.linha + ')">' +
         '</div>' +
         '<button class="cat-save-btn" onclick="dispararSalvar(' + it.linha + ')" title="Salvar Preço">✓</button>' +
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

function dispararSalvar(linha) {
  var input = document.getElementById('input_cat_' + linha);
  if (!input) return;

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
    input.blur();
    return;
  }

  var msg = 'Atualizar "' + desc + '" para R$ ' + formatNum(novo) +
            '?\n\nAtualizar também as requisições já APROVADAS/ENTREGUES/NEGADAS deste mês?\n\n' +
            'OK = sim · Cancelar = só pendentes';
  var atualizarAntigas = confirm(msg);

  input.dataset.original = novo;
  input.value = formatNum(novo);
  input.blur();

  var btn = input.parentElement.nextElementSibling;
  if (btn) {
    btn.innerHTML = '⌛';
    btn.disabled = true;
  }

  showSuccess('✅', 'Preço alterado!', 'Sincronizando no fundo...');

  fetch(API_URL, {
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
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (btn) { btn.innerHTML = '✓'; btn.disabled = false; }
    if (d.status === 'ok') {
      for (var i = 0; i < catalogo.length; i++) {
        if (catalogo[i].linha === linha) { catalogo[i].valor = novo; break; }
      }
      if (d.atualizadosPendentes > 0 || d.atualizadosAntigos > 0) {
        carregarDados();
      }
    } else {
      reverterErro(input, original, btn, d.msg || 'Erro ao salvar');
    }
  })
  .catch(function(e) {
    reverterErro(input, original, btn, 'Erro de conexão. Valor revertido.');
  });
}

function reverterErro(input, valorOriginal, btn, msgErro) {
  input.dataset.original = valorOriginal;
  input.value = formatNum(valorOriginal);
  if (btn) { btn.innerHTML = '✓'; btn.disabled = false; }
  toast(msgErro);
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

// ══════════════════════════════════════════════════════════════
//  IMPORTAÇÃO IA — PARSING DE FOTO
// ══════════════════════════════════════════════════════════════
var importacaoTemp = null;

var CIDADES_PADRAO = ['Ibicuí', 'Nova Canaã', 'Boa Nova', 'Dário Meira', 'Floresta Azul'];
var SETORES_PADRAO = ['EDUCAÇÃO', 'SAÚDE', 'ASSISTÊNCIA SOCIAL', 'ADMINISTRAÇÃO', 'INFRAESTRUTURA'];
var LS_CIDADES = 'cv_cidades_custom';
var LS_SETORES = 'cv_setores_custom';

function _carregarLista(key, padrao) {
  var saved = localStorage.getItem(key);
  if (saved) { try { return JSON.parse(saved); } catch(e) {} }
  return padrao.slice();
}
function _salvarLista(key, lista) { localStorage.setItem(key, JSON.stringify(lista)); }

function _popularSelect(id, lista, placeholder) {
  var sel = document.getElementById(id);
  var atual = sel.value;
  sel.innerHTML = '<option value="">' + placeholder + '</option>';
  lista.forEach(function(item) {
    var opt = document.createElement('option');
    opt.value = item; opt.textContent = item;
    sel.appendChild(opt);
  });
  if (atual && lista.indexOf(atual) !== -1) sel.value = atual;
}

function popularSelectsCidadeSetor() {
  var cidades = _carregarLista(LS_CIDADES, CIDADES_PADRAO);
  var setores = _carregarLista(LS_SETORES, SETORES_PADRAO);
  _popularSelect('impCidade', cidades, 'Selecione...');
  _popularSelect('impSetor', setores, 'Selecione...');
}

function adicionarCidade() {
  var nome = prompt('Nome da nova cidade:');
  if (!nome || !nome.trim()) return;
  nome = nome.trim();
  var lista = _carregarLista(LS_CIDADES, CIDADES_PADRAO);
  var existe = lista.some(function(c) { return c.toLowerCase() === nome.toLowerCase(); });
  if (existe) { toast('Cidade já existe'); return; }
  lista.push(nome);
  lista.sort();
  _salvarLista(LS_CIDADES, lista);
  _popularSelect('impCidade', lista, 'Selecione...');
  document.getElementById('impCidade').value = nome;
  toast('Cidade adicionada');
}

function removerCidade() {
  var sel = document.getElementById('impCidade');
  if (!sel.value) { toast('Selecione a cidade para remover'); return; }
  if (!confirm('Remover "' + sel.value + '" da lista?')) return;
  var lista = _carregarLista(LS_CIDADES, CIDADES_PADRAO);
  lista = lista.filter(function(c) { return c !== sel.value; });
  _salvarLista(LS_CIDADES, lista);
  _popularSelect('impCidade', lista, 'Selecione...');
  toast('Cidade removida');
}

function adicionarSetor() {
  var nome = prompt('Nome do novo setor:');
  if (!nome || !nome.trim()) return;
  nome = nome.trim().toUpperCase();
  var lista = _carregarLista(LS_SETORES, SETORES_PADRAO);
  if (lista.indexOf(nome) !== -1) { toast('Setor já existe'); return; }
  lista.push(nome);
  lista.sort();
  _salvarLista(LS_SETORES, lista);
  _popularSelect('impSetor', lista, 'Selecione...');
  document.getElementById('impSetor').value = nome;
  toast('Setor adicionado');
}

function removerSetor() {
  var sel = document.getElementById('impSetor');
  if (!sel.value) { toast('Selecione o setor para remover'); return; }
  if (!confirm('Remover "' + sel.value + '" da lista?')) return;
  var lista = _carregarLista(LS_SETORES, SETORES_PADRAO);
  lista = lista.filter(function(s) { return s !== sel.value; });
  _salvarLista(LS_SETORES, lista);
  _popularSelect('impSetor', lista, 'Selecione...');
  toast('Setor removido');
}

function abrirImportar() {
  document.body.style.overflow = 'hidden';
  document.getElementById('importarModal').classList.add('show');
  history.pushState({ modal: 'importar' }, '', '');            // ✏️ v6.7 — Tarefa 6
  document.getElementById('impStep1').style.display = 'block';
  document.getElementById('impStep2').style.display = 'none';
  document.getElementById('impStep3').style.display = 'none';
  document.getElementById('impTexto').value = '';
  document.getElementById('impArquivo').value = '';
  document.getElementById('impPreview').innerHTML = '';
  var hoje = new Date();
  document.getElementById('impData').value = hoje.getFullYear() + '-' +
    String(hoje.getMonth() + 1).padStart(2, '0') + '-' +
    String(hoje.getDate()).padStart(2, '0');
  document.getElementById('impReqId').value = '';
  importacaoTemp = null;
  popularSelectsCidadeSetor();
}

function fecharImportar() {
  var wasOpen = document.getElementById('importarModal').classList.contains('show');
  document.body.style.overflow = '';
  document.getElementById('importarModal').classList.remove('show');
  if (wasOpen && !_insidePopstate) history.back();             // ✏️ v6.7 — Tarefa 6
}

function comprimirImagem(file, maxSize, callback) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      var width = img.width, height = img.height;
      if (width > height && width > maxSize) { height *= maxSize / width; width = maxSize; }
      else if (height > maxSize) { width *= maxSize / height; height = maxSize; }
      canvas.width = width; canvas.height = height;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL('image/jpeg', 0.65));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function escolherCidadeSetor() {
  var cidade = document.getElementById('impCidade').value;
  var setor = document.getElementById('impSetor').value;
  var reqId = document.getElementById('impReqId').value.trim();
  var dataReq = document.getElementById('impData').value;
  var arquivo = document.getElementById('impArquivo').files[0];
  var texto = document.getElementById('impTexto').value.trim();

  if (!cidade || !setor || !reqId) { toast('Preencha cidade, setor e ID'); return; }
  if (!dataReq) { toast('Informe a data da requisição'); return; }
  if (!arquivo && !texto) { toast('Anexe foto OU cole texto'); return; }

  document.getElementById('impStep1').style.display = 'none';
  document.getElementById('impStep2').style.display = 'block';

  var payload = {
    acao: 'parsearrequisicao',
    usuario: sessao.nome,
    senha: sessao.hash
  };
  if (texto) payload.textoBruto = texto;

  if (arquivo) {
    comprimirImagem(arquivo, 800, function(base64Otimizado) {
      payload.imagemBase64 = base64Otimizado.split(',')[1];
      payload.mimeType = 'image/jpeg';
      enviarParaIA(payload, cidade, setor, reqId, dataReq);
    });
  } else {
    enviarParaIA(payload, cidade, setor, reqId, dataReq);
  }
}

function enviarParaIA(payload, cidade, setor, reqId, dataReq) {
  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow'
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status !== 'ok') { toast(d.msg || 'Erro na IA'); voltarStep1(); return; }
      importacaoTemp = { cidade: cidade, setor: setor, reqId: reqId, data: dataReq, itens: d.resultado.itens, meta: d.resultado };
      renderPreviewImportacao();
    })
    .catch(function(e) { toast('Erro de conexão'); voltarStep1(); });
}

function voltarStep1() {
  document.getElementById('impStep1').style.display = 'block';
  document.getElementById('impStep2').style.display = 'none';
  document.getElementById('impStep3').style.display = 'none';
}

function renderPreviewImportacao() {
  document.getElementById('impStep2').style.display = 'none';
  document.getElementById('impStep3').style.display = 'block';

  var meta = importacaoTemp.meta;
  var itens = importacaoTemp.itens;
  var totalGeral = 0;

  var h = '<div class="imp-meta-box">';
  h += '<div><strong>📍 Cidade:</strong> ' + escapeHtml(importacaoTemp.cidade) + ' / ' + escapeHtml(importacaoTemp.setor) + '</div>';
  h += '<div><strong>🆔 Req ID:</strong> ' + escapeHtml(importacaoTemp.reqId) + '</div>';
  if (importacaoTemp.data) {
    var partes = importacaoTemp.data.split('-');
    h += '<div><strong>📅 Data:</strong> ' + partes[2] + '/' + partes[1] + '/' + partes[0] + '</div>';
  }
  if (meta.cidade_detectada) h += '<div style="color:var(--text-tertiary);font-size:.7rem;margin-top:6px;">IA detectou: ' + escapeHtml(meta.cidade_detectada) + ' / ' + escapeHtml(meta.setor_detectado || '?') + '</div>';
  h += '</div>';

  h += '<div class="imp-legenda"><span class="leg-dot leg-ok"></span>OK <span class="leg-dot leg-novo"></span>Novo <span class="leg-dot leg-div"></span>Divergente <span class="leg-dot leg-baixa"></span>Conferir</div>';

  itens.forEach(function(it, idx) {
    var classe = 'imp-row';
    if (it.confianca === 'BAIXA') classe += ' baixa';
    else if (it.status_catalogo === 'NOVO') classe += ' novo';
    else if (it.status_catalogo === 'DIVERGENTE' || it.status_catalogo === 'MANUAL_PROTEGIDO') classe += ' div';
    else classe += ' ok';

    totalGeral += parseFloat(it.valor_total) || 0;

    h += '<div class="' + classe + '">';
    h += '<div class="imp-row-head"><span class="imp-num">' + (idx + 1) + '</span><input class="imp-desc" value="' + escapeHtml(it.descricao_normalizada || it.descricao) + '" data-idx="' + idx + '" data-campo="descricao_normalizada"></div>';
    h += '<div class="imp-row-grid">';
    h += '<label>Qtd<input type="number" step="0.01" class="imp-input" value="' + it.quantidade + '" data-idx="' + idx + '" data-campo="quantidade"></label>';
    h += '<label>Un<input class="imp-input" value="' + escapeHtml(it.unidade_compra) + '" data-idx="' + idx + '" data-campo="unidade_compra"></label>';
    h += '<label>Por emb<input type="number" step="1" class="imp-input" value="' + (it.qtd_por_embalagem || 1) + '" data-idx="' + idx + '" data-campo="qtd_por_embalagem"></label>';
    h += '<label>Total R$<input type="number" step="0.01" class="imp-input" value="' + it.valor_total + '" data-idx="' + idx + '" data-campo="valor_total" onchange="recalcUnit(' + idx + ')"></label>';
    h += '<label>Unit R$<input type="number" step="0.01" class="imp-input imp-unit" value="' + (it.valor_unitario_calc || 0).toFixed(4) + '" data-idx="' + idx + '" data-campo="valor_unitario_calc" id="impUnit' + idx + '"></label>';
    h += '</div>';

    var statusTxt = '';
    if (it.status_catalogo === 'NOVO') statusTxt = '🆕 Item novo — entrará no catálogo como AUTO';
    else if (it.status_catalogo === 'DIVERGENTE') statusTxt = '⚠️ Catálogo: R$ ' + (it.preco_no_catalogo || 0).toFixed(2) + ' (AUTO) → será atualizado';
    else if (it.status_catalogo === 'MANUAL_PROTEGIDO') statusTxt = '🔒 Catálogo: R$ ' + (it.preco_no_catalogo || 0).toFixed(2) + ' (MANUAL) — protegido';
    else if (it.status_catalogo === 'OK') statusTxt = '✅ Bate com catálogo';
    if (it.confianca === 'BAIXA') statusTxt = '⚠️ CONFIRMAR — ' + (it.observacao || 'IA com baixa confiança');
    h += '<div class="imp-status-msg">' + statusTxt + '</div>';
    h += '<button class="imp-remove" onclick="removerItemImp(' + idx + ')">🗑️ Remover</button>';
    h += '</div>';
  });

  h += '<div class="imp-total-box">💰 Total da Requisição: <strong id="impTotalGeral">R$ ' + totalGeral.toFixed(2).replace('.', ',') + '</strong></div>';
  h += '<div class="imp-actions">';
  h += '<button class="imp-btn-cancel" onclick="voltarStep1()">↩️ Refazer</button>';
  h += '<button class="imp-btn-confirm" onclick="confirmarImportacao()">✅ Confirmar e Lançar</button>';
  h += '</div>';

  document.getElementById('impPreview').innerHTML = h;

  document.querySelectorAll('#impPreview input').forEach(function(inp) {
    inp.addEventListener('input', function() {
      var idx = parseInt(this.dataset.idx);
      var campo = this.dataset.campo;
      var val = this.type === 'number' ? parseFloat(this.value) : this.value;
      importacaoTemp.itens[idx][campo] = val;
    });
  });
}

function recalcUnit(idx) {
  var it = importacaoTemp.itens[idx];
  var qtdEmb = it.qtd_por_embalagem || 1;
  var unit = it.valor_total / (it.quantidade * qtdEmb);
  it.valor_unitario_calc = unit;
  document.getElementById('impUnit' + idx).value = unit.toFixed(4);
  var t = 0;
  importacaoTemp.itens.forEach(function(i) { t += parseFloat(i.valor_total) || 0; });
  document.getElementById('impTotalGeral').textContent = 'R$ ' + t.toFixed(2).replace('.', ',');
}

function removerItemImp(idx) {
  if (!confirm('Remover este item?')) return;
  importacaoTemp.itens.splice(idx, 1);
  renderPreviewImportacao();
}

function confirmarImportacao() {
  if (!importacaoTemp || !importacaoTemp.itens.length) { toast('Sem itens'); return; }
  var btn = document.querySelector('.imp-btn-confirm');
  btn.disabled = true; btn.textContent = '⌛ Lançando...';

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'confirmarimportacao',
      usuario: sessao.nome, senha: sessao.hash,
      cidade: importacaoTemp.cidade,
      setor: importacaoTemp.setor,
      reqId: importacaoTemp.reqId,
      data: importacaoTemp.data,
      itens: importacaoTemp.itens
    }),
    redirect: 'follow'
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status === 'ok') {
        showSuccess('🚀', 'Requisição lançada!', d.itensInseridos + ' itens · R$ ' + d.totalRequisicao.toFixed(2));
        fecharImportar();
        carregarDados();
      } else {
        toast(d.msg || 'Erro ao lançar');
        btn.disabled = false; btn.textContent = '✅ Confirmar e Lançar';
      }
    })
    .catch(function() {
      toast('Erro de conexão');
      btn.disabled = false; btn.textContent = '✅ Confirmar e Lançar';
    });
}

// ══════════════════════════════════════════════════════════════
//  🤖 ASSISTENTE IA
// ══════════════════════════════════════════════════════════════
var iaComandoAtual = null;
var iaPovoamentoTemp = null;

function abrirAssistenteIA() {
  document.body.style.overflow = 'hidden';
  document.getElementById('iaModal').classList.add('show');
  history.pushState({ modal: 'ia' }, '', '');                  // ✏️ v6.7 — Tarefa 6
  document.getElementById('iaStep1').style.display = 'block';
  document.getElementById('iaStep2').style.display = 'none';
  document.getElementById('iaStep3').style.display = 'none';
  document.getElementById('iaParamWrap').style.display = 'none';
  document.getElementById('iaPovoarWrap').style.display = 'none';
  document.getElementById('iaPovoarPreview').style.display = 'none';
  document.getElementById('iaAtualizarWrap').style.display = 'none';    // ✏️ v6.7 — Tarefa 3
  document.getElementById('iaAtualizarPreview').style.display = 'none'; // ✏️ v6.7 — Tarefa 3
  document.getElementById('iaResposta').innerHTML = '';

  if (!comandosIA.length) {
    document.getElementById('iaListaCmds').innerHTML =
      '<div style="text-align:center;padding:40px 20px;"><div class="ld-spinner" style="margin:0 auto 16px;"></div>' +
      '<div class="empty-text">Carregando comandos...</div></div>';

    fetch(API_URL + '?userHash=' + sessao.hash + '&acao=comandos')
      .then(function(r){ return r.json(); })
      .then(function(d){
        if (d.status === 'ok') {
          comandosIA = d.comandos || [];
          renderListaComandos();
        } else {
          document.getElementById('iaListaCmds').innerHTML =
            '<div class="empty-state"><div class="empty-text">Erro ao carregar comandos</div></div>';
        }
      })
      .catch(function(){ toast('Erro de conexão'); });
  } else {
    renderListaComandos();
  }
}

function fecharAssistenteIA() {
  var wasOpen = document.getElementById('iaModal').classList.contains('show');
  document.body.style.overflow = '';
  document.getElementById('iaModal').classList.remove('show');
  if (wasOpen && !_insidePopstate) history.back();             // ✏️ v6.7 — Tarefa 6
}

function renderListaComandos() {
  var h = '<div class="ia-intro">Escolha um comando pré-treinado. Cada um custa entre R$ 0,01 e R$ 0,10 e responde em 3-5 segundos.</div>';
  comandosIA.forEach(function(cmd) {
    h += '<div class="ia-cmd-card" onclick="selecionarComando(\'' + escapeHtml(cmd.comando) + '\')">';
    h += '<div class="ia-cmd-nome">' + escapeHtml(cmd.nome) + '</div>';
    h += '<div class="ia-cmd-desc">' + escapeHtml(cmd.descricao) + '</div>';
    h += '<div class="ia-cmd-meta">💰 ~R$ ' + escapeHtml(cmd.custo) + '</div>';
    h += '</div>';
  });
  document.getElementById('iaListaCmds').innerHTML = h;
}

function selecionarComando(comando) {
  iaComandoAtual = comando;

  // Comando especial: POVOAR_CATALOGO usa fluxo próprio
  if (comando === 'POVOAR_CATALOGO') {
    document.getElementById('iaStep1').style.display = 'none';
    document.getElementById('iaPovoarWrap').style.display = 'block';
    var textarea = document.getElementById('iaPovoarLista');
    textarea.value = '';
    textarea.placeholder = 'Cole uma lista de itens (um por linha)\nOU\nDigite uma categoria: mercearia seca, açougue, laticínios, limpeza, higiene, hortifruti, bebidas, padaria, congelados, descartáveis, papelaria';
    setTimeout(function(){ textarea.focus(); }, 100);
    return;
  }

  // ✏️ v6.7 — Tarefa 3 — Comando especial: ATUALIZAR_PRECOS_LISTA
  if (comando === 'ATUALIZAR_PRECOS_LISTA') {
    document.getElementById('iaStep1').style.display = 'none';
    document.getElementById('iaAtualizarWrap').style.display = 'block';
    document.getElementById('iaAtualizarLista').value = '';
    setTimeout(function(){ document.getElementById('iaAtualizarLista').focus(); }, 100);
    return;
  }

  var precisaParam = ['ANALISE_SETOR', 'SUGERIR_PRECO_ITEM', 'BUSCAR_ITEM_CATALOGO'].indexOf(comando) !== -1;

  if (precisaParam) {
    var label = '', placeholder = '';
    if (comando === 'ANALISE_SETOR') {
      label = '🏢 Qual setor analisar?';
      placeholder = 'Ex: EDUCAÇÃO';
    } else if (comando === 'SUGERIR_PRECO_ITEM') {
      label = '💡 Qual item você quer estimar?';
      placeholder = 'Ex: Creme de leite 200g';
    } else if (comando === 'BUSCAR_ITEM_CATALOGO') {
      label = '🔍 Sua pergunta';
      placeholder = 'Ex: Quanto custa creme de leite?';
    }
    document.getElementById('iaParamLabel').textContent = label;
    document.getElementById('iaParamInput').placeholder = placeholder;
    document.getElementById('iaParamInput').value = '';
    document.getElementById('iaParamWrap').style.display = 'block';
    document.getElementById('iaStep1').style.display = 'none';
    setTimeout(function(){ document.getElementById('iaParamInput').focus(); }, 100);
  } else {
    executarIA(comando, '');
  }
}

function confirmarParametro() {
  var valor = document.getElementById('iaParamInput').value.trim();
  if (!valor) { toast('Preencha o campo'); return; }
  document.getElementById('iaParamWrap').style.display = 'none';
  executarIA(iaComandoAtual, valor);
}

function voltarListaComandos() {
  document.getElementById('iaParamWrap').style.display = 'none';
  document.getElementById('iaPovoarWrap').style.display = 'none';
  document.getElementById('iaPovoarPreview').style.display = 'none';
  document.getElementById('iaAtualizarWrap').style.display = 'none';   // ✏️ v6.7 — Tarefa 3
  document.getElementById('iaAtualizarPreview').style.display = 'none'; // ✏️ v6.7 — Tarefa 3
  document.getElementById('iaStep2').style.display = 'none';
  document.getElementById('iaStep3').style.display = 'none';
  document.getElementById('iaStep1').style.display = 'block';
  iaPovoamentoTemp = null;
  iaAtualizacaoTemp = null;                                            // ✏️ v6.7 — Tarefa 3
}

function executarIA(comando, parametro) {
  document.getElementById('iaStep1').style.display = 'none';
  document.getElementById('iaParamWrap').style.display = 'none';
  document.getElementById('iaStep2').style.display = 'block';

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'comandoia',
      usuario: sessao.nome,
      senha: sessao.hash,
      comando: comando,
      parametro: parametro
    }),
    redirect: 'follow'
  })
    .then(function(r){ return r.json(); })
    .then(function(d){
      document.getElementById('iaStep2').style.display = 'none';
      document.getElementById('iaStep3').style.display = 'block';

      if (d.status === 'ok') {
        var resp = (d.resposta || '').toString();
        var custoTxt = '';
        if (d.fromCache) {
          custoTxt = '⚡ Resposta de cache (R$ 0,00)';
        } else {
          var custoUsd = (d.tokensIn * 0.30 / 1000000) + (d.tokensOut * 2.50 / 1000000);
          var custoBrl = (custoUsd * 5.30).toFixed(4);
          custoTxt = '💰 Custo: R$ ' + custoBrl + ' · ' + (d.tokensIn + d.tokensOut) + ' tokens';
        }

        var h = '<div class="ia-resp-header">' +
                '<div class="ia-resp-cmd">' + escapeHtml(comando) + '</div>' +
                '<div class="ia-resp-custo">' + custoTxt + '</div>' +
                '</div>';
        h += '<div class="ia-resp-texto" id="iaRespTexto">' + formatarRespostaIA(resp) + '</div>';
        h += '<div class="ia-resp-actions">';
        h += '<button class="imp-btn-cancel" onclick="voltarListaComandos()">↩️ Outro Comando</button>';
        h += '<button class="imp-btn-confirm" onclick="copiarRespostaIA()">📋 Copiar para WhatsApp</button>';
        h += '</div>';
        document.getElementById('iaResposta').innerHTML = h;
      } else {
        var hErr = '<div class="ia-resp-header"><div class="ia-resp-cmd">❌ Erro</div></div>';
        hErr += '<div class="ia-resp-texto" style="color:var(--red);">' + escapeHtml(d.msg || 'Erro desconhecido') + '</div>';
        hErr += '<div class="ia-resp-actions"><button class="imp-btn-cancel" onclick="voltarListaComandos()">↩️ Voltar</button></div>';
        document.getElementById('iaResposta').innerHTML = hErr;
      }
    })
    .catch(function(){
      document.getElementById('iaStep2').style.display = 'none';
      document.getElementById('iaStep3').style.display = 'block';
      document.getElementById('iaResposta').innerHTML =
        '<div class="ia-resp-header"><div class="ia-resp-cmd">❌ Erro de conexão</div></div>' +
        '<div class="ia-resp-actions"><button class="imp-btn-cancel" onclick="voltarListaComandos()">↩️ Voltar</button></div>';
    });
}

// ✏️ v6.7 — Tarefa 4 — formatação com blocos de código
function formatarRespostaIA(texto) {
  var partes = texto.split(/(```[\s\S]*?```)/g);
  var html = '';
  partes.forEach(function(parte) {
    if (parte.indexOf('```') === 0) {
      var code = parte.replace(/^```\w*\n?/, '').replace(/```$/, '');
      html += '<pre class="ia-code-block"><code>' + escapeHtml(code) + '</code></pre>';
    } else {
      var safe = escapeHtml(parte);
      safe = safe.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
      safe = safe.replace(/\n/g, '<br>');
      html += safe;
    }
  });
  return html;
}

// ✏️ v6.7 — Tarefa 5 — cópia inteligente para WhatsApp
function copiarRespostaIA() {
  var el = document.getElementById('iaRespTexto');
  if (!el) return;
  var texto = (el.innerText || el.textContent || '').replace(/^```\w*$/gm, '').trim();
  try {
    var obj = JSON.parse(texto);
    texto = _formatarJsonParaTexto(obj);
  } catch (e) {}
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(function(){
      showSuccess('✅', 'Copiado!', 'Cole no WhatsApp');
    }).catch(function(){ toast('Erro ao copiar'); });
  } else {
    toast('Copie manualmente');
  }
}

function _formatarJsonParaTexto(obj) {
  if (Array.isArray(obj)) {
    return obj.map(function(item, i) { return _formatarItemTexto(item, i + 1); }).join('\n');
  }
  if (typeof obj === 'object' && obj !== null) {
    var linhas = [];
    Object.keys(obj).forEach(function(k) {
      var v = obj[k];
      if (Array.isArray(v)) {
        linhas.push('*' + k + '*');
        v.forEach(function(item, i) { linhas.push(_formatarItemTexto(item, i + 1)); });
      } else {
        linhas.push('*' + k + ':* ' + v);
      }
    });
    return linhas.join('\n');
  }
  return String(obj);
}

function _formatarItemTexto(item, num) {
  if (typeof item === 'string') return num + '. ' + item;
  if (typeof item === 'object' && item !== null) {
    var parts = [];
    Object.keys(item).forEach(function(k) { parts.push(k + ': ' + item[k]); });
    return num + '. ' + parts.join(' · ');
  }
  return num + '. ' + String(item);
}

// ══════════════════════════════════════════════════════════════
//  🆕 POVOAR CATÁLOGO (fluxo especial — aceita lista OU categoria)
// ══════════════════════════════════════════════════════════════
function processarPovoamento() {
  var lista = document.getElementById('iaPovoarLista').value.trim();
  if (!lista || lista.length < 3) { toast('Digite uma lista ou categoria'); return; }

  var linhas = lista.split('\n').map(function(l){return l.trim();}).filter(function(l){return l.length > 1;});

  if (linhas.length > 60) {
    toast('Máximo 60 itens por lote. Você tem ' + linhas.length + ' — divida em partes.');
    return;
  }

  document.getElementById('iaPovoarWrap').style.display = 'none';
  document.getElementById('iaStep2').style.display = 'block';

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'comandoia',
      usuario: sessao.nome,
      senha: sessao.hash,
      comando: 'POVOAR_CATALOGO',
      parametro: lista
    }),
    redirect: 'follow'
  })
    .then(function(r){ return r.json(); })
    .then(function(d){
      document.getElementById('iaStep2').style.display = 'none';
      if (d.status !== 'ok') {
        toast(d.msg || 'Erro na IA');
        voltarListaComandos();
        return;
      }
      iaPovoamentoTemp = d;
      renderPreviewPovoamento();
    })
    .catch(function(){
      toast('Erro de conexão');
      voltarListaComandos();
    });
}

function renderPreviewPovoamento() {
  document.getElementById('iaPovoarPreview').style.display = 'block';

  var d = iaPovoamentoTemp;
  var custoUsd = (d.tokensIn * 0.30 / 1000000) + (d.tokensOut * 2.50 / 1000000);
  var custoBrl = (custoUsd * 5.30).toFixed(4);

  var h = '<div class="ia-resp-header">';
  h += '<div class="ia-resp-cmd">🆕 POVOAR_CATALOGO</div>';
  h += '<div class="ia-resp-custo">💰 R$ ' + custoBrl + ' · ' + d.total_processados + ' itens processados</div>';
  h += '</div>';

  h += '<div class="pov-resumo">';
  h += '<div class="pov-stat"><div class="pov-stat-num">' + d.total_processados + '</div><div class="pov-stat-lbl">Total IA</div></div>';
  h += '<div class="pov-stat novo"><div class="pov-stat-num">' + d.novos + '</div><div class="pov-stat-lbl">Novos</div></div>';
  h += '<div class="pov-stat ja"><div class="pov-stat-num">' + d.ja_existentes + '</div><div class="pov-stat-lbl">Já existem</div></div>';
  h += '</div>';

  h += '<div class="pov-aviso">📝 Edite os preços antes de confirmar. Itens marcados como "já existe" serão ignorados (não sobrescreve catálogo manual).</div>';

  d.itens.forEach(function(it, idx) {
    var classe = 'pov-row';
    if (it.ja_existe) classe += ' ja-existe';
    else if (it.confianca === 'ALTA') classe += ' alta';
    else if (it.confianca === 'MEDIA') classe += ' media';
    else classe += ' baixa';

    h += '<div class="' + classe + '">';
    h += '<div class="pov-row-head">';
    h += '<input type="checkbox" class="pov-check" data-idx="' + idx + '" ' + (it.ja_existe ? '' : 'checked') + ' ' + (it.ja_existe ? 'disabled' : '') + '>';
    h += '<input class="pov-desc" value="' + escapeHtml(it.descricao_normalizada || it.descricao_original || '') + '" data-idx="' + idx + '" data-campo="descricao_normalizada">';
    h += '<button class="pov-remove-btn" onclick="removerItemPovoamento(' + idx + ')">🗑️</button>'; // ✏️ v6.7 — Tarefa 7
    h += '</div>';
    h += '<div class="pov-row-grid">';
    h += '<label>Unidade<input class="pov-input" value="' + escapeHtml(it.unidade_padrao || 'UN') + '" data-idx="' + idx + '" data-campo="unidade_padrao"></label>';
    h += '<label>Qtd/Emb<input type="number" step="1" class="pov-input" value="' + (it.qtd_por_embalagem || 1) + '" data-idx="' + idx + '" data-campo="qtd_por_embalagem"></label>';
    h += '<label>Preço R$<input type="number" step="0.01" class="pov-input pov-preco" value="' + (it.preco_estimado || 0).toFixed(2) + '" data-idx="' + idx + '" data-campo="preco_estimado"></label>';
    h += '</div>';

    var statusTxt = '';
    if (it.ja_existe) statusTxt = '🔒 Já existe no catálogo — ignorado';
    else if (it.confianca === 'ALTA') statusTxt = '✅ Confiança ALTA · ' + (it.observacao || 'Item comum');
    else if (it.confianca === 'MEDIA') statusTxt = '⚠️ Confiança MÉDIA · ' + (it.observacao || 'Confira o preço');
    else statusTxt = '🔴 Confiança BAIXA · ' + (it.observacao || 'Item incomum, valide o preço');
    h += '<div class="pov-status">' + statusTxt + '</div>';
    h += '</div>';
  });

  h += '<div class="ia-resp-actions">';
  h += '<button class="imp-btn-cancel" onclick="voltarListaComandos()">↩️ Cancelar</button>';
  h += '<button class="imp-btn-confirm" onclick="confirmarPovoamento()">✅ Adicionar ao Catálogo</button>';
  h += '</div>';

  document.getElementById('iaPovoarPreview').innerHTML = h;

  document.querySelectorAll('#iaPovoarPreview input').forEach(function(inp) {
    inp.addEventListener('input', function() {
      if (this.classList.contains('pov-check')) return;
      var idx = parseInt(this.dataset.idx);
      var campo = this.dataset.campo;
      var val = this.type === 'number' ? parseFloat(this.value) : this.value;
      iaPovoamentoTemp.itens[idx][campo] = val;
    });
  });
}

function confirmarPovoamento() {
  if (!iaPovoamentoTemp) return;

  var itensSelecionados = [];
  document.querySelectorAll('#iaPovoarPreview .pov-check').forEach(function(chk) {
    if (chk.checked && !chk.disabled) {
      var idx = parseInt(chk.dataset.idx);
      itensSelecionados.push(iaPovoamentoTemp.itens[idx]);
    }
  });

  if (!itensSelecionados.length) {
    toast('Marque pelo menos 1 item para adicionar');
    return;
  }

  var btn = document.querySelector('#iaPovoarPreview .imp-btn-confirm');
  btn.disabled = true; btn.textContent = '⌛ Adicionando...';

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'confirmarpovoamento',
      usuario: sessao.nome,
      senha: sessao.hash,
      itens: itensSelecionados
    }),
    redirect: 'follow'
  })
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (d.status === 'ok') {
        showSuccess('🎉', 'Catálogo atualizado!', d.inseridos + ' itens adicionados · ' + d.ignorados + ' ignorados');
        fecharAssistenteIA();
      } else {
        toast(d.msg || 'Erro ao adicionar');
        btn.disabled = false; btn.textContent = '✅ Adicionar ao Catálogo';
      }
    })
    .catch(function(){
      toast('Erro de conexão');
      btn.disabled = false; btn.textContent = '✅ Adicionar ao Catálogo';
    });
}

// ✏️ v6.7 — Tarefa 7 — remover item individual do povoamento
function removerItemPovoamento(idx) {
  if (!iaPovoamentoTemp || !iaPovoamentoTemp.itens) return;
  if (!confirm('Remover este item?')) return;
  iaPovoamentoTemp.itens.splice(idx, 1);
  iaPovoamentoTemp.total_processados = iaPovoamentoTemp.itens.length;
  iaPovoamentoTemp.novos = iaPovoamentoTemp.itens.filter(function(i) { return !i.ja_existe; }).length;
  iaPovoamentoTemp.ja_existentes = iaPovoamentoTemp.itens.filter(function(i) { return i.ja_existe; }).length;
  renderPreviewPovoamento();
}

// ══════════════════════════════════════════════════════════════
//  ✏️ v6.7 — Tarefa 3 — ATUALIZAR PREÇOS LISTA (IA)
// ══════════════════════════════════════════════════════════════
function processarAtualizacaoPrecos() {
  var lista = document.getElementById('iaAtualizarLista').value.trim();
  if (!lista || lista.length < 3) { toast('Cole a lista de preços'); return; }

  document.getElementById('iaAtualizarWrap').style.display = 'none';
  document.getElementById('iaStep2').style.display = 'block';

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'comandoia',
      usuario: sessao.nome,
      senha: sessao.hash,
      comando: 'ATUALIZAR_PRECOS_LISTA',
      parametro: lista
    }),
    redirect: 'follow'
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      document.getElementById('iaStep2').style.display = 'none';
      if (d.status !== 'ok') { toast(d.msg || 'Erro na IA'); voltarListaComandos(); return; }
      iaAtualizacaoTemp = d;
      renderPreviewAtualizacao();
    })
    .catch(function() { toast('Erro de conexão'); voltarListaComandos(); });
}

function renderPreviewAtualizacao() {
  document.getElementById('iaAtualizarPreview').style.display = 'block';

  var d = iaAtualizacaoTemp;
  var custoUsd = (d.tokensIn * 0.30 / 1000000) + (d.tokensOut * 2.50 / 1000000);
  var custoBrl = (custoUsd * 5.30).toFixed(4);

  var h = '<div class="ia-resp-header">';
  h += '<div class="ia-resp-cmd">📋 ATUALIZAR_PRECOS_LISTA</div>';
  h += '<div class="ia-resp-custo">💰 R$ ' + custoBrl + ' · ' + (d.itens || []).length + ' itens</div>';
  h += '</div>';

  (d.itens || []).forEach(function(it, idx) {
    var classe = it.encontrado ? 'pov-row alta' : 'pov-row baixa';
    h += '<div class="' + classe + '">';
    h += '<div class="pov-row-head">';
    h += '<input type="checkbox" class="pov-check" data-idx="' + idx + '" ' + (it.encontrado ? 'checked' : '') + '>';
    h += '<span class="pov-desc" style="flex:1;padding:6px 10px;">' + escapeHtml(it.descricao || '') + '</span>';
    h += '</div>';
    h += '<div class="pov-row-grid">';
    h += '<label>Atual R$<input class="pov-input" value="' + (it.preco_atual || 0).toFixed(2) + '" readonly></label>';
    h += '<label>Novo R$<input type="number" step="0.01" class="pov-input pov-preco" value="' + (it.preco_novo || 0).toFixed(2) + '" data-idx="' + idx + '" data-campo="preco_novo"></label>';
    h += '</div>';
    var status = it.encontrado ? '✅ Encontrado no catálogo' : '⚠️ Não encontrado — será ignorado';
    h += '<div class="pov-status">' + status + '</div>';
    h += '</div>';
  });

  h += '<div class="ia-resp-actions">';
  h += '<button class="imp-btn-cancel" onclick="voltarListaComandos()">↩️ Cancelar</button>';
  h += '<button class="imp-btn-confirm" onclick="confirmarAtualizacaoPrecosFront()">✅ Atualizar Preços</button>';
  h += '</div>';

  document.getElementById('iaAtualizarPreview').innerHTML = h;

  document.querySelectorAll('#iaAtualizarPreview input[data-campo]').forEach(function(inp) {
    inp.addEventListener('input', function() {
      var idx = parseInt(this.dataset.idx);
      iaAtualizacaoTemp.itens[idx][this.dataset.campo] = parseFloat(this.value) || 0;
    });
  });
}

function confirmarAtualizacaoPrecosFront() {
  if (!iaAtualizacaoTemp) return;

  var selecionados = [];
  document.querySelectorAll('#iaAtualizarPreview .pov-check').forEach(function(chk) {
    if (chk.checked) {
      var idx = parseInt(chk.dataset.idx);
      selecionados.push(iaAtualizacaoTemp.itens[idx]);
    }
  });

  if (!selecionados.length) { toast('Marque pelo menos 1 item'); return; }

  var btn = document.querySelector('#iaAtualizarPreview .imp-btn-confirm');
  btn.disabled = true; btn.textContent = '⌛ Atualizando...';

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'confirmaratualizacaoprecos',
      usuario: sessao.nome,
      senha: sessao.hash,
      itens: selecionados
    }),
    redirect: 'follow'
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status === 'ok') {
        showSuccess('🎉', 'Preços atualizados!', d.atualizados + ' itens');
        fecharAssistenteIA();
        carregarDados();
      } else {
        toast(d.msg || 'Erro');
        btn.disabled = false; btn.textContent = '✅ Atualizar Preços';
      }
    })
    .catch(function() {
      toast('Erro de conexão');
      btn.disabled = false; btn.textContent = '✅ Atualizar Preços';
    });
}
