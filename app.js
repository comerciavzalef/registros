// ============================================================
//  REQUISIÇÕES DIGITAL — app.js v8.8.0 PREMIUM
//  Grupo Carlos Vaz — CRV/LAS
//  v8.8: Redesign UI + Catálogo Custo por Setor + Filtros + Fix IA
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

// ── v8.8: Catálogo Custo - estado de filtro/sort ──
var _custoCatSort = 'setor';
var _custoCatSetorFiltro = 'TODOS';

// ── v8.8: Mapa de setores para categorização inteligente ──
var SETOR_CATEGORIAS = {
  'MERCEARIA':    { icon: '🛒', color: 'accent',  keywords: ['ARROZ','FEIJÃO','FEIJAO','AÇÚCAR','ACUCAR','ÓLEO','OLEO','SAL','CAFÉ','CAFE','FARINHA','MACARRÃO','MACARRAO','FUBÁ','FUBA','VINAGRE','MOLHO','EXTRATO','TEMPERO','COLORAU','COLORÍFICO','COLORAU','CALDO','SARDINHA','ATUM','MILHO VERDE','ERVILHA','ACHOCOLATADO','LEITE EM PÓ','LEITE EM PO','CREME DE LEITE','LEITE CONDENSADO','GELATINA','AMIDO','FERMENTO','MASSA','BISCOITO','BOLACHA','AVEIA','FLOCOS','PROTEÍNA','PROTEINA','COCO RALADO','LEITE DE COCO','AZEITE','MANTEIGA','MARGARINA'] },
  'HORTIFRUTI':   { icon: '🥬', color: 'success', keywords: ['ALFACE','TOMATE','CEBOLA','BATATA','CENOURA','BETERRABA','BANANA','MAÇÃ','MACA','LARANJA','LIMÃO','LIMAO','MAMÃO','MAMAO','MANGA','MELANCIA','UVA','ABACAXI','COUVE','REPOLHO','PIMENTÃO','PIMENTAO','ABÓBORA','ABOBORA','CHUCHU','PEPINO','ALHO','CHEIRO VERDE','COENTRO','SALSA','INHAME','MANDIOCA','MACAXEIRA','AIPIM','BERINJELA','QUIABO','JILÓ','JILO','MAXIXE'] },
  'FRIOS':        { icon: '🧀', color: 'info',    keywords: ['QUEIJO','PRESUNTO','MORTADELA','SALSICHA','LINGUIÇA','LINGUICA','MUSSARELA','MUÇARELA','REQUEIJÃO','REQUEIJAO','IOGURTE','MANTEIGA','CREAM CHEESE','BACON','APRESUNTADO','PEITO DE PERU','SALAMINHO','PROVOLONE','RICOTA','NATA','CREME DE RICOTA'] },
  'CONGELADOS':   { icon: '🧊', color: 'purple',  keywords: ['FRANGO','CARNE','BOI','PEIXE','TILÁPIA','TILAPIA','CHARQUE','CALABRESA','HAMBÚRGUER','HAMBURGUER','NUGGET','SALSICHA','SOBRECOXA','COXA','PEITO DE FRANGO','FILÉ','FILE','ACÉM','ACEM','COSTELA','CUPIM','ALCATRA','PATINHO','POLPA','COXÃO','COXAO','MÚSCULO','MUSCULO','STEAK','EMPANADO','BOLINHO','CAMARÃO','CAMARAO','POLVO'] },
  'BEBIDAS':      { icon: '🥤', color: 'warning',  keywords: ['REFRIGERANTE','SUCO','ÁGUA','AGUA','CERVEJA','VINHO','ENERGÉTICO','ENERGETICO','CHÁ','CHA','LEITE','ACHOCOLATADO LÍQUIDO','NECTAR','ISOTÔNICO','ISOTONICO','POLPA DE FRUTA'] },
  'LIMPEZA':      { icon: '🧹', color: 'teal',    keywords: ['DETERGENTE','SABÃO','SABAO','DESINFETANTE','ÁGUA SANITÁRIA','AGUA SANITARIA','ALVEJANTE','ESPONJA','PANO','VASSOURA','RODO','BALDE','SACO DE LIXO','LUVA','LIMPEZA','MULTIUSO','AMACIANTE','SABÃO EM PÓ','SABAO EM PO','CLORO'] },
  'DESCARTÁVEIS': { icon: '🥤', color: 'orange',  keywords: ['COPO','PRATO DESCARTÁVEL','PRATO DESCARTAVEL','GUARDANAPO','PAPEL','ALUMÍNIO','ALUMINIO','FILME','SACOLA','EMBALAGEM','MARMITA','TALHER','CANUDO','TOALHA DE PAPEL','PAPEL HIGIÊNICO','PAPEL HIGIENICO','PAPEL TOALHA'] },
  'PADARIA':      { icon: '🍞', color: 'yellow',  keywords: ['PÃO','PAO','BOLO','TORTA','ROSCA','BISCOITO','SALGADO','COXINHA','PASTEL','EMPADA','SONHO','CROISSANT'] },
  'OUTROS':       { icon: '📦', color: 'accent',  keywords: [] }
};

var SETOR_COLOR_MAP = {
  accent:  { bg: 'var(--accent-soft)',  border: 'var(--accent-mid)',  text: 'var(--accent)' },
  success: { bg: 'var(--success-soft)', border: 'var(--success-mid)', text: 'var(--success)' },
  info:    { bg: 'var(--info-soft)',    border: 'rgba(90,126,184,.2)', text: 'var(--info)' },
  purple:  { bg: 'var(--purple-soft)',  border: 'var(--purple-mid)',  text: 'var(--purple)' },
  warning: { bg: 'var(--warning-soft)', border: 'var(--warning-mid)', text: 'var(--warning)' },
  teal:    { bg: 'rgba(90,158,138,.1)', border: 'rgba(90,158,138,.2)', text: 'var(--teal)' },
  orange:  { bg: 'var(--warning-soft)', border: 'var(--warning-mid)', text: 'var(--orange)' },
  yellow:  { bg: 'rgba(184,168,90,.1)', border: 'rgba(184,168,90,.2)', text: 'var(--yellow)' },
  danger:  { bg: 'var(--danger-soft)',  border: 'var(--danger-mid)',  text: 'var(--danger)' }
};

