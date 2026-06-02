// ============================================================
//  REQUISIÇÕES DIGITAL — app.js v8.7.0 PREMIUM
//  Grupo Carlos Vaz — CRV/LAS
//  v8.7: Virada de Mês via PWA + Histórico visual + Mês específico
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

// ── v8.7: Histórico de Meses ──
var historicoMeses = null;

// ══════════════════════════════════════════════════════════════
//  INIT & LOGIN
// ══════════════════════════════════════════════════════════════
var APP_VERSION = '8.7.0';
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
  sessao = null; dadosCompletos = null; catalogo = []; comandosIA = []; historicoMeses = null;
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
  if (document.getElementById('mesDetalheModal').classList.contains('show')) fecharMesDetalhe();
  else if (document.getElementById('historicoModal').classList.contains('show')) fecharHistorico();
  else if (document.getElementById('viradaMesModal').classList.contains('show')) fecharViradaMes();
  else if (document.getElementById('editReqModal').classList.contains('show')) fecharEditReq();
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
    else if (acao === 'viradaMes') abrirViradaMes();
    else if (acao === 'historicoMeses') abrirHistoricoCompleto();
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
  carregarHistorico();
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

function carregarHistorico() {
  fetch(API_URL + '?userHash=' + sessao.hash + '&acao=historico')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status === 'ok') {
        historicoMeses = d.meses || [];
        renderHistoricoDashboard();
      }
    })
    .catch(function() { /* silencioso */ });
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
//  v8.7: HISTÓRICO NO DASHBOARD (últimos 3 meses)
// ══════════════════════════════════════════════════════════════
function renderHistoricoDashboard() {
  var container = document.getElementById('historicoCards');
  if (!container) return;

  if (!historicoMeses || !historicoMeses.length) {
    container.innerHTML = '<div class="hist-empty"><div class="hist-empty-text">Nenhum mês arquivado ainda. Use "Virada de Mês" no menu para arquivar o mês atual.</div></div>';
    return;
  }

  // Mostrar últimos 3
  var ultimos = historicoMeses.slice(-3).reverse();
  var maxTotal = 1;
  ultimos.forEach(function(m) { if (m.total > maxTotal) maxTotal = m.total; });

  var CIDADES_ORDEM = ['Ibicuí', 'Nova Canaã', 'Boa Nova', 'Dário Meira', 'Floresta Azul'];
  var h = '';

  ultimos.forEach(function(mes) {
    h += '<div class="hist-mes-card" onclick="abrirMesDetalhe(\'' + escapeHtml(mes.nome) + '\')">';
    h += '<div class="hist-mes-top">';
    h += '<div class="hist-mes-nome">' + escapeHtml(mes.nome) + '</div>';
    h += '<div class="hist-mes-total">' + formatCurrency(mes.total) + '</div>';
    h += '</div>';

    h += '<div class="hist-mes-cidades">';
    CIDADES_ORDEM.forEach(function(cid) {
      var val = (mes.cidades && mes.cidades[cid]) ? mes.cidades[cid] : 0;
      if (val > 0) {
        h += '<span class="hist-cidade-chip">' + escapeHtml(cid) + ' <span class="hcc-valor">' + formatCurrency(val) + '</span></span>';
      }
    });
    h += '</div>';

    // Mini barras comparativas
    h += '<div class="hist-bars">';
    var maxCid = 1;
    CIDADES_ORDEM.forEach(function(cid) {
      var val = (mes.cidades && mes.cidades[cid]) ? mes.cidades[cid] : 0;
      if (val > maxCid) maxCid = val;
    });
    CIDADES_ORDEM.forEach(function(cid) {
      var val = (mes.cidades && mes.cidades[cid]) ? mes.cidades[cid] : 0;
      var pct = maxCid > 0 ? Math.max(2, (val / maxCid) * 100) : 2;
      h += '<div class="hist-bar" style="height:' + pct + '%" title="' + escapeHtml(cid) + ': ' + formatCurrency(val) + '"></div>';
    });
    h += '</div>';

    h += '</div>';
  });

  container.innerHTML = h;
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
    var mapaNorm = {};
    Object.keys(mapa).forEach(function(k) { mapaNorm[_normFront(k)] = mapa[k]; });

    document.querySelectorAll('.item-custo-ref[data-desc-custo]').forEach(function(el) {
      var rawKey = el.getAttribute('data-desc-custo') || '';
      var tmp = document.createElement('span');
      tmp.innerHTML = rawKey;
      var descOriginal = (tmp.textContent || tmp.innerText || '').toUpperCase().trim();

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
//  EDIÇÃO DE REQUISIÇÃO
// ══════════════════════════════════════════════════════════════
var editTemp = null;

function editarRequisicao(cidade, setor, reqId) {
  if (!dadosCompletos) return;
  var cid = dadosCompletos.cidades.find(function(c) { return c.nome === cidade; });
  if (!cid) return;
  var set = cid.setores.find(function(s) { return s.nome === setor; });
  if (!set) return;

  var itens = set.itens.filter(function(it) { return (it.requisicao || '-') === reqId; });
  if (!itens.length) { toast('Requisição não encontrada'); return; }

  editTemp = {
    cidade: cidade,
    setor: setor,
    reqId: reqId,
    setorOriginal: setor,
    itens: itens.map(function(it) {
      return {
        linha: it.linha,
        descricao: it.descricao,
        quantidade: it.quantidade,
        um: it.um || '',
        valorUnit: it.valorUnit || 0,
        total: it.total || 0,
        observacao: it.observacao || '',
        data: it.data || '',
        destinatario: it.destinatario || ''
      };
    }),
    observacao: itens[0].observacao || '',
    data: itens[0].data || ''
  };

  renderEditReq();
  document.getElementById('editReqModal').classList.add('show');
  document.body.style.overflow = 'hidden';
  history.pushState({ modal: 'editReq' }, '', '');
}

function fecharEditReq() {
  var wasOpen = document.getElementById('editReqModal').classList.contains('show');
  document.getElementById('editReqModal').classList.remove('show');
  document.body.style.overflow = '';
  editTemp = null;
  if (wasOpen && !_insidePopstate) history.back();
}

function renderEditReq() {
  if (!editTemp) return;
  document.getElementById('editReqTitle').textContent = editTemp.reqId + ' — ' + editTemp.cidade;

  var h = '';

  // Cabeçalho: observação e data
  h += '<div class="edit-header-box">';
  h += '<label class="edit-label">Observação<input type="text" class="edit-input" id="editObs" value="' + escapeHtml(editTemp.observacao) + '"></label>';
  h += '<label class="edit-label">Data<input type="date" class="edit-input" id="editData" value="' + _brParaIso(editTemp.data) + '"></label>';

  // Select para mover de setor
  h += '<label class="edit-label">Setor atual';
  h += '<select id="editSetorMover" class="edit-input">';
  SETORES_PADRAO.forEach(function(s) {
    var sel = (s === editTemp.setor) ? ' selected' : '';
    h += '<option value="' + escapeHtml(s) + '"' + sel + '>' + escapeHtml(s) + '</option>';
  });
  h += '</select></label>';
  h += '</div>';

  // Itens
  editTemp.itens.forEach(function(it, idx) {
    h += '<div class="edit-item-row">';
    h += '<div class="edit-item-head"><span class="edit-item-num">' + (idx + 1) + '</span>';
    h += '<input class="edit-item-desc" value="' + escapeHtml(it.descricao) + '" data-idx="' + idx + '" data-campo="descricao"></div>';

    if (it.destinatario) {
      h += '<label class="edit-sublabel">Escola/Local<input class="edit-input edit-dest" value="' + escapeHtml(it.destinatario) + '" data-idx="' + idx + '" data-campo="destinatario"></label>';
    }

    h += '<div class="edit-item-grid">';
    h += '<label>Qtd<input type="number" step="0.01" class="edit-input" value="' + it.quantidade + '" data-idx="' + idx + '" data-campo="quantidade" onchange="editRecalcTotal(' + idx + ')"></label>';
    h += '<label>Un<input class="edit-input" value="' + escapeHtml(it.um) + '" data-idx="' + idx + '" data-campo="um"></label>';
    h += '<label>Unit R$<input type="number" step="0.01" class="edit-input" value="' + (it.valorUnit || 0).toFixed(2) + '" data-idx="' + idx + '" data-campo="valorUnit" id="editUnit' + idx + '" onchange="editRecalcTotal(' + idx + ')"></label>';
    h += '<label>Total R$<input type="number" step="0.01" class="edit-input" value="' + (it.total || 0).toFixed(2) + '" data-idx="' + idx + '" data-campo="total" id="editTotal' + idx + '" readonly></label>';
    h += '</div>';

    h += '<button class="edit-remove-btn" onclick="editRemoverItem(' + idx + ')">Remover item</button>';
    h += '</div>';
  });

  // Adicionar item
  h += '<button class="imp-add-item-btn" onclick="editAdicionarItem()" style="margin:12px 0;">';
  h += '<span class="iaim-icon">+</span>';
  h += '<span class="iaim-text"><span class="iaim-title">Adicionar item</span>';
  h += '<span class="iaim-sub">Inclua um novo item nesta requisição</span></span>';
  h += '</button>';

  // Total
  var totalReq = 0;
  editTemp.itens.forEach(function(it) { totalReq += (it.total || 0); });
  h += '<div class="imp-total-box">Total: <strong id="editTotalGeral">' + formatCurrency(totalReq) + '</strong></div>';

  // Botões
  h += '<div class="edit-actions">';
  h += '<button class="imp-btn-cancel" onclick="editExcluirRequisicao()">Excluir Requisição</button>';
  h += '<button class="imp-btn-confirm" onclick="editSalvar()">Salvar Alterações</button>';
  h += '</div>';

  document.getElementById('editReqBody').innerHTML = h;

  // Bind inputs
  document.querySelectorAll('#editReqBody input[data-idx]').forEach(function(inp) {
    inp.addEventListener('input', function() {
      var idx = parseInt(this.dataset.idx);
      var campo = this.dataset.campo;
      if (campo === 'quantidade' || campo === 'valorUnit' || campo === 'total') {
        editTemp.itens[idx][campo] = parseFloat(this.value) || 0;
      } else {
        editTemp.itens[idx][campo] = this.value;
      }
    });
  });
}

function editRecalcTotal(idx) {
  var it = editTemp.itens[idx];
  it.total = (it.quantidade || 0) * (it.valorUnit || 0);
  var el = document.getElementById('editTotal' + idx);
  if (el) el.value = it.total.toFixed(2);
  _editRecalcGeral();
}

function _editRecalcGeral() {
  var t = 0;
  editTemp.itens.forEach(function(it) { t += (it.total || 0); });
  var el = document.getElementById('editTotalGeral');
  if (el) el.textContent = formatCurrency(t);
}

function editRemoverItem(idx) {
  if (!editTemp || !editTemp.itens[idx]) return;
  if (!confirm('Remover "' + editTemp.itens[idx].descricao + '"?')) return;
  editTemp.itens.splice(idx, 1);
  if (!editTemp.itens.length) {
    toast('Sem itens — use Excluir Requisição');
    renderEditReq();
    return;
  }
  renderEditReq();
}

function editAdicionarItem() {
  if (!editTemp) return;
  editTemp.itens.push({
    linha: null,
    descricao: '',
    quantidade: 1,
    um: 'UN',
    valorUnit: 0,
    total: 0,
    observacao: '',
    data: editTemp.data,
    destinatario: '',
    _novo: true
  });
  renderEditReq();
  setTimeout(function() {
    var inputs = document.querySelectorAll('#editReqBody .edit-item-desc');
    var ultimo = inputs[inputs.length - 1];
    if (ultimo) { ultimo.focus(); ultimo.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }, 80);
}

function editSalvar() {
  if (!editTemp) return;
  var obs = document.getElementById('editObs').value.trim();
  var data = document.getElementById('editData').value;
  var novoSetor = document.getElementById('editSetorMover').value;
  var moverSetor = novoSetor !== editTemp.setorOriginal;

  var btn = document.querySelector('.edit-actions .imp-btn-confirm');
  btn.disabled = true; btn.textContent = 'Salvando...';

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'editarrequisicao',
      usuario: sessao.nome,
      senha: sessao.hash,
      cidade: editTemp.cidade,
      setor: editTemp.setorOriginal,
      reqId: editTemp.reqId,
      novoSetor: moverSetor ? novoSetor : null,
      observacao: obs,
      data: data,
      itens: editTemp.itens
    }),
    redirect: 'follow'
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    btn.disabled = false; btn.textContent = 'Salvar Alterações';
    if (d.status === 'ok') {
      showSuccess('', 'Requisição salva!', moverSetor ? 'Movida para ' + novoSetor : '');
      fecharEditReq();
      fecharCidade();
      carregarDados();
    } else {
      toast(d.msg || 'Erro ao salvar');
    }
  })
  .catch(function() {
    btn.disabled = false; btn.textContent = 'Salvar Alterações';
    toast('Erro de conexão');
  });
}

