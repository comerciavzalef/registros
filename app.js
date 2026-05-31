// ============================================================
//  REQUISIÇÕES DIGITAL — app.js v8.6.9 PREMIUM
//  Grupo Carlos Vaz — CRV/LAS
//  v8.6: Preço de Custo setor a setor + dedup + thinking OFF
// ============================================================

var API_URL = 'https://script.google.com/macros/s/AKfycbzXuhmVkTDsMGotRuG3-i-YYnx0_nLFWDWjb7hNsTZ2HUg5SzWKDK6jbad_HqOEsnxt/exec';
var SESSION_KEY = 'cv_requisicoes_sessao';

var sessao = null;
var dadosCompletos = null;
var catalogo = [];
var comandosIA = [];
var autoRefreshTimer = null;
var _insidePopstate = false;
var iaAtualizacaoTemp = null;

// ── v8.6: Preço de Custo (setor a setor) ──
var precoCustoSetores       = [];
var precoCustoJaProcessados = {};
var precoCustoResultados    = [];
var precoCustoSetorAtual    = 0;
var precoCustoPesquisando   = false;
var precoCustoTotalCusto    = 0;

// ══════════════════════════════════════════════════════════════
//  INIT & LOGIN
// ══════════════════════════════════════════════════════════════
var APP_VERSION = '8.6.9';
(function () {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(function(reg) {
      reg.update();
      reg.addEventListener('updatefound', function() {
        var newSW = reg.installing;
        if (newSW) {
          newSW.addEventListener('statechange', function() {
            if (newSW.state === 'activated') {
              if (localStorage.getItem('cv_app_version') !== APP_VERSION) {
                localStorage.setItem('cv_app_version', APP_VERSION);
                window.location.reload();
              }
            }
          });
        }
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      if (localStorage.getItem('cv_app_version') !== APP_VERSION) {
        localStorage.setItem('cv_app_version', APP_VERSION);
        window.location.reload();
      }
    });
  }

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
  if (input.type === 'password') {
    input.type = 'text';
    icon.innerHTML = '<use href="#icon-eye-off"/>';
  } else {
    input.type = 'password';
    icon.innerHTML = '<use href="#icon-eye"/>';
  }
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
  document.getElementById('eyeIcon').innerHTML = '<use href="#icon-eye"/>';
  document.getElementById('loginError').textContent = '';
  var lgpd = document.getElementById('lgpdCheck'); if (lgpd) lgpd.checked = false;
  fecharMenuLateral();
}

document.addEventListener('DOMContentLoaded', function () {
  var passField = document.getElementById('loginPass');
  if (passField) passField.addEventListener('keydown', function (e) { if (e.key === 'Enter') fazerLogin(); });
});

// ══════════════════════════════════════════════════════════════
//  MENU LATERAL
// ══════════════════════════════════════════════════════════════
window.addEventListener('popstate', function () {
  _insidePopstate = true;
  if (document.getElementById('editReqModal').classList.contains('show')) fecharEditReq();
  else if (document.getElementById('iaModal').classList.contains('show')) fecharAssistenteIA();
  else if (document.getElementById('importarModal').classList.contains('show')) fecharImportar();
  else if (document.getElementById('catalogoCustoModal').classList.contains('show')) fecharCatalogoCusto();
  else if (document.getElementById('catalogoModal').classList.contains('show')) fecharCatalogo();
  else if (document.getElementById('cidadeModal').classList.contains('show')) fecharCidade();
  else if (document.getElementById('menuLateral').classList.contains('show')) fecharMenuLateral();
  _insidePopstate = false;
});

function abrirMenuLateral() {
  document.getElementById('menuLateral').classList.add('show');
  document.getElementById('menuOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
  history.pushState({ modal: 'menu' }, '', '');
}

function fecharMenuLateral() {
  var el = document.getElementById('menuLateral');
  var ov = document.getElementById('menuOverlay');
  var wasOpen = el && el.classList.contains('show');
  if (el) el.classList.remove('show');
  if (ov) ov.classList.remove('show');
  document.body.style.overflow = '';
  if (wasOpen && !_insidePopstate) history.back();
}

function menuAcao(acao) {
  fecharMenuLateral();
  setTimeout(function() {
    if (acao === 'ia') abrirAssistenteIA();
    else if (acao === 'importar') abrirImportar();
    else if (acao === 'catalogo') abrirCatalogo();
    else if (acao === 'catalogoCusto') abrirCatalogoCusto();
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
    htmlCards += '<div class="cidade-icon"><svg width="18" height="18"><use href="#icon-building"/></svg></div>';
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
  document.getElementById('cidadeModalTitle').textContent = cid.nome;

  var h = '<div class="cidade-header"><div class="ch-total">' + formatCurrency(cid.total) +
          '</div><div style="color:var(--text-tertiary);font-size:0.8rem;margin-top:5px;">' +
          cid.itens + ' itens faturados</div></div>';

  if (cid.setores.length) {
    h += '<div style="display:flex;justify-content:center;margin:10px 0 18px;">';
    h += '<button onclick="imprimirTodasRequisicoes(\'' + escapeHtml(cid.nome) + '\')" ' +
         'style="background:linear-gradient(135deg,#1e3a5f,#2c5282);color:#fff;border:none;border-radius:10px;' +
         'padding:11px 20px;font-size:.82rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:8px;' +
         'box-shadow:0 4px 14px rgba(30,58,95,0.35);font-family:var(--font);">' +
         '🖨️ Imprimir Todas as Requisições</button>';
    h += '</div>';
  }

  if (!cid.setores.length) {
    h += '<div class="empty-state"><div class="empty-text">Nenhuma requisição.</div></div>';
  } else {
    cid.setores.forEach(function (setor) {
      var reqMap = {};
      setor.itens.forEach(function (it) {
        var rid = it.requisicao || '-';
        if (!reqMap[rid]) reqMap[rid] = { itens: [], total: 0, observacao: '', data: '' };
        reqMap[rid].itens.push(it);
        reqMap[rid].total += it.total;
        if (it.observacao && !reqMap[rid].observacao) reqMap[rid].observacao = it.observacao;
        if (it.data && !reqMap[rid].data) reqMap[rid].data = it.data;
      });

      h += '<div class="setor-block"><div class="setor-header"><div class="sh-left">' +
           '<div class="sh-badge ' + getSetorClass(setor.nome) + '">&#128194;</div>' +
           '<div class="sh-nome">' + escapeHtml(setor.nome) + '</div></div>' +
           '<div style="display:flex;align-items:center;gap:8px;">' +
           '<button onclick="event.stopPropagation();imprimirPorSetor(\'' + escapeHtml(cid.nome) + '\',\'' + escapeHtml(setor.nome) + '\')" ' +
           'style="background:linear-gradient(135deg,#1e3a5f,#2c5282);color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:.72rem;font-weight:600;cursor:pointer;font-family:var(--font);white-space:nowrap;" title="Imprimir setor">🖨️</button>' +
           '<div class="sh-total">' + formatCurrency(setor.total) + '</div>' +
           '</div></div>' +
           '<div class="setor-items">';

      Object.keys(reqMap).forEach(function (rid) {
        var grp = reqMap[rid];

        h += '<div class="req-group-block">';
        h += '<div class="req-group-header-pro">';

        h += '<div class="rgh-top">';
        h += '<div class="rgh-top-left" onclick="editarRequisicao(\'' + escapeHtml(cid.nome) + '\',\'' +
             escapeHtml(setor.nome) + '\',\'' + escapeHtml(rid) + '\')" title="Clique para editar">';
        h += '<span class="rgh-id">' + escapeHtml(rid);
        if (grp.observacao) h += ' <span style="font-weight:400;opacity:0.7;">—</span> ' + escapeHtml(grp.observacao);
        h += '</span>';
        h += '<span class="rgh-count">' + grp.itens.length + ' itens · ' + formatCurrency(grp.total) + '</span>';
        h += '</div>';
        h += '<div class="rgh-top-right">';
        h += '<button class="rgh-btn rgh-btn-edit" onclick="editarRequisicao(\'' + escapeHtml(cid.nome) + '\',\'' +
             escapeHtml(setor.nome) + '\',\'' + escapeHtml(rid) + '\')" title="Editar">Editar</button>';
        h += '<button class="rgh-btn rgh-btn-print" onclick="event.stopPropagation();imprimirRequisicaoIndividual(\'' + escapeHtml(cid.nome) +
             '\',\'' + escapeHtml(setor.nome) + '\',\'' + escapeHtml(rid) + '\')" title="Imprimir">🖨️</button>';
        h += '</div>';
        h += '</div>';

        if (grp.data) {
          h += '<div class="rgh-meta">';
          h += '<span class="rgh-chip rgh-chip-data"><span class="rgh-chip-ico">📅</span>' + escapeHtml(formatarDataBR(grp.data)) + '</span>';
          h += '</div>';
        }

        h += '</div>';

        grp.itens.forEach(function (it) {
          var descDisplay = escapeHtml(it.descricao);
          descDisplay = descDisplay.replace(/\[([^\]]+)\]/g, '<span style="color:var(--accent);font-size:0.65rem;font-weight:600;display:block;">$1</span>');
          h += '<div class="item-row"><div class="item-desc">' + descDisplay +
               ' <span style="color:var(--text-tertiary);font-size:0.7rem;">(x' + it.quantidade + ')</span></div>' +
               '<div style="text-align:right;">' +
               '<div class="item-valor">' + formatCurrency(it.total) + '</div>' +
               '<div class="item-custo-ref" data-desc-custo="' + escapeHtml((it.descricao || '').toUpperCase().trim()) + '"></div>' +
               '</div></div>';
        });
        h += '</div>';
      });

      h += '</div></div>';
    });
  }

  document.getElementById('cidadeBody').innerHTML = h;
  document.getElementById('cidadeModal').classList.add('show');
  history.pushState({ modal: 'cidade' }, '', '');

  _carregarPrecosCustoParaRef(function(mapa) {
    if (!mapa || !Object.keys(mapa).length) return;
    // Criar mapa normalizado para match inteligente
    var mapaNorm = {};
    Object.keys(mapa).forEach(function(k) { mapaNorm[_normFront(k)] = mapa[k]; });

    document.querySelectorAll('.item-custo-ref[data-desc-custo]').forEach(function(el) {
      var rawKey = el.getAttribute('data-desc-custo') || '';
      var tmp = document.createElement('span');
      tmp.innerHTML = rawKey;
      var descOriginal = (tmp.textContent || tmp.innerText || '').toUpperCase().trim();

      // Tentar match exato primeiro, depois normalizado
      var preco = mapa[descOriginal];
      if (preco === undefined || preco <= 0) {
        preco = mapaNorm[_normFront(descOriginal)];
      }

      if (preco !== undefined && preco > 0) {
        el.textContent = 'Custo: ' + formatCurrency(preco);
        el.style.display = 'block';
      }
    });
  });
}

function fecharCidade() {
  var wasOpen = document.getElementById('cidadeModal').classList.contains('show');
  document.getElementById('cidadeModal').classList.remove('show');
  if (wasOpen && !_insidePopstate) history.back();
}

// ══════════════════════════════════════════════════════════════
//  IMPRESSÃO PDF
// ══════════════════════════════════════════════════════════════
function formatarDataBR(dt) {
  if (!dt) return '';
  var s = String(dt).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    var p = s.substring(0, 10).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  try {
    var d = new Date(s);
    if (!isNaN(d.getTime())) {
      return String(d.getDate()).padStart(2,'0') + '/' +
             String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
    }
  } catch(e) {}
  return s;
}

function _brParaIso(ddmmyyyy) {
  if (!ddmmyyyy) return '';
  var s = String(ddmmyyyy).trim();
  var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return m[3] + '-' + m[2] + '-' + m[1];
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  return '';
}

function _isoParaBr(yyyymmdd) {
  if (!yyyymmdd) return '';
  var s = String(yyyymmdd).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[3] + '/' + m[2] + '/' + m[1];
  return s;
}

function _gerarCabecalhoPDF(cidade) {
  var hoje = new Date();
  var dataHoje = String(hoje.getDate()).padStart(2,'0') + '/' +
                 String(hoje.getMonth()+1).padStart(2,'0') + '/' + hoje.getFullYear();
  var hora = String(hoje.getHours()).padStart(2,'0') + ':' + String(hoje.getMinutes()).padStart(2,'0');

  return '<div class="pdf-header">' +
           '<div class="pdf-brand">GRUPO CARLOS VAZ</div>' +
           '<div class="pdf-divider"></div>' +
           '<div class="pdf-title">Requisições ' + escapeHtml(cidade) + '</div>' +
           '<div class="pdf-meta">Emitido em ' + dataHoje + ' às ' + hora + '</div>' +
         '</div>';
}

function _gerarBlocoRequisicaoPDF(setorNome, reqId, grp) {
  var h = '<div class="pdf-req-block">';

  h += '<div class="pdf-req-head">';
  h += '<div>';
  h += '<div class="pdf-req-setor">' + escapeHtml(setorNome) + '</div>';
  h += '<div class="pdf-req-id">ID: ' + escapeHtml(reqId) + '</div>';
  h += '</div>';
  h += '<div class="pdf-req-info">';
  if (grp.data) h += '<div>' + escapeHtml(formatarDataBR(grp.data)) + '</div>';
  h += '<div>' + grp.itens.length + ' ite' + (grp.itens.length === 1 ? 'm' : 'ns') + '</div>';
  h += '</div>';
  h += '</div>';

  if (grp.observacao) {
    h += '<div class="pdf-req-obs"><strong>Observação:</strong> ' + escapeHtml(grp.observacao) + '</div>';
  }

  h += '<table class="pdf-table">';
  h += '<thead><tr>' +
       '<th style="width:5%;text-align:center;">#</th>' +
       '<th style="width:43%;">Descrição</th>' +
       '<th style="width:10%;text-align:center;">Qtd</th>' +
       '<th style="width:7%;text-align:center;">Un</th>' +
       '<th style="width:17%;text-align:right;">V. Unitário</th>' +
       '<th style="width:18%;text-align:right;">Total</th>' +
       '</tr></thead><tbody>';
  grp.itens.forEach(function(it, idx) {
    var desc = escapeHtml(it.descricao);
    h += '<tr>' +
         '<td style="text-align:center;color:#64748b;">' + (idx+1) + '</td>' +
         '<td style="font-weight:500;">' + desc + '</td>' +
         '<td style="text-align:center;">' + (it.quantidade || 0) + '</td>' +
         '<td style="text-align:center;color:#64748b;">' + escapeHtml(it.um || '') + '</td>' +
         '<td style="text-align:right;">' + formatCurrency(it.valorUnit || 0) + '</td>' +
         '<td style="text-align:right;font-weight:600;">' + formatCurrency(it.total || 0) + '</td>' +
         '</tr>';
  });
  h += '<tr class="pdf-total-row">' +
       '<td colspan="5" style="text-align:right;padding-right:12px;">TOTAL — ' + escapeHtml(reqId) + '</td>' +
       '<td style="text-align:right;">' + formatCurrency(grp.total) + '</td>' +
       '</tr>';
  h += '</tbody></table>';
  h += '</div>';
  return h;
}

function _abrirJanelaImpressao(titulo, corpoHtml) {
  var css = [
    '<style>',
    '@page { size: A4; margin: 10mm 12mm; }',
    '* { box-sizing: border-box; margin: 0; padding: 0; }',
    'body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #1a1a2e; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; line-height: 1.4; }',
    '.pdf-header { padding: 10px 0 8px; margin-bottom: 10px; text-align: center; border-bottom: 2px solid #1e3a5f; page-break-after: avoid; }',
    '.pdf-brand { font-size: 15px; font-weight: 800; letter-spacing: 3px; color: #1e3a5f; text-transform: uppercase; }',
    '.pdf-divider { width: 40px; height: 2px; background: linear-gradient(90deg, #c9a063, #e8c77b); margin: 4px auto 5px; border-radius: 2px; }',
    '.pdf-title { font-size: 13px; font-weight: 600; color: #2c5282; }',
    '.pdf-meta { font-size: 9px; color: #777; margin-top: 3px; letter-spacing: 0.5px; }',
    '.pdf-req-block { margin-bottom: 16px; page-break-inside: avoid; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }',
    '.pdf-req-block + .pdf-req-block { page-break-before: auto; }',
    '.pdf-req-head { display: flex; justify-content: space-between; align-items: flex-start; padding: 8px 12px; background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); color: #fff; }',
    '.pdf-req-setor { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.85; }',
    '.pdf-req-id { font-size: 13px; font-weight: 800; margin-top: 1px; }',
    '.pdf-req-info { font-size: 9px; text-align: right; line-height: 1.5; opacity: 0.9; }',
    '.pdf-req-obs { margin: 0; padding: 8px 16px; background: #fffbeb; border-bottom: 1px solid #f0e6c8; font-size: 11px; color: #92400e; }',
    '.pdf-req-obs strong { color: #78350f; }',
    '.pdf-table { width: 100%; border-collapse: collapse; font-size: 10px; }',
    '.pdf-table thead th { background: #f1f5f9; color: #334155; padding: 5px 6px; font-weight: 700; text-align: left; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #cbd5e1; }',
    '.pdf-table tbody td { padding: 4px 6px; border-bottom: 1px solid #f1f5f9; }',
    '.pdf-table tbody tr:nth-child(even) td { background: #f8fafc; }',
    '.pdf-total-row td { background: #1e3a5f !important; color: #fff !important; border-top: 2px solid #1e3a5f !important; font-weight: 700; font-size: 10px; }',
    '.pdf-footer { margin-top: 16px; padding: 8px 0; border-top: 2px solid #e2e8f0; font-size: 8px; color: #94a3b8; text-align: center; letter-spacing: 0.5px; }',
    '.pdf-resumo { margin-top: 12px; padding: 10px 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 10px; color: #166534; }',
    '.pdf-resumo strong { font-size: 12px; }',
    '@media print { .no-print { display: none !important; } }',
    '.no-print { position: fixed; top: 14px; right: 14px; z-index: 9999; display: flex; gap: 8px; }',
    '.no-print button { background: linear-gradient(135deg, #1e3a5f, #2c5282); color: #fff; border: none; padding: 11px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }',
    '.no-print button.cancel { background: #64748b; box-shadow: none; }',
    '</style>'
  ].join('');

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + escapeHtml(titulo) + '</title>' + css + '</head><body>' +
             '<div class="no-print"><button onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>' +
             '<button class="cancel" onclick="window.close()">Fechar</button></div>' +
             corpoHtml +
             '<div class="pdf-footer">Grupo Carlos Vaz — CRV/LAS · Sistema de Requisições Digital</div>' +
             '</body></html>';

  var win = window.open('', '_blank');
  if (!win) { toast('Permita pop-ups para imprimir'); return; }
  win.document.write(html);
  win.document.title = titulo;
  win.document.close();
  setTimeout(function() { try { win.focus(); } catch(e){} }, 300);
}

function imprimirTodasRequisicoes(cidadeNome) {
  if (!dadosCompletos) { toast('Carregue os dados primeiro'); return; }
  var cid = dadosCompletos.cidades.find(function(c) { return c.nome === cidadeNome; });
  if (!cid || !cid.setores.length) { toast('Nada para imprimir'); return; }

  var corpo = _gerarCabecalhoPDF(cidadeNome);

  var totalGeral = 0;
  var totalReqs = 0;
  cid.setores.forEach(function(setor) {
    var reqMap = {};
    setor.itens.forEach(function(it) {
      var rid = it.requisicao || '-';
      if (!reqMap[rid]) reqMap[rid] = { itens: [], total: 0, observacao: '', data: '' };
      reqMap[rid].itens.push(it);
      reqMap[rid].total += it.total;
      if (it.observacao && !reqMap[rid].observacao) reqMap[rid].observacao = it.observacao;
      if (it.data && !reqMap[rid].data) reqMap[rid].data = it.data;
    });

    Object.keys(reqMap).forEach(function(rid) {
      corpo += _gerarBlocoRequisicaoPDF(setor.nome, rid, reqMap[rid]);
      totalGeral += reqMap[rid].total;
      totalReqs++;
    });
  });

  corpo += '<div class="pdf-resumo"><strong>TOTAL GERAL: ' + formatCurrency(totalGeral) + '</strong><br>' +
           totalReqs + ' requisições · ' + cid.itens + ' itens · ' + cid.setores.length + ' setores</div>';

  _abrirJanelaImpressao('Requisições ' + cidadeNome, corpo);
}

function imprimirRequisicaoIndividual(cidadeNome, setorNome, reqId) {
  if (!dadosCompletos) { toast('Carregue os dados primeiro'); return; }
  var cid = dadosCompletos.cidades.find(function(c) { return c.nome === cidadeNome; });
  if (!cid) { toast('Cidade não encontrada'); return; }
  var setor = cid.setores.find(function(s) { return s.nome === setorNome; });
  if (!setor) { toast('Setor não encontrado'); return; }

  var grp = { itens: [], total: 0, observacao: '', data: '' };
  setor.itens.forEach(function(it) {
    if ((it.requisicao || '-') === reqId) {
      grp.itens.push(it);
      grp.total += it.total;
      if (it.observacao && !grp.observacao) grp.observacao = it.observacao;
      if (it.data && !grp.data) grp.data = it.data;
    }
  });
  if (!grp.itens.length) { toast('Requisição vazia'); return; }

  var corpo = _gerarCabecalhoPDF(cidadeNome);
  corpo += _gerarBlocoRequisicaoPDF(setorNome, reqId, grp);

  _abrirJanelaImpressao('Requisição ' + reqId + ' — ' + cidadeNome, corpo);
}

function imprimirPorSetor(cidadeNome, setorNome) {
  if (!dadosCompletos) { toast('Carregue os dados primeiro'); return; }
  var cid = dadosCompletos.cidades.find(function(c) { return c.nome === cidadeNome; });
  if (!cid) { toast('Cidade não encontrada'); return; }
  var setor = cid.setores.find(function(s) { return s.nome === setorNome; });
  if (!setor || !setor.itens.length) { toast('Setor vazio'); return; }

  var reqMap = {};
  setor.itens.forEach(function(it) {
    var rid = it.requisicao || '-';
    if (!reqMap[rid]) reqMap[rid] = { itens: [], total: 0, observacao: '', data: '' };
    reqMap[rid].itens.push(it);
    reqMap[rid].total += it.total;
    if (it.observacao && !reqMap[rid].observacao) reqMap[rid].observacao = it.observacao;
    if (it.data && !reqMap[rid].data) reqMap[rid].data = it.data;
  });

  var corpo = _gerarCabecalhoPDF(cidadeNome);
  var totalSetor = 0;
  var totalReqs = 0;

  Object.keys(reqMap).forEach(function(rid) {
    corpo += _gerarBlocoRequisicaoPDF(setorNome, rid, reqMap[rid]);
    totalSetor += reqMap[rid].total;
    totalReqs++;
  });

  corpo += '<div class="pdf-resumo"><strong>TOTAL SETOR ' + escapeHtml(setorNome) + ': ' + formatCurrency(totalSetor) + '</strong><br>' +
           totalReqs + ' requisições · ' + setor.itens.length + ' itens</div>';

  _abrirJanelaImpressao('Requisições ' + setorNome + ' — ' + cidadeNome, corpo);
}

// ══════════════════════════════════════════════════════════════
//  CATÁLOGO
// ══════════════════════════════════════════════════════════════
function abrirCatalogo() {
  document.body.style.overflow = 'hidden';
  document.getElementById('catalogoModal').classList.add('show');
  history.pushState({ modal: 'catalogo' }, '', '');
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
  if (wasOpen && !_insidePopstate) history.back();
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
    btn.innerHTML = '...';
    btn.disabled = true;
  }

  showSuccess('', 'Preço alterado!', 'Sincronizando no fundo...');

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
      showSuccess('', 'Resumo copiado!', 'Cole no WhatsApp');
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
//  IMPORTAÇÃO IA
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
  history.pushState({ modal: 'importar' }, '', '');
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
  var _idEl = document.getElementById('impReqId'); if (_idEl) _idEl.value = '';
  document.getElementById('impObs').value = '';
  importacaoTemp = null;
  popularSelectsCidadeSetor();
}

function fecharImportar() {
  var wasOpen = document.getElementById('importarModal').classList.contains('show');
  document.body.style.overflow = '';
  document.getElementById('importarModal').classList.remove('show');
  if (wasOpen && !_insidePopstate) history.back();
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
      callback(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function escolherCidadeSetor() {
  var cidade = document.getElementById('impCidade').value;
  var setor = document.getElementById('impSetor').value;
  var dataReq = document.getElementById('impData').value;
  var obsReq = document.getElementById('impObs').value.trim();
  var arquivo = document.getElementById('impArquivo').files[0];
  var texto = document.getElementById('impTexto').value.trim();

  if (!cidade || !setor) { toast('Preencha cidade e setor'); return; }
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
    comprimirImagem(arquivo, 1400, function(base64Otimizado) {
      payload.imagemBase64 = base64Otimizado.split(',')[1];
      payload.mimeType = 'image/jpeg';
      enviarParaIA(payload, cidade, setor, '', dataReq, obsReq);
    });
  } else {
    enviarParaIA(payload, cidade, setor, '', dataReq, obsReq);
  }
}

function enviarParaIA(payload, cidade, setor, reqId, dataReq, obsReq) {
  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow'
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status !== 'ok') { toast(d.msg || 'Erro na IA'); voltarStep1(); return; }
      importacaoTemp = { cidade: cidade, setor: setor, reqId: '(automático)', data: dataReq, observacao: obsReq || '', itens: d.resultado.itens, meta: d.resultado };
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ acao: 'previewproximoid', usuario: sessao.nome, senha: sessao.hash, cidade: cidade, setor: setor }),
        redirect: 'follow'
      }).then(function(r){return r.json();}).then(function(pp) {
        if (pp.status === 'ok') {
          importacaoTemp.reqId = pp.proximoId;
          renderPreviewImportacao();
        } else { renderPreviewImportacao(); }
      }).catch(function(){ renderPreviewImportacao(); });
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
  h += '<div><strong>Cidade:</strong> ' + escapeHtml(importacaoTemp.cidade) + ' / ' + escapeHtml(importacaoTemp.setor) + '</div>';
  h += '<div><strong>Req ID (auto):</strong> <span style="color:var(--accent);font-weight:700;">' + escapeHtml(importacaoTemp.reqId) + '</span></div>';
  if (importacaoTemp.observacao) {
    h += '<div style="color:var(--accent);font-weight:600;font-size:.85rem;margin:4px 0;"><strong>Obs:</strong> ' + escapeHtml(importacaoTemp.observacao) + '</div>';
  }
  if (importacaoTemp.data) {
    var partes = importacaoTemp.data.split('-');
    h += '<div><strong>Data:</strong> ' + partes[2] + '/' + partes[1] + '/' + partes[0] + '</div>';
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
    if (it.destinatario) {
      h += '<div class="imp-dest-row"><label>Escola/Local<input class="imp-input imp-dest" value="' + escapeHtml(it.destinatario) + '" data-idx="' + idx + '" data-campo="destinatario" placeholder="Nome da escola/local"></label></div>';
    }
    h += '<div class="imp-row-grid">';
    h += '<label>Qtd<input type="number" step="0.01" class="imp-input" value="' + it.quantidade + '" data-idx="' + idx + '" data-campo="quantidade"></label>';
    h += '<label>Un<input class="imp-input" value="' + escapeHtml(it.unidade_compra) + '" data-idx="' + idx + '" data-campo="unidade_compra"></label>';
    h += '<label>Por emb<input type="number" step="1" class="imp-input" value="' + (it.qtd_por_embalagem || 1) + '" data-idx="' + idx + '" data-campo="qtd_por_embalagem"></label>';
    h += '<label>Unit R$<input type="number" step="0.01" class="imp-input imp-unit" value="' + (it.valor_unitario_calc || 0).toFixed(4) + '" data-idx="' + idx + '" data-campo="valor_unitario_calc" id="impUnit' + idx + '" onchange="recalcTotal(' + idx + ')"></label>';
    h += '<label>Total R$<input type="number" step="0.01" class="imp-input" value="' + it.valor_total + '" data-idx="' + idx + '" data-campo="valor_total" id="impTotal' + idx + '" onchange="recalcUnit(' + idx + ')"></label>';
    h += '</div>';

    var statusTxt = '';
    if (it.status_catalogo === 'NOVO') statusTxt = 'Item novo — entrará no catálogo como AUTO';
    else if (it.status_catalogo === 'DIVERGENTE') statusTxt = 'Catálogo: R$ ' + (it.preco_no_catalogo || 0).toFixed(2) + ' (AUTO) — será atualizado';
    else if (it.status_catalogo === 'MANUAL_PROTEGIDO') statusTxt = 'Catálogo: R$ ' + (it.preco_no_catalogo || 0).toFixed(2) + ' (MANUAL) — protegido';
    else if (it.status_catalogo === 'OK') statusTxt = 'Bate com catálogo';
    if (it.confianca === 'BAIXA') statusTxt = 'CONFIRMAR — ' + (it.observacao || 'IA com baixa confiança');
    h += '<div class="imp-status-msg">' + statusTxt + '</div>';
    h += '<button class="imp-remove" onclick="removerItemImp(' + idx + ')">Remover</button>';
    h += '</div>';
  });

  h += '<button class="imp-add-item-btn" onclick="adicionarItemImpManual()">';
  h += '<span class="iaim-icon">+</span>';
  h += '<span class="iaim-text"><span class="iaim-title">Adicionar item manualmente</span>';
  h += '<span class="iaim-sub">Inclua um item que a IA não detectou</span></span>';
  h += '</button>';

  h += '<div class="imp-total-box">Total da Requisição: <strong id="impTotalGeral">R$ ' + totalGeral.toFixed(2).replace('.', ',') + '</strong></div>';
  h += '<div class="imp-actions">';
  h += '<button class="imp-btn-cancel" onclick="voltarStep1()">Refazer</button>';
  h += '<button class="imp-btn-confirm" onclick="confirmarImportacao()">Confirmar e Lançar</button>';
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
  var qtd = it.quantidade || 1;
  var unit = it.valor_total / (qtd * qtdEmb);
  it.valor_unitario_calc = unit;
  var unitEl = document.getElementById('impUnit' + idx);
  if (unitEl) unitEl.value = unit.toFixed(4);
  _recalcTotalGeral();
}