// ══════════════════════════════════════════════════════════════
//  INIT & LOGIN
// ══════════════════════════════════════════════════════════════
var APP_VERSION = '8.8.0';
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
//  v8.7: HISTÓRICO NO DASHBOARD
// ══════════════════════════════════════════════════════════════
function renderHistoricoDashboard() {
  var container = document.getElementById('historicoCards');
  if (!container) return;

  if (!historicoMeses || !historicoMeses.length) {
    container.innerHTML = '<div class="hist-empty"><div class="hist-empty-text">Nenhum mês arquivado ainda. Use "Virada de Mês" no menu para arquivar o mês atual.</div></div>';
    return;
  }

  var ultimos = historicoMeses.slice(-3).reverse();
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
//  v8.8: CATEGORIZAÇÃO INTELIGENTE DE ITENS POR SETOR
// ══════════════════════════════════════════════════════════════
function _categorizarItem(descricao) {
  var desc = (descricao || '').toUpperCase().trim();
  desc = desc.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  var setorKeys = Object.keys(SETOR_CATEGORIAS);
  for (var s = 0; s < setorKeys.length; s++) {
    var setor = setorKeys[s];
    if (setor === 'OUTROS') continue;
    var keywords = SETOR_CATEGORIAS[setor].keywords;
    for (var k = 0; k < keywords.length; k++) {
      var kw = keywords[k].normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (desc.indexOf(kw) > -1) return setor;
    }
  }
  return 'OUTROS';
}

function _getSetorInfo(setorNome) {
  return SETOR_CATEGORIAS[setorNome] || SETOR_CATEGORIAS['OUTROS'];
}

function _getSetorColorStyle(colorKey) {
  return SETOR_COLOR_MAP[colorKey] || SETOR_COLOR_MAP['accent'];
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
         'class="imp-btn-confirm" style="max-width:280px;">Imprimir Todas as Requisições</button>';
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
           'class="rgh-btn" title="Imprimir setor">Imprimir</button>' +
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
        if (grp.observacao) h += ' — ' + escapeHtml(grp.observacao);
        h += '</span>';
        h += '<span class="rgh-count">' + grp.itens.length + ' itens · ' + formatCurrency(grp.total) + '</span>';
        h += '</div>';
        h += '<div class="rgh-top-right">';
        h += '<button class="rgh-btn" onclick="editarRequisicao(\'' + escapeHtml(cid.nome) + '\',\'' +
             escapeHtml(setor.nome) + '\',\'' + escapeHtml(rid) + '\')" title="Editar">Editar</button>';
        h += '<button class="rgh-btn" onclick="event.stopPropagation();imprimirRequisicaoIndividual(\'' + escapeHtml(cid.nome) +
             '\',\'' + escapeHtml(setor.nome) + '\',\'' + escapeHtml(rid) + '\')" title="Imprimir">Imprimir</button>';
        h += '</div></div>';

        if (grp.data) {
          h += '<div class="rgh-meta">';
          h += '<span class="rgh-chip"><span class="rgh-chip-ico">📅</span>' + escapeHtml(formatarDataBR(grp.data)) + '</span>';
          h += '</div>';
        }

        h += '</div>';

        grp.itens.forEach(function (it) {
          var descDisplay = escapeHtml(it.descricao);
          descDisplay = descDisplay.replace(/\[([^\]]+)\]/g, '<span style="color:var(--accent);font-size:0.63rem;font-weight:600;display:block;">$1</span>');
          h += '<div class="item-row"><div class="item-desc">' + descDisplay +
               ' <span style="color:var(--text-tertiary);font-size:0.68rem;">(x' + it.quantidade + ')</span></div>' +
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
  h += '<div><div class="pdf-req-setor">' + escapeHtml(setorNome) + '</div>';
  h += '<div class="pdf-req-id">ID: ' + escapeHtml(reqId) + '</div></div>';
  h += '<div class="pdf-req-info">';
  if (grp.data) h += '<div>' + escapeHtml(formatarDataBR(grp.data)) + '</div>';
  h += '<div>' + grp.itens.length + ' ite' + (grp.itens.length === 1 ? 'm' : 'ns') + '</div>';
  h += '</div></div>';

  if (grp.observacao) {
    h += '<div class="pdf-req-obs"><strong>Observação:</strong> ' + escapeHtml(grp.observacao) + '</div>';
  }

  h += '<table class="pdf-table"><thead><tr>' +
       '<th style="width:5%;text-align:center;">#</th>' +
       '<th style="width:43%;">Descrição</th>' +
       '<th style="width:10%;text-align:center;">Qtd</th>' +
       '<th style="width:7%;text-align:center;">Un</th>' +
       '<th style="width:17%;text-align:right;">V. Unitário</th>' +
       '<th style="width:18%;text-align:right;">Total</th>' +
       '</tr></thead><tbody>';
  grp.itens.forEach(function(it, idx) {
    h += '<tr>' +
         '<td style="text-align:center;color:#64748b;">' + (idx+1) + '</td>' +
         '<td style="font-weight:500;">' + escapeHtml(it.descricao) + '</td>' +
         '<td style="text-align:center;">' + (it.quantidade || 0) + '</td>' +
         '<td style="text-align:center;color:#64748b;">' + escapeHtml(it.um || '') + '</td>' +
         '<td style="text-align:right;">' + formatCurrency(it.valorUnit || 0) + '</td>' +
         '<td style="text-align:right;font-weight:600;">' + formatCurrency(it.total || 0) + '</td>' +
         '</tr>';
  });
  h += '<tr class="pdf-total-row">' +
       '<td colspan="5" style="text-align:right;padding-right:12px;">TOTAL — ' + escapeHtml(reqId) + '</td>' +
       '<td style="text-align:right;">' + formatCurrency(grp.total) + '</td>' +
       '</tr></tbody></table></div>';
  return h;
}

function _abrirJanelaImpressao(titulo, corpoHtml) {
  var css = [
    '<style>',
    '@page { size: A4; margin: 10mm 12mm; }',
    '* { box-sizing: border-box; margin: 0; padding: 0; }',
    'body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #1a1a2e; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; line-height: 1.4; }',
    '.pdf-header { padding: 10px 0 8px; margin-bottom: 10px; text-align: center; border-bottom: 2px solid #1e3a5f; }',
    '.pdf-brand { font-size: 15px; font-weight: 800; letter-spacing: 3px; color: #1e3a5f; text-transform: uppercase; }',
    '.pdf-divider { width: 40px; height: 2px; background: #5a7fa3; margin: 4px auto 5px; border-radius: 2px; }',
    '.pdf-title { font-size: 13px; font-weight: 600; color: #2c5282; }',
    '.pdf-meta { font-size: 9px; color: #777; margin-top: 3px; }',
    '.pdf-req-block { margin-bottom: 16px; page-break-inside: avoid; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }',
    '.pdf-req-head { display: flex; justify-content: space-between; padding: 8px 12px; background: #1e3a5f; color: #fff; }',
    '.pdf-req-setor { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.85; }',
    '.pdf-req-id { font-size: 13px; font-weight: 800; margin-top: 1px; }',
    '.pdf-req-info { font-size: 9px; text-align: right; line-height: 1.5; opacity: 0.9; }',
    '.pdf-req-obs { padding: 8px 16px; background: #fffbeb; border-bottom: 1px solid #f0e6c8; font-size: 11px; color: #92400e; }',
    '.pdf-req-obs strong { color: #78350f; }',
    '.pdf-table { width: 100%; border-collapse: collapse; font-size: 10px; }',
    '.pdf-table thead th { background: #f1f5f9; color: #334155; padding: 5px 6px; font-weight: 700; text-align: left; font-size: 8.5px; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; }',
    '.pdf-table tbody td { padding: 4px 6px; border-bottom: 1px solid #f1f5f9; }',
    '.pdf-table tbody tr:nth-child(even) td { background: #f8fafc; }',
    '.pdf-total-row td { background: #1e3a5f !important; color: #fff !important; font-weight: 700; font-size: 10px; }',
    '.pdf-footer { margin-top: 16px; padding: 8px 0; border-top: 2px solid #e2e8f0; font-size: 8px; color: #94a3b8; text-align: center; }',
    '.pdf-resumo { margin-top: 12px; padding: 10px 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 10px; color: #166534; }',
    '.pdf-resumo strong { font-size: 12px; }',
    '@media print { .no-print { display: none !important; } }',
    '.no-print { position: fixed; top: 14px; right: 14px; z-index: 9999; display: flex; gap: 8px; }',
    '.no-print button { background: #1e3a5f; color: #fff; border: none; padding: 11px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }',
    '.no-print button.cancel { background: #64748b; }',
    '</style>'
  ].join('');

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + escapeHtml(titulo) + '</title>' + css + '</head><body>' +
             '<div class="no-print"><button onclick="window.print()">Imprimir / Salvar PDF</button>' +
             '<button class="cancel" onclick="window.close()">Fechar</button></div>' +
             corpoHtml +
             '<div class="pdf-footer">Grupo Carlos Vaz — CRV/LAS · Sistema de Requisições Digital v' + APP_VERSION + '</div>' +
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
  var totalGeral = 0, totalReqs = 0;

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
  if (!cid) return;
  var setor = cid.setores.find(function(s) { return s.nome === setorNome; });
  if (!setor) return;

  var grp = { itens: [], total: 0, observacao: '', data: '' };
  setor.itens.forEach(function(it) {
    if ((it.requisicao || '-') === reqId) {
      grp.itens.push(it); grp.total += it.total;
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
  if (!cid) return;
  var setor = cid.setores.find(function(s) { return s.nome === setorNome; });
  if (!setor || !setor.itens.length) { toast('Setor vazio'); return; }

  var reqMap = {};
  setor.itens.forEach(function(it) {
    var rid = it.requisicao || '-';
    if (!reqMap[rid]) reqMap[rid] = { itens: [], total: 0, observacao: '', data: '' };
    reqMap[rid].itens.push(it); reqMap[rid].total += it.total;
    if (it.observacao && !reqMap[rid].observacao) reqMap[rid].observacao = it.observacao;
    if (it.data && !reqMap[rid].data) reqMap[rid].data = it.data;
  });

  var corpo = _gerarCabecalhoPDF(cidadeNome);
  var totalSetor = 0, totalReqs = 0;
  Object.keys(reqMap).forEach(function(rid) {
    corpo += _gerarBlocoRequisicaoPDF(setorNome, rid, reqMap[rid]);
    totalSetor += reqMap[rid].total; totalReqs++;
  });

  corpo += '<div class="pdf-resumo"><strong>TOTAL SETOR ' + escapeHtml(setorNome) + ': ' + formatCurrency(totalSetor) + '</strong><br>' +
           totalReqs + ' requisições · ' + setor.itens.length + ' itens</div>';
  _abrirJanelaImpressao('Requisições ' + setorNome + ' — ' + cidadeNome, corpo);
}

// ══════════════════════════════════════════════════════════════
//  CATÁLOGO DE PREÇOS (venda)
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

  var h = '<div class="cat-meta">' + lista.length + ' ' + (lista.length === 1 ? 'item' : 'itens') + '</div>';

  lista.forEach(function (it) {
    var codigoHtml = it.codigo
      ? '<span class="cat-cod">' + escapeHtml(it.codigo) + '</span><span class="cat-sep">·</span>'
      : '';

    h += '<div class="cat-item">' +
         '<div class="cat-info">' + codigoHtml +
         '<span class="cat-desc">' + escapeHtml(it.descricao) + '</span></div>' +
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
         'onkeydown="if(event.key===\'Enter\')dispararSalvar(' + it.linha + ')">' +
         '</div>' +
         '<button class="cat-save-btn" onclick="dispararSalvar(' + it.linha + ')" title="Salvar">✓</button>' +
         '</div></div>';
  });

  document.getElementById('catalogoBody').innerHTML = h;
}

// ══════════════════════════════════════════════════════════════
//  v8.8: CATÁLOGO PREÇO DE CUSTO — SEPARADO POR SETOR + FILTROS
// ══════════════════════════════════════════════════════════════
function abrirCatalogoCusto() {
  document.body.style.overflow = 'hidden';
  document.getElementById('catalogoCustoModal').classList.add('show');
  history.pushState({ modal: 'catalogoCusto' }, '', '');

  _custoCatSort = 'setor';
  _custoCatSetorFiltro = 'TODOS';

  document.getElementById('catalogoCustoBody').innerHTML =
    '<div style="text-align:center;padding:40px 20px;"><div class="ld-spinner" style="margin:0 auto 16px;"></div>' +
    '<div class="empty-text">Carregando catálogo de custo...</div></div>';
  document.getElementById('catalogoCustoSearch').value = '';
  document.getElementById('custoSetorTabs').innerHTML = '';

  // Reset filter buttons
  document.querySelectorAll('.custo-filter-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.sort === 'setor');
  });

  fetch(API_URL + '?userHash=' + sessao.hash + '&acao=catalogocusto')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status !== 'ok') { toast(d.msg || 'Erro'); return; }
      window._catalogoCustoItens = (d.itens || []).map(function(it) {
        it._setor = _categorizarItem(it.descricao);
        return it;
      });
      _renderCustoSetorTabs();
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

function _renderCustoSetorTabs() {
  var itens = window._catalogoCustoItens || [];
  var contagem = {};
  itens.forEach(function(it) {
    var s = it._setor || 'OUTROS';
    contagem[s] = (contagem[s] || 0) + 1;
  });

  var tabs = document.getElementById('custoSetorTabs');
  if (!tabs) return;

  var setorKeys = Object.keys(SETOR_CATEGORIAS).filter(function(k) { return contagem[k] > 0; });
  if (setorKeys.length < 2) { tabs.innerHTML = ''; return; }

  var h = '<button class="custo-setor-tab active" data-setor="TODOS" onclick="filtrarCustoSetor(\'TODOS\')">Todos <span class="cst-count">' + itens.length + '</span></button>';
  setorKeys.forEach(function(k) {
    var info = SETOR_CATEGORIAS[k];
    h += '<button class="custo-setor-tab" data-setor="' + k + '" onclick="filtrarCustoSetor(\'' + k + '\')">' +
         info.icon + ' ' + k.charAt(0) + k.slice(1).toLowerCase() +
         ' <span class="cst-count">' + contagem[k] + '</span></button>';
  });

  tabs.innerHTML = h;
}

function filtrarCustoSetor(setor) {
  _custoCatSetorFiltro = setor;
  document.querySelectorAll('.custo-setor-tab').forEach(function(tab) {
    tab.classList.toggle('active', tab.dataset.setor === setor);
  });
  var q = document.getElementById('catalogoCustoSearch').value.toLowerCase().trim();
  renderCatalogoCusto(q);
}

function sortCatalogoCusto(tipo) {
  _custoCatSort = tipo;
  document.querySelectorAll('.custo-filter-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.sort === tipo);
  });
  var q = document.getElementById('catalogoCustoSearch').value.toLowerCase().trim();
  renderCatalogoCusto(q);
}

function filtrarCatalogoCusto() {
  var q = document.getElementById('catalogoCustoSearch').value.toLowerCase().trim();
  renderCatalogoCusto(q);
}

function renderCatalogoCusto(filtro) {
  var lista = (window._catalogoCustoItens || []).slice();

  // Filtrar por texto
  if (filtro) {
    lista = lista.filter(function(it) {
      return (it.descricao || '').toLowerCase().indexOf(filtro) > -1;
    });
  }

  // Filtrar por setor
  if (_custoCatSetorFiltro !== 'TODOS') {
    lista = lista.filter(function(it) { return it._setor === _custoCatSetorFiltro; });
  }

  if (!lista.length) {
    document.getElementById('catalogoCustoBody').innerHTML =
      '<div class="empty-state"><div class="empty-text">' +
      (filtro ? 'Nenhum item para "' + escapeHtml(filtro) + '"' : 'Catálogo de custo vazio') + '</div></div>';
    return;
  }

  // Ordenar
  if (_custoCatSort === 'az') {
    lista.sort(function(a, b) { return (a.descricao || '').localeCompare(b.descricao || ''); });
  } else if (_custoCatSort === 'za') {
    lista.sort(function(a, b) { return (b.descricao || '').localeCompare(a.descricao || ''); });
  } else if (_custoCatSort === 'preco-asc') {
    lista.sort(function(a, b) { return (a.custo || 0) - (b.custo || 0); });
  } else if (_custoCatSort === 'preco-desc') {
    lista.sort(function(a, b) { return (b.custo || 0) - (a.custo || 0); });
  }

  // Stats
  var totalCusto = 0;
  lista.forEach(function(it) { totalCusto += (it.custo || 0); });

  var h = '<div class="custo-stats-bar">';
  h += '<span class="custo-stat-chip"><span class="csc-val">' + lista.length + '</span> itens</span>';
  if (totalCusto > 0) {
    h += '<span class="custo-stat-chip chip-total">Total: <span class="csc-val">' + formatCurrency(totalCusto) + '</span></span>';
  }
  h += '</div>';

  // Renderizar agrupado por setor ou flat
  if (_custoCatSort === 'setor' && _custoCatSetorFiltro === 'TODOS') {
    // Agrupar
    var grupos = {};
    lista.forEach(function(it) {
      var s = it._setor || 'OUTROS';
      if (!grupos[s]) grupos[s] = [];
      grupos[s].push(it);
    });

    var setorKeys = Object.keys(SETOR_CATEGORIAS);
    setorKeys.forEach(function(setorKey) {
      var grpItens = grupos[setorKey];
      if (!grpItens || !grpItens.length) return;
      var info = SETOR_CATEGORIAS[setorKey];
      var colorStyle = _getSetorColorStyle(info.color);
      var totalGrupo = 0;
      grpItens.forEach(function(it) { totalGrupo += (it.custo || 0); });

      h += '<div class="custo-setor-group">';
      h += '<div class="custo-setor-group-header">';
      h += '<div class="custo-setor-group-icon" style="background:' + colorStyle.bg + ';border:1px solid ' + colorStyle.border + ';color:' + colorStyle.text + ';">' + info.icon + '</div>';
      h += '<div class="custo-setor-group-nome">' + setorKey.charAt(0) + setorKey.slice(1).toLowerCase() + '</div>';
      h += '<div class="custo-setor-group-count">' + grpItens.length + ' itens</div>';
      if (totalGrupo > 0) h += '<div class="custo-setor-group-total">' + formatCurrency(totalGrupo) + '</div>';
      h += '</div>';

      grpItens.forEach(function(it) {
        h += _renderCustoItem(it);
      });
      h += '</div>';
    });
  } else {
    // Flat
    lista.forEach(function(it) {
      h += _renderCustoItem(it);
    });
  }

  document.getElementById('catalogoCustoBody').innerHTML = h;
}

function _renderCustoItem(it) {
  var setorInfo = _getSetorInfo(it._setor);
  var confClass = '';
  var confLabel = '';
  if (it.confianca) {
    var cf = it.confianca.toUpperCase();
    if (cf === 'ALTA') { confClass = 'conf-alta'; confLabel = 'Alta'; }
    else if (cf === 'MEDIA' || cf === 'MÉDIA') { confClass = 'conf-media'; confLabel = 'Média'; }
    else { confClass = 'conf-baixa'; confLabel = 'Baixa'; }
  }

  var h = '<div class="custo-item">';
  h += '<div class="custo-item-info">';
  h += '<div class="custo-item-nome">' + escapeHtml(it.descricao) + '</div>';
  h += '<div class="custo-item-meta">';
  h += '<span style="opacity:.7;">' + setorInfo.icon + ' ' + (it._setor || 'Outros').charAt(0) + (it._setor || 'Outros').slice(1).toLowerCase() + '</span>';
  if (confLabel) h += '<span class="custo-item-badge ' + confClass + '">' + confLabel + '</span>';
  h += '</div></div>';

  h += '<div class="custo-item-action">';
  h += '<div class="custo-valor-wrap">';
  h += '<span class="custo-prefix">R$</span>';
  h += '<input type="text" inputmode="decimal" class="custo-input" ' +
       'id="input_custo_' + it.linha + '" ' +
       'value="' + formatNum(it.custo || 0) + '" ' +
       'data-linha="' + it.linha + '" ' +
       'data-original="' + (it.custo || 0) + '" ' +
       'data-desc="' + escapeHtml(it.descricao) + '" ' +
       'onfocus="this.select()" ' +
       'onkeydown="if(event.key===\'Enter\')salvarPrecoCusto(' + it.linha + ')">';
  h += '</div>';
  h += '<button class="custo-save-btn" onclick="salvarPrecoCusto(' + it.linha + ')" title="Salvar">✓</button>';
  h += '</div></div>';
  return h;
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
      } else { callback({}); }
    })
    .catch(function() { callback({}); });
}