function editExcluirRequisicao() {
  if (!editTemp) return;
  if (!confirm('EXCLUIR requisição ' + editTemp.reqId + ' de ' + editTemp.cidade + '/' + editTemp.setor + '?\n\nEssa ação é irreversível!')) return;
  if (!confirm('TEM CERTEZA? Todos os itens serão removidos permanentemente.')) return;

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'excluirrequisicao',
      usuario: sessao.nome,
      senha: sessao.hash,
      cidade: editTemp.cidade,
      setor: editTemp.setorOriginal,
      reqId: editTemp.reqId
    }),
    redirect: 'follow'
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.status === 'ok') {
      showSuccess('', 'Requisição excluída', editTemp.reqId);
      fecharEditReq();
      fecharCidade();
      carregarDados();
    } else {
      toast(d.msg || 'Erro ao excluir');
    }
  })
  .catch(function() { toast('Erro de conexão'); });
}

// ══════════════════════════════════════════════════════════════
//  ASSISTENTE IA
// ══════════════════════════════════════════════════════════════
function abrirAssistenteIA() {
  document.body.style.overflow = 'hidden';
  document.getElementById('iaModal').classList.add('show');
  history.pushState({ modal: 'ia' }, '', '');

  if (!comandosIA.length) {
    document.getElementById('iaBody').innerHTML =
      '<div style="text-align:center;padding:40px;"><div class="ld-spinner" style="margin:0 auto 16px;"></div>' +
      '<div class="empty-text">Carregando comandos...</div></div>';
    fetch(API_URL + '?userHash=' + sessao.hash + '&acao=comandosia')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.status === 'ok') {
          comandosIA = d.comandos || [];
          renderComandosIA();
        } else {
          document.getElementById('iaBody').innerHTML =
            '<div class="empty-state"><div class="empty-text">' + (d.msg || 'Erro') + '</div></div>';
        }
      })
      .catch(function() {
        document.getElementById('iaBody').innerHTML =
          '<div class="empty-state"><div class="empty-text">Erro de conexão</div></div>';
      });
  } else {
    renderComandosIA();
  }
}

function fecharAssistenteIA() {
  var wasOpen = document.getElementById('iaModal').classList.contains('show');
  document.body.style.overflow = '';
  document.getElementById('iaModal').classList.remove('show');
  if (wasOpen && !_insidePopstate) history.back();
}

function renderComandosIA() {
  var h = '<div class="ia-cmds-grid">';
  comandosIA.forEach(function(cmd) {
    h += '<button class="ia-cmd-btn" onclick="executarComandoIA(\'' + escapeHtml(cmd.id) + '\')">';
    h += '<div class="ia-cmd-icon">' + (cmd.icone || '🤖') + '</div>';
    h += '<div class="ia-cmd-nome">' + escapeHtml(cmd.nome) + '</div>';
    h += '<div class="ia-cmd-desc">' + escapeHtml(cmd.descricao || '') + '</div>';
    h += '</button>';
  });
  h += '</div>';

  h += '<div id="iaResultado" class="ia-resultado"></div>';
  document.getElementById('iaBody').innerHTML = h;
}

function executarComandoIA(cmdId) {
  var resBox = document.getElementById('iaResultado');
  resBox.innerHTML = '<div style="text-align:center;padding:30px;"><div class="ld-spinner" style="margin:0 auto 16px;"></div>' +
                     '<div class="empty-text">Processando comando...</div></div>';
  resBox.scrollIntoView({ behavior: 'smooth' });

  var cmd = comandosIA.find(function(c) { return c.id === cmdId; });
  var needsInput = cmd && cmd.requerInput;
  var inputUsuario = '';

  if (needsInput) {
    inputUsuario = prompt(cmd.promptInput || 'Digite o parâmetro:');
    if (inputUsuario === null || !inputUsuario.trim()) {
      resBox.innerHTML = '';
      return;
    }
  }

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'executarcomandia',
      usuario: sessao.nome,
      senha: sessao.hash,
      comandoId: cmdId,
      input: inputUsuario
    }),
    redirect: 'follow'
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.status === 'ok') {
      var resp = d.resultado || d.texto || '';
      resBox.innerHTML = '<div class="ia-resp-box">' +
        '<div class="ia-resp-head">Resultado — ' + escapeHtml(cmd ? cmd.nome : cmdId) + '</div>' +
        '<div class="ia-resp-body">' + formatIAResp(resp) + '</div>' +
        '<div class="ia-resp-actions">' +
        '<button class="ia-copy-btn" onclick="copiarTextoIA()">Copiar</button>' +
        '</div></div>';

      if (d.atualizacao) {
        iaAtualizacaoTemp = d.atualizacao;
        resBox.innerHTML += '<div class="ia-update-box">' +
          '<div class="ia-update-msg">' + escapeHtml(d.atualizacao.mensagem || 'Atualização disponível') + '</div>' +
          '<button class="ia-apply-btn" onclick="aplicarAtualizacaoIA()">Aplicar Atualização</button></div>';
      }
    } else {
      resBox.innerHTML = '<div class="ia-resp-box ia-resp-erro">' +
        '<div class="ia-resp-head">Erro</div>' +
        '<div class="ia-resp-body">' + escapeHtml(d.msg || 'Erro desconhecido') + '</div></div>';
    }
  })
  .catch(function() {
    resBox.innerHTML = '<div class="ia-resp-box ia-resp-erro">' +
      '<div class="ia-resp-head">Erro</div>' +
      '<div class="ia-resp-body">Sem conexão com o servidor</div></div>';
  });
}

function formatIAResp(texto) {
  if (!texto) return '';
  var t = escapeHtml(texto);
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\n/g, '<br>');
  return t;
}

function copiarTextoIA() {
  var box = document.querySelector('.ia-resp-body');
  if (!box) return;
  var texto = box.innerText || box.textContent;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(function() { toast('Copiado!'); });
  } else {
    toast('Erro ao copiar');
  }
}

function aplicarAtualizacaoIA() {
  if (!iaAtualizacaoTemp) return;

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'aplicaratualizacaoia',
      usuario: sessao.nome,
      senha: sessao.hash,
      atualizacao: iaAtualizacaoTemp
    }),
    redirect: 'follow'
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.status === 'ok') {
      showSuccess('', 'Atualização aplicada!', d.msg || '');
      iaAtualizacaoTemp = null;
      carregarDados();
    } else {
      toast(d.msg || 'Erro ao aplicar');
    }
  })
  .catch(function() { toast('Erro de conexão'); });
}