function recalcTotal(idx) {
  var it = importacaoTemp.itens[idx];
  var qtdEmb = it.qtd_por_embalagem || 1;
  var qtd = it.quantidade || 1;
  var total = (it.valor_unitario_calc || 0) * qtd * qtdEmb;
  it.valor_total = total;
  var totalEl = document.getElementById('impTotal' + idx);
  if (totalEl) totalEl.value = total.toFixed(2);
  _recalcTotalGeral();
}

function _recalcTotalGeral() {
  var t = 0;
  importacaoTemp.itens.forEach(function(i) { t += parseFloat(i.valor_total) || 0; });
  var el = document.getElementById('impTotalGeral');
  if (el) el.textContent = 'R$ ' + t.toFixed(2).replace('.', ',');
}

function removerItemImp(idx) {
  if (!importacaoTemp || !importacaoTemp.itens || !importacaoTemp.itens[idx]) return;
  importacaoTemp.itens.splice(idx, 1);
  if (importacaoTemp.itens.length === 0) {
    toast('Todos os itens removidos');
    voltarStep1();
    return;
  }
  toast('Item removido');
  renderPreviewImportacao();
}

function adicionarItemImpManual() {
  if (!importacaoTemp) { toast('Sem importação ativa'); return; }

  var novoItem = {
    ordem: importacaoTemp.itens.length + 1,
    descricao: '',
    descricao_normalizada: '',
    quantidade: 1,
    unidade_compra: 'UN',
    qtd_por_embalagem: 1,
    valor_total: 0,
    valor_unitario_calc: 0,
    confianca: 'ALTA',
    observacao: 'Adicionado manualmente',
    destinatario: '',
    status_catalogo: 'NOVO',
    preco_no_catalogo: null,
    origem_atual: null,
    _manual: true
  };

  importacaoTemp.itens.push(novoItem);
  renderPreviewImportacao();

  setTimeout(function() {
    var inputs = document.querySelectorAll('#impPreview .imp-desc');
    var ultimoInput = inputs[inputs.length - 1];
    if (ultimoInput) {
      ultimoInput.focus();
      ultimoInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 80);

  showSuccess('', 'Item adicionado', 'Preencha a descrição e os valores');
}

function confirmarImportacao() {
  if (!importacaoTemp || !importacaoTemp.itens.length) { toast('Sem itens'); return; }
  var btn = document.querySelector('.imp-btn-confirm');
  btn.disabled = true; btn.textContent = 'Lançando...';

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
      observacao: importacaoTemp.observacao || '',
      itens: importacaoTemp.itens
    }),
    redirect: 'follow'
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status === 'ok') {
        showSuccess('', 'Requisição lançada!', d.itensInseridos + ' itens · R$ ' + d.totalRequisicao.toFixed(2));
        fecharImportar();
        carregarDados();
      } else {
        toast(d.msg || 'Erro ao lançar');
        btn.disabled = false; btn.textContent = 'Confirmar e Lançar';
      }
    })
    .catch(function() {
      toast('Erro de conexão');
      btn.disabled = false; btn.textContent = 'Confirmar e Lançar';
    });
}
// ══════════════════════════════════════════════════════════════
//  ASSISTENTE IA
// ══════════════════════════════════════════════════════════════
var iaComandoAtual = null;
var iaPovoamentoTemp = null;