// ══════════════════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════════════════
function getSetorClass(nome) {
  var n = (nome || '').toUpperCase();
  if (n.indexOf('EDUCAÇÃO') > -1 || n.indexOf('EDUCACAO') > -1) return 'edu';
  if (n.indexOf('SAÚDE') > -1 || n.indexOf('SAUDE') > -1) return 'sau';
  if (n.indexOf('ASSISTÊNCIA') > -1 || n.indexOf('ASSISTENCIA') > -1) return 'ass';
  if (n.indexOf('ADMINISTRAÇÃO') > -1 || n.indexOf('ADMINISTRACAO') > -1) return 'adm';
  if (n.indexOf('INFRAESTRUTURA') > -1) return 'inf';
  return 'adm';
}

function formatCurrency(v) {
  if (typeof v !== 'number' || isNaN(v)) v = 0;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

function _dataHoraAtual() {
  var d = new Date();
  return String(d.getDate()).padStart(2,'0') + '/' +
         String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear() + ' às ' +
         String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

function _normFront(str) {
  if (!str) return '';
  var s = String(str).toUpperCase().trim();
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[^A-Z0-9 ]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function dispararSalvar(linha) {
  var input = document.getElementById('input_cat_' + linha);
  if (!input) return;

  var original = parseFloat(input.dataset.original);
  var desc = input.dataset.desc;
  var novo = parseValorBR(input.value);

  if (novo === null || novo < 0) { toast('Valor inválido'); input.value = formatNum(original); return; }
  if (Math.abs(novo - original) < 0.001) { input.value = formatNum(original); input.blur(); return; }

  var msg = 'Atualizar "' + desc + '" para R$ ' + formatNum(novo) + '?\n\nAtualizar também requisições antigas?\n\nOK = sim · Cancelar = só pendentes';
  var atualizarAntigas = confirm(msg);

  input.dataset.original = novo;
  input.value = formatNum(novo);
  input.blur();

  var btn = input.parentElement.nextElementSibling;
  if (btn) { btn.innerHTML = '...'; btn.disabled = true; }

  showSuccess('', 'Preço alterado!', 'Sincronizando...');

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
      if (d.atualizadosPendentes > 0 || d.atualizadosAntigos > 0) carregarDados();
    } else {
      input.dataset.original = original; input.value = formatNum(original);
      if (btn) { btn.innerHTML = '✓'; btn.disabled = false; }
      toast(d.msg || 'Erro ao salvar');
    }
  })
  .catch(function() {
    input.dataset.original = original; input.value = formatNum(original);
    if (btn) { btn.innerHTML = '✓'; btn.disabled = false; }
    toast('Erro de conexão');
  });
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
  texto += '_Requisições Digital v' + APP_VERSION + ' — CRV/LAS_';

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(function () {
      showSuccess('', 'Resumo copiado!', 'Cole no WhatsApp');
    }).catch(function () { toast('Erro ao copiar'); });
  } else { toast('Copie manualmente'); }
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
  if (lista.some(function(c) { return c.toLowerCase() === nome.toLowerCase(); })) { toast('Cidade já existe'); return; }
  lista.push(nome); lista.sort();
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
  lista.push(nome); lista.sort();
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
    String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');
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
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
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

  var payload = { acao: 'parsearrequisicao', usuario: sessao.nome, senha: sessao.hash };
  if (texto) payload.textoBruto = texto;

  if (arquivo) {
    comprimirImagem(arquivo, 1400, function(base64) {
      payload.imagemBase64 = base64.split(',')[1];
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
    body: JSON.stringify(payload), redirect: 'follow'
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
        if (pp.status === 'ok') importacaoTemp.reqId = pp.proximoId;
        renderPreviewImportacao();
      }).catch(function(){ renderPreviewImportacao(); });
    })
    .catch(function() { toast('Erro de conexão'); voltarStep1(); });
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
  h += '<div><strong>Req ID:</strong> <span style="color:var(--accent);font-weight:700;">' + escapeHtml(importacaoTemp.reqId) + '</span></div>';
  if (importacaoTemp.observacao) h += '<div style="color:var(--accent);"><strong>Obs:</strong> ' + escapeHtml(importacaoTemp.observacao) + '</div>';
  if (importacaoTemp.data) { var p = importacaoTemp.data.split('-'); h += '<div><strong>Data:</strong> ' + p[2] + '/' + p[1] + '/' + p[0] + '</div>'; }
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
      h += '<div class="imp-dest-row"><label>Escola/Local<input class="imp-input imp-dest" value="' + escapeHtml(it.destinatario) + '" data-idx="' + idx + '" data-campo="destinatario"></label></div>';
    }
    h += '<div class="imp-row-grid">';
    h += '<label>Qtd<input type="number" step="0.01" class="imp-input" value="' + it.quantidade + '" data-idx="' + idx + '" data-campo="quantidade"></label>';
    h += '<label>Un<input class="imp-input" value="' + escapeHtml(it.unidade_compra) + '" data-idx="' + idx + '" data-campo="unidade_compra"></label>';
    h += '<label>Por emb<input type="number" step="1" class="imp-input" value="' + (it.qtd_por_embalagem || 1) + '" data-idx="' + idx + '" data-campo="qtd_por_embalagem"></label>';
    h += '<label>Unit R$<input type="number" step="0.01" class="imp-input imp-unit" value="' + (it.valor_unitario_calc || 0).toFixed(4) + '" data-idx="' + idx + '" data-campo="valor_unitario_calc" id="impUnit' + idx + '" onchange="recalcTotal(' + idx + ')"></label>';
    h += '<label>Total R$<input type="number" step="0.01" class="imp-input" value="' + it.valor_total + '" data-idx="' + idx + '" data-campo="valor_total" id="impTotal' + idx + '" onchange="recalcUnit(' + idx + ')"></label>';
    h += '</div>';

    var statusTxt = '';
    if (it.status_catalogo === 'NOVO') statusTxt = 'Item novo — entrará no catálogo';
    else if (it.status_catalogo === 'DIVERGENTE') statusTxt = 'Catálogo: R$ ' + (it.preco_no_catalogo || 0).toFixed(2) + ' (AUTO) — será atualizado';
    else if (it.status_catalogo === 'MANUAL_PROTEGIDO') statusTxt = 'Catálogo: R$ ' + (it.preco_no_catalogo || 0).toFixed(2) + ' (MANUAL) — protegido';
    else if (it.status_catalogo === 'OK') statusTxt = 'Bate com catálogo';
    if (it.confianca === 'BAIXA') statusTxt = 'CONFIRMAR — ' + (it.observacao || 'IA com baixa confiança');
    h += '<div class="imp-status-msg">' + statusTxt + '</div>';
    h += '<button class="imp-remove" onclick="removerItemImp(' + idx + ')">Remover</button>';
    h += '</div>';
  });

  h += '<button class="imp-add-item-btn" onclick="adicionarItemImpManual()"><span class="iaim-icon">+</span><span class="iaim-text"><span class="iaim-title">Adicionar item manualmente</span><span class="iaim-sub">Inclua um item que a IA não detectou</span></span></button>';

  h += '<div class="imp-total-box">Total da Requisição: <strong id="impTotalGeral">R$ ' + totalGeral.toFixed(2).replace('.', ',') + '</strong></div>';
  h += '<div class="imp-actions"><button class="imp-btn-cancel" onclick="voltarStep1()">Refazer</button><button class="imp-btn-confirm" onclick="confirmarImportacao()">Confirmar e Lançar</button></div>';

  document.getElementById('impPreview').innerHTML = h;

  document.querySelectorAll('#impPreview input').forEach(function(inp) {
    inp.addEventListener('input', function() {
      var idx = parseInt(this.dataset.idx);
      var campo = this.dataset.campo;
      importacaoTemp.itens[idx][campo] = this.type === 'number' ? parseFloat(this.value) : this.value;
    });
  });
}

function recalcUnit(idx) {
  var it = importacaoTemp.itens[idx];
  var unit = it.valor_total / ((it.quantidade || 1) * (it.qtd_por_embalagem || 1));
  it.valor_unitario_calc = unit;
  var el = document.getElementById('impUnit' + idx);
  if (el) el.value = unit.toFixed(4);
  _recalcTotalGeral();
}