// ══════════════════════════════════════════════════════════════
//  CATÁLOGO DE CUSTO (v8.6)
// ══════════════════════════════════════════════════════════════
function abrirCatalogoCusto() {
  document.body.style.overflow = 'hidden';
  document.getElementById('catalogoCustoModal').classList.add('show');
  history.pushState({ modal: 'catalogoCusto' }, '', '');

  document.getElementById('catalogoCustoBody').innerHTML =
    '<div style="text-align:center;padding:40px 20px;"><div class="ld-spinner" style="margin:0 auto 16px;"></div>' +
    '<div class="empty-text">Carregando catálogo de custo...</div></div>';
  document.getElementById('catalogoCustoSearch').value = '';

  fetch(API_URL + '?userHash=' + sessao.hash + '&acao=catalogocusto')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status !== 'ok') { toast(d.msg || 'Erro'); return; }
      window._catalogoCustoItens = d.itens || [];
      renderCatalogoCusto('');
    })
    .catch(function() { toast('Erro de conexão'); });
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
  var lista = window._catalogoCustoItens || [];
  if (filtro) {
    lista = lista.filter(function(it) {
      return (it.descricao || '').toLowerCase().indexOf(filtro) > -1;
    });
  }

  if (!lista.length) {
    document.getElementById('catalogoCustoBody').innerHTML =
      '<div class="empty-state"><div class="empty-text">' +
      (filtro ? 'Nenhum item para "' + escapeHtml(filtro) + '"' : 'Catálogo de custo vazio') + '</div></div>';
    return;
  }

  var h = '<div class="cat-meta">' + lista.length + ' ' + (lista.length === 1 ? 'item' : 'itens') + '</div>';

  lista.forEach(function(it) {
    h += '<div class="cat-item">';
    h += '<div class="cat-info"><span class="cat-desc">' + escapeHtml(it.descricao) + '</span></div>';
    h += '<div class="cat-action-wrap">';
    h += '<div class="cat-valor-wrap">';
    h += '<span class="cat-prefix">R$</span>';
    h += '<input type="text" inputmode="decimal" class="cat-input" ' +
         'id="input_custo_' + it.linha + '" ' +
         'value="' + formatNum(it.custo || 0) + '" ' +
         'data-linha="' + it.linha + '" ' +
         'data-original="' + (it.custo || 0) + '" ' +
         'data-desc="' + escapeHtml(it.descricao) + '" ' +
         'onfocus="this.select()" ' +
         'onkeydown="if(event.key === \'Enter\') salvarPrecoCusto(' + it.linha + ')">';
    h += '</div>';
    h += '<button class="cat-save-btn" onclick="salvarPrecoCusto(' + it.linha + ')" title="Salvar">✓</button>';
    h += '</div></div>';
  });

  document.getElementById('catalogoCustoBody').innerHTML = h;
}

function salvarPrecoCusto(linha) {
  var input = document.getElementById('input_custo_' + linha);
  if (!input) return;
  var original = parseFloat(input.dataset.original);
  var novo = parseValorBR(input.value);
  if (novo === null || novo < 0) { toast('Valor inválido'); input.value = formatNum(original); return; }
  if (Math.abs(novo - original) < 0.001) { input.blur(); return; }

  var btn = input.parentElement.nextElementSibling;
  if (btn) { btn.innerHTML = '...'; btn.disabled = true; }

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'salvarprecoindicador',
      usuario: sessao.nome,
      senha: sessao.hash,
      linha: linha,
      custo: novo
    }),
    redirect: 'follow'
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (btn) { btn.innerHTML = '✓'; btn.disabled = false; }
    if (d.status === 'ok') {
      input.dataset.original = novo;
      input.value = formatNum(novo);
      showSuccess('', 'Custo salvo!', '');
      if (window._catalogoCustoItens) {
        for (var i = 0; i < window._catalogoCustoItens.length; i++) {
          if (window._catalogoCustoItens[i].linha === linha) {
            window._catalogoCustoItens[i].custo = novo; break;
          }
        }
      }
    } else {
      input.value = formatNum(original);
      toast(d.msg || 'Erro ao salvar');
    }
  })
  .catch(function() {
    if (btn) { btn.innerHTML = '✓'; btn.disabled = false; }
    input.value = formatNum(original);
    toast('Erro de conexão');
  });
}

function _carregarPrecosCustoParaRef(callback) {
  if (window._precoCustoMapaCache) { callback(window._precoCustoMapaCache); return; }
  fetch(API_URL + '?userHash=' + sessao.hash + '&acao=catalogocusto')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status === 'ok') {
        var mapa = {};
        (d.itens || []).forEach(function(it) {
          if (it.custo && it.custo > 0) mapa[(it.descricao || '').toUpperCase().trim()] = it.custo;
        });
        window._precoCustoMapaCache = mapa;
        callback(mapa);
      } else {
        callback({});
      }
    })
    .catch(function() { callback({}); });
}

// ══════════════════════════════════════════════════════════════
//  PESQUISA DE PREÇO DE CUSTO POR SETOR (v8.6)
// ══════════════════════════════════════════════════════════════
function abrirPesquisaCusto() {
  if (!dadosCompletos || !dadosCompletos.cidades.length) {
    toast('Carregue os dados primeiro');
    return;
  }

  // Coletar setores únicos com itens
  var setoresComItens = {};
  dadosCompletos.cidades.forEach(function(cid) {
    cid.setores.forEach(function(s) {
      if (s.itens && s.itens.length) {
        if (!setoresComItens[s.nome]) setoresComItens[s.nome] = [];
        s.itens.forEach(function(it) {
          var desc = (it.descricao || '').toUpperCase().trim();
          if (desc && setoresComItens[s.nome].indexOf(desc) === -1) {
            setoresComItens[s.nome].push(desc);
          }
        });
      }
    });
  });

  precoCustoSetores = Object.keys(setoresComItens).map(function(nome) {
    return { nome: nome, descricoes: setoresComItens[nome] };
  });

  if (!precoCustoSetores.length) { toast('Nenhum setor com itens'); return; }

  precoCustoJaProcessados = {};
  precoCustoResultados = [];
  precoCustoSetorAtual = 0;
  precoCustoPesquisando = true;
  precoCustoTotalCusto = 0;

  // Renderizar UI no painel de custo
  var panel = document.getElementById('precoCustoPanel');
  if (panel) {
    panel.style.display = 'block';
    panel.innerHTML = '<div class="pc-header">Pesquisa de Custo por Setor</div>' +
      '<div id="pcProgress" class="pc-progress"></div>' +
      '<div id="pcResultados" class="pc-resultados"></div>' +
      '<button class="pc-cancel-btn" onclick="cancelarPesquisaCusto()">Cancelar</button>';
  }

  processarProximoSetorCusto();
}

function cancelarPesquisaCusto() {
  precoCustoPesquisando = false;
  var panel = document.getElementById('precoCustoPanel');
  if (panel) panel.style.display = 'none';
}

function processarProximoSetorCusto() {
  if (!precoCustoPesquisando) return;
  if (precoCustoSetorAtual >= precoCustoSetores.length) {
    finalizarPesquisaCusto();
    return;
  }

  var setor = precoCustoSetores[precoCustoSetorAtual];
  var progEl = document.getElementById('pcProgress');
  if (progEl) {
    var pct = Math.round(((precoCustoSetorAtual) / precoCustoSetores.length) * 100);
    progEl.innerHTML = '<div class="pc-prog-text">' + escapeHtml(setor.nome) + ' (' + (precoCustoSetorAtual + 1) + '/' + precoCustoSetores.length + ')</div>' +
      '<div class="pc-bar-bg"><div class="pc-bar-fill" style="width:' + pct + '%"></div></div>';
  }

  // Filtrar apenas descricoes ainda não processadas
  var descParaProcessar = setor.descricoes.filter(function(d) {
    return !precoCustoJaProcessados[_normFront(d)];
  });

  if (!descParaProcessar.length) {
    precoCustoSetorAtual++;
    processarProximoSetorCusto();
    return;
  }

  // Enviar ao backend para pesquisa de custo IA
  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'pesquisarcusto',
      usuario: sessao.nome,
      senha: sessao.hash,
      setor: setor.nome,
      descricoes: descParaProcessar
    }),
    redirect: 'follow'
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.status === 'ok' && d.resultados) {
      d.resultados.forEach(function(r) {
        precoCustoJaProcessados[_normFront(r.descricao)] = true;
        precoCustoResultados.push(r);
        precoCustoTotalCusto += (r.custo || 0);
      });
      _renderPcResultadosParciais();
    }
    precoCustoSetorAtual++;
    setTimeout(processarProximoSetorCusto, 500);
  })
  .catch(function() {
    precoCustoSetorAtual++;
    setTimeout(processarProximoSetorCusto, 500);
  });
}

function _renderPcResultadosParciais() {
  var el = document.getElementById('pcResultados');
  if (!el) return;
  var h = '<div class="pc-total">Total acumulado: ' + formatCurrency(precoCustoTotalCusto) + '</div>';
  precoCustoResultados.slice(-10).reverse().forEach(function(r) {
    h += '<div class="pc-item"><span class="pc-desc">' + escapeHtml(r.descricao) + '</span>' +
         '<span class="pc-custo">' + formatCurrency(r.custo || 0) + '</span></div>';
  });
  el.innerHTML = h;
}

function finalizarPesquisaCusto() {
  precoCustoPesquisando = false;
  var progEl = document.getElementById('pcProgress');
  if (progEl) {
    progEl.innerHTML = '<div class="pc-prog-text">Concluído!</div>' +
      '<div class="pc-bar-bg"><div class="pc-bar-fill" style="width:100%"></div></div>';
  }
  _renderPcResultadosParciais();
  toast('Pesquisa de custo finalizada');
}