function abrirAssistenteIA() {
  document.body.style.overflow = 'hidden';
  document.getElementById('iaModal').classList.add('show');
  history.pushState({ modal: 'ia' }, '', '');
  document.getElementById('iaStep1').style.display = 'block';
  document.getElementById('iaStep2').style.display = 'none';
  document.getElementById('iaStep3').style.display = 'none';
  document.getElementById('iaParamWrap').style.display = 'none';
  document.getElementById('iaPovoarWrap').style.display = 'none';
  document.getElementById('iaPovoarPreview').style.display = 'none';
  document.getElementById('iaAtualizarWrap').style.display = 'none';
  document.getElementById('iaAtualizarPreview').style.display = 'none';
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
  if (wasOpen && !_insidePopstate) history.back();
}

function renderListaComandos() {
  var h = '<div class="ia-intro">Escolha um comando pré-treinado. Cada um custa entre R$ 0,01 e R$ 0,10 e responde em 3-5 segundos.</div>';
  comandosIA.forEach(function(cmd) {
    h += '<div class="ia-cmd-card" onclick="selecionarComando(\'' + escapeHtml(cmd.comando) + '\')">';
    h += '<div class="ia-cmd-nome">' + escapeHtml(cmd.nome) + '</div>';
    h += '<div class="ia-cmd-desc">' + escapeHtml(cmd.descricao) + '</div>';
    h += '<div class="ia-cmd-meta">~R$ ' + escapeHtml(cmd.custo) + '</div>';
    h += '</div>';
  });
  document.getElementById('iaListaCmds').innerHTML = h;
}