function recalcTotal(idx) {
  var it = importacaoTemp.itens[idx];
  var total = (it.valor_unitario_calc || 0) * (it.quantidade || 1) * (it.qtd_por_embalagem || 1);
  it.valor_total = total;
  var el = document.getElementById('impTotal' + idx);
  if (el) el.value = total.toFixed(2);
  _recalcTotalGeral();
}

function _recalcTotalGeral() {
  var t = 0;
  importacaoTemp.itens.forEach(function(i) { t += parseFloat(i.valor_total) || 0; });
  var el = document.getElementById('impTotalGeral');
  if (el) el.textContent = 'R$ ' + t.toFixed(2).replace('.', ',');
}

function removerItemImp(idx) {
  if (!importacaoTemp || !importacaoTemp.itens[idx]) return;
  importacaoTemp.itens.splice(idx, 1);
  if (!importacaoTemp.itens.length) { toast('Todos os itens removidos'); voltarStep1(); return; }
  toast('Item removido');
  renderPreviewImportacao();
}

function adicionarItemImpManual() {
  if (!importacaoTemp) return;
  importacaoTemp.itens.push({
    ordem: importacaoTemp.itens.length + 1, descricao: '', descricao_normalizada: '',
    quantidade: 1, unidade_compra: 'UN', qtd_por_embalagem: 1,
    valor_total: 0, valor_unitario_calc: 0, confianca: 'ALTA',
    observacao: 'Manual', destinatario: '', status_catalogo: 'NOVO',
    preco_no_catalogo: null, origem_atual: null, _manual: true
  });
  renderPreviewImportacao();
  setTimeout(function() {
    var inputs = document.querySelectorAll('#impPreview .imp-desc');
    var ultimo = inputs[inputs.length - 1];
    if (ultimo) { ultimo.focus(); ultimo.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }, 80);
  showSuccess('', 'Item adicionado', 'Preencha os valores');
}

function confirmarImportacao() {
  if (!importacaoTemp || !importacaoTemp.itens.length) { toast('Sem itens'); return; }
  var btn = document.querySelector('.imp-btn-confirm');
  btn.disabled = true; btn.textContent = 'Lançando...';

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'confirmarimportacao', usuario: sessao.nome, senha: sessao.hash,
      cidade: importacaoTemp.cidade, setor: importacaoTemp.setor,
      reqId: importacaoTemp.reqId, data: importacaoTemp.data,
      observacao: importacaoTemp.observacao || '', itens: importacaoTemp.itens
    }), redirect: 'follow'
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status === 'ok') {
        showSuccess('', 'Requisição lançada!', d.itensInseridos + ' itens · R$ ' + d.totalRequisicao.toFixed(2));
        fecharImportar(); carregarDados();
      } else { toast(d.msg || 'Erro ao lançar'); btn.disabled = false; btn.textContent = 'Confirmar e Lançar'; }
    })
    .catch(function() { toast('Erro de conexão'); btn.disabled = false; btn.textContent = 'Confirmar e Lançar'; });
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
    cidade: cidade, setor: setor, reqId: reqId, setorOriginal: setor,
    itens: itens.map(function(it) {
      return { linha: it.linha, descricao: it.descricao, quantidade: it.quantidade, um: it.um || '', valorUnit: it.valorUnit || 0, total: it.total || 0, observacao: it.observacao || '', data: it.data || '', destinatario: it.destinatario || '' };
    }),
    observacao: itens[0].observacao || '', data: itens[0].data || ''
  };

  renderEditReq();
  document.getElementById('editReqModal').classList.add('show');
  document.body.style.overflow = 'hidden';
  history.pushState({ modal: 'editReq' }, '', '');
}

function fecharEditReq() {
  var wasOpen = document.getElementById('editReqModal').classList.contains('show');
  document.getElementById('editReqModal').classList.remove('show');
  document.body.style.overflow = ''; editTemp = null;
  if (wasOpen && !_insidePopstate) history.back();
}

function renderEditReq() {
  if (!editTemp) return;
  document.getElementById('editReqTitle').textContent = editTemp.reqId + ' — ' + editTemp.cidade;

  var h = '<div class="edit-header-box">';
  h += '<label class="edit-label">Observação<input type="text" class="edit-input" id="editObs" value="' + escapeHtml(editTemp.observacao) + '"></label>';
  h += '<label class="edit-label">Data<input type="date" class="edit-input" id="editData" value="' + _brParaIso(editTemp.data) + '"></label>';
  h += '<label class="edit-label">Setor atual<select id="editSetorMover" class="edit-input">';
  SETORES_PADRAO.forEach(function(s) {
    h += '<option value="' + escapeHtml(s) + '"' + (s === editTemp.setor ? ' selected' : '') + '>' + escapeHtml(s) + '</option>';
  });
  h += '</select></label></div>';

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
    h += '<button class="edit-remove-btn" onclick="editRemoverItem(' + idx + ')">Remover item</button></div>';
  });

  h += '<button class="imp-add-item-btn" onclick="editAdicionarItem()" style="margin:12px 0;"><span class="iaim-icon">+</span><span class="iaim-text"><span class="iaim-title">Adicionar item</span><span class="iaim-sub">Inclua um novo item nesta requisição</span></span></button>';

  var totalReq = 0;
  editTemp.itens.forEach(function(it) { totalReq += (it.total || 0); });
  h += '<div class="imp-total-box">Total: <strong id="editTotalGeral">' + formatCurrency(totalReq) + '</strong></div>';
  h += '<div class="edit-actions"><button class="imp-btn-cancel" onclick="editExcluirRequisicao()">Excluir Requisição</button><button class="imp-btn-confirm" onclick="editSalvar()">Salvar Alterações</button></div>';

  document.getElementById('editReqBody').innerHTML = h;

  document.querySelectorAll('#editReqBody input[data-idx]').forEach(function(inp) {
    inp.addEventListener('input', function() {
      var idx = parseInt(this.dataset.idx), campo = this.dataset.campo;
      if (campo === 'quantidade' || campo === 'valorUnit' || campo === 'total') editTemp.itens[idx][campo] = parseFloat(this.value) || 0;
      else editTemp.itens[idx][campo] = this.value;
    });
  });
}

function editRecalcTotal(idx) {
  var it = editTemp.itens[idx];
  it.total = (it.quantidade || 0) * (it.valorUnit || 0);
  var el = document.getElementById('editTotal' + idx);
  if (el) el.value = it.total.toFixed(2);
  var t = 0; editTemp.itens.forEach(function(i) { t += (i.total || 0); });
  var el2 = document.getElementById('editTotalGeral');
  if (el2) el2.textContent = formatCurrency(t);
}

function editRemoverItem(idx) {
  if (!editTemp || !editTemp.itens[idx]) return;
  if (!confirm('Remover "' + editTemp.itens[idx].descricao + '"?')) return;
  editTemp.itens.splice(idx, 1);
  if (!editTemp.itens.length) { toast('Sem itens — use Excluir Requisição'); }
  renderEditReq();
}

function editAdicionarItem() {
  if (!editTemp) return;
  editTemp.itens.push({ linha: null, descricao: '', quantidade: 1, um: 'UN', valorUnit: 0, total: 0, observacao: '', data: editTemp.data, destinatario: '', _novo: true });
  renderEditReq();
  setTimeout(function() {
    var inputs = document.querySelectorAll('#editReqBody .edit-item-desc');
    var u = inputs[inputs.length - 1];
    if (u) { u.focus(); u.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
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
      acao: 'editarrequisicao', usuario: sessao.nome, senha: sessao.hash,
      cidade: editTemp.cidade, setor: editTemp.setorOriginal, reqId: editTemp.reqId,
      novoSetor: moverSetor ? novoSetor : null, observacao: obs, data: data, itens: editTemp.itens
    }), redirect: 'follow'
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    btn.disabled = false; btn.textContent = 'Salvar Alterações';
    if (d.status === 'ok') {
      showSuccess('', 'Requisição salva!', moverSetor ? 'Movida para ' + novoSetor : '');
      fecharEditReq(); fecharCidade(); carregarDados();
    } else { toast(d.msg || 'Erro ao salvar'); }
  })
  .catch(function() { btn.disabled = false; btn.textContent = 'Salvar Alterações'; toast('Erro de conexão'); });
}

function editExcluirRequisicao() {
  if (!editTemp) return;
  if (!confirm('EXCLUIR requisição ' + editTemp.reqId + '?\n\nAção irreversível!')) return;
  if (!confirm('TEM CERTEZA? Todos os itens serão removidos.')) return;

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'excluirrequisicao', usuario: sessao.nome, senha: sessao.hash,
      cidade: editTemp.cidade, setor: editTemp.setorOriginal, reqId: editTemp.reqId
    }), redirect: 'follow'
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.status === 'ok') {
      showSuccess('', 'Requisição excluída', editTemp.reqId);
      fecharEditReq(); fecharCidade(); carregarDados();
    } else { toast(d.msg || 'Erro ao excluir'); }
  })
  .catch(function() { toast('Erro de conexão'); });
}

// ══════════════════════════════════════════════════════════════
//  ASSISTENTE IA — v8.8 FIX
// ══════════════════════════════════════════════════════════════
function abrirAssistenteIA() {
  document.body.style.overflow = 'hidden';
  document.getElementById('iaModal').classList.add('show');
  history.pushState({ modal: 'ia' }, '', '');

  var iaBody = document.getElementById('iaBody');
  if (!iaBody) { toast('Erro interno: container IA não encontrado'); return; }

  if (!comandosIA.length) {
    iaBody.innerHTML =
      '<div style="text-align:center;padding:40px;"><div class="ld-spinner" style="margin:0 auto 16px;"></div>' +
      '<div class="empty-text">Carregando comandos...</div></div>';
    fetch(API_URL + '?userHash=' + sessao.hash + '&acao=comandosia')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.status === 'ok') {
          comandosIA = d.comandos || [];
          renderComandosIA();
        } else {
          iaBody.innerHTML = '<div class="empty-state"><div class="empty-text">' + (d.msg || 'Erro') + '</div></div>';
        }
      })
      .catch(function() {
        iaBody.innerHTML = '<div class="empty-state"><div class="empty-text">Erro de conexão</div></div>';
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
  var iaBody = document.getElementById('iaBody');
  if (!iaBody) return;

  var h = '<div class="ia-cmds-grid">';
  comandosIA.forEach(function(cmd) {
    h += '<button class="ia-cmd-btn" onclick="executarComandoIA(\'' + escapeHtml(cmd.id) + '\')">';
    h += '<div class="ia-cmd-icon">' + (cmd.icone || '🤖') + '</div>';
    h += '<div style="flex:1;min-width:0;">';
    h += '<div class="ia-cmd-nome">' + escapeHtml(cmd.nome) + '</div>';
    h += '<div class="ia-cmd-desc">' + escapeHtml(cmd.descricao || '') + '</div>';
    h += '</div></button>';
  });
  h += '</div>';
  h += '<div id="iaResultado" class="ia-resultado"></div>';
  iaBody.innerHTML = h;
}

function executarComandoIA(cmdId) {
  var resBox = document.getElementById('iaResultado');
  if (!resBox) return;
  resBox.innerHTML = '<div style="text-align:center;padding:30px;"><div class="ld-spinner" style="margin:0 auto 16px;"></div><div class="empty-text">Processando...</div></div>';
  resBox.scrollIntoView({ behavior: 'smooth' });

  var cmd = comandosIA.find(function(c) { return c.id === cmdId; });
  var needsInput = cmd && cmd.requerInput;
  var inputUsuario = '';

  if (needsInput) {
    inputUsuario = prompt(cmd.promptInput || 'Digite o parâmetro:');
    if (inputUsuario === null || !inputUsuario.trim()) { resBox.innerHTML = ''; return; }
  }

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      acao: 'executarcomandia', usuario: sessao.nome, senha: sessao.hash,
      comandoId: cmdId, input: inputUsuario
    }), redirect: 'follow'
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.status === 'ok') {
      var resp = d.resultado || d.texto || '';
      resBox.innerHTML = '<div class="ia-resp-box"><div class="ia-resp-head">Resultado — ' + escapeHtml(cmd ? cmd.nome : cmdId) + '</div>' +
        '<div class="ia-resp-body">' + _formatIAResp(resp) + '</div>' +
        '<div class="ia-resp-actions"><button class="ia-copy-btn" onclick="copiarTextoIA()">Copiar</button></div></div>';

      if (d.atualizacao) {
        iaAtualizacaoTemp = d.atualizacao;
        resBox.innerHTML += '<div class="ia-update-box"><div class="ia-update-msg">' + escapeHtml(d.atualizacao.mensagem || 'Atualização disponível') + '</div>' +
          '<button class="ia-apply-btn" onclick="aplicarAtualizacaoIA()">Aplicar Atualização</button></div>';
      }
    } else {
      resBox.innerHTML = '<div class="ia-resp-box ia-resp-erro"><div class="ia-resp-head">Erro</div><div class="ia-resp-body">' + escapeHtml(d.msg || 'Erro desconhecido') + '</div></div>';
    }
  })
  .catch(function() {
    resBox.innerHTML = '<div class="ia-resp-box ia-resp-erro"><div class="ia-resp-head">Erro</div><div class="ia-resp-body">Sem conexão com o servidor</div></div>';
  });
}