// ══════════════════════════════════════════════════════════════
//  v8.7: VIRADA DE MÊS
// ══════════════════════════════════════════════════════════════
function abrirViradaMes() {
  document.body.style.overflow = 'hidden';
  document.getElementById('viradaMesModal').classList.add('show');
  history.pushState({ modal: 'viradaMes' }, '', '');

  var meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var hoje = new Date();
  var mesAtual = meses[hoje.getMonth()] + '/' + hoje.getFullYear();

  var totalGeral = dadosCompletos ? (dadosCompletos.totalGeral || 0) : 0;
  var totalItens = 0;
  if (dadosCompletos && dadosCompletos.cidades) {
    dadosCompletos.cidades.forEach(function(c) { totalItens += c.itens; });
  }

  var h = '<div class="vm-header">';
  h += '<div class="vm-icon">📅</div>';
  h += '<div class="vm-title">Virada de Mês</div>';
  h += '<div class="vm-subtitle">Arquivar mês atual e iniciar novo período</div>';
  h += '</div>';

  h += '<div class="vm-info-box">';
  h += '<div class="vm-info-label">Mês a ser arquivado:</div>';
  h += '<div class="vm-info-value" id="vmMesNome">' + escapeHtml(mesAtual) + '</div>';
  h += '<div class="vm-info-stats">';
  h += '<span>' + formatCurrency(totalGeral) + '</span>';
  h += '<span>' + totalItens + ' itens</span>';
  h += '</div>';
  h += '</div>';

  // Resumo por cidade
  if (dadosCompletos && dadosCompletos.cidades) {
    h += '<div class="vm-cidades-resumo">';
    dadosCompletos.cidades.forEach(function(cid) {
      if (cid.itens > 0) {
        h += '<div class="vm-cidade-row">';
        h += '<span class="vm-cid-nome">' + escapeHtml(cid.nome) + '</span>';
        h += '<span class="vm-cid-val">' + formatCurrency(cid.total) + ' · ' + cid.itens + ' itens</span>';
        h += '</div>';
      }
    });
    h += '</div>';
  }

  h += '<div class="vm-warning">';
  h += '<strong>Atenção:</strong> Esta ação irá:';
  h += '<br>1. Salvar os totais do mês atual no histórico';
  h += '<br>2. Salvar o detalhamento de cada requisição';
  h += '<br>3. Limpar todas as requisições para o novo mês';
  h += '<br><br>Esta ação <strong>não pode ser desfeita</strong>.';
  h += '</div>';

  h += '<div class="vm-actions">';
  h += '<button class="vm-btn-cancel" onclick="fecharViradaMes()">Cancelar</button>';
  h += '<button class="vm-btn-confirm" id="vmBtnConfirm" onclick="confirmarViradaMes()">Confirmar Virada de Mês</button>';
  h += '</div>';

  document.getElementById('viradaMesBody').innerHTML = h;
}

function fecharViradaMes() {
  var wasOpen = document.getElementById('viradaMesModal').classList.contains('show');
  document.body.style.overflow = '';
  document.getElementById('viradaMesModal').classList.remove('show');
  if (wasOpen && !_insidePopstate) history.back();
}

function confirmarViradaMes() {
  if (!confirm('TEM CERTEZA que deseja virar o mês?\n\nTodos os dados atuais serão arquivados e as requisições serão zeradas.')) return;

  var btn = document.getElementById('vmBtnConfirm');
  btn.disabled = true;
  btn.textContent = 'Processando...';

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'viradames',
      usuario: sessao.nome,
      senha: sessao.hash
    }),
    redirect: 'follow'
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    btn.disabled = false;
    btn.textContent = 'Confirmar Virada de Mês';
    if (d.status === 'ok') {
      showSuccess('', 'Mês virado com sucesso!', d.mesArquivado || 'Dados arquivados');
      fecharViradaMes();
      historicoMeses = null;
      window._precoCustoMapaCache = null;
      carregarDados();
      carregarHistorico();
    } else {
      toast(d.msg || 'Erro na virada de mês');
    }
  })
  .catch(function() {
    btn.disabled = false;
    btn.textContent = 'Confirmar Virada de Mês';
    toast('Erro de conexão');
  });
}

// ══════════════════════════════════════════════════════════════
//  v8.7: HISTÓRICO COMPLETO (modal com todos os meses)
// ══════════════════════════════════════════════════════════════
function abrirHistoricoCompleto() {
  document.body.style.overflow = 'hidden';
  document.getElementById('historicoModal').classList.add('show');
  history.pushState({ modal: 'historico' }, '', '');

  if (!historicoMeses) {
    document.getElementById('historicoBody').innerHTML =
      '<div style="text-align:center;padding:40px;"><div class="ld-spinner" style="margin:0 auto 16px;"></div>' +
      '<div class="empty-text">Carregando histórico...</div></div>';
    carregarHistorico();
    setTimeout(function() { renderHistoricoCompleto(); }, 2000);
  } else {
    renderHistoricoCompleto();
  }
}

function fecharHistorico() {
  var wasOpen = document.getElementById('historicoModal').classList.contains('show');
  document.body.style.overflow = '';
  document.getElementById('historicoModal').classList.remove('show');
  if (wasOpen && !_insidePopstate) history.back();
}

function renderHistoricoCompleto() {
  if (!historicoMeses || !historicoMeses.length) {
    document.getElementById('historicoBody').innerHTML =
      '<div class="empty-state"><div class="empty-text">Nenhum mês arquivado ainda</div></div>';
    return;
  }

  var CIDADES_ORDEM = ['Ibicuí', 'Nova Canaã', 'Boa Nova', 'Dário Meira', 'Floresta Azul'];
  var meses = historicoMeses.slice().reverse();
  var totalAcumulado = 0;
  meses.forEach(function(m) { totalAcumulado += (m.total || 0); });

  var h = '<div class="hist-full-header">';
  h += '<div class="hfh-total">Acumulado: ' + formatCurrency(totalAcumulado) + '</div>';
  h += '<div class="hfh-count">' + meses.length + ' ' + (meses.length === 1 ? 'mês' : 'meses') + ' arquivados</div>';
  h += '</div>';

  // Ações de resumo
  h += '<div class="hist-acoes">';
  h += '<button class="hist-acao-btn" onclick="imprimirHistorico3Meses()">🖨️ Imprimir últimos 3 meses</button>';
  h += '<button class="hist-acao-btn" onclick="whatsappHistorico3Meses()">📱 WhatsApp últimos 3 meses</button>';
  h += '</div>';

  // Lista de meses
  meses.forEach(function(mes) {
    h += '<div class="hist-full-mes" onclick="abrirMesDetalhe(\'' + escapeHtml(mes.nome) + '\')">';
    h += '<div class="hfm-top">';
    h += '<div class="hfm-nome">' + escapeHtml(mes.nome) + '</div>';
    h += '<div class="hfm-total">' + formatCurrency(mes.total) + '</div>';
    h += '</div>';

    h += '<div class="hfm-cidades">';
    CIDADES_ORDEM.forEach(function(cid) {
      var val = (mes.cidades && mes.cidades[cid]) ? mes.cidades[cid] : 0;
      if (val > 0) {
        h += '<div class="hfm-cid-row">';
        h += '<span class="hfm-cid-nome">' + escapeHtml(cid) + '</span>';
        h += '<span class="hfm-cid-val">' + formatCurrency(val) + '</span>';
        h += '</div>';
      }
    });
    h += '</div>';

    h += '</div>';
  });

  document.getElementById('historicoBody').innerHTML = h;
}

// ══════════════════════════════════════════════════════════════
//  v8.7: MÊS ESPECÍFICO (detalhe completo)
// ══════════════════════════════════════════════════════════════
function abrirMesDetalhe(mesNome) {
  document.getElementById('mesDetalheModal').classList.add('show');
  document.body.style.overflow = 'hidden';
  history.pushState({ modal: 'mesDetalhe' }, '', '');

  document.getElementById('mesDetalheTitle').textContent = mesNome;
  document.getElementById('mesDetalheBody').innerHTML =
    '<div style="text-align:center;padding:40px;"><div class="ld-spinner" style="margin:0 auto 16px;"></div>' +
    '<div class="empty-text">Carregando detalhes de ' + escapeHtml(mesNome) + '...</div></div>';

  fetch(API_URL + '?userHash=' + sessao.hash + '&acao=historicomes&mes=' + encodeURIComponent(mesNome))
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status === 'ok') {
        renderMesDetalhe(mesNome, d);
      } else {
        document.getElementById('mesDetalheBody').innerHTML =
          '<div class="empty-state"><div class="empty-text">' + escapeHtml(d.msg || 'Erro') + '</div></div>';
      }
    })
    .catch(function() {
      document.getElementById('mesDetalheBody').innerHTML =
        '<div class="empty-state"><div class="empty-text">Erro de conexão</div></div>';
    });
}

function fecharMesDetalhe() {
  var wasOpen = document.getElementById('mesDetalheModal').classList.contains('show');
  document.getElementById('mesDetalheModal').classList.remove('show');
  document.body.style.overflow = '';
  if (wasOpen && !_insidePopstate) history.back();
}