function selecionarComando(comando) {
  iaComandoAtual = comando;

  if (comando === 'POVOAR_CATALOGO') {
    document.getElementById('iaStep1').style.display = 'none';
    document.getElementById('iaPovoarWrap').style.display = 'block';
    var textarea = document.getElementById('iaPovoarLista');
    textarea.value = '';
    textarea.placeholder = 'Cole uma lista de itens (um por linha)\nOU\nDigite uma categoria: mercearia seca, açougue, laticínios, limpeza, higiene, hortifruti, bebidas, padaria, congelados, descartáveis, papelaria';
    setTimeout(function(){ textarea.focus(); }, 100);
    return;
  }

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
      label = 'Qual setor analisar?';
      placeholder = 'Ex: EDUCAÇÃO';
    } else if (comando === 'SUGERIR_PRECO_ITEM') {
      label = 'Qual item você quer estimar?';
      placeholder = 'Ex: Creme de leite 200g';
    } else if (comando === 'BUSCAR_ITEM_CATALOGO') {
      label = 'Sua pergunta';
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
  document.getElementById('iaAtualizarWrap').style.display = 'none';
  document.getElementById('iaAtualizarPreview').style.display = 'none';
  document.getElementById('iaStep2').style.display = 'none';
  document.getElementById('iaStep3').style.display = 'none';
  document.getElementById('iaStep1').style.display = 'block';
  iaPovoamentoTemp = null;
  iaAtualizacaoTemp = null;
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
          custoTxt = 'Resposta de cache (R$ 0,00)';
        } else {
          var custoUsd = (d.tokensIn * 0.30 / 1000000) + (d.tokensOut * 2.50 / 1000000);
          var custoBrl = (custoUsd * 5.30).toFixed(4);
          custoTxt = 'Custo: R$ ' + custoBrl + ' · ' + (d.tokensIn + d.tokensOut) + ' tokens';
        }

        var h = '<div class="ia-resp-header">' +
                '<div class="ia-resp-cmd">' + escapeHtml(comando) + '</div>' +
                '<div class="ia-resp-custo">' + custoTxt + '</div>' +
                '</div>';
        h += '<div class="ia-resp-texto" id="iaRespTexto">' + formatarRespostaIA(resp) + '</div>';
        h += '<div class="ia-resp-actions">';
        h += '<button class="imp-btn-cancel" onclick="voltarListaComandos()">Outro Comando</button>';
        h += '<button class="imp-btn-confirm" onclick="copiarRespostaIA()">Copiar para WhatsApp</button>';
        h += '</div>';
        document.getElementById('iaResposta').innerHTML = h;
      } else {
        var hErr = '<div class="ia-resp-header"><div class="ia-resp-cmd">Erro</div></div>';
        hErr += '<div class="ia-resp-texto" style="color:var(--danger);">' + escapeHtml(d.msg || 'Erro desconhecido') + '</div>';
        hErr += '<div class="ia-resp-actions"><button class="imp-btn-cancel" onclick="voltarListaComandos()">Voltar</button></div>';
        document.getElementById('iaResposta').innerHTML = hErr;
      }
    })
    .catch(function(){
      document.getElementById('iaStep2').style.display = 'none';
      document.getElementById('iaStep3').style.display = 'block';
      document.getElementById('iaResposta').innerHTML =
        '<div class="ia-resp-header"><div class="ia-resp-cmd">Erro de conexão</div></div>' +
        '<div class="ia-resp-actions"><button class="imp-btn-cancel" onclick="voltarListaComandos()">Voltar</button></div>';
    });
}

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
      showSuccess('', 'Copiado!', 'Cole no WhatsApp');
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
//  POVOAR & ATUALIZAR PREÇOS (IA)
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
  h += '<div class="ia-resp-cmd">POVOAR_CATALOGO</div>';
  h += '<div class="ia-resp-custo">R$ ' + custoBrl + ' · ' + d.total_processados + ' itens processados</div>';
  h += '</div>';

  h += '<div class="pov-resumo">';
  h += '<div class="pov-stat"><div class="pov-stat-num">' + d.total_processados + '</div><div class="pov-stat-lbl">Total IA</div></div>';
  h += '<div class="pov-stat novo"><div class="pov-stat-num">' + d.novos + '</div><div class="pov-stat-lbl">Novos</div></div>';
  h += '<div class="pov-stat ja"><div class="pov-stat-num">' + d.ja_existentes + '</div><div class="pov-stat-lbl">Já existem</div></div>';
  h += '</div>';

  h += '<div class="pov-aviso">Edite os preços antes de confirmar. Itens marcados como "já existe" serão ignorados (não sobrescreve catálogo manual).</div>';

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
    h += '<button class="pov-remove-btn" onclick="removerItemPovoamento(' + idx + ')"><svg width="12" height="12"><use href="#icon-trash"/></svg></button>';
    h += '</div>';
    h += '<div class="pov-row-grid">';
    h += '<label>Unidade<input class="pov-input" value="' + escapeHtml(it.unidade_padrao || 'UN') + '" data-idx="' + idx + '" data-campo="unidade_padrao"></label>';
    h += '<label>Qtd/Emb<input type="number" step="1" class="pov-input" value="' + (it.qtd_por_embalagem || 1) + '" data-idx="' + idx + '" data-campo="qtd_por_embalagem"></label>';
    h += '<label>Preço R$<input type="number" step="0.01" class="pov-input pov-preco" value="' + (it.preco_estimado || 0).toFixed(2) + '" data-idx="' + idx + '" data-campo="preco_estimado"></label>';
    h += '</div>';

    var statusTxt = '';
    if (it.ja_existe) statusTxt = 'Já existe no catálogo — ignorado';
    else if (it.confianca === 'ALTA') statusTxt = 'Confiança ALTA · ' + (it.observacao || 'Item comum');
    else if (it.confianca === 'MEDIA') statusTxt = 'Confiança MÉDIA · ' + (it.observacao || 'Confira o preço');
    else statusTxt = 'Confiança BAIXA · ' + (it.observacao || 'Item incomum, valide o preço');
    h += '<div class="pov-status">' + statusTxt + '</div>';
    h += '</div>';
  });

  h += '<div class="ia-resp-actions">';
  h += '<button class="imp-btn-cancel" onclick="voltarListaComandos()">Cancelar</button>';
  h += '<button class="imp-btn-confirm" onclick="confirmarPovoamento()">Adicionar ao Catálogo</button>';
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
  btn.disabled = true; btn.textContent = 'Adicionando...';

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
        showSuccess('', 'Catálogo atualizado!', d.inseridos + ' itens adicionados · ' + d.ignorados + ' ignorados');
        fecharAssistenteIA();
      } else {
        toast(d.msg || 'Erro ao adicionar');
        btn.disabled = false; btn.textContent = 'Adicionar ao Catálogo';
      }
    })
    .catch(function(){
      toast('Erro de conexão');
      btn.disabled = false; btn.textContent = 'Adicionar ao Catálogo';
    });
}

function removerItemPovoamento(idx) {
  if (!iaPovoamentoTemp || !iaPovoamentoTemp.itens) return;
  if (!confirm('Remover este item?')) return;
  iaPovoamentoTemp.itens.splice(idx, 1);
  iaPovoamentoTemp.total_processados = iaPovoamentoTemp.itens.length;
  iaPovoamentoTemp.novos = iaPovoamentoTemp.itens.filter(function(i) { return !i.ja_existe; }).length;
  iaPovoamentoTemp.ja_existentes = iaPovoamentoTemp.itens.filter(function(i) { return i.ja_existe; }).length;
  renderPreviewPovoamento();
}

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
  h += '<div class="ia-resp-cmd">ATUALIZAR_PRECOS_LISTA</div>';
  h += '<div class="ia-resp-custo">R$ ' + custoBrl + ' · ' + (d.itens || []).length + ' itens</div>';
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
    var status = it.encontrado ? 'Encontrado no catálogo' : 'Não encontrado — será ignorado';
    h += '<div class="pov-status">' + status + '</div>';
    h += '</div>';
  });

  h += '<div class="ia-resp-actions">';
  h += '<button class="imp-btn-cancel" onclick="voltarListaComandos()">Cancelar</button>';
  h += '<button class="imp-btn-confirm" onclick="confirmarAtualizacaoPrecosFront()">Atualizar Preços</button>';
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
  btn.disabled = true; btn.textContent = 'Atualizando...';

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
        showSuccess('', 'Preços atualizados!', d.atualizados + ' itens');
        fecharAssistenteIA();
        carregarDados();
      } else {
        toast(d.msg || 'Erro');
        btn.disabled = false; btn.textContent = 'Atualizar Preços';
      }
    })
    .catch(function() {
      toast('Erro de conexão');
      btn.disabled = false; btn.textContent = 'Atualizar Preços';
    });
}

// ══════════════════════════════════════════════════════════════
//  EDITAR / ADICIONAR / MOVER REQUISIÇÃO
// ══════════════════════════════════════════════════════════════
var edicaoReqTemp = null;
var novosItensTemp = [];

function editarRequisicao(cidade, setor, reqId) {
  if (!dadosCompletos) { toast('Dados não carregados'); return; }
  var cid = dadosCompletos.cidades.find(function(c) { return c.nome === cidade; });
  if (!cid) { toast('Cidade não encontrada'); return; }
  var setorObj = cid.setores.find(function(s) { return s.nome === setor; });
  if (!setorObj) { toast('Setor não encontrado'); return; }
  var itens = setorObj.itens.filter(function(it) { return it.requisicao === reqId; });
  if (!itens.length) { toast('Nenhum item encontrado'); return; }

  var obsReq = '';
  itens.forEach(function(it) { if (it.observacao && !obsReq) obsReq = it.observacao; });

  edicaoReqTemp = {
    cidade: cidade, setor: setor, reqId: reqId, observacao: obsReq,
    itens: itens.map(function(it) {
      return { linha: it.linha, descricao: it.descricao, valorUnit: it.valorUnit, quantidade: it.quantidade, um: it.um, total: it.total, status: it.status, data: it.data };
    })
  };

  renderEdicaoRequisicao();
  document.getElementById('editReqModal').classList.add('show');
  history.pushState({ modal: 'editReq' }, '', '');
}

function fecharEditReq() {
  var wasOpen = document.getElementById('editReqModal').classList.contains('show');
  document.getElementById('editReqModal').classList.remove('show');
  if (wasOpen && !_insidePopstate) history.back();
}

function renderEdicaoRequisicao() {
  if (!edicaoReqTemp) return;

  var tituloEdit = 'Editar ' + edicaoReqTemp.reqId;
  if (edicaoReqTemp.observacao) tituloEdit += ' — ' + edicaoReqTemp.observacao;
  document.getElementById('editReqTitle').textContent = tituloEdit;

  var itens = edicaoReqTemp.itens;
  var totalGeral = 0;
  var dataAtual = (itens[0] && itens[0].data) ? formatarDataBR(itens[0].data) : '';
  var dataIso = _brParaIso(dataAtual);

  var h = '<div class="imp-meta-box">';
  h += '<div><strong>Cidade:</strong> ' + escapeHtml(edicaoReqTemp.cidade) + '</div>';
  h += '<div><strong>Setor:</strong> ' + escapeHtml(edicaoReqTemp.setor) + '</div>';
  h += '<div><strong>Requisição:</strong> ' + escapeHtml(edicaoReqTemp.reqId) + '</div>';
  if (edicaoReqTemp.observacao) h += '<div style="color:var(--accent);font-weight:600;font-size:.85rem;margin:4px 0;"><strong>📝 Obs:</strong> ' + escapeHtml(edicaoReqTemp.observacao) + '</div>';
  h += '<div class="login-field" style="margin-top:8px;"><label style="font-weight:600;font-size:.8rem;color:var(--text-secondary);">Data da Requisição</label>';
  h += '<input type="date" id="editReqData" class="imp-input" value="' + dataIso + '" style="width:100%;padding:8px 10px;font-size:.85rem;border-radius:8px;border:1px solid var(--border);font-family:var(--font);" onchange="edicaoReqTemp.dataNova=this.value"></div>';
  h += '</div>';

  itens.forEach(function(it, idx) {
    totalGeral += it.total || 0;
    var statusClass = '';
    if (it.status === 'APROVADO') statusClass = ' ok';
    else if (it.status === 'NEGADO') statusClass = ' baixa';
    else if (it.status === 'ENTREGUE') statusClass = ' ok';
    else statusClass = ' novo';

    h += '<div class="imp-row' + statusClass + '">';
    h += '<div class="imp-row-head"><span class="imp-num">' + (idx + 1) + '</span>';
    h += '<input class="imp-desc" value="' + escapeHtml(it.descricao) + '" data-idx="' + idx + '" data-campo="descricao"></div>';
    h += '<div class="imp-row-grid">';
    h += '<label>V. Unit R$<input type="number" step="0.01" class="imp-input" value="' + (it.valorUnit || 0).toFixed(2) + '" data-idx="' + idx + '" data-campo="valorUnit" id="editUnit' + idx + '" onchange="recalcEditTotal(' + idx + ')"></label>';
    h += '<label>Qtd<input type="number" step="0.01" class="imp-input" value="' + (it.quantidade || 0) + '" data-idx="' + idx + '" data-campo="quantidade" onchange="recalcEditTotal(' + idx + ')"></label>';
    h += '<label>Un<input class="imp-input" value="' + escapeHtml(it.um || '') + '" data-idx="' + idx + '" data-campo="um"></label>';
    h += '<label>Total R$<input type="number" step="0.01" class="imp-input imp-unit" value="' + (it.total || 0).toFixed(2) + '" data-idx="' + idx + '" data-campo="total" id="editTotal' + idx + '" onchange="recalcEditUnit(' + idx + ')"></label>';
    h += '<label>Status<select class="imp-input" data-idx="' + idx + '" data-campo="status" style="font-family:var(--font);font-size:.75rem;">';
    ['PENDENTE', 'APROVADO', 'NEGADO', 'ENTREGUE'].forEach(function(st) {
      h += '<option value="' + st + '"' + (it.status === st ? ' selected' : '') + '>' + st + '</option>';
    });
    h += '</select></label>';
    h += '</div>';
    h += '<button class="imp-remove" onclick="removerItemEdit(' + idx + ')">Remover item</button>';
    h += '</div>';
  });

  h += '<div class="imp-total-box">Total: <strong id="editTotalGeral">R$ ' + totalGeral.toFixed(2).replace('.', ',') + '</strong></div>';

  h += '<div style="margin:12px 0;">';
  h += '<button onclick="abrirAdicionarItem()" style="width:100%;padding:11px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border:none;border-radius:8px;font-weight:700;font-size:.9rem;cursor:pointer;font-family:var(--font);box-shadow:0 2px 8px rgba(22,163,74,0.3);">➕ Adicionar Item</button>';
  h += '</div>';

  h += '<div style="margin:12px 0;">';
  h += '<button onclick="abrirMoverSetor()" style="width:100%;padding:11px;background:linear-gradient(135deg,#c9a063,#a87f3f);color:#fff;border:none;border-radius:8px;font-weight:700;font-size:.9rem;cursor:pointer;font-family:var(--font);box-shadow:0 2px 8px rgba(168,127,63,0.3);">🔀 Mover para outro Setor</button>';
  h += '</div>';

  h += '<div class="imp-actions">';
  h += '<button class="imp-btn-cancel" onclick="fecharEditReq()">Cancelar</button>';
  h += '<button class="imp-btn-confirm" id="btnSalvarEdit" onclick="salvarEdicaoRequisicao()">Salvar Alterações</button>';
  h += '</div>';

  document.getElementById('editReqBody').innerHTML = h;

  document.querySelectorAll('#editReqBody input[data-campo], #editReqBody select[data-campo]').forEach(function(inp) {
    inp.addEventListener('input', function() {
      var idx = parseInt(this.dataset.idx);
      var campo = this.dataset.campo;
      if (this.tagName === 'SELECT') edicaoReqTemp.itens[idx][campo] = this.value;
      else if (this.type === 'number') edicaoReqTemp.itens[idx][campo] = parseFloat(this.value) || 0;
      else edicaoReqTemp.itens[idx][campo] = this.value;
    });
  });
}