function _formatIAResp(texto) {
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
  }
}

function aplicarAtualizacaoIA() {
  if (!iaAtualizacaoTemp) return;
  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ acao: 'aplicaratualizacaoia', usuario: sessao.nome, senha: sessao.hash, atualizacao: iaAtualizacaoTemp }),
    redirect: 'follow'
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.status === 'ok') { showSuccess('', 'Atualização aplicada!', d.msg || ''); iaAtualizacaoTemp = null; carregarDados(); }
    else { toast(d.msg || 'Erro ao aplicar'); }
  })
  .catch(function() { toast('Erro de conexão'); });
}

// ══════════════════════════════════════════════════════════════
//  v8.7: VIRADA DE MÊS
// ══════════════════════════════════════════════════════════════
function abrirViradaMes() {
  document.body.style.overflow = 'hidden';
  document.getElementById('viradaMesModal').classList.add('show');
  history.pushState({ modal: 'viradaMes' }, '', '');

  var meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var hoje = new Date();
  var mesAtual = meses[hoje.getMonth()] + '/' + hoje.getFullYear();
  var totalGeral = dadosCompletos ? (dadosCompletos.totalGeral || 0) : 0;
  var totalItens = 0;
  if (dadosCompletos && dadosCompletos.cidades) dadosCompletos.cidades.forEach(function(c) { totalItens += c.itens; });

  var h = '<div class="vm-header"><div class="vm-icon">📅</div><div class="vm-title">Virada de Mês</div><div class="vm-subtitle">Arquivar mês atual e iniciar novo período</div></div>';
  h += '<div class="vm-info-box"><div class="vm-info-label">Mês a ser arquivado</div><div class="vm-info-value" id="vmMesNome">' + escapeHtml(mesAtual) + '</div>';
  h += '<div class="vm-info-stats"><span>' + formatCurrency(totalGeral) + '</span><span>' + totalItens + ' itens</span></div></div>';

  if (dadosCompletos && dadosCompletos.cidades) {
    h += '<div class="vm-cidades-resumo">';
    dadosCompletos.cidades.forEach(function(cid) {
      if (cid.itens > 0) {
        h += '<div class="vm-cidade-row"><span class="vm-cid-nome">' + escapeHtml(cid.nome) + '</span><span class="vm-cid-val">' + formatCurrency(cid.total) + ' · ' + cid.itens + ' itens</span></div>';
      }
    });
    h += '</div>';
  }

  h += '<div class="vm-warning"><strong>Atenção:</strong> Esta ação irá salvar os totais e detalhes no histórico, depois limpar todas as requisições. <strong>Não pode ser desfeita.</strong></div>';
  h += '<div class="vm-actions"><button class="vm-btn-cancel" onclick="fecharViradaMes()">Cancelar</button><button class="vm-btn-confirm" id="vmBtnConfirm" onclick="confirmarViradaMes()">Confirmar Virada</button></div>';

  document.getElementById('viradaMesBody').innerHTML = h;
}

function fecharViradaMes() {
  var wasOpen = document.getElementById('viradaMesModal').classList.contains('show');
  document.body.style.overflow = '';
  document.getElementById('viradaMesModal').classList.remove('show');
  if (wasOpen && !_insidePopstate) history.back();
}

function confirmarViradaMes() {
  if (!confirm('TEM CERTEZA que deseja virar o mês?\n\nTodos os dados serão arquivados e as requisições zeradas.')) return;
  var btn = document.getElementById('vmBtnConfirm');
  btn.disabled = true; btn.textContent = 'Processando...';

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ acao: 'viradames', usuario: sessao.nome, senha: sessao.hash }),
    redirect: 'follow'
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    btn.disabled = false; btn.textContent = 'Confirmar Virada';
    if (d.status === 'ok') {
      showSuccess('', 'Mês virado!', d.mesArquivado || '');
      fecharViradaMes(); historicoMeses = null; window._precoCustoMapaCache = null;
      carregarDados(); carregarHistorico();
    } else { toast(d.msg || 'Erro'); }
  })
  .catch(function() { btn.disabled = false; btn.textContent = 'Confirmar Virada'; toast('Erro de conexão'); });
}

// ══════════════════════════════════════════════════════════════
//  v8.7: HISTÓRICO COMPLETO + MÊS DETALHE
// ══════════════════════════════════════════════════════════════
function abrirHistoricoCompleto() {
  document.body.style.overflow = 'hidden';
  document.getElementById('historicoModal').classList.add('show');
  history.pushState({ modal: 'historico' }, '', '');

  if (!historicoMeses) {
    document.getElementById('historicoBody').innerHTML = '<div style="text-align:center;padding:40px;"><div class="ld-spinner" style="margin:0 auto 16px;"></div><div class="empty-text">Carregando...</div></div>';
    carregarHistorico();
    setTimeout(renderHistoricoCompleto, 2000);
  } else { renderHistoricoCompleto(); }
}

function fecharHistorico() {
  var wasOpen = document.getElementById('historicoModal').classList.contains('show');
  document.body.style.overflow = '';
  document.getElementById('historicoModal').classList.remove('show');
  if (wasOpen && !_insidePopstate) history.back();
}

function renderHistoricoCompleto() {
  if (!historicoMeses || !historicoMeses.length) {
    document.getElementById('historicoBody').innerHTML = '<div class="empty-state"><div class="empty-text">Nenhum mês arquivado ainda</div></div>';
    return;
  }
  var CIDADES_ORDEM = ['Ibicuí', 'Nova Canaã', 'Boa Nova', 'Dário Meira', 'Floresta Azul'];
  var meses = historicoMeses.slice().reverse();
  var totalAcumulado = 0;
  meses.forEach(function(m) { totalAcumulado += (m.total || 0); });

  var h = '<div class="hist-full-header"><div class="hfh-total">' + formatCurrency(totalAcumulado) + '</div>';
  h += '<div class="hfh-count">' + meses.length + ' meses arquivados</div></div>';
  h += '<div class="hist-acoes"><button class="hist-acao-btn" onclick="imprimirHistorico3Meses()">Imprimir últimos 3 meses</button>';
  h += '<button class="hist-acao-btn" onclick="whatsappHistorico3Meses()">WhatsApp últimos 3 meses</button></div>';

  meses.forEach(function(mes) {
    h += '<div class="hist-full-mes" onclick="abrirMesDetalhe(\'' + escapeHtml(mes.nome) + '\')">';
    h += '<div class="hfm-top"><div class="hfm-nome">' + escapeHtml(mes.nome) + '</div><div class="hfm-total">' + formatCurrency(mes.total) + '</div></div>';
    h += '<div class="hfm-cidades">';
    CIDADES_ORDEM.forEach(function(cid) {
      var val = (mes.cidades && mes.cidades[cid]) ? mes.cidades[cid] : 0;
      if (val > 0) h += '<div class="hfm-cid-row"><span class="hfm-cid-nome">' + escapeHtml(cid) + '</span><span class="hfm-cid-val">' + formatCurrency(val) + '</span></div>';
    });
    h += '</div></div>';
  });

  document.getElementById('historicoBody').innerHTML = h;
}

function abrirMesDetalhe(mesNome) {
  document.getElementById('mesDetalheModal').classList.add('show');
  document.body.style.overflow = 'hidden';
  history.pushState({ modal: 'mesDetalhe' }, '', '');
  document.getElementById('mesDetalheTitle').textContent = mesNome;
  document.getElementById('mesDetalheBody').innerHTML = '<div style="text-align:center;padding:40px;"><div class="ld-spinner" style="margin:0 auto 16px;"></div><div class="empty-text">Carregando...</div></div>';

  fetch(API_URL + '?userHash=' + sessao.hash + '&acao=historicomes&mes=' + encodeURIComponent(mesNome))
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status === 'ok') renderMesDetalhe(mesNome, d);
      else document.getElementById('mesDetalheBody').innerHTML = '<div class="empty-state"><div class="empty-text">' + escapeHtml(d.msg || 'Erro') + '</div></div>';
    })
    .catch(function() { document.getElementById('mesDetalheBody').innerHTML = '<div class="empty-state"><div class="empty-text">Erro de conexão</div></div>'; });
}

function fecharMesDetalhe() {
  var wasOpen = document.getElementById('mesDetalheModal').classList.contains('show');
  document.getElementById('mesDetalheModal').classList.remove('show');
  document.body.style.overflow = '';
  if (wasOpen && !_insidePopstate) history.back();
}