function renderMesDetalhe(mesNome, dados) {
  var CIDADES_ORDEM = ['Ibicuí', 'Nova Canaã', 'Boa Nova', 'Dário Meira', 'Floresta Azul'];
  var resumo = dados.resumo || {};
  var detalhes = dados.detalhes || [];

  var h = '';

  // Resumo geral
  h += '<div class="md-resumo">';
  h += '<div class="md-total-geral">' + formatCurrency(resumo.total || 0) + '</div>';
  h += '<div class="md-total-meta">' + (resumo.totalItens || 0) + ' itens no período</div>';
  h += '</div>';

  // Rankings
  var cidadeArr = [];
  CIDADES_ORDEM.forEach(function(cid) {
    var val = (resumo.cidades && resumo.cidades[cid]) ? resumo.cidades[cid] : 0;
    cidadeArr.push({ nome: cid, total: val });
  });
  cidadeArr.sort(function(a, b) { return b.total - a.total; });
  var maxCid = cidadeArr.length && cidadeArr[0].total > 0 ? cidadeArr[0].total : 1;

  h += '<div class="md-section"><div class="md-section-title">Ranking por Cidade</div>';
  cidadeArr.forEach(function(c, idx) {
    if (c.total <= 0) return;
    var pct = (c.total / maxCid) * 100;
    h += '<div class="ranking-item"><div class="r-left"><span class="r-pos">' + (idx + 1) +
         '</span><div class="r-info"><span class="r-nome">' + escapeHtml(c.nome) +
         '</span></div></div><div class="r-right"><span class="r-valor">' + formatCurrency(c.total) +
         '</span><div class="r-bar-bg"><div class="r-bar-fill blue" style="width:' + pct + '%"></div></div></div></div>';
  });
  h += '</div>';

  // Ranking por setor
  if (resumo.setores) {
    var setorArr = [];
    Object.keys(resumo.setores).forEach(function(s) {
      setorArr.push({ nome: s, total: resumo.setores[s] });
    });
    setorArr.sort(function(a, b) { return b.total - a.total; });
    var maxSet = setorArr.length && setorArr[0].total > 0 ? setorArr[0].total : 1;

    h += '<div class="md-section"><div class="md-section-title">Ranking por Setor</div>';
    setorArr.forEach(function(s, idx) {
      if (s.total <= 0) return;
      var pct = (s.total / maxSet) * 100;
      h += '<div class="ranking-item"><div class="r-left"><span class="r-pos">' + (idx + 1) +
           '</span><div class="r-info"><span class="r-nome">' + escapeHtml(s.nome) +
           '</span></div></div><div class="r-right"><span class="r-valor">' + formatCurrency(s.total) +
           '</span><div class="r-bar-bg"><div class="r-bar-fill purple" style="width:' + pct + '%"></div></div></div></div>';
    });
    h += '</div>';
  }

  // Detalhes das requisições
  if (detalhes.length) {
    h += '<div class="md-section"><div class="md-section-title">Requisições do Período</div>';

    // Agrupar por cidade > setor > reqId
    var agrupado = {};
    detalhes.forEach(function(it) {
      var cid = it.cidade || 'N/A';
      var set = it.setor || 'N/A';
      var rid = it.reqId || '-';
      if (!agrupado[cid]) agrupado[cid] = {};
      if (!agrupado[cid][set]) agrupado[cid][set] = {};
      if (!agrupado[cid][set][rid]) agrupado[cid][set][rid] = { itens: [], total: 0, obs: '', data: '' };
      agrupado[cid][set][rid].itens.push(it);
      agrupado[cid][set][rid].total += (it.total || 0);
      if (it.observacao && !agrupado[cid][set][rid].obs) agrupado[cid][set][rid].obs = it.observacao;
      if (it.data && !agrupado[cid][set][rid].data) agrupado[cid][set][rid].data = it.data;
    });

    CIDADES_ORDEM.forEach(function(cid) {
      if (!agrupado[cid]) return;
      h += '<div class="md-cidade-block">';
      h += '<div class="md-cidade-nome">' + escapeHtml(cid) + '</div>';

      Object.keys(agrupado[cid]).forEach(function(set) {
        Object.keys(agrupado[cid][set]).forEach(function(rid) {
          var grp = agrupado[cid][set][rid];
          h += '<div class="md-req-block">';
          h += '<div class="md-req-head">';
          h += '<div class="md-req-id">' + escapeHtml(rid) + '</div>';
          h += '<div class="md-req-setor">' + escapeHtml(set) + '</div>';
          h += '<div class="md-req-val">' + formatCurrency(grp.total) + '</div>';
          h += '</div>';
          if (grp.obs) h += '<div class="md-req-obs">' + escapeHtml(grp.obs) + '</div>';
          grp.itens.forEach(function(it) {
            h += '<div class="md-item">';
            h += '<span class="md-item-desc">' + escapeHtml(it.descricao || '') + ' <span style="opacity:.6;">(x' + (it.quantidade || 0) + ')</span></span>';
            h += '<span class="md-item-val">' + formatCurrency(it.total || 0) + '</span>';
            h += '</div>';
          });
          h += '</div>';
        });
      });

      h += '</div>';
    });

    h += '</div>';
  }

  // Ações
  h += '<div class="md-actions">';
  h += '<button class="hist-acao-btn" onclick="imprimirMesEspecifico(\'' + escapeHtml(mesNome) + '\')">🖨️ Imprimir este mês</button>';
  h += '<button class="hist-acao-btn" onclick="whatsappMesEspecifico(\'' + escapeHtml(mesNome) + '\')">📱 WhatsApp</button>';
  h += '</div>';

  document.getElementById('mesDetalheBody').innerHTML = h;
}

// ══════════════════════════════════════════════════════════════
//  v8.7: IMPRESSÃO E WHATSAPP DO HISTÓRICO
// ══════════════════════════════════════════════════════════════
function imprimirHistorico3Meses() {
  if (!historicoMeses || !historicoMeses.length) { toast('Sem histórico'); return; }

  var ultimos = historicoMeses.slice(-3).reverse();
  var corpo = '<div class="pdf-header">' +
    '<div class="pdf-brand">GRUPO CARLOS VAZ</div>' +
    '<div class="pdf-divider"></div>' +
    '<div class="pdf-title">Resumo dos Últimos 3 Meses</div>' +
    '<div class="pdf-meta">Emitido em ' + _dataHoraAtual() + '</div></div>';

  var CIDADES_ORDEM = ['Ibicuí', 'Nova Canaã', 'Boa Nova', 'Dário Meira', 'Floresta Azul'];
  var acumulado = 0;

  ultimos.forEach(function(mes) {
    acumulado += (mes.total || 0);
    corpo += '<div class="pdf-req-block">';
    corpo += '<div class="pdf-req-head"><div><div class="pdf-req-setor">MÊS</div><div class="pdf-req-id">' + escapeHtml(mes.nome) + '</div></div>';
    corpo += '<div class="pdf-req-info"><div>' + formatCurrency(mes.total) + '</div></div></div>';

    corpo += '<table class="pdf-table"><thead><tr><th style="width:60%;">Cidade</th><th style="width:40%;text-align:right;">Total</th></tr></thead><tbody>';
    CIDADES_ORDEM.forEach(function(cid) {
      var val = (mes.cidades && mes.cidades[cid]) ? mes.cidades[cid] : 0;
      if (val > 0) {
        corpo += '<tr><td>' + escapeHtml(cid) + '</td><td style="text-align:right;font-weight:600;">' + formatCurrency(val) + '</td></tr>';
      }
    });
    corpo += '<tr class="pdf-total-row"><td style="text-align:right;padding-right:12px;">TOTAL</td>';
    corpo += '<td style="text-align:right;">' + formatCurrency(mes.total) + '</td></tr>';
    corpo += '</tbody></table></div>';
  });

  corpo += '<div class="pdf-resumo"><strong>ACUMULADO ' + ultimos.length + ' MESES: ' + formatCurrency(acumulado) + '</strong></div>';

  _abrirJanelaImpressao('Resumo 3 Meses — CRV/LAS', corpo);
}

function whatsappHistorico3Meses() {
  if (!historicoMeses || !historicoMeses.length) { toast('Sem histórico'); return; }

  var ultimos = historicoMeses.slice(-3).reverse();
  var CIDADES_ORDEM = ['Ibicuí', 'Nova Canaã', 'Boa Nova', 'Dário Meira', 'Floresta Azul'];

  var texto = '📊 *RESUMO — ÚLTIMOS 3 MESES*\n';
  texto += '📅 Emitido em ' + _dataHoraAtual() + '\n';
  texto += '━━━━━━━━━━━━━━━━━━━━\n\n';

  var acumulado = 0;
  ultimos.forEach(function(mes) {
    acumulado += (mes.total || 0);
    texto += '📅 *' + mes.nome.toUpperCase() + '*\n';
    CIDADES_ORDEM.forEach(function(cid) {
      var val = (mes.cidades && mes.cidades[cid]) ? mes.cidades[cid] : 0;
      if (val > 0) {
        texto += '   🏙️ ' + cid + ': ' + formatCurrency(val) + '\n';
      }
    });
    texto += '   💰 *Total: ' + formatCurrency(mes.total) + '*\n\n';
  });

  texto += '━━━━━━━━━━━━━━━━━━━━\n';
  texto += '📊 *ACUMULADO: ' + formatCurrency(acumulado) + '*\n\n';
  texto += '_Requisições Digital — CRV/LAS_';

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(function() {
      showSuccess('', 'Resumo copiado!', 'Cole no WhatsApp');
    }).catch(function() { toast('Erro ao copiar'); });
  } else {
    toast('Copie manualmente');
  }
}

function imprimirMesEspecifico(mesNome) {
  var mes = historicoMeses ? historicoMeses.find(function(m) { return m.nome === mesNome; }) : null;
  if (!mes) { toast('Mês não encontrado'); return; }

  var CIDADES_ORDEM = ['Ibicuí', 'Nova Canaã', 'Boa Nova', 'Dário Meira', 'Floresta Azul'];

  var corpo = '<div class="pdf-header">' +
    '<div class="pdf-brand">GRUPO CARLOS VAZ</div>' +
    '<div class="pdf-divider"></div>' +
    '<div class="pdf-title">Resumo — ' + escapeHtml(mesNome) + '</div>' +
    '<div class="pdf-meta">Emitido em ' + _dataHoraAtual() + '</div></div>';

  corpo += '<div class="pdf-req-block">';
  corpo += '<div class="pdf-req-head"><div><div class="pdf-req-setor">PERÍODO</div><div class="pdf-req-id">' + escapeHtml(mesNome) + '</div></div>';
  corpo += '<div class="pdf-req-info"><div>' + formatCurrency(mes.total) + '</div></div></div>';

  corpo += '<table class="pdf-table"><thead><tr><th style="width:60%;">Cidade</th><th style="width:40%;text-align:right;">Total</th></tr></thead><tbody>';
  CIDADES_ORDEM.forEach(function(cid) {
    var val = (mes.cidades && mes.cidades[cid]) ? mes.cidades[cid] : 0;
    if (val > 0) {
      corpo += '<tr><td>' + escapeHtml(cid) + '</td><td style="text-align:right;font-weight:600;">' + formatCurrency(val) + '</td></tr>';
    }
  });
  corpo += '<tr class="pdf-total-row"><td style="text-align:right;padding-right:12px;">TOTAL</td>';
  corpo += '<td style="text-align:right;">' + formatCurrency(mes.total) + '</td></tr>';
  corpo += '</tbody></table></div>';

  _abrirJanelaImpressao('Resumo ' + mesNome + ' — CRV/LAS', corpo);
}