function recalcEditTotal(idx) {
  var it = edicaoReqTemp.itens[idx];
  var novoTotal = (it.valorUnit || 0) * (it.quantidade || 0);
  it.total = novoTotal;
  var el = document.getElementById('editTotal' + idx);
  if (el) el.value = novoTotal.toFixed(2);
  _recalcEditTotalGeral();
}

function recalcEditUnit(idx) {
  var it = edicaoReqTemp.itens[idx];
  var qtd = it.quantidade || 1;
  var novoUnit = (it.total || 0) / qtd;
  it.valorUnit = novoUnit;
  var el = document.getElementById('editUnit' + idx);
  if (el) el.value = novoUnit.toFixed(2);
  _recalcEditTotalGeral();
}

function _recalcEditTotalGeral() {
  var t = 0;
  edicaoReqTemp.itens.forEach(function(i) { t += i.total || 0; });
  var tEl = document.getElementById('editTotalGeral');
  if (tEl) tEl.textContent = 'R$ ' + t.toFixed(2).replace('.', ',');
}

function removerItemEdit(idx) {
  if (!edicaoReqTemp || !edicaoReqTemp.itens[idx]) return;
  if (!confirm('Remover "' + edicaoReqTemp.itens[idx].descricao + '"?\n\nIsso remove permanentemente da planilha.')) return;

  var item = edicaoReqTemp.itens[idx];
  var btn = event.target;
  btn.disabled = true; btn.textContent = 'Removendo...';

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'removeritrequisicao', usuario: sessao.nome, senha: sessao.hash,
      cidade: edicaoReqTemp.cidade, linha: item.linha
    }),
    redirect: 'follow'
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.status === 'ok') {
      edicaoReqTemp.itens.splice(idx, 1);
      if (edicaoReqTemp.itens.length === 0) {
        showSuccess('', 'Item removido', 'Requisição ficou vazia');
        fecharEditReq();
        carregarDados();
      } else {
        toast('Item removido');
        renderEdicaoRequisicao();
      }
    } else {
      toast(d.msg || 'Erro ao remover');
      btn.disabled = false; btn.textContent = 'Remover item';
    }
  })
  .catch(function() { toast('Erro de conexão'); btn.disabled = false; btn.textContent = 'Remover item'; });
}

function salvarEdicaoRequisicao() {
  if (!edicaoReqTemp || !edicaoReqTemp.itens.length) { toast('Sem itens'); return; }

  var btn = document.getElementById('btnSalvarEdit');
  btn.disabled = true; btn.textContent = 'Salvando...';

  var payload = {
    acao: 'salvareditrequisicao', usuario: sessao.nome, senha: sessao.hash,
    cidade: edicaoReqTemp.cidade, itens: edicaoReqTemp.itens
  };
  if (edicaoReqTemp.dataNova) payload.dataNova = edicaoReqTemp.dataNova;

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow'
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.status === 'ok') {
      showSuccess('', 'Requisição atualizada!', d.atualizados + ' itens salvos');
      fecharEditReq();
      fecharCidade();
      carregarDados();
    } else {
      toast(d.msg || 'Erro ao salvar');
      btn.disabled = false; btn.textContent = 'Salvar Alterações';
    }
  })
  .catch(function() { toast('Erro de conexão'); btn.disabled = false; btn.textContent = 'Salvar Alterações'; });
}

function abrirAdicionarItem() {
  if (!edicaoReqTemp) return;
  novosItensTemp = [{ descricao: '', valorUnit: 0, quantidade: 1, um: 'UN' }];
  _renderAdicionarItem();
  document.getElementById('addItemModal').classList.add('show');
  history.pushState({ modal: 'addItem' }, '', '');
}

function fecharAdicionarItem() {
  var modal = document.getElementById('addItemModal');
  var wasOpen = modal && modal.classList.contains('show');
  if (modal) modal.classList.remove('show');
  novosItensTemp = [];
  if (wasOpen && !_insidePopstate) history.back();
}

function _renderAdicionarItem() {
  var h = '<div class="imp-meta-box">';
  h += '<div><strong>Cidade:</strong> ' + escapeHtml(edicaoReqTemp.cidade) + '</div>';
  h += '<div><strong>Setor:</strong> ' + escapeHtml(edicaoReqTemp.setor) + '</div>';
  h += '<div><strong>Requisição:</strong> ' + escapeHtml(edicaoReqTemp.reqId) + '</div>';
  h += '</div>';

  novosItensTemp.forEach(function(it, idx) {
    h += '<div class="imp-row novo">';
    h += '<div class="imp-row-head"><span class="imp-num">' + (idx+1) + '</span>';
    h += '<input class="imp-desc" placeholder="Descrição do item" value="' + escapeHtml(it.descricao) + '" data-nidx="' + idx + '" data-ncampo="descricao"></div>';
    h += '<div class="imp-row-grid">';
    h += '<label>V. Unit R$<input type="number" step="0.01" class="imp-input" value="' + (it.valorUnit||0).toFixed(2) + '" data-nidx="' + idx + '" data-ncampo="valorUnit"></label>';
    h += '<label>Qtd<input type="number" step="0.01" class="imp-input" value="' + (it.quantidade||1) + '" data-nidx="' + idx + '" data-ncampo="quantidade"></label>';
    h += '<label>Un<input class="imp-input" value="' + escapeHtml(it.um||'UN') + '" data-nidx="' + idx + '" data-ncampo="um"></label>';
    h += '</div>';
    if (novosItensTemp.length > 1) {
      h += '<button class="imp-remove" onclick="novosItensTemp.splice(' + idx + ',1);_renderAdicionarItem()">Remover</button>';
    }
    h += '</div>';
  });

  h += '<div style="margin:12px 0;"><button onclick="novosItensTemp.push({descricao:\'\',valorUnit:0,quantidade:1,um:\'UN\'});_renderAdicionarItem()" style="width:100%;padding:10px;background:#f1f5f9;color:#334155;border:1px dashed #94a3b8;border-radius:8px;font-weight:600;cursor:pointer;font-family:var(--font);">+ Mais um item</button></div>';

  h += '<div class="imp-actions">';
  h += '<button class="imp-btn-cancel" onclick="fecharAdicionarItem()">Cancelar</button>';
  h += '<button class="imp-btn-confirm" id="btnAddItem" onclick="confirmarAdicionarItem()">Adicionar à Requisição</button>';
  h += '</div>';

  document.getElementById('addItemBody').innerHTML = h;

  document.querySelectorAll('#addItemBody input[data-ncampo]').forEach(function(inp) {
    inp.addEventListener('input', function() {
      var idx = parseInt(this.dataset.nidx);
      var campo = this.dataset.ncampo;
      if (this.type === 'number') novosItensTemp[idx][campo] = parseFloat(this.value) || 0;
      else novosItensTemp[idx][campo] = this.value;
    });
  });
}

function confirmarAdicionarItem() {
  var validos = novosItensTemp.filter(function(it){ return (it.descricao||'').trim() && (it.quantidade||0) > 0; });
  if (!validos.length) { toast('Preencha pelo menos 1 item válido'); return; }

  var btn = document.getElementById('btnAddItem');
  btn.disabled = true; btn.textContent = 'Adicionando...';

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'adicionaritensreq', usuario: sessao.nome, senha: sessao.hash,
      cidade: edicaoReqTemp.cidade, setor: edicaoReqTemp.setor,
      reqId: edicaoReqTemp.reqId, itens: validos
    }),
    redirect: 'follow'
  })
  .then(function(r){ return r.json(); })
  .then(function(d) {
    if (d.status === 'ok') {
      showSuccess('', 'Itens adicionados!', d.adicionados + ' novos itens');
      fecharAdicionarItem();
      fecharEditReq();
      fecharCidade();
      carregarDados();
    } else {
      toast(d.msg || 'Erro ao adicionar');
      btn.disabled = false; btn.textContent = 'Adicionar à Requisição';
    }
  })
  .catch(function() { toast('Erro de conexão'); btn.disabled = false; btn.textContent = 'Adicionar à Requisição'; });
}

function abrirMoverSetor() {
  if (!edicaoReqTemp) return;
  document.getElementById('moverSetorModal').classList.add('show');
  history.pushState({ modal: 'moverSetor' }, '', '');

  document.getElementById('moverSetorBody').innerHTML =
    '<div style="text-align:center;padding:30px 20px;"><div class="ld-spinner" style="margin:0 auto 16px;"></div>' +
    '<div class="empty-text">Carregando setores...</div></div>';

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'listarsetorescidade', usuario: sessao.nome, senha: sessao.hash,
      cidade: edicaoReqTemp.cidade
    }),
    redirect: 'follow'
  })
  .then(function(r){ return r.json(); })
  .then(function(d) {
    if (d.status !== 'ok') { toast(d.msg || 'Erro'); fecharMoverSetor(); return; }
    var outros = d.setores.filter(function(s){ return s !== edicaoReqTemp.setor; });
    _renderMoverSetor(outros);
  })
  .catch(function() { toast('Erro de conexão'); fecharMoverSetor(); });
}

function fecharMoverSetor() {
  var modal = document.getElementById('moverSetorModal');
  var wasOpen = modal && modal.classList.contains('show');
  if (modal) modal.classList.remove('show');
  if (wasOpen && !_insidePopstate) history.back();
}