function renderMesDetalhe(mesNome, dados) {
  var CIDADES_ORDEM = ['Ibicuí', 'Nova Canaã', 'Boa Nova', 'Dário Meira', 'Floresta Azul'];
  var resumo = dados.resumo || {}, detalhes = dados.detalhes || [];

  var h = '<div class="md-resumo"><div class="md-total-geral">' + formatCurrency(resumo.total || 0) + '</div><div class="md-total-meta">' + (resumo.totalItens || 0) + ' itens</div></div>';

  // Rankings
  var cidadeArr = [];
  CIDADES_ORDEM.forEach(function(cid) { cidadeArr.push({ nome: cid, total: (resumo.cidades && resumo.cidades[cid]) || 0 }); });
  cidadeArr.sort(function(a, b) { return b.total - a.total; });
  var maxCid = cidadeArr[0] && cidadeArr[0].total > 0 ? cidadeArr[0].total : 1;

  h += '<div class="md-section"><div class="md-section-title">Ranking por Cidade</div>';
  cidadeArr.forEach(function(c, idx) {
    if (c.total <= 0) return;
    var pct = (c.total / maxCid) * 100;
    h += '<div class="ranking-item"><div class="r-left"><span class="r-pos">' + (idx+1) + '</span><div class="r-info"><span class="r-nome">' + escapeHtml(c.nome) + '</span></div></div><div class="r-right"><span class="r-valor">' + formatCurrency(c.total) + '</span><div class="r-bar-bg"><div class="r-bar-fill blue" style="width:' + pct + '%"></div></div></div></div>';
  });
  h += '</div>';

  if (resumo.setores) {
    var setorArr = [];
    Object.keys(resumo.setores).forEach(function(s) { setorArr.push({ nome: s, total: resumo.setores[s] }); });
    setorArr.sort(function(a, b) { return b.total - a.total; });
    var maxSet = setorArr[0] && setorArr[0].total > 0 ? setorArr[0].total : 1;

    h += '<div class="md-section"><div class="md-section-title">Ranking por Setor</div>';
    setorArr.forEach(function(s, idx) {
      if (s.total <= 0) return;
      h += '<div class="ranking-item"><div class="r-left"><span class="r-pos">' + (idx+1) + '</span><div class="r-info"><span class="r-nome">' + escapeHtml(s.nome) + '</span></div></div><div class="r-right"><span class="r-valor">' + formatCurrency(s.total) + '</span><div class="r-bar-bg"><div class="r-bar-fill purple" style="width:' + ((s.total/maxSet)*100) + '%"></div></div></div></div>';
    });
    h += '</div>';
  }

  if (detalhes.length) {
    h += '<div class="md-section"><div class="md-section-title">Requisições do Período</div>';
    var agrupado = {};
    detalhes.forEach(function(it) {
      var cid = it.cidade || 'N/A', set = it.setor || 'N/A', rid = it.reqId || '-';
      if (!agrupado[cid]) agrupado[cid] = {};
      if (!agrupado[cid][set]) agrupado[cid][set] = {};
      if (!agrupado[cid][set][rid]) agrupado[cid][set][rid] = { itens: [], total: 0, obs: '' };
      agrupado[cid][set][rid].itens.push(it);
      agrupado[cid][set][rid].total += (it.total || 0);
      if (it.observacao && !agrupado[cid][set][rid].obs) agrupado[cid][set][rid].obs = it.observacao;
    });

    CIDADES_ORDEM.forEach(function(cid) {
      if (!agrupado[cid]) return;
      h += '<div class="md-cidade-block"><div class="md-cidade-nome">' + escapeHtml(cid) + '</div>';
      Object.keys(agrupado[cid]).forEach(function(set) {
        Object.keys(agrupado[cid][set]).forEach(function(rid) {
          var grp = agrupado[cid][set][rid];
          h += '<div class="md-req-block"><div class="md-req-head"><div class="md-req-id">' + escapeHtml(rid) + '</div><div class="md-req-setor">' + escapeHtml(set) + '</div><div class="md-req-val">' + formatCurrency(grp.total) + '</div></div>';
          if (grp.obs) h += '<div class="md-req-obs">' + escapeHtml(grp.obs) + '</div>';
          grp.itens.forEach(function(it) {
            h += '<div class="md-item"><span class="md-item-desc">' + escapeHtml(it.descricao || '') + ' <span style="opacity:.5;">(x' + (it.quantidade || 0) + ')</span></span><span class="md-item-val">' + formatCurrency(it.total || 0) + '</span></div>';
          });
          h += '</div>';
        });
      });
      h += '</div>';
    });
    h += '</div>';
  }

  h += '<div class="md-actions"><button class="hist-acao-btn" onclick="imprimirMesEspecifico(\'' + escapeHtml(mesNome) + '\')">Imprimir</button><button class="hist-acao-btn" onclick="whatsappMesEspecifico(\'' + escapeHtml(mesNome) + '\')">WhatsApp</button></div>';
  document.getElementById('mesDetalheBody').innerHTML = h;
}

// ══════════════════════════════════════════════════════════════
//  IMPRESSÃO / WHATSAPP HISTÓRICO
// ══════════════════════════════════════════════════════════════
function imprimirHistorico3Meses() {
  if (!historicoMeses || !historicoMeses.length) { toast('Sem histórico'); return; }
  var ultimos = historicoMeses.slice(-3).reverse();
  var CIDADES_ORDEM = ['Ibicuí', 'Nova Canaã', 'Boa Nova', 'Dário Meira', 'Floresta Azul'];
  var corpo = '<div class="pdf-header"><div class="pdf-brand">GRUPO CARLOS VAZ</div><div class="pdf-divider"></div><div class="pdf-title">Resumo dos Últimos 3 Meses</div><div class="pdf-meta">' + _dataHoraAtual() + '</div></div>';
  var acumulado = 0;
  ultimos.forEach(function(mes) {
    acumulado += (mes.total || 0);
    corpo += '<div class="pdf-req-block"><div class="pdf-req-head"><div><div class="pdf-req-setor">MÊS</div><div class="pdf-req-id">' + escapeHtml(mes.nome) + '</div></div><div class="pdf-req-info"><div>' + formatCurrency(mes.total) + '</div></div></div>';
    corpo += '<table class="pdf-table"><thead><tr><th style="width:60%;">Cidade</th><th style="width:40%;text-align:right;">Total</th></tr></thead><tbody>';
    CIDADES_ORDEM.forEach(function(cid) {
      var val = (mes.cidades && mes.cidades[cid]) || 0;
      if (val > 0) corpo += '<tr><td>' + escapeHtml(cid) + '</td><td style="text-align:right;font-weight:600;">' + formatCurrency(val) + '</td></tr>';
    });
    corpo += '<tr class="pdf-total-row"><td style="text-align:right;">TOTAL</td><td style="text-align:right;">' + formatCurrency(mes.total) + '</td></tr></tbody></table></div>';
  });
  corpo += '<div class="pdf-resumo"><strong>ACUMULADO: ' + formatCurrency(acumulado) + '</strong></div>';
  _abrirJanelaImpressao('Resumo 3 Meses — CRV/LAS', corpo);
}

function whatsappHistorico3Meses() {
  if (!historicoMeses || !historicoMeses.length) { toast('Sem histórico'); return; }
  var ultimos = historicoMeses.slice(-3).reverse();
  var CIDADES_ORDEM = ['Ibicuí', 'Nova Canaã', 'Boa Nova', 'Dário Meira', 'Floresta Azul'];
  var texto = '📊 *RESUMO — ÚLTIMOS 3 MESES*\n📅 ' + _dataHoraAtual() + '\n━━━━━━━━━━━━━━━━━━━━\n\n';
  var acumulado = 0;
  ultimos.forEach(function(mes) {
    acumulado += (mes.total || 0);
    texto += '📅 *' + mes.nome.toUpperCase() + '*\n';
    CIDADES_ORDEM.forEach(function(cid) {
      var val = (mes.cidades && mes.cidades[cid]) || 0;
      if (val > 0) texto += '   🏙️ ' + cid + ': ' + formatCurrency(val) + '\n';
    });
    texto += '   💰 *Total: ' + formatCurrency(mes.total) + '*\n\n';
  });
  texto += '━━━━━━━━━━━━━━━━━━━━\n📊 *ACUMULADO: ' + formatCurrency(acumulado) + '*\n\n_Requisições Digital v' + APP_VERSION + ' — CRV/LAS_';
  if (navigator.clipboard) navigator.clipboard.writeText(texto).then(function() { showSuccess('', 'Copiado!', 'Cole no WhatsApp'); });
}

function imprimirMesEspecifico(mesNome) {
  var mes = historicoMeses ? historicoMeses.find(function(m) { return m.nome === mesNome; }) : null;
  if (!mes) { toast('Mês não encontrado'); return; }
  var CIDADES_ORDEM = ['Ibicuí', 'Nova Canaã', 'Boa Nova', 'Dário Meira', 'Floresta Azul'];
  var corpo = '<div class="pdf-header"><div class="pdf-brand">GRUPO CARLOS VAZ</div><div class="pdf-divider"></div><div class="pdf-title">Resumo — ' + escapeHtml(mesNome) + '</div><div class="pdf-meta">' + _dataHoraAtual() + '</div></div>';
  corpo += '<div class="pdf-req-block"><div class="pdf-req-head"><div><div class="pdf-req-setor">PERÍODO</div><div class="pdf-req-id">' + escapeHtml(mesNome) + '</div></div><div class="pdf-req-info"><div>' + formatCurrency(mes.total) + '</div></div></div>';
  corpo += '<table class="pdf-table"><thead><tr><th style="width:60%;">Cidade</th><th style="width:40%;text-align:right;">Total</th></tr></thead><tbody>';
  CIDADES_ORDEM.forEach(function(cid) {
    var val = (mes.cidades && mes.cidades[cid]) || 0;
    if (val > 0) corpo += '<tr><td>' + escapeHtml(cid) + '</td><td style="text-align:right;font-weight:600;">' + formatCurrency(val) + '</td></tr>';
  });
  corpo += '<tr class="pdf-total-row"><td style="text-align:right;">TOTAL</td><td style="text-align:right;">' + formatCurrency(mes.total) + '</td></tr></tbody></table></div>';
  _abrirJanelaImpressao('Resumo ' + mesNome, corpo);
}

function whatsappMesEspecifico(mesNome) {
  var mes = historicoMeses ? historicoMeses.find(function(m) { return m.nome === mesNome; }) : null;
  if (!mes) { toast('Mês não encontrado'); return; }
  var CIDADES_ORDEM = ['Ibicuí', 'Nova Canaã', 'Boa Nova', 'Dário Meira', 'Floresta Azul'];
  var texto = '📊 *RESUMO — ' + mesNome.toUpperCase() + '*\n📅 ' + _dataHoraAtual() + '\n━━━━━━━━━━━━━━━━━━━━\n\n';
  CIDADES_ORDEM.forEach(function(cid) {
    var val = (mes.cidades && mes.cidades[cid]) || 0;
    if (val > 0) texto += '🏙️ *' + cid.toUpperCase() + '*\n   💰 ' + formatCurrency(val) + '\n\n';
  });
  texto += '━━━━━━━━━━━━━━━━━━━━\n📊 *TOTAL: ' + formatCurrency(mes.total) + '*\n\n_Requisições Digital v' + APP_VERSION + ' — CRV/LAS_';
  if (navigator.clipboard) navigator.clipboard.writeText(texto).then(function() { showSuccess('', 'Copiado!', 'Cole no WhatsApp'); });
}

// ══════════════════════════════════════════════════════════════
//  LEVENSHTEIN + DEDUP LOCAL
// ══════════════════════════════════════════════════════════════
function _levenshtein(a, b) {
  if (!a || !b) return Math.max((a||'').length, (b||'').length);
  var la = a.length, lb = b.length;
  if (!la) return lb; if (!lb) return la;
  var matrix = [];
  for (var i = 0; i <= la; i++) { matrix[i] = [i]; }
  for (var j = 0; j <= lb; j++) { matrix[0][j] = j; }
  for (var i2 = 1; i2 <= la; i2++) {
    for (var j2 = 1; j2 <= lb; j2++) {
      var cost = a.charAt(i2-1) === b.charAt(j2-1) ? 0 : 1;
      matrix[i2][j2] = Math.min(matrix[i2-1][j2]+1, matrix[i2][j2-1]+1, matrix[i2-1][j2-1]+cost);
    }
  }
  return matrix[la][lb];
}

// ══════════════════════════════════════════════════════════════
//  DETECÇÃO OFFLINE / ONLINE + ATALHOS + PULL-TO-REFRESH
// ══════════════════════════════════════════════════════════════
window.addEventListener('online', function() { setBadge(true); toast('Conexão restaurada'); if (sessao) carregarDados(); });
window.addEventListener('offline', function() { setBadge(false); toast('Modo offline'); });