function whatsappMesEspecifico(mesNome) {
  var mes = historicoMeses ? historicoMeses.find(function(m) { return m.nome === mesNome; }) : null;
  if (!mes) { toast('Mês não encontrado'); return; }

  var CIDADES_ORDEM = ['Ibicuí', 'Nova Canaã', 'Boa Nova', 'Dário Meira', 'Floresta Azul'];

  var texto = '📊 *RESUMO — ' + mesNome.toUpperCase() + '*\n';
  texto += '📅 ' + _dataHoraAtual() + '\n';
  texto += '━━━━━━━━━━━━━━━━━━━━\n\n';

  CIDADES_ORDEM.forEach(function(cid) {
    var val = (mes.cidades && mes.cidades[cid]) ? mes.cidades[cid] : 0;
    if (val > 0) {
      texto += '🏙️ *' + cid.toUpperCase() + '*\n';
      texto += '   💰 ' + formatCurrency(val) + '\n\n';
    }
  });

  texto += '━━━━━━━━━━━━━━━━━━━━\n';
  texto += '📊 *TOTAL: ' + formatCurrency(mes.total) + '*\n\n';
  texto += '_Requisições Digital — CRV/LAS_';

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(function() {
      showSuccess('', 'Resumo copiado!', 'Cole no WhatsApp');
    }).catch(function() { toast('Erro ao copiar'); });
  } else {
    toast('Copie manualmente');
  }
}

function _dataHoraAtual() {
  var d = new Date();
  return String(d.getDate()).padStart(2,'0') + '/' +
         String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear() + ' às ' +
         String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

// ══════════════════════════════════════════════════════════════
//  NORMALIZAÇÃO FRONT-END (_normFront)
// ══════════════════════════════════════════════════════════════
function _normFront(str) {
  if (!str) return '';
  var s = String(str).toUpperCase().trim();
  // Remove acentos
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Remove caracteres especiais, mantém letras, números e espaço
  s = s.replace(/[^A-Z0-9 ]/g, ' ');
  // Colapsa espaços múltiplos
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

// ══════════════════════════════════════════════════════════════
//  LEVENSHTEIN — DEDUP LOCAL (sem custo IA)
// ══════════════════════════════════════════════════════════════
function _levenshtein(a, b) {
  if (!a || !b) return Math.max((a || '').length, (b || '').length);
  var la = a.length, lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  var matrix = [];
  var i, j;

  for (i = 0; i <= la; i++) {
    matrix[i] = [i];
  }
  for (j = 0; j <= lb; j++) {
    matrix[0][j] = j;
  }

  for (i = 1; i <= la; i++) {
    for (j = 1; j <= lb; j++) {
      var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[la][lb];
}

function _similaridade(a, b) {
  var na = _normFront(a);
  var nb = _normFront(b);
  if (na === nb) return 1;
  var maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  var dist = _levenshtein(na, nb);
  return 1 - (dist / maxLen);
}

function detectarDuplicadosLocal(itens, limiar) {
  limiar = limiar || 0.85;
  var duplicados = [];
  for (var i = 0; i < itens.length; i++) {
    for (var j = i + 1; j < itens.length; j++) {
      var sim = _similaridade(itens[i].descricao || itens[i].descricao_normalizada, itens[j].descricao || itens[j].descricao_normalizada);
      if (sim >= limiar) {
        duplicados.push({
          idx1: i,
          idx2: j,
          desc1: itens[i].descricao || itens[i].descricao_normalizada,
          desc2: itens[j].descricao || itens[j].descricao_normalizada,
          similaridade: Math.round(sim * 100)
        });
      }
    }
  }
  return duplicados;
}

// ══════════════════════════════════════════════════════════════
//  WHATSAPP — RESUMO HISTÓRICO POR MÊS ESPECÍFICO (DETALHADO)
// ══════════════════════════════════════════════════════════════
function whatsappMesDetalhado(mesNome) {
  // Busca detalhes do mês via API e gera resumo WhatsApp com requisições
  fetch(API_URL + '?userHash=' + sessao.hash + '&acao=historicomes&mes=' + encodeURIComponent(mesNome))
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status !== 'ok') { toast(d.msg || 'Erro'); return; }

      var resumo = d.resumo || {};
      var detalhes = d.detalhes || [];
      var CIDADES_ORDEM = ['Ibicuí', 'Nova Canaã', 'Boa Nova', 'Dário Meira', 'Floresta Azul'];

      var texto = '📊 *DETALHAMENTO — ' + mesNome.toUpperCase() + '*\n';
      texto += '📅 ' + _dataHoraAtual() + '\n';
      texto += '━━━━━━━━━━━━━━━━━━━━\n\n';

      // Agrupar por cidade > setor
      var agrupado = {};
      detalhes.forEach(function(it) {
        var cid = it.cidade || 'N/A';
        var set = it.setor || 'N/A';
        if (!agrupado[cid]) agrupado[cid] = {};
        if (!agrupado[cid][set]) agrupado[cid][set] = { itens: [], total: 0 };
        agrupado[cid][set].itens.push(it);
        agrupado[cid][set].total += (it.total || 0);
      });

      CIDADES_ORDEM.forEach(function(cid) {
        if (!agrupado[cid]) return;
        texto += '🏙️ *' + cid.toUpperCase() + '*\n';
        Object.keys(agrupado[cid]).forEach(function(set) {
          var grp = agrupado[cid][set];
          texto += '   📁 ' + set + ' — ' + formatCurrency(grp.total) + '\n';
          texto += '   ' + grp.itens.length + ' itens\n';
        });
        var totalCid = (resumo.cidades && resumo.cidades[cid]) ? resumo.cidades[cid] : 0;
        texto += '   💰 *Subtotal: ' + formatCurrency(totalCid) + '*\n\n';
      });

      texto += '━━━━━━━━━━━━━━━━━━━━\n';
      texto += '📊 *TOTAL GERAL: ' + formatCurrency(resumo.total || 0) + '*\n';
      texto += '📦 ' + (resumo.totalItens || 0) + ' itens\n\n';
      texto += '_Requisições Digital — CRV/LAS_';

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(function() {
          showSuccess('', 'Detalhamento copiado!', 'Cole no WhatsApp');
        }).catch(function() { toast('Erro ao copiar'); });
      } else {
        toast('Copie manualmente');
      }
    })
    .catch(function() { toast('Erro de conexão'); });
}

// ══════════════════════════════════════════════════════════════
//  IMPRESSÃO MÊS DETALHADO (com todas as requisições)
// ══════════════════════════════════════════════════════════════
function imprimirMesDetalhado(mesNome) {
  fetch(API_URL + '?userHash=' + sessao.hash + '&acao=historicomes&mes=' + encodeURIComponent(mesNome))
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status !== 'ok') { toast(d.msg || 'Erro'); return; }

      var resumo = d.resumo || {};
      var detalhes = d.detalhes || [];
      var CIDADES_ORDEM = ['Ibicuí', 'Nova Canaã', 'Boa Nova', 'Dário Meira', 'Floresta Azul'];

      var corpo = '<div class="pdf-header">' +
        '<div class="pdf-brand">GRUPO CARLOS VAZ</div>' +
        '<div class="pdf-divider"></div>' +
        '<div class="pdf-title">Detalhamento — ' + escapeHtml(mesNome) + '</div>' +
        '<div class="pdf-meta">Emitido em ' + _dataHoraAtual() + '</div></div>';

      // Agrupar por cidade > setor > reqId
      var agrupado = {};
      detalhes.forEach(function(it) {
        var cid = it.cidade || 'N/A';
        var set = it.setor || 'N/A';
        var rid = it.reqId || '-';
        if (!agrupado[cid]) agrupado[cid] = {};
        if (!agrupado[cid][set]) agrupado[cid][set] = {};
        if (!agrupado[cid][set][rid]) agrupado[cid][set][rid] = { itens: [], total: 0, obs: '', data: '' };
        agrupado[cid][set][rid].itens.push(it);
        agrupado[cid][set][rid].total += (it.total || 0);
        if (it.observacao && !agrupado[cid][set][rid].obs) agrupado[cid][set][rid].obs = it.observacao;
        if (it.data && !agrupado[cid][set][rid].data) agrupado[cid][set][rid].data = it.data;
      });

      var totalGeral = 0;

      CIDADES_ORDEM.forEach(function(cid) {
        if (!agrupado[cid]) return;
        Object.keys(agrupado[cid]).forEach(function(set) {
          Object.keys(agrupado[cid][set]).forEach(function(rid) {
            var grp = agrupado[cid][set][rid];
            corpo += _gerarBlocoRequisicaoPDF(set + ' — ' + cid, rid, grp);
            totalGeral += grp.total;
          });
        });
      });

      corpo += '<div class="pdf-resumo"><strong>TOTAL ' + escapeHtml(mesNome).toUpperCase() + ': ' +
               formatCurrency(totalGeral) + '</strong><br>' +
               detalhes.length + ' itens</div>';

      _abrirJanelaImpressao('Detalhamento ' + mesNome + ' — CRV/LAS', corpo);
    })
    .catch(function() { toast('Erro de conexão'); });
}