function _renderMoverSetor(setores) {
  var h = '<div class="imp-meta-box">';
  h += '<div><strong>Cidade:</strong> ' + escapeHtml(edicaoReqTemp.cidade) + '</div>';
  h += '<div><strong>Requisição:</strong> ' + escapeHtml(edicaoReqTemp.reqId) + '</div>';
  h += '<div><strong>Setor atual:</strong> ' + escapeHtml(edicaoReqTemp.setor) + '</div>';
  h += '</div>';

  h += '<div style="margin:14px 0 6px;font-weight:600;color:var(--text-secondary);font-size:.85rem;">Selecione o novo setor:</div>';

  if (!setores.length) {
    h += '<div class="empty-text" style="padding:20px;">Nenhum outro setor disponível.</div>';
  } else {
    h += '<div style="display:flex;flex-direction:column;gap:8px;margin:12px 0;">';
    setores.forEach(function(s) {
      h += '<button class="setor-pick-btn" onclick="confirmarMoverSetor(\'' + escapeHtml(s).replace(/'/g,"\\'") + '\')" ' +
           'style="text-align:left;padding:14px 16px;background:#f8fafc;border:2px solid #e2e8f0;border-radius:10px;cursor:pointer;font-family:var(--font);font-size:.9rem;font-weight:600;color:#1e3a5f;transition:all .15s;">' +
           '📁 ' + escapeHtml(s) + '</button>';
    });
    h += '</div>';
  }

  h += '<div class="imp-actions"><button class="imp-btn-cancel" onclick="fecharMoverSetor()">Cancelar</button></div>';
  document.getElementById('moverSetorBody').innerHTML = h;
}

function confirmarMoverSetor(setorDestino) {
  if (!confirm('Mover requisição ' + edicaoReqTemp.reqId + ' para o setor "' + setorDestino + '"?\n\nO ID será regerado para o novo setor.')) return;

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'moverrequisicao', usuario: sessao.nome, senha: sessao.hash,
      cidade: edicaoReqTemp.cidade, setorOrigem: edicaoReqTemp.setor,
      setorDestino: setorDestino, reqId: edicaoReqTemp.reqId
    }),
    redirect: 'follow'
  })
  .then(function(r){ return r.json(); })
  .then(function(d) {
    if (d.status === 'ok') {
      showSuccess('', 'Movido com sucesso!', 'Novo ID: ' + d.novoReqId);
      fecharMoverSetor();
      fecharEditReq();
      fecharCidade();
      carregarDados();
    } else {
      toast(d.msg || 'Erro ao mover');
    }
  })
  .catch(function() { toast('Erro de conexão'); });
}

// ══════════════════════════════════════════════════════════════
//  💰 v8.6: CATÁLOGO DE PREÇO DE CUSTO — modo dual
// ══════════════════════════════════════════════════════════════
var catalogoCusto = [];
var _modoCatalogoCusto = 'catalogo';

function abrirCatalogoCusto() {
  document.body.style.overflow = 'hidden';
  document.getElementById('catalogoCustoModal').classList.add('show');
  history.pushState({ modal: 'catalogoCusto' }, '', '');
  _modoCatalogoCusto = 'catalogo';

  document.getElementById('catalogoCustoBody').innerHTML =
    '<div style="text-align:center;padding:40px 20px;"><div class="ld-spinner" style="margin:0 auto 16px;"></div>' +
    '<div class="empty-text">Carregando catálogo de custo...</div></div>';
  var searchEl = document.getElementById('catalogoCustoSearch');
  if (searchEl) searchEl.value = '';

  fetch(API_URL + '?userHash=' + sessao.hash + '&acao=catalogocusto')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.erro) { toast(d.erro || 'Erro ao carregar'); return; }
      catalogoCusto = d.itens || [];
      renderCatalogoCusto('');
    })
    .catch(function() {
      toast('Erro de conexão');
      document.getElementById('catalogoCustoBody').innerHTML =
        '<div class="empty-state"><div class="empty-text">Erro de conexão. Tente novamente.</div></div>';
    });
}

function alternarModoCustoPainel() {
  if (_modoCatalogoCusto === 'catalogo') {
    _modoCatalogoCusto = 'painel';
    abrirPainelPrecoCustoV86();
  } else {
    _modoCatalogoCusto = 'catalogo';
    renderCatalogoCusto('');
  }
}

function fecharCatalogoCusto() {
  var wasOpen = document.getElementById('catalogoCustoModal').classList.contains('show');
  document.body.style.overflow = '';
  document.getElementById('catalogoCustoModal').classList.remove('show');
  if (wasOpen && !_insidePopstate) history.back();
}

function filtrarCatalogoCusto() {
  var q = document.getElementById('catalogoCustoSearch').value.toLowerCase().trim();
  renderCatalogoCusto(q);
}

function renderCatalogoCusto(filtro) {
  _modoCatalogoCusto = 'catalogo';
  var lista = catalogoCusto;
  if (filtro) {
    lista = catalogoCusto.filter(function(it) {
      return it.descricao.toLowerCase().indexOf(filtro) > -1;
    });
  }

  // Botões: pesquisar + reanalisar + imprimir
  var btnTopo = '<div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;">' +
    '<button onclick="gerarPrecosCustoIA()" style="flex:1;min-width:160px;padding:11px 14px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:.82rem;cursor:pointer;font-family:var(--font);box-shadow:0 3px 12px rgba(22,163,74,0.3);display:flex;align-items:center;justify-content:center;gap:6px;">' +
    '<svg width="16" height="16"><use href="#icon-sparkles"/></svg> Pesquisar Preços (IA)</button>' +
    (catalogoCusto.length >= 2 ? '<button onclick="reanalisarDuplicados()" style="flex:0 0 auto;padding:11px 14px;background:linear-gradient(135deg,#c9a063,#a87f3f);color:#fff;border:none;border-radius:10px;font-weight:600;font-size:.78rem;cursor:pointer;font-family:var(--font);display:flex;align-items:center;gap:6px;">🔍 Reanalisar Duplicados</button>' : '') +
    (catalogoCusto.length > 0 ? '<button onclick="imprimirCatalogoCusto()" style="flex:0 0 auto;padding:11px 14px;background:linear-gradient(135deg,#1e3a5f,#2c5282);color:#fff;border:none;border-radius:10px;font-weight:600;font-size:.78rem;cursor:pointer;font-family:var(--font);display:flex;align-items:center;gap:6px;">🖨️ Imprimir</button>' : '') +
    '</div>';

  if (!lista.length) {
    document.getElementById('catalogoCustoBody').innerHTML = btnTopo +
      '<div class="empty-state"><div class="empty-text">' +
      (filtro ? 'Nenhum item para "' + escapeHtml(filtro) + '"' : 'Catálogo de custo vazio. Clique em "Pesquisar Preço de Custo (IA)" para começar.') +
      '</div></div>';
    return;
  }

  var h = btnTopo + '<div class="cat-meta">' + lista.length + ' ' +
          (lista.length === 1 ? 'item' : 'itens') +
          ' · toque no preço para editar</div>';

  lista.forEach(function(it) {
    var confClass = (it.confianca === 'ALTA') ? 'conf-alta' : (it.confianca === 'MEDIA') ? 'conf-media' : 'conf-baixa';
    var confEmoji = (it.confianca === 'ALTA') ? '🟢' : (it.confianca === 'MEDIA') ? '🟡' : '🔴';
    var baseRef = (it.base_estimativa || it.fonte || '').toString().trim();

    h += '<div class="custo-card">' +
         '<div class="custo-card-nome">' + escapeHtml(it.descricao) + '</div>' +
         '<div class="custo-card-preco-row">' +
         '<div class="cat-valor-wrap">' +
         '<span class="cat-prefix">R$</span>' +
         '<input type="text" inputmode="decimal" class="cat-input" ' +
         'id="input_custo_' + it.linha + '" ' +
         'value="' + formatNum(it.preco_custo) + '" ' +
         'data-linha="' + it.linha + '" ' +
         'data-original="' + it.preco_custo + '" ' +
         'data-desc="' + escapeHtml(it.descricao) + '" ' +
         'onfocus="this.select()" ' +
         'onkeydown="if(event.key===\'Enter\') salvarPrecoCustoIndividual(' + it.linha + ')">' +
         '</div>' +
         '<button class="cat-save-btn" onclick="salvarPrecoCustoIndividual(' + it.linha + ')" title="Salvar">✓</button>' +
         '</div>' +
         '<div class="custo-card-conf">' + confEmoji + ' <span class="custo-conf ' + confClass + '">' + escapeHtml(it.confianca || '') + '</span></div>' +
         (baseRef ? '<div class="custo-card-ref">📍 ' + escapeHtml(baseRef) + '</div>' : '') +
         '</div>';
  });

  document.getElementById('catalogoCustoBody').innerHTML = h;
}

function salvarPrecoCustoIndividual(linha) {
  var input = document.getElementById('input_custo_' + linha);
  if (!input) return;
  var original = parseFloat(input.dataset.original);
  var tmp = document.createElement('span');
  tmp.innerHTML = input.dataset.desc || '';
  var desc = tmp.textContent || tmp.innerText || '';
  var novo = parseValorBR(input.value);

  if (novo === null || novo < 0) { toast('Valor inválido'); input.value = formatNum(original); return; }
  if (Math.abs(novo - original) < 0.001) { input.value = formatNum(original); input.blur(); return; }

  input.dataset.original = novo;
  input.value = formatNum(novo);
  input.blur();

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'salvarprecoscusto', usuario: sessao.nome, senha: sessao.hash,
      itens: [{ descricao: desc, preco_custo: novo, confianca: 'MANUAL', base_estimativa: 'Editado manualmente' }]
    }),
    redirect: 'follow'
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.status === 'ok') {
      for (var i = 0; i < catalogoCusto.length; i++) {
        if (catalogoCusto[i].linha === linha) { catalogoCusto[i].preco_custo = novo; catalogoCusto[i].confianca = 'MANUAL'; break; }
      }
      toast('Preço de custo salvo');
      _precoCustoCache = null;
    } else {
      toast(d.msg || 'Erro ao salvar');
      input.value = formatNum(original);
      input.dataset.original = original;
    }
  })
  .catch(function() { toast('Erro de conexão'); input.value = formatNum(original); input.dataset.original = original; });
}

// ══════════════════════════════════════════════════════════════
//  💰 v8.6: PAINEL PREÇO DE CUSTO (setor a setor + dedup)
// ══════════════════════════════════════════════════════════════
function gerarPrecosCustoIA() {
  // Compatibilidade — redireciona para o painel novo
  abrirPainelPrecoCustoV86();
}

function abrirPainelPrecoCustoV86() {
  if (!dadosCompletos || !dadosCompletos.cidades) {
    toast('Carregue os dados primeiro');
    return;
  }

  precoCustoSetores = [];
  dadosCompletos.cidades.forEach(function(c) {
    (c.setores || []).forEach(function(s) {
      if (s.itens && s.itens.length > 0) {
        precoCustoSetores.push({
          cidade: c.nome, setor: s.nome,
          itens: s.itens.length, processado: false
        });
      }
    });
  });

  if (!precoCustoSetores.length) {
    toast('Nenhum setor com itens encontrado');
    return;
  }

  renderizarPainelPrecoCusto();
}