document.addEventListener('keydown', function(e) {
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

(function() {
  var startY = 0, pulling = false;
  document.addEventListener('touchstart', function(e) {
    if (window.scrollY === 0 && !document.querySelector('.modal-full.show')) { startY = e.touches[0].clientY; pulling = true; }
  }, { passive: true });
  document.addEventListener('touchmove', function(e) {
    if (!pulling) return;
    if (e.touches[0].clientY - startY > 100) { pulling = false; if (sessao) { toast('Atualizando...'); carregarDados(); carregarHistorico(); } }
  }, { passive: true });
  document.addEventListener('touchend', function() { pulling = false; }, { passive: true });
})();

function ajustarAlturaViewport() {
  document.documentElement.style.setProperty('--vh', (window.innerHeight * 0.01) + 'px');
}
window.addEventListener('resize', ajustarAlturaViewport);
ajustarAlturaViewport();

// PWA install
var deferredPrompt = null;
window.addEventListener('beforeinstallprompt', function(e) { e.preventDefault(); deferredPrompt = e; });

function limparCacheLocal() {
  window._precoCustoMapaCache = null; window._catalogoCustoItens = null;
  catalogo = []; comandosIA = []; historicoMeses = null; dadosCompletos = null;
  toast('Cache limpo'); if (sessao) carregarDados();
}

function diagnostico() {
  var info = { versao: APP_VERSION, usuario: sessao ? sessao.nome : 'N/A', online: navigator.onLine, cidades: dadosCompletos ? dadosCompletos.cidades.length : 0, catalogoItens: catalogo.length, historicoMeses: historicoMeses ? historicoMeses.length : 0 };
  console.table(info);
  var texto = 'DIAG v' + APP_VERSION + '\n';
  Object.keys(info).forEach(function(k) { texto += k + ': ' + info[k] + '\n'; });
  if (navigator.clipboard) navigator.clipboard.writeText(texto).then(function() { toast('Diagnóstico copiado'); });
  return info;
}

// ══════════════════════════════════════════════════════════════
//  EXPOSIÇÃO GLOBAL
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
window.dispararSalvar = dispararSalvar;
window.abrirCatalogoCusto = abrirCatalogoCusto;
window.fecharCatalogoCusto = fecharCatalogoCusto;
window.filtrarCatalogoCusto = filtrarCatalogoCusto;
window.filtrarCustoSetor = filtrarCustoSetor;
window.sortCatalogoCusto = sortCatalogoCusto;
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
window.limparCacheLocal = limparCacheLocal;
window.diagnostico = diagnostico;


// ══════════════════════════════════════════════════════════════
//  PATCH v8.8.1 — Performance + Data formatada + Design elite
//  Cola no FINAL do app.js (sobrescreve funções anteriores)
// ══════════════════════════════════════════════════════════════

// ── 1. CACHE LOCAL INTELIGENTE ──────────────────────────────
var _cacheLocal = {
  get: function(key) {
    try {
      var raw = sessionStorage.getItem('cv_' + key);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (obj._exp && Date.now() > obj._exp) { sessionStorage.removeItem('cv_' + key); return null; }
      return obj.data;
    } catch(e) { return null; }
  },
  set: function(key, data, ttlMs) {
    try {
      sessionStorage.setItem('cv_' + key, JSON.stringify({ data: data, _exp: Date.now() + (ttlMs || 60000) }));
    } catch(e) {}
  },
  clear: function() {
    try {
      Object.keys(sessionStorage).forEach(function(k) { if (k.indexOf('cv_') === 0) sessionStorage.removeItem(k); });
    } catch(e) {}
  }
};

// ── 2. FORMATADOR DE DATA UNIVERSAL (corrige "Mon Jun 01...") ──
function _formatarDataUniversal(val) {
  if (!val) return '';
  var s = String(val).trim();

  // Já está DD/MM/AAAA
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;

  // ISO: AAAA-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    var p = s.substring(0, 10).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  // Formato longo: "Mon Jun 01 2026 04:00:00 GMT..." ou similar
  try {
    var d = new Date(s);
    if (!isNaN(d.getTime())) {
      return String(d.getDate()).padStart(2, '0') + '/' +
             String(d.getMonth() + 1).padStart(2, '0') + '/' +
             d.getFullYear();
    }
  } catch(e) {}

  // Timestamp numérico
  if (/^\d{10,13}$/.test(s)) {
    var ts = parseInt(s);
    if (ts < 10000000000) ts *= 1000;
    var d2 = new Date(ts);
    if (!isNaN(d2.getTime())) {
      return String(d2.getDate()).padStart(2, '0') + '/' +
             String(d2.getMonth() + 1).padStart(2, '0') + '/' +
             d2.getFullYear();
    }
  }

  return s;
}

// Sobrescrever formatarDataBR com a versão universal
formatarDataBR = _formatarDataUniversal;

// ── 3. CARREGAR DADOS — COM CACHE + LOADING RÁPIDO ──────────
carregarDados = function() {
  // Tenta cache primeiro (mostra instantâneo)
  var cached = _cacheLocal.get('dadosCompletos');
  if (cached && !dadosCompletos) {
    dadosCompletos = cached;
    renderPainel();
  }

  var bar = document.getElementById('ldBarTop');
  bar.style.transition = 'width 1.5s ease';
  bar.style.width = '60%';

  fetch(API_URL + '?userHash=' + sessao.hash + '&dados=todos')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      bar.style.transition = 'width .2s ease';
      bar.style.width = '100%';
      setTimeout(function() {
        bar.style.opacity = '0';
        setTimeout(function() { bar.style.width = '0'; bar.style.opacity = '1'; }, 200);
      }, 150);

      document.getElementById('ldScreen').classList.add('hidden');
      var g = document.getElementById('cidadesGrid');
      if (g) delete g.dataset.skeleton;

      // Formatar todas as datas antes de usar
      if (d && d.cidades) {
        d.cidades.forEach(function(cid) {
          cid.setores.forEach(function(setor) {
            setor.itens.forEach(function(it) {
              it.data = _formatarDataUniversal(it.data);
            });
          });
        });
      }

      dadosCompletos = d;
      _cacheLocal.set('dadosCompletos', d, 120000); // 2 min cache
      renderPainel();

      var hoje = new Date();
      document.getElementById('syncTime').textContent =
        'Sincronizado às ' + String(hoje.getHours()).padStart(2, '0') + ':' +
        String(hoje.getMinutes()).padStart(2, '0');
      setBadge(true);
    })
    .catch(function() {
      bar.style.width = '0';
      document.getElementById('ldScreen').classList.add('hidden');
      // Se falhou mas tem cache, usa cache
      if (!dadosCompletos) {
        var fallback = _cacheLocal.get('dadosCompletos');
        if (fallback) { dadosCompletos = fallback; renderPainel(); }
      }
      toast('Erro de conexão');
      setBadge(false);
    });
};

// ── 4. CARREGAR HISTÓRICO — COM CACHE ──────────────────────
carregarHistorico = function() {
  // Cache instantâneo
  var cached = _cacheLocal.get('historico');
  if (cached && !historicoMeses) {
    historicoMeses = cached;
    renderHistoricoDashboard();
  }

  fetch(API_URL + '?userHash=' + sessao.hash + '&acao=historico')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status === 'ok') {
        historicoMeses = d.meses || [];
        _cacheLocal.set('historico', historicoMeses, 180000); // 3 min
        renderHistoricoDashboard();
      }
    })
    .catch(function() {});
};

// ── 5. MÊS DETALHE — COM CACHE + LOADING ELEGANTE ──────────
abrirMesDetalhe = function(mesNome) {
  document.getElementById('mesDetalheModal').classList.add('show');
  document.body.style.overflow = 'hidden';
  history.pushState({ modal: 'mesDetalhe' }, '', '');
  document.getElementById('mesDetalheTitle').textContent = mesNome;

  // Loading elegante
  document.getElementById('mesDetalheBody').innerHTML =
    '<div style="text-align:center;padding:60px 20px;">' +
    '<div class="ld-spinner" style="margin:0 auto 18px;width:24px;height:24px;"></div>' +
    '<div style="color:var(--text-secondary);font-size:.82rem;font-weight:600;">' + escapeHtml(mesNome) + '</div>' +
    '<div style="color:var(--text-tertiary);font-size:.68rem;margin-top:4px;">Carregando detalhes...</div></div>';

  // Tenta cache
  var cacheKey = 'mes_' + mesNome.replace(/[^a-zA-Z0-9]/g, '_');
  var cached = _cacheLocal.get(cacheKey);
  if (cached) {
    renderMesDetalhe(mesNome, cached);
    return;
  }

  fetch(API_URL + '?userHash=' + sessao.hash + '&acao=historicomes&mes=' + encodeURIComponent(mesNome))
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status === 'ok') {
        // Formatar datas
        if (d.detalhes) {
          d.detalhes.forEach(function(it) { it.data = _formatarDataUniversal(it.data); });
        }
        _cacheLocal.set(cacheKey, d, 300000); // 5 min
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
};