// ══════════════════════════════════════════════════════════════
//  SCROLL SUAVE & UI HELPERS
// ══════════════════════════════════════════════════════════════
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function scrollToElement(id) {
  var el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ══════════════════════════════════════════════════════════════
//  TEMA & VISUAL
// ══════════════════════════════════════════════════════════════
function ajustarAlturaViewport() {
  var vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', vh + 'px');
}
window.addEventListener('resize', ajustarAlturaViewport);
ajustarAlturaViewport();

// ══════════════════════════════════════════════════════════════
//  PWA INSTALL PROMPT
// ══════════════════════════════════════════════════════════════
var deferredPrompt = null;

window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  deferredPrompt = e;
  var installBtn = document.getElementById('installBtn');
  if (installBtn) {
    installBtn.style.display = 'inline-flex';
    installBtn.addEventListener('click', function() {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function(choice) {
          deferredPrompt = null;
          installBtn.style.display = 'none';
        });
      }
    });
  }
});

window.addEventListener('appinstalled', function() {
  deferredPrompt = null;
  var installBtn = document.getElementById('installBtn');
  if (installBtn) installBtn.style.display = 'none';
});

// ══════════════════════════════════════════════════════════════
//  DETECÇÃO OFFLINE / ONLINE
// ══════════════════════════════════════════════════════════════
window.addEventListener('online', function() {
  setBadge(true);
  toast('Conexão restaurada');
  if (sessao) carregarDados();
});

window.addEventListener('offline', function() {
  setBadge(false);
  toast('Sem conexão — modo offline');
});

// ══════════════════════════════════════════════════════════════
//  ATALHOS DE TECLADO
// ══════════════════════════════════════════════════════════════
document.addEventListener('keydown', function(e) {
  // ESC fecha qualquer modal aberto
  if (e.key === 'Escape') {
    if (document.getElementById('mesDetalheModal').classList.contains('show')) { fecharMesDetalhe(); return; }
    if (document.getElementById('historicoModal').classList.contains('show')) { fecharHistorico(); return; }
    if (document.getElementById('viradaMesModal').classList.contains('show')) { fecharViradaMes(); return; }
    if (document.getElementById('editReqModal').classList.contains('show')) { fecharEditReq(); return; }
    if (document.getElementById('iaModal').classList.contains('show')) { fecharAssistenteIA(); return; }
    if (document.getElementById('importarModal').classList.contains('show')) { fecharImportar(); return; }
    if (document.getElementById('catalogoCustoModal').classList.contains('show')) { fecharCatalogoCusto(); return; }
    if (document.getElementById('catalogoModal').classList.contains('show')) { fecharCatalogo(); return; }
    if (document.getElementById('cidadeModal').classList.contains('show')) { fecharCidade(); return; }
    if (document.getElementById('menuLateral').classList.contains('show')) { fecharMenuLateral(); return; }
  }
});

// ══════════════════════════════════════════════════════════════
//  PULL-TO-REFRESH (mobile touch)
// ══════════════════════════════════════════════════════════════
(function() {
  var startY = 0;
  var pulling = false;

  document.addEventListener('touchstart', function(e) {
    if (window.scrollY === 0 && !document.querySelector('.show')) {
      startY = e.touches[0].clientY;
      pulling = true;
    }
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    if (!pulling) return;
    var diff = e.touches[0].clientY - startY;
    if (diff > 100) {
      pulling = false;
      if (sessao) {
        toast('Atualizando...');
        carregarDados();
        carregarHistorico();
      }
    }
  }, { passive: true });

  document.addEventListener('touchend', function() {
    pulling = false;
  }, { passive: true });
})();

// ══════════════════════════════════════════════════════════════
//  PREÇO DE CUSTO — PAINEL UI NO DASHBOARD (v8.6)
// ══════════════════════════════════════════════════════════════
function renderPainelPrecoCusto() {
  var panel = document.getElementById('precoCustoPanel');
  if (!panel) return;

  if (!precoCustoResultados.length) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';
  var h = '<div class="pc-header">Preços de Custo Estimados</div>';

  h += '<div class="pc-total">Total estimado: ' + formatCurrency(precoCustoTotalCusto) + '</div>';

  // Agrupar por setor
  var porSetor = {};
  precoCustoResultados.forEach(function(r) {
    var s = r.setor || 'GERAL';
    if (!porSetor[s]) porSetor[s] = { itens: [], total: 0 };
    porSetor[s].itens.push(r);
    porSetor[s].total += (r.custo || 0);
  });

  Object.keys(porSetor).forEach(function(setor) {
    var grp = porSetor[setor];
    h += '<div class="pc-setor-block">';
    h += '<div class="pc-setor-head">';
    h += '<span class="pc-setor-nome">' + escapeHtml(setor) + '</span>';
    h += '<span class="pc-setor-total">' + formatCurrency(grp.total) + '</span>';
    h += '</div>';
    grp.itens.forEach(function(it) {
      h += '<div class="pc-item">';
      h += '<span class="pc-desc">' + escapeHtml(it.descricao) + '</span>';
      h += '<span class="pc-custo">' + formatCurrency(it.custo || 0) + '</span>';
      h += '</div>';
    });
    h += '</div>';
  });

  h += '<div class="pc-actions">';
  h += '<button class="pc-action-btn" onclick="imprimirPrecoCusto()">🖨️ Imprimir</button>';
  h += '<button class="pc-action-btn" onclick="whatsappPrecoCusto()">📱 WhatsApp</button>';
  h += '<button class="pc-close-btn" onclick="fecharPainelCusto()">Fechar</button>';
  h += '</div>';

  panel.innerHTML = h;
}

function fecharPainelCusto() {
  var panel = document.getElementById('precoCustoPanel');
  if (panel) panel.style.display = 'none';
}

function imprimirPrecoCusto() {
  if (!precoCustoResultados.length) { toast('Sem dados'); return; }

  var corpo = '<div class="pdf-header">' +
    '<div class="pdf-brand">GRUPO CARLOS VAZ</div>' +
    '<div class="pdf-divider"></div>' +
    '<div class="pdf-title">Estimativa de Preço de Custo</div>' +
    '<div class="pdf-meta">Emitido em ' + _dataHoraAtual() + '</div></div>';

  var porSetor = {};
  precoCustoResultados.forEach(function(r) {
    var s = r.setor || 'GERAL';
    if (!porSetor[s]) porSetor[s] = { itens: [], total: 0 };
    porSetor[s].itens.push(r);
    porSetor[s].total += (r.custo || 0);
  });

  Object.keys(porSetor).forEach(function(setor) {
    var grp = porSetor[setor];
    corpo += '<div class="pdf-req-block">';
    corpo += '<div class="pdf-req-head"><div><div class="pdf-req-setor">SETOR</div><div class="pdf-req-id">' + escapeHtml(setor) + '</div></div>';
    corpo += '<div class="pdf-req-info"><div>' + formatCurrency(grp.total) + '</div></div></div>';

    corpo += '<table class="pdf-table"><thead><tr>';
    corpo += '<th style="width:5%;text-align:center;">#</th>';
    corpo += '<th style="width:65%;">Descrição</th>';
    corpo += '<th style="width:30%;text-align:right;">Custo Estimado</th>';
    corpo += '</tr></thead><tbody>';

    grp.itens.forEach(function(it, idx) {
      corpo += '<tr>';
      corpo += '<td style="text-align:center;color:#64748b;">' + (idx + 1) + '</td>';
      corpo += '<td>' + escapeHtml(it.descricao) + '</td>';
      corpo += '<td style="text-align:right;font-weight:600;">' + formatCurrency(it.custo || 0) + '</td>';
      corpo += '</tr>';
    });

    corpo += '<tr class="pdf-total-row">';
    corpo += '<td colspan="2" style="text-align:right;padding-right:12px;">TOTAL — ' + escapeHtml(setor) + '</td>';
    corpo += '<td style="text-align:right;">' + formatCurrency(grp.total) + '</td>';
    corpo += '</tr></tbody></table></div>';
  });

  corpo += '<div class="pdf-resumo"><strong>TOTAL GERAL CUSTO: ' + formatCurrency(precoCustoTotalCusto) + '</strong></div>';

  _abrirJanelaImpressao('Preço de Custo — CRV/LAS', corpo);
}

function whatsappPrecoCusto() {
  if (!precoCustoResultados.length) { toast('Sem dados'); return; }

  var texto = '💰 *ESTIMATIVA DE PREÇO DE CUSTO*\n';
  texto += '📅 ' + _dataHoraAtual() + '\n';
  texto += '━━━━━━━━━━━━━━━━━━━━\n\n';

  var porSetor = {};
  precoCustoResultados.forEach(function(r) {
    var s = r.setor || 'GERAL';
    if (!porSetor[s]) porSetor[s] = { itens: [], total: 0 };
    porSetor[s].itens.push(r);
    porSetor[s].total += (r.custo || 0);
  });

  Object.keys(porSetor).forEach(function(setor) {
    var grp = porSetor[setor];
    texto += '📁 *' + setor + '* — ' + formatCurrency(grp.total) + '\n';
    grp.itens.forEach(function(it) {
      texto += '   · ' + it.descricao + ': ' + formatCurrency(it.custo || 0) + '\n';
    });
    texto += '\n';
  });

  texto += '━━━━━━━━━━━━━━━━━━━━\n';
  texto += '💰 *TOTAL CUSTO: ' + formatCurrency(precoCustoTotalCusto) + '*\n\n';
  texto += '_Requisições Digital — CRV/LAS_';

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(function() {
      showSuccess('', 'Resumo copiado!', 'Cole no WhatsApp');
    }).catch(function() { toast('Erro ao copiar'); });
  } else {
    toast('Copie manualmente');
  }
}