function renderizarPainelPrecoCusto() {
  var container = document.getElementById('catalogoCustoBody');
  if (!container) return;

  var totalBruto = 0;
  precoCustoSetores.forEach(function(s) { totalBruto += s.itens; });
  var processados = precoCustoSetores.filter(function(s) { return s.processado; }).length;
  var unicos = Object.keys(precoCustoJaProcessados).length;
  var todosFeitos = precoCustoSetores.length > 0 && precoCustoSetores.every(function(s) { return s.processado; });

  var html = '';

  // Botão voltar ao catálogo
  html += '<div style="margin-bottom:10px;">';
  html += '<button onclick="alternarModoCustoPainel()" style="padding:8px 14px;background:var(--surface-2);color:var(--text-secondary);border:1px solid var(--border);border-radius:8px;font-weight:600;font-size:.75rem;cursor:pointer;font-family:var(--font);">← Voltar ao Catálogo</button>';
  html += '</div>';

  html += '<div class="pc-header">';
  html += '<h3 style="margin:0 0 6px 0;color:var(--accent);font-size:.95rem;font-weight:700;">💰 Estimativa de Preço de Custo — IA</h3>';
  html += '<p style="margin:0 0 12px 0;color:var(--text-tertiary);font-size:.72rem;line-height:1.5;">Os valores são <strong style="color:var(--text-secondary);">estimativas geradas por IA</strong> com base em dados de atacadistas e distribuidores regionais.</p>';

  html += '<div class="pc-stats">';
  html += '<span class="pc-stat">📊 ' + precoCustoSetores.length + ' setores</span>';
  html += '<span class="pc-stat">📦 ' + totalBruto + ' itens brutos</span>';
  html += '<span class="pc-stat ' + (processados === precoCustoSetores.length && processados > 0 ? 'pc-stat-ok' : '') + '">✅ ' + processados + '/' + precoCustoSetores.length + '</span>';
  html += '<span class="pc-stat">🔍 ' + unicos + ' produtos únicos</span>';
  if (precoCustoTotalCusto > 0) {
    html += '<span class="pc-stat pc-stat-custo">💲 R$ ' + precoCustoTotalCusto.toFixed(4) + '</span>';
  }
  html += '</div>';

  html += '<div class="pc-actions">';
  if (!precoCustoPesquisando) {
    if (!todosFeitos) {
      html += '<button class="btn-pesquisar-custo" onclick="iniciarPesquisaCustoProgressiva()">🔍 Próximo Setor</button>';
      html += '<button class="btn-pesquisar-todos" onclick="pesquisarTodosSetoresCusto()">🚀 Estimar Todos</button>';
    }
    if (precoCustoResultados.length > 0) {
      html += '<button class="btn-salvar-custo" onclick="salvarTodosPrecosCusto()">💾 Salvar ' + precoCustoResultados.length + '</button>';
    }
    html += '<button class="btn-reset-custo" onclick="resetarPesquisaCusto()">🔄 Resetar</button>';
  } else {
    html += '<div class="pc-pesquisando"><div class="spinner-pequeno"></div> Estimando preços...</div>';
  }
  html += '</div>';
  html += '</div>';

  if (precoCustoSetores.length > 0) {
    html += '<div class="pc-setores-grid">';
    precoCustoSetores.forEach(function(s, idx) {
      var carregando = precoCustoPesquisando && precoCustoSetorAtual === idx;
      var cls = s.processado ? 'pc-setor-done' : (carregando ? 'pc-setor-loading' : 'pc-setor-pending');
      var icon = s.processado ? '✅' : (carregando ? '🔄' : '⏳');
      html += '<div class="pc-setor-card ' + cls + '">';
      html += '<span class="pc-setor-icon">' + icon + '</span>';
      html += '<span class="pc-setor-info"><strong>' + escapeHtml(s.cidade) + '</strong><small>' + escapeHtml(s.setor) + ' (' + s.itens + ' itens)</small></span>';
      if (!s.processado && !precoCustoPesquisando) {
        html += '<button class="pc-setor-btn" onclick="pesquisarSetorEspecifico(' + idx + ')" title="Estimar só este setor">🔍</button>';
      }
      html += '</div>';
    });
    html += '</div>';
  }

  if (precoCustoResultados.length > 0) {
    var ordenados = precoCustoResultados.slice().sort(function(a, b) {
      return (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR');
    });

    html += '<div class="pc-resultados">';
    html += '<h4 style="color:var(--accent);margin:16px 0 10px 0;font-size:.82rem;">📋 Estimativas (' + ordenados.length + ' produtos únicos)</h4>';

    ordenados.forEach(function(r) {
      var conf = (r.confianca || 'MEDIA').toUpperCase();
      var confClass = 'pc-conf-' + conf.toLowerCase();
      var confEmoji = conf === 'ALTA' ? '🟢' : (conf === 'MEDIA' ? '🟡' : '🔴');
      var base = (r.base_estimativa || r.fonte || 'Estimativa IA').toString();

      html += '<div class="pc-resultado-card">';
      html += '<div class="pc-resultado-nome">' + escapeHtml(r.descricao || '') + '</div>';
      html += '<div class="pc-resultado-preco">';
      html += '<span class="pc-preco-valor">R$ ' + formatNum(r.preco_custo || 0) + '</span>';
      html += '<span class="pc-conf-badge ' + confClass + '">' + confEmoji + ' ' + conf + '</span>';
      html += '</div>';
      html += '<div class="pc-resultado-ref">🤖 Estimativa IA — ' + escapeHtml(base) + '</div>';
      html += '</div>';
    });

    html += '</div>';
  }

  container.innerHTML = html;
}

function pesquisarSetorEspecifico(idx) {
  if (precoCustoPesquisando) return;
  if (idx < 0 || idx >= precoCustoSetores.length) return;
  if (precoCustoSetores[idx].processado) { toast('Setor já estimado'); return; }
  precoCustoSetorAtual = idx;
  _executarPesquisaSetor(idx, function() { renderizarPainelPrecoCusto(); });
}

function iniciarPesquisaCustoProgressiva() {
  if (precoCustoPesquisando) return;
  for (var i = 0; i < precoCustoSetores.length; i++) {
    if (!precoCustoSetores[i].processado) { pesquisarSetorEspecifico(i); return; }
  }
  toast('Todos os setores já foram estimados!');
}

function pesquisarTodosSetoresCusto() {
  if (precoCustoPesquisando) return;
  var pendentes = precoCustoSetores.filter(function(s) { return !s.processado; });
  if (!pendentes.length) { toast('Todos já processados!'); return; }

  // Calcular quantos itens únicos realmente vão ser enviados
  var simNovos = 0;
  var simJa = Object.assign({}, precoCustoJaProcessados);
  pendentes.forEach(function(s) {
    var cid = (dadosCompletos.cidades || []).find(function(c) { return c.nome === s.cidade; });
    var setObj = cid ? (cid.setores || []).find(function(st) { return st.nome === s.setor; }) : null;
    (setObj && setObj.itens || []).forEach(function(it) {
      var norm = _normFront((it.descricao || '').trim());
      if (norm && !simJa[norm]) { simJa[norm] = true; simNovos++; }
    });
  });

  if (!confirm(
    'Estimar preços de ' + pendentes.length + ' setores?\n\n' +
    '• ' + simNovos + ' produtos únicos novos\n' +
    '• Duplicados são pulados automaticamente (custo zero)\n' +
    '• O custo real aparece no painel após a pesquisa'
  )) return;

  _seqLoopCusto(0);
}

function _seqLoopCusto(start) {
  for (var i = start; i < precoCustoSetores.length; i++) {
    if (!precoCustoSetores[i].processado) {
      precoCustoSetorAtual = i;
      _executarPesquisaSetor(i, function() {
        setTimeout(function() { _seqLoopCusto(precoCustoSetorAtual + 1); }, 400);
      });
      return;
    }
  }
  showSuccess('', 'Estimativa completa!', precoCustoResultados.length + ' produtos únicos');
  renderizarPainelPrecoCusto();
}

function _executarPesquisaSetor(idx, callback) {
  var s = precoCustoSetores[idx];

  // ── DEDUP 100% NO FRONTEND: filtrar itens deste setor que já foram processados ──
  var cid = (dadosCompletos.cidades || []).find(function(c) { return c.nome === s.cidade; });
  var setorObj = cid ? (cid.setores || []).find(function(st) { return st.nome === s.setor; }) : null;
  var itensDoSetor = (setorObj && setorObj.itens) ? setorObj.itens : [];

  var itensNovos = [];
  var ignorados = 0;
  itensDoSetor.forEach(function(it) {
    var desc = (it.descricao || '').trim();
    if (!desc) return;
    var norm = _normFront(desc);
    if (!norm) return;
    if (precoCustoJaProcessados[norm]) { ignorados++; return; }
    // Marcar AGORA para não enviar duplicado mesmo dentro deste setor
    precoCustoJaProcessados[norm] = true;
    itensNovos.push({ descricao: desc, um: it.um || '' });
  });

  // Se todos os itens deste setor já foram processados, pular sem chamar a IA
  if (!itensNovos.length) {
    precoCustoSetores[idx].processado = true;
    toast('⏭️ ' + s.cidade + '/' + s.setor + ' — ' + ignorados + ' itens já estimados, pulou');
    renderizarPainelPrecoCusto();
    if (callback) callback();
    return;
  }

  precoCustoPesquisando = true;
  renderizarPainelPrecoCusto();
  toast('🤖 Estimando: ' + s.cidade + ' → ' + s.setor + ' (' + itensNovos.length + ' novos, ' + ignorados + ' já feitos)...');

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'pesquisarprecoscusto', usuario: sessao.nome, senha: sessao.hash,
      cidade: s.cidade, setor: s.setor,
      itensFiltrados: itensNovos,
      regiao: 'interior da Bahia, Brasil'
    }),
    redirect: 'follow'
  })
  .then(function(r) { return r.json(); })
  .then(function(resp) {
    precoCustoPesquisando = false;
    precoCustoSetores[idx].processado = true;

    if (resp.status === 'erro') {
      toast('❌ ' + (resp.msg || 'Erro'));
      renderizarPainelPrecoCusto();
      if (callback) callback();
      return;
    }

    (resp.precos || []).forEach(function(p) {
      var norm = _normFront(p.descricao || '');
      var existe = precoCustoResultados.some(function(r) { return _normFront(r.descricao || '') === norm; });
      if (!existe) {
        precoCustoResultados.push({
          descricao: p.descricao || '',
          preco_custo: parseFloat(p.preco_custo) || 0,
          confianca: p.confianca || 'MEDIA',
          base_estimativa: p.base_estimativa || 'Estimativa IA'
        });
      }
    });

    var tIn = resp.tokensIn || 0;
    var tOut = resp.tokensOut || 0;
    precoCustoTotalCusto += ((tIn * 0.15 / 1000000) + (tOut * 0.60 / 1000000)) * 5.50;

    toast('✅ ' + s.cidade + '/' + s.setor + ': ' + itensNovos.length + ' estimados, ' + ignorados + ' pulados');
    renderizarPainelPrecoCusto();
    if (callback) callback();
  })
  .catch(function(err) {
    precoCustoPesquisando = false;
    precoCustoSetores[idx].processado = true;
    toast('❌ Erro de rede: ' + err.toString());
    renderizarPainelPrecoCusto();
    if (callback) callback();
  });
}

function salvarTodosPrecosCusto() {
  if (!precoCustoResultados.length) { toast('Nenhum resultado para salvar'); return; }
  if (!confirm(
    'Salvar ' + precoCustoResultados.length + ' estimativas?\n\n' +
    'Preços marcados como MANUAL não serão sobrescritos.'
  )) return;

  toast('💾 Salvando ' + precoCustoResultados.length + ' preços...');

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'salvarprecoscusto', usuario: sessao.nome, senha: sessao.hash,
      itens: precoCustoResultados
    }),
    redirect: 'follow'
  })
  .then(function(r) { return r.json(); })
  .then(function(resp) {
    if (resp.status === 'ok') {
      var msg = (resp.inseridos || 0) + ' novos, ' + (resp.atualizados || 0) + ' atualizados';
      if (resp.protegidos > 0) msg += ', ' + resp.protegidos + ' protegidos';
      showSuccess('', 'Preços salvos!', msg);
      _precoCustoCache = null;
      fetch(API_URL + '?userHash=' + sessao.hash + '&acao=catalogocusto')
        .then(function(r) { return r.json(); })
        .then(function(d) { catalogoCusto = (d.itens || []); })
        .catch(function() {});
    } else {
      toast('❌ ' + (resp.msg || 'Erro ao salvar'));
    }
  })
  .catch(function(err) { toast('❌ Erro: ' + err); });
}

function resetarPesquisaCusto() {
  if (precoCustoPesquisando) return;
  if (precoCustoResultados.length > 0 &&
      !confirm('Descartar ' + precoCustoResultados.length + ' resultados não salvos?')) return;
  precoCustoJaProcessados = {};
  precoCustoResultados = [];
  precoCustoSetorAtual = 0;
  precoCustoTotalCusto = 0;
  precoCustoSetores.forEach(function(s) { s.processado = false; });
  renderizarPainelPrecoCusto();
  toast('🔄 Resetado');
}