// ── 6. RENDER MES DETALHE — DATAS FORMATADAS + DESIGN ELITE ──
renderMesDetalhe = function(mesNome, dados) {
  var CIDADES_ORDEM = ['Ibicuí', 'Nova Canaã', 'Boa Nova', 'Dário Meira', 'Floresta Azul'];
  var resumo = dados.resumo || {}, detalhes = dados.detalhes || [];

  var h = '';

  // Header elite
  h += '<div class="md-resumo">';
  h += '<div style="font-size:.58rem;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.12em;font-weight:700;margin-bottom:6px;">Total do Período</div>';
  h += '<div class="md-total-geral">' + formatCurrency(resumo.total || 0) + '</div>';
  h += '<div class="md-total-meta">' + (resumo.totalItens || 0) + ' itens registrados</div>';
  h += '</div>';

  // Ranking cidades
  var cidadeArr = [];
  CIDADES_ORDEM.forEach(function(cid) {
    cidadeArr.push({ nome: cid, total: (resumo.cidades && resumo.cidades[cid]) || 0 });
  });
  cidadeArr.sort(function(a, b) { return b.total - a.total; });
  var maxCid = cidadeArr[0] && cidadeArr[0].total > 0 ? cidadeArr[0].total : 1;

  h += '<div class="md-section"><div class="md-section-title">Ranking por Cidade</div>';
  h += '<div class="ranking-card" style="margin-bottom:0;">';
  cidadeArr.forEach(function(c, idx) {
    if (c.total <= 0) return;
    var pct = (c.total / maxCid) * 100;
    h += '<div class="ranking-item"><div class="r-left"><span class="r-pos">' + (idx + 1) +
         '</span><div class="r-info"><span class="r-nome">' + escapeHtml(c.nome) +
         '</span></div></div><div class="r-right"><span class="r-valor">' + formatCurrency(c.total) +
         '</span><div class="r-bar-bg"><div class="r-bar-fill blue" style="width:' + pct + '%"></div></div></div></div>';
  });
  h += '</div></div>';

  // Ranking setores
  if (resumo.setores) {
    var setorArr = [];
    Object.keys(resumo.setores).forEach(function(s) { setorArr.push({ nome: s, total: resumo.setores[s] }); });
    setorArr.sort(function(a, b) { return b.total - a.total; });
    var maxSet = setorArr[0] && setorArr[0].total > 0 ? setorArr[0].total : 1;

    h += '<div class="md-section"><div class="md-section-title">Ranking por Setor</div>';
    h += '<div class="ranking-card" style="margin-bottom:0;">';
    setorArr.forEach(function(s, idx) {
      if (s.total <= 0) return;
      h += '<div class="ranking-item"><div class="r-left"><span class="r-pos">' + (idx + 1) +
           '</span><div class="r-info"><span class="r-nome">' + escapeHtml(s.nome) +
           '</span></div></div><div class="r-right"><span class="r-valor">' + formatCurrency(s.total) +
           '</span><div class="r-bar-bg"><div class="r-bar-fill purple" style="width:' + ((s.total / maxSet) * 100) + '%"></div></div></div></div>';
    });
    h += '</div></div>';
  }

  // Detalhes das requisições
  if (detalhes.length) {
    h += '<div class="md-section"><div class="md-section-title">Requisições do Período</div>';

    var agrupado = {};
    detalhes.forEach(function(it) {
      var cid = it.cidade || 'N/A', set = it.setor || 'N/A', rid = it.reqId || '-';
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

          // Data formatada
          if (grp.data) {
            h += '<div style="padding:4px 14px;font-size:.62rem;color:var(--text-tertiary);border-bottom:1px solid var(--border-subtle);">' +
                 _formatarDataUniversal(grp.data) + '</div>';
          }

          grp.itens.forEach(function(it) {
            h += '<div class="md-item">';
            h += '<span class="md-item-desc">' + escapeHtml(it.descricao || '') +
                 ' <span style="opacity:.4;">(x' + (it.quantidade || 0) + ')</span></span>';
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

  // Ações elite
  h += '<div class="md-actions">';
  h += '<button class="hist-acao-btn" onclick="imprimirMesEspecifico(\'' + escapeHtml(mesNome) + '\')">Imprimir este mês</button>';
  h += '<button class="hist-acao-btn" onclick="whatsappMesEspecifico(\'' + escapeHtml(mesNome) + '\')">Copiar para WhatsApp</button>';
  h += '</div>';

  document.getElementById('mesDetalheBody').innerHTML = h;
};

// ── 7. ABRIR CIDADE — DATAS FORMATADAS ──────────────────────
var _abrirCidadeOriginal = abrirCidade;
abrirCidade = function(nome) {
  // Formatar datas antes de renderizar
  if (dadosCompletos && dadosCompletos.cidades) {
    var cid = dadosCompletos.cidades.find(function(c) { return c.nome === nome; });
    if (cid) {
      cid.setores.forEach(function(setor) {
        setor.itens.forEach(function(it) {
          it.data = _formatarDataUniversal(it.data);
        });
      });
    }
  }
  _abrirCidadeOriginal(nome);
};

// ── 8. HISTÓRICO DASHBOARD — DESIGN ELITE ──────────────────
renderHistoricoDashboard = function() {
  var container = document.getElementById('historicoCards');
  if (!container) return;

  if (!historicoMeses || !historicoMeses.length) {
    container.innerHTML = '<div class="hist-empty"><div class="hist-empty-text">Nenhum mês arquivado ainda.<br>Use "Virada de Mês" no menu para arquivar.</div></div>';
    return;
  }

  var ultimos = historicoMeses.slice(-3).reverse();
  var CIDADES_ORDEM = ['Ibicuí', 'Nova Canaã', 'Boa Nova', 'Dário Meira', 'Floresta Azul'];
  var h = '';

  ultimos.forEach(function(mes, mIdx) {
    h += '<div class="hist-mes-card" onclick="abrirMesDetalhe(\'' + escapeHtml(mes.nome) + '\')" style="animation-delay:' + (mIdx * 0.05) + 's;">';

    h += '<div class="hist-mes-top">';
    h += '<div class="hist-mes-nome">' + escapeHtml(mes.nome) + '</div>';
    h += '<div class="hist-mes-total">' + formatCurrency(mes.total) + '</div>';
    h += '</div>';

    // Chips de cidades
    h += '<div class="hist-mes-cidades">';
    CIDADES_ORDEM.forEach(function(cid) {
      var val = (mes.cidades && mes.cidades[cid]) ? mes.cidades[cid] : 0;
      if (val > 0) {
        h += '<span class="hist-cidade-chip">' + escapeHtml(cid) +
             ' <span class="hcc-valor">' + formatCurrency(val) + '</span></span>';
      }
    });
    h += '</div>';

    // Mini barras
    var maxCid = 1;
    CIDADES_ORDEM.forEach(function(cid) {
      var val = (mes.cidades && mes.cidades[cid]) || 0;
      if (val > maxCid) maxCid = val;
    });
    h += '<div class="hist-bars">';
    CIDADES_ORDEM.forEach(function(cid) {
      var val = (mes.cidades && mes.cidades[cid]) || 0;
      var pct = maxCid > 0 ? Math.max(3, (val / maxCid) * 100) : 3;
      h += '<div class="hist-bar" style="height:' + pct + '%" title="' + escapeHtml(cid) + ': ' + formatCurrency(val) + '"></div>';
    });
    h += '</div>';

    h += '</div>';
  });

  container.innerHTML = h;
};

// ── 9. HISTÓRICO COMPLETO — COM CACHE ───────────────────────
abrirHistoricoCompleto = function() {
  document.body.style.overflow = 'hidden';
  document.getElementById('historicoModal').classList.add('show');
  history.pushState({ modal: 'historico' }, '', '');

  if (!historicoMeses) {
    document.getElementById('historicoBody').innerHTML =
      '<div style="text-align:center;padding:60px 20px;">' +
      '<div class="ld-spinner" style="margin:0 auto 18px;width:24px;height:24px;"></div>' +
      '<div style="color:var(--text-secondary);font-size:.82rem;font-weight:600;">Carregando histórico...</div></div>';
    carregarHistorico();
    setTimeout(renderHistoricoCompleto, 2500);
  } else {
    renderHistoricoCompleto();
  }
};

// ── 10. VIRADA DE MÊS — DATAS FORMATADAS + DESIGN ELITE ────
abrirViradaMes = function() {
  document.body.style.overflow = 'hidden';
  document.getElementById('viradaMesModal').classList.add('show');
  history.pushState({ modal: 'viradaMes' }, '', '');

  var meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var hoje = new Date();
  var mesAtual = meses[hoje.getMonth()] + '/' + hoje.getFullYear();
  var dataHoje = String(hoje.getDate()).padStart(2,'0') + '/' + String(hoje.getMonth()+1).padStart(2,'0') + '/' + hoje.getFullYear();

  var totalGeral = dadosCompletos ? (dadosCompletos.totalGeral || 0) : 0;
  var totalItens = 0;
  if (dadosCompletos && dadosCompletos.cidades) dadosCompletos.cidades.forEach(function(c) { totalItens += c.itens; });

  var h = '';
  h += '<div class="vm-header">';
  h += '<div class="vm-icon">📅</div>';
  h += '<div class="vm-title">Virada de Mês</div>';
  h += '<div class="vm-subtitle">Arquivar o período atual e iniciar novo ciclo</div>';
  h += '</div>';

  h += '<div class="vm-info-box">';
  h += '<div class="vm-info-label">Período a ser arquivado</div>';
  h += '<div class="vm-info-value">' + escapeHtml(mesAtual) + '</div>';
  h += '<div class="vm-info-stats">';
  h += '<span>' + formatCurrency(totalGeral) + '</span>';
  h += '<span>' + totalItens + ' itens</span>';
  h += '<span>' + dataHoje + '</span>';
  h += '</div>';
  h += '</div>';

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
  h += '<strong>Atenção:</strong> Esta ação irá salvar todos os dados do mês atual no histórico e limpar as requisições para o novo período. Esta ação é irreversível.';
  h += '</div>';

  h += '<div class="vm-actions">';
  h += '<button class="vm-btn-cancel" onclick="fecharViradaMes()">Cancelar</button>';
  h += '<button class="vm-btn-confirm" id="vmBtnConfirm" onclick="confirmarViradaMes()">Confirmar Virada</button>';
  h += '</div>';

  document.getElementById('viradaMesBody').innerHTML = h;
};

// ── 11. CONFIRMAR VIRADA — LIMPAR CACHE APÓS ────────────────
confirmarViradaMes = function() {
  if (!confirm('TEM CERTEZA que deseja virar o mês?\n\nTodos os dados serão arquivados e as requisições zeradas.')) return;
  var btn = document.getElementById('vmBtnConfirm');
  btn.disabled = true; btn.textContent = 'Processando...';

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ acao: 'viradames', usuario: sessao.nome, senha: sessao.hash }),
    redirect: 'follow'
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    btn.disabled = false; btn.textContent = 'Confirmar Virada';
    if (d.status === 'ok') {
      showSuccess('', 'Mês virado com sucesso!', d.mesArquivado || '');
      fecharViradaMes();
      // Limpar TODOS os caches
      historicoMeses = null;
      dadosCompletos = null;
      window._precoCustoMapaCache = null;
      _cacheLocal.clear();
      carregarDados();
      carregarHistorico();
    } else { toast(d.msg || 'Erro na virada de mês'); }
  })
  .catch(function() { btn.disabled = false; btn.textContent = 'Confirmar Virada'; toast('Erro de conexão'); });
};

// ── 12. LIMPAR CACHE — ATUALIZADO ───────────────────────────
limparCacheLocal = function() {
  window._precoCustoMapaCache = null;
  window._catalogoCustoItens = null;
  catalogo = [];
  comandosIA = [];
  historicoMeses = null;
  dadosCompletos = null;
  _cacheLocal.clear();
  toast('Cache limpo');
  if (sessao) { carregarDados(); carregarHistorico(); }
};

// ── 13. CATÁLOGO CUSTO — LOADING MAIS RÁPIDO ────────────────
var _abrirCatalogoCustoOriginal = abrirCatalogoCusto;
abrirCatalogoCusto = function() {
  document.body.style.overflow = 'hidden';
  document.getElementById('catalogoCustoModal').classList.add('show');
  history.pushState({ modal: 'catalogoCusto' }, '', '');

  _custoCatSort = 'setor';
  _custoCatSetorFiltro = 'TODOS';
  document.getElementById('catalogoCustoSearch').value = '';
  document.getElementById('custoSetorTabs').innerHTML = '';
  document.querySelectorAll('.custo-filter-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.sort === 'setor');
  });

  // Tenta cache local primeiro
  var cached = _cacheLocal.get('catalogoCusto');
  if (cached && cached.length) {
    window._catalogoCustoItens = cached.map(function(it) {
      if (!it._setor) it._setor = _categorizarItem(it.descricao);
      return it;
    });
    _renderCustoSetorTabs();
    renderCatalogoCusto('');

    // Atualiza em background
    fetch(API_URL + '?userHash=' + sessao.hash + '&acao=catalogocusto')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.status === 'ok') {
          var itens = (d.itens || []).map(function(it) { it._setor = _categorizarItem(it.descricao); return it; });
          window._catalogoCustoItens = itens;
          _cacheLocal.set('catalogoCusto', itens, 180000);
        }
      }).catch(function() {});
    return;
  }

  document.getElementById('catalogoCustoBody').innerHTML =
    '<div style="text-align:center;padding:50px 20px;">' +
    '<div class="ld-spinner" style="margin:0 auto 16px;"></div>' +
    '<div style="color:var(--text-secondary);font-size:.8rem;font-weight:600;">Carregando catálogo...</div></div>';

  fetch(API_URL + '?userHash=' + sessao.hash + '&acao=catalogocusto')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status !== 'ok') { toast(d.msg || 'Erro'); return; }
      var itens = (d.itens || []).map(function(it) { it._setor = _categorizarItem(it.descricao); return it; });
      window._catalogoCustoItens = itens;
      _cacheLocal.set('catalogoCusto', itens, 180000);
      _renderCustoSetorTabs();
      renderCatalogoCusto('');
    })
    .catch(function() { toast('Erro de conexão'); });
};

// ── 14. RE-EXPOR NOVAS FUNÇÕES ──────────────────────────────
window.abrirCidade = abrirCidade;
window.abrirMesDetalhe = abrirMesDetalhe;
window.renderMesDetalhe = renderMesDetalhe;
window.renderHistoricoDashboard = renderHistoricoDashboard;
window.abrirHistoricoCompleto = abrirHistoricoCompleto;
window.abrirViradaMes = abrirViradaMes;
window.confirmarViradaMes = confirmarViradaMes;
window.limparCacheLocal = limparCacheLocal;
window.abrirCatalogoCusto = abrirCatalogoCusto;
window.carregarDados = carregarDados;
window.carregarHistorico = carregarHistorico;

// ══════════════════════════════════════════════════════════════
//  FIM PATCH v8.8.1
// ══════════════════════════════════════════════════════════════