// ══════════════════════════════════════════════════════════════
//  COMPARATIVO VENDA vs CUSTO
// ══════════════════════════════════════════════════════════════
function gerarComparativoVendaCusto() {
  if (!dadosCompletos) { toast('Carregue os dados primeiro'); return; }

  _carregarPrecosCustoParaRef(function(mapa) {
    if (!mapa || !Object.keys(mapa).length) {
      toast('Catálogo de custo vazio');
      return;
    }

    var mapaNorm = {};
    Object.keys(mapa).forEach(function(k) { mapaNorm[_normFront(k)] = mapa[k]; });

    var comparativo = [];
    var totalVenda = 0;
    var totalCusto = 0;

    dadosCompletos.cidades.forEach(function(cid) {
      cid.setores.forEach(function(setor) {
        setor.itens.forEach(function(it) {
          var desc = (it.descricao || '').toUpperCase().trim();
          var custoUnit = mapa[desc];
          if (custoUnit === undefined) custoUnit = mapaNorm[_normFront(desc)];

          if (custoUnit !== undefined && custoUnit > 0) {
            var custoTotal = custoUnit * (it.quantidade || 1);
            var margem = it.total > 0 ? ((it.total - custoTotal) / it.total) * 100 : 0;

            comparativo.push({
              cidade: cid.nome,
              setor: setor.nome,
              descricao: it.descricao,
              qtd: it.quantidade,
              vendaUnit: it.valorUnit || 0,
              vendaTotal: it.total || 0,
              custoUnit: custoUnit,
              custoTotal: custoTotal,
              margem: margem
            });

            totalVenda += (it.total || 0);
            totalCusto += custoTotal;
          }
        });
      });
    });

    if (!comparativo.length) {
      toast('Nenhum item com preço de custo cadastrado');
      return;
    }

    var margemGeral = totalVenda > 0 ? ((totalVenda - totalCusto) / totalVenda) * 100 : 0;

    var texto = '📊 *COMPARATIVO VENDA vs CUSTO*\n';
    texto += '📅 ' + _dataHoraAtual() + '\n';
    texto += '━━━━━━━━━━━━━━━━━━━━\n\n';
    texto += '💰 Total Venda: ' + formatCurrency(totalVenda) + '\n';
    texto += '📦 Total Custo: ' + formatCurrency(totalCusto) + '\n';
    texto += '📈 Margem Geral: ' + margemGeral.toFixed(1) + '%\n';
    texto += '📋 ' + comparativo.length + ' itens comparados\n\n';
    texto += '_Requisições Digital — CRV/LAS_';

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function() {
        showSuccess('', 'Comparativo copiado!', 'Margem: ' + margemGeral.toFixed(1) + '%');
      }).catch(function() { toast('Erro ao copiar'); });
    }
  });
}

// ══════════════════════════════════════════════════════════════
//  VALIDAÇÃO DE DADOS NA IMPORTAÇÃO
// ══════════════════════════════════════════════════════════════
function validarItensImportacao(itens) {
  var erros = [];
  itens.forEach(function(it, idx) {
    var num = idx + 1;
    if (!it.descricao_normalizada && !it.descricao) {
      erros.push('Item ' + num + ': descrição vazia');
    }
    if (!it.quantidade || it.quantidade <= 0) {
      erros.push('Item ' + num + ': quantidade inválida');
    }
    if (it.valor_total < 0) {
      erros.push('Item ' + num + ': total negativo');
    }
  });
  return erros;
}

// ══════════════════════════════════════════════════════════════
//  FORMATAÇÃO AUXILIAR
// ══════════════════════════════════════════════════════════════
function formatarNumeroCompacto(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function pluralizar(qtd, singular, plural) {
  return qtd === 1 ? singular : (plural || singular + 's');
}

function capitalizar(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function truncar(str, max) {
  if (!str || str.length <= max) return str || '';
  return str.substring(0, max - 3) + '...';
}

// ══════════════════════════════════════════════════════════════
//  DEBOUNCE PARA BUSCAS
// ══════════════════════════════════════════════════════════════
function debounce(fn, delay) {
  var timer = null;
  return function() {
    var args = arguments;
    var ctx = this;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
  };
}

// Debounce para busca no catálogo
var filtrarCatalogoDebounced = debounce(filtrarCatalogo, 300);
var filtrarCatalogoCustoDebounced = debounce(filtrarCatalogoCusto, 300);

// ══════════════════════════════════════════════════════════════
//  LIMPEZA DE CACHE
// ══════════════════════════════════════════════════════════════
function limparCacheLocal() {
  window._precoCustoMapaCache = null;
  window._catalogoCustoItens = null;
  catalogo = [];
  comandosIA = [];
  historicoMeses = null;
  dadosCompletos = null;
  toast('Cache limpo');
  if (sessao) carregarDados();
}

// ══════════════════════════════════════════════════════════════
//  DIAGNÓSTICO (para debug)
// ══════════════════════════════════════════════════════════════
function diagnostico() {
  var info = {
    versao: APP_VERSION,
    usuario: sessao ? sessao.nome : 'N/A',
    nivel: sessao ? sessao.nivel : 'N/A',
    dadosCarregados: !!dadosCompletos,
    cidades: dadosCompletos ? dadosCompletos.cidades.length : 0,
    totalGeral: dadosCompletos ? formatCurrency(dadosCompletos.totalGeral || 0) : 'N/A',
    catalogoItens: catalogo.length,
    comandosIA: comandosIA.length,
    historicoMeses: historicoMeses ? historicoMeses.length : 0,
    online: navigator.onLine,
    sw: 'serviceWorker' in navigator,
    cache: {
      precoCusto: !!window._precoCustoMapaCache,
      catalogoCusto: !!(window._catalogoCustoItens && window._catalogoCustoItens.length)
    }
  };

  console.table(info);

  var texto = '🔧 DIAGNÓSTICO CRV/LAS v' + APP_VERSION + '\n\n';
  Object.keys(info).forEach(function(k) {
    var val = info[k];
    if (typeof val === 'object') val = JSON.stringify(val);
    texto += k + ': ' + val + '\n';
  });

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(function() {
      toast('Diagnóstico copiado');
    });
  }

  return info;
}

// ══════════════════════════════════════════════════════════════
//  EXPOSIÇÃO GLOBAL (para chamadas do HTML onclick)
// ══════════════════════════════════════════════════════════════
window.fazerLogin = fazerLogin;
window.toggleSenha = toggleSenha;
window.logout = logout;
window.abrirMenuLateral = abrirMenuLateral;
window.fecharMenuLateral = fecharMenuLateral;
window.menuAcao = menuAcao;
window.abrirCidade = abrirCidade;
window.fecharCidade = fecharCidade;
window.editarRequisicao = editarRequisicao;
window.fecharEditReq = fecharEditReq;
window.editRecalcTotal = editRecalcTotal;
window.editRemoverItem = editRemoverItem;
window.editAdicionarItem = editAdicionarItem;
window.editSalvar = editSalvar;
window.editExcluirRequisicao = editExcluirRequisicao;
window.abrirImportar = abrirImportar;
window.fecharImportar = fecharImportar;
window.escolherCidadeSetor = escolherCidadeSetor;
window.confirmarImportacao = confirmarImportacao;
window.voltarStep1 = voltarStep1;
window.removerItemImp = removerItemImp;
window.adicionarItemImpManual = adicionarItemImpManual;
window.recalcTotal = recalcTotal;
window.recalcUnit = recalcUnit;
window.adicionarCidade = adicionarCidade;
window.removerCidade = removerCidade;
window.adicionarSetor = adicionarSetor;
window.removerSetor = removerSetor;
window.abrirCatalogo = abrirCatalogo;
window.fecharCatalogo = fecharCatalogo;
window.filtrarCatalogo = filtrarCatalogo;
window.filtrarCatalogoDebounced = filtrarCatalogoDebounced;
window.dispararSalvar = dispararSalvar;
window.abrirCatalogoCusto = abrirCatalogoCusto;
window.fecharCatalogoCusto = fecharCatalogoCusto;
window.filtrarCatalogoCusto = filtrarCatalogoCusto;
window.filtrarCatalogoCustoDebounced = filtrarCatalogoCustoDebounced;
window.salvarPrecoCusto = salvarPrecoCusto;
window.abrirAssistenteIA = abrirAssistenteIA;
window.fecharAssistenteIA = fecharAssistenteIA;
window.executarComandoIA = executarComandoIA;
window.copiarTextoIA = copiarTextoIA;
window.aplicarAtualizacaoIA = aplicarAtualizacaoIA;
window.toggleRelatorio = toggleRelatorio;
window.imprimirTodasRequisicoes = imprimirTodasRequisicoes;
window.imprimirRequisicaoIndividual = imprimirRequisicaoIndividual;
window.imprimirPorSetor = imprimirPorSetor;
window.abrirViradaMes = abrirViradaMes;
window.fecharViradaMes = fecharViradaMes;
window.confirmarViradaMes = confirmarViradaMes;
window.abrirHistoricoCompleto = abrirHistoricoCompleto;
window.fecharHistorico = fecharHistorico;
window.abrirMesDetalhe = abrirMesDetalhe;
window.fecharMesDetalhe = fecharMesDetalhe;
window.imprimirHistorico3Meses = imprimirHistorico3Meses;
window.whatsappHistorico3Meses = whatsappHistorico3Meses;
window.imprimirMesEspecifico = imprimirMesEspecifico;
window.whatsappMesEspecifico = whatsappMesEspecifico;
window.imprimirMesDetalhado = imprimirMesDetalhado;
window.whatsappMesDetalhado = whatsappMesDetalhado;
window.abrirPesquisaCusto = abrirPesquisaCusto;
window.cancelarPesquisaCusto = cancelarPesquisaCusto;
window.renderPainelPrecoCusto = renderPainelPrecoCusto;
window.fecharPainelCusto = fecharPainelCusto;
window.imprimirPrecoCusto = imprimirPrecoCusto;
window.whatsappPrecoCusto = whatsappPrecoCusto;
window.gerarComparativoVendaCusto = gerarComparativoVendaCusto;
window.limparCacheLocal = limparCacheLocal;
window.diagnostico = diagnostico;
window.scrollToTop = scrollToTop;

// ══════════════════════════════════════════════════════════════
//  FIM — app.js v8.7.0 PREMIUM
//  Grupo Carlos Vaz — CRV/LAS
// ══════════════════════════════════════════════════════════════