// Utilitários de normalização (espelha o backend)
var _PC_UMS = ['UN','CX','FD','FARDO','KG','L','PCT','G','SC','DZ','UNID','UND','ML','GR','LT'];

function _normFront(desc) {
  var n = desc.toString().toUpperCase().trim();
  // Remove texto entre colchetes [escola X]
  n = n.replace(/\s*\[.*?\]\s*/g, ' ').trim();
  // Remove contexto descritivo: "PARA FESTA", "PARA MERENDA", "P/ EVENTO", "PARA LANCHE"
  n = n.replace(/\s+(PARA|P\/|P\.)\s+(FESTA|MERENDA|EVENTO|LANCHE|ESCOLA|CRECHE|HOSPITAL|DISTRIBUIÇÃO|DOAÇÃO|CONSUMO|PREPARO|COZINHA|REFEITÓRIO|USO)\b.*$/i, '').trim();
  // Remove peso/volume no final: "ARROZ 5KG" → "ARROZ"
  n = n.replace(/\s+\d+(\.\d+)?\s*(KG|G|GR|L|LT|ML|UN|UND|UNID|CX|PCT|FD|FARDO|SC|DZ)\s*$/i, '').trim();
  // Remove unidade solta no final: "ARROZ KG" → "ARROZ"
  var pts = n.split(/\s+/);
  if (pts.length > 1 && _PC_UMS.indexOf(pts[pts.length - 1]) > -1) { pts.pop(); n = pts.join(' '); }
  // Remove quantidade solta no final: "ARROZ 10" → "ARROZ"
  pts = n.split(/\s+/);
  if (pts.length > 1 && /^\d+(\.\d+)?$/.test(pts[pts.length - 1])) { pts.pop(); n = pts.join(' '); }
  // Remove variações de embalagem
  n = n.replace(/\s+(DUZIA|CARTELA|BANDEJA|SACO|CAIXA|PACOTE|GARRAFA|LATA|POTE|BALDE|GALÃO|ROLO|LITRO|UNIDADE)\s*$/i, '').trim();
  return n.replace(/\s+/g, ' ').trim();
}

// ══════════════════════════════════════════════════════════════
//  🔍 v8.6.9: REANALISAR DUPLICADOS NO CATÁLOGO DE CUSTO
// ══════════════════════════════════════════════════════════════
function reanalisarDuplicados() {
  if (catalogoCusto.length < 2) { toast('Catálogo precisa de pelo menos 2 itens'); return; }

  var container = document.getElementById('catalogoCustoBody');
  container.innerHTML =
    '<div style="text-align:center;padding:60px 20px;">' +
    '<div class="ld-spinner" style="margin:0 auto 20px;"></div>' +
    '<div style="color:var(--text-primary);font-weight:600;margin-bottom:6px;">IA analisando duplicados...</div>' +
    '<div style="color:var(--text-tertiary);font-size:.75rem;">' + catalogoCusto.length + ' itens · erros de digitação, variações</div></div>';

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'reanalisarduplicados',
      usuario: sessao.nome,
      senha: sessao.hash
    }),
    redirect: 'follow'
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.status !== 'ok') { toast(d.msg || 'Erro'); renderCatalogoCusto(''); return; }
    var grupos = d.grupos || [];
    if (!grupos.length) {
      toast('Nenhum duplicado encontrado!');
      renderCatalogoCusto('');
      return;
    }
    _renderPreviewDuplicados(grupos);
  })
  .catch(function() { toast('Erro de conexão'); renderCatalogoCusto(''); });
}

function _renderPreviewDuplicados(grupos) {
  var container = document.getElementById('catalogoCustoBody');
  var h = '';

  h += '<div style="margin-bottom:12px;">' +
    '<button onclick="renderCatalogoCusto(\'\')" style="padding:8px 14px;background:var(--surface-2);color:var(--text-secondary);border:1px solid var(--border);border-radius:8px;font-weight:600;font-size:.75rem;cursor:pointer;font-family:var(--font);">← Voltar ao Catálogo</button>' +
    '</div>';

  h += '<div style="margin-bottom:16px;">' +
    '<h3 style="margin:0 0 6px;color:var(--accent);font-size:.95rem;">🔍 Duplicados Encontrados</h3>' +
    '<p style="margin:0;color:var(--text-tertiary);font-size:.72rem;">A IA encontrou ' + grupos.length + ' grupo(s) de possíveis duplicados. Marque os que deseja remover.</p>' +
    '</div>';

  grupos.forEach(function(g, gIdx) {
    h += '<div class="dup-grupo" style="border:1px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden;">';
    h += '<div style="background:rgba(201,160,99,0.1);padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">';
    h += '<div><strong style="color:var(--text-primary);font-size:.85rem;">✏️ Manter como:</strong> <span style="color:var(--accent);font-weight:700;">' + escapeHtml(g.manter) + '</span></div>';
    h += '<span style="font-size:.7rem;color:var(--text-tertiary);">' + escapeHtml(g.motivo || '') + '</span>';
    h += '</div>';

    (g.itens_detalhes || []).forEach(function(it) {
      var isCorreto = (it.descricao || '').toUpperCase().trim() === (g.manter || '').toUpperCase().trim();
      h += '<div style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-top:1px solid var(--border,#222);font-size:.8rem;">';
      if (isCorreto) {
        h += '<span style="color:#16a34a;font-weight:700;font-size:.7rem;width:60px;">✅ MANTER</span>';
      } else {
        h += '<input type="checkbox" checked class="dup-check" data-gidx="' + gIdx + '" data-linha="' + it.linha + '" style="width:18px;height:18px;accent-color:#dc2626;">';
      }
      h += '<span style="flex:1;color:var(--text-primary);">' + escapeHtml(it.descricao || '') + '</span>';
      h += '<span style="color:var(--text-tertiary);font-size:.75rem;">L' + it.linha + '</span>';
      h += '<span style="color:var(--accent);font-weight:600;white-space:nowrap;">' + formatCurrency(it.preco_custo || 0) + '</span>';
      h += '</div>';
    });
    h += '</div>';
  });

  h += '<div style="display:flex;gap:8px;margin-top:16px;">';
  h += '<button onclick="renderCatalogoCusto(\'\')" style="flex:1;padding:12px;background:var(--surface-2);color:var(--text-primary);border:1px solid var(--border);border-radius:10px;font-weight:600;font-size:.85rem;cursor:pointer;font-family:var(--font);">Cancelar</button>';
  h += '<button id="btnConfirmarDup" onclick="_confirmarRemocaoDuplicados()" style="flex:1;padding:12px;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:.85rem;cursor:pointer;font-family:var(--font);box-shadow:0 3px 12px rgba(220,38,38,0.3);">🗑️ Remover Selecionados</button>';
  h += '</div>';

  // Guardar grupos para referência
  window._dupGrupos = grupos;
  container.innerHTML = h;
}

function _confirmarRemocaoDuplicados() {
  var checkboxes = document.querySelectorAll('.dup-check:checked');
  if (!checkboxes.length) { toast('Nenhum item marcado para remover'); return; }

  var linhasRemover = [];
  var renomear = [];

  // Para cada grupo, ver se tem item mantido que precisa renomear
  var gruposUsados = {};
  checkboxes.forEach(function(chk) {
    var gIdx = parseInt(chk.dataset.gidx);
    var linha = parseInt(chk.dataset.linha);
    linhasRemover.push(linha);
    gruposUsados[gIdx] = true;
  });

  // Para cada grupo que teve remoção, renomear o item mantido para o nome correto
  Object.keys(gruposUsados).forEach(function(gIdx) {
    var g = window._dupGrupos[parseInt(gIdx)];
    if (!g) return;
    var nomeCorreto = g.manter;
    (g.itens_detalhes || []).forEach(function(it) {
      if (linhasRemover.indexOf(it.linha) === -1) {
        // Este é o que fica — renomear se necessário
        if ((it.descricao || '').toUpperCase().trim() !== nomeCorreto.toUpperCase().trim()) {
          renomear.push({ linha: it.linha, novoNome: nomeCorreto });
        }
      }
    });
  });

  if (!confirm('Remover ' + linhasRemover.length + ' item(ns) duplicado(s)?\n\nEssa ação é permanente.')) return;

  var btn = document.getElementById('btnConfirmarDup');
  if (btn) { btn.disabled = true; btn.textContent = 'Removendo...'; }

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'removerduplicadoscusto',
      usuario: sessao.nome,
      senha: sessao.hash,
      linhas: linhasRemover,
      renomear: renomear
    }),
    redirect: 'follow'
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.status === 'ok') {
      showSuccess('', 'Duplicados removidos!', d.removidos + ' removidos · ' + d.renomeados + ' corrigidos');
      _precoCustoCache = null;
      // Recarregar catálogo
      fetch(API_URL + '?userHash=' + sessao.hash + '&acao=catalogocusto')
        .then(function(r) { return r.json(); })
        .then(function(d2) {
          catalogoCusto = (d2.itens || []);
          renderCatalogoCusto('');
        })
        .catch(function() { renderCatalogoCusto(''); });
    } else {
      toast(d.msg || 'Erro ao remover');
      if (btn) { btn.disabled = false; btn.textContent = '🗑️ Remover Selecionados'; }
    }
  })
  .catch(function() {
    toast('Erro de conexão');
    if (btn) { btn.disabled = false; btn.textContent = '🗑️ Remover Selecionados'; }
  });
}

// Cache de referência de custo (usado no modal cidade)
var _precoCustoCache = null;

function _carregarPrecosCustoParaRef(callback) {
  if (_precoCustoCache) { callback(_precoCustoCache); return; }
  fetch(API_URL + '?userHash=' + sessao.hash + '&acao=catalogocusto')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      _precoCustoCache = {};
      if (!d.erro && Array.isArray(d.itens)) {
        d.itens.forEach(function(it) {
          var key = (it.descricao || '').toUpperCase().trim();
          if (key && it.preco_custo > 0) _precoCustoCache[key] = it.preco_custo;
        });
      }
      callback(_precoCustoCache);
    })
    .catch(function() { _precoCustoCache = {}; callback(_precoCustoCache); });
}

// Impressão do catálogo de custo
function imprimirCatalogoCusto() {
  if (!catalogoCusto.length) { toast('Catálogo vazio'); return; }

  var hoje = new Date();
  var dataHoje = String(hoje.getDate()).padStart(2,'0') + '/' + String(hoje.getMonth()+1).padStart(2,'0') + '/' + hoje.getFullYear();
  var hora = String(hoje.getHours()).padStart(2,'0') + ':' + String(hoje.getMinutes()).padStart(2,'0');

  var corpo = '<div class="pdf-header">' +
    '<div class="pdf-brand">GRUPO CARLOS VAZ</div>' +
    '<div class="pdf-divider"></div>' +
    '<div class="pdf-title">Catálogo de Preço de Custo</div>' +
    '<div class="pdf-meta">Emitido em ' + dataHoje + ' às ' + hora + '</div></div>';

  corpo += '<div class="pdf-req-block"><table class="pdf-table"><thead><tr>' +
    '<th style="width:5%;text-align:center;">#</th>' +
    '<th style="width:45%;">Descrição</th>' +
    '<th style="width:18%;text-align:right;">Preço de Custo</th>' +
    '<th style="width:12%;text-align:center;">Confiança</th>' +
    '<th style="width:20%;text-align:left;">Base IA</th>' +
    '</tr></thead><tbody>';

  catalogoCusto.forEach(function(it, idx) {
    var bg = idx % 2 === 0 ? '#fff' : '#f4f6f9';
    corpo += '<tr style="background:' + bg + ';">' +
      '<td style="text-align:center;color:#64748b;">' + (idx + 1) + '</td>' +
      '<td style="font-weight:500;">' + escapeHtml(it.descricao) + '</td>' +
      '<td style="text-align:right;font-weight:600;">' + formatCurrency(it.preco_custo) + '</td>' +
      '<td style="text-align:center;font-size:9px;">' + escapeHtml(it.confianca || '') + '</td>' +
      '<td style="font-size:9px;color:#64748b;font-style:italic;">' + escapeHtml(it.base_estimativa || it.fonte || '') + '</td></tr>';
  });

  corpo += '</tbody></table></div>';
  _abrirJanelaImpressao('Catálogo Preço de Custo', corpo);
}
