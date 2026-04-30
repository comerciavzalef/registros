// ============================================================
//  REQUISIÇÕES DIGITAL — app.js v4.1 (Sanitização Apple + Hash)
//  Grupo Carlos Vaz — CRV/LAS
// ============================================================

var API_URL = 'https://script.google.com/macros/s/AKfycbzXuhmVkTDsMGotRuG3-i-YYnx0_nLFWDWjb7hNsTZ2HUg5SzWKDK6jbad_HqOEsnxt/exec';
var SESSION_KEY = 'cv_requisicoes_sessao';

var CREDS_OFFLINE = {
  'ALEF': '893f0b2f56b3e6c0c29a285d8928c03e91129424c5decf1a4b4bb2e6f4a8cb88', // Exemplo de Hash
  'CARLOS VAZ': '893f0b2f56b3e6c0c29a285d8928c03e91129424c5decf1a4b4bb2e6f4a8cb88'
};

var sessao = null;
var dadosCompletos = null;
var autoRefreshTimer = null;

// ══════════════════════════════════════════════════════════════
//  INIT & LOGIN SEGURO (LGPD + HASH)
// ══════════════════════════════════════════════════════════════
(function () {
  var s = localStorage.getItem(SESSION_KEY);
  if (s) { try { sessao = JSON.parse(s); if (sessao && sessao.nome) { esconderLogin(); iniciarApp(); return; } } catch (e) { } }
})();

function toggleSenha() {
  var input = document.getElementById('loginPass');
  var icon = document.getElementById('eyeIcon');
  if (input.type === 'password') { input.type = 'text'; icon.textContent = '🙈'; } else { input.type = 'password'; icon.textContent = '👁️'; }
}

async function fazerLogin() {
  var user = document.getElementById('loginUser').value.trim().toUpperCase();
  var pass = document.getElementById('loginPass').value.trim();
  var err = document.getElementById('loginError');
  var btn = document.getElementById('loginBtn');
  var lgpd = document.getElementById('lgpdCheck');
  
  err.textContent = '';
  if (!user || !pass) { err.textContent = 'Preencha todos os campos'; shakeLogin(); return; }
  if (lgpd && !lgpd.checked) { err.textContent = 'Aceite os termos da LGPD para entrar'; shakeLogin(); return; }
  
  btn.disabled = true; btn.textContent = 'Autenticando...';

  try {
    var senhaHash = await gerarHash(pass);

    fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ acao: 'login', usuario: user, senha: senhaHash }), redirect: 'follow' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.status === 'ok') { 
          sessao = { nome: d.nome, nivel: d.nivel, senha: pass }; 
          localStorage.setItem(SESSION_KEY, JSON.stringify(sessao)); 
          esconderLogin(); iniciarApp(); 
        } else { 
          err.textContent = d.msg || 'Credenciais inválidas'; shakeLogin(); 
        }
      }).catch(function () {
        if (CREDS_OFFLINE[user] && CREDS_OFFLINE[user] === senhaHash) { 
          sessao = { nome: user, nivel: 'gestor', senha: pass }; 
          localStorage.setItem(SESSION_KEY, JSON.stringify(sessao)); 
          esconderLogin(); iniciarApp(); 
        } else { 
          err.textContent = 'Sem conexão e credenciais inválidas'; shakeLogin(); 
        }
      }).finally(function () { btn.disabled = false; btn.textContent = 'Entrar'; });
  } catch(e) {
    err.textContent = 'Erro de segurança'; shakeLogin();
    btn.disabled = false; btn.textContent = 'Entrar';
  }
}

async function gerarHash(texto) {
  const msgBuffer = new TextEncoder().encode(texto);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function shakeLogin() { var c = document.querySelector('.login-card'); c.classList.add('shake'); setTimeout(function () { c.classList.remove('shake'); }, 500); }
function esconderLogin() { document.getElementById('loginScreen').classList.add('hidden'); }

function logout() {
  sessao = null; dadosCompletos = null; localStorage.removeItem(SESSION_KEY);
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  document.getElementById('mainApp').style.display = 'none'; 
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('loginUser').value = ''; document.getElementById('loginPass').value = ''; 
  document.getElementById('loginPass').type = 'password'; document.getElementById('eyeIcon').textContent = '👁️'; 
  document.getElementById('loginError').textContent = '';
  var lgpd = document.getElementById('lgpdCheck'); if(lgpd) lgpd.checked = false;
}

document.addEventListener('DOMContentLoaded', function() {
  var passField = document.getElementById('loginPass');
  if(passField) passField.addEventListener('keydown', function(e){ if(e.key === 'Enter') fazerLogin(); });
});

// ══════════════════════════════════════════════════════════════
//  CARREGAR E SANITIZAR DADOS (MAGIA AQUI)
// ══════════════════════════════════════════════════════════════
function iniciarApp() {
  document.getElementById('ldScreen').classList.remove('hidden');
  document.getElementById('mainApp').style.display = 'block';
  document.getElementById('userBadge').textContent = sessao.nome;
  carregarDados();
  autoRefreshTimer = setInterval(carregarDados, 300000);
}

function carregarDados() {
  fetch(API_URL + '?senha=GP.Carlos2026&dados=todos')
    .then(function(r) { return r.json(); })
    .then(function(d) {
       document.getElementById('ldScreen').classList.add('hidden');
       dadosCompletos = limparLixoDaPlanilha(d); // Aplica o filtro antibagunça
       renderPainel();
       var hoje = new Date();
       document.getElementById('syncTime').textContent = 'Sincronizado às ' + String(hoje.getHours()).padStart(2,'0') + ':' + String(hoje.getMinutes()).padStart(2,'0');
       setBadge(true);
    })
    .catch(function(e) {
       document.getElementById('ldScreen').classList.add('hidden');
       toast('Aviso: Operando offline ou com erro de conexão');
       setBadge(false);
    });
}

function setBadge(on) { 
  var b = document.getElementById('badgeStatus'); 
  b.textContent = on ? 'Online' : 'Offline'; 
  b.className = 'badge ' + (on ? 'badge-online' : 'badge-offline'); 
}

// ── MOTOR DE LIMPEZA DA PLANILHA ─────────────────────────────
function limparLixoDaPlanilha(d) {
  if (!d || !d.cidades) return d;
  var totalGeralReal = 0;

  d.cidades.forEach(function(cid) {
      var mapaSetores = {};
      var itensValidosCid = 0;
      var totalCid = 0;

      cid.setores.forEach(function(setor) {
          var nomeCru = (setor.nome || '').toUpperCase().trim();

          // Ignorar cabeçalhos visuais
          if (nomeCru === 'Nº' || nomeCru.indexOf('TOTAL') > -1 || nomeCru === 'ITEM') return;

          // Unificar pastas (Limpa o "SETOR:" da frente)
          var nomeLimpo = nomeCru.replace('SETOR:', '').trim();
          if (nomeLimpo === '') nomeLimpo = 'OUTROS';

          if (!mapaSetores[nomeLimpo]) {
              mapaSetores[nomeLimpo] = { nome: nomeLimpo, itens: [], total: 0 };
          }

          setor.itens.forEach(function(item) {
              var desc = (item.descricao || '').toUpperCase().trim();
              var reqId = (item.requisicao || '').toUpperCase().trim();

              // Deteta lixo visual disfarçado de item e destrói
              if (desc.indexOf('TOTAL DO SETOR') > -1 || desc.indexOf('ID REQUISIÇÃO') > -1 || reqId.indexOf('ID REQUISIÇÃO') > -1 || (item.quantidade === 0 && item.total === 0)) return;

              mapaSetores[nomeLimpo].itens.push(item);
              mapaSetores[nomeLimpo].total += (item.total || 0);
              totalCid += (item.total || 0);
              itensValidosCid++;
          });
      });

      var setoresFinais = [];
      Object.keys(mapaSetores).sort().forEach(function(k) {
          if (mapaSetores[k].itens.length > 0) setoresFinais.push(mapaSetores[k]);
      });

      cid.setores = setoresFinais;
      cid.total = totalCid;
      cid.itens = itensValidosCid;
      totalGeralReal += totalCid;
  });

  d.totalGeral = totalGeralReal;
  return d;
}

// ══════════════════════════════════════════════════════════════
//  DASHBOARD & RANKINGS
// ══════════════════════════════════════════════════════════════
function renderPainel() {
  if(!dadosCompletos || !dadosCompletos.cidades) return;
  var grid = document.getElementById('cidadesGrid');
  var htmlCards = '';
  var arrayCidades = [];
  var mapSetores = {};

  dadosCompletos.cidades.forEach(function(cid) {
     arrayCidades.push({ nome: cid.nome, total: cid.total, itens: cid.itens });

     htmlCards += '<div class="cidade-card" onclick="abrirCidade(\'' + escapeHtml(cid.nome) + '\')">';
     htmlCards += '<div class="cidade-icon">🏙️</div>';
     htmlCards += '<div class="cidade-info"><div class="cidade-nome">' + escapeHtml(cid.nome) + '</div><div class="cidade-meta">' + cid.setores.length + ' setores · ' + cid.itens + ' itens</div></div>';
     htmlCards += '<div class="cidade-valor">' + formatCurrency(cid.total) + '</div>';
     htmlCards += '</div>';

     cid.setores.forEach(function(setor) {
         if (!mapSetores[setor.nome]) mapSetores[setor.nome] = { nome: setor.nome, total: 0, itens: 0 };
         mapSetores[setor.nome].total += setor.total;
         mapSetores[setor.nome].itens += setor.itens.length;
     });
  });

  grid.innerHTML = htmlCards;
  document.getElementById('statTotal').textContent = formatCurrency(dadosCompletos.totalGeral);
  renderRankings(arrayCidades, mapSetores);
}

function renderRankings(arrayCidades, mapSetores) {
  arrayCidades.sort(function(a, b) { return b.total - a.total; });
  var arraySetores = Object.values(mapSetores).sort(function(a, b) { return b.total - a.total; });
  var maxCidade = arrayCidades.length > 0 && arrayCidades[0].total > 0 ? arrayCidades[0].total : 1;
  var maxSetor = arraySetores.length > 0 && arraySetores[0].total > 0 ? arraySetores[0].total : 1;

  var divCidades = document.getElementById('rankingCidades');
  var htmlCid = '';
  arrayCidades.forEach(function(cid, index) {
      if(cid.total === 0) return;
      var pct = (cid.total / maxCidade) * 100;
      htmlCid += '<div class="ranking-item"><div class="r-left"><span class="r-pos">' + (index + 1) + '</span><div class="r-info"><span class="r-nome">' + escapeHtml(cid.nome) + '</span><span class="r-meta">' + cid.itens + ' itens</span></div></div><div class="r-right"><span class="r-valor">' + formatCurrency(cid.total) + '</span><div class="r-bar-bg"><div class="r-bar-fill blue" style="width: ' + pct + '%"></div></div></div></div>';
  });
  if(htmlCid === '') htmlCid = '<div class="empty-state"><div class="empty-text">Sem dados faturados</div></div>';
  divCidades.innerHTML = htmlCid;

  var divSetores = document.getElementById('rankingSetores');
  var htmlSet = '';
  arraySetores.forEach(function(setor, index) {
      if(setor.total === 0) return;
      var pct = (setor.total / maxSetor) * 100;
      htmlSet += '<div class="ranking-item"><div class="r-left"><span class="r-pos">' + (index + 1) + '</span><div class="r-info"><span class="r-nome">' + escapeHtml(setor.nome) + '</span><span class="r-meta">' + setor.itens + ' itens</span></div></div><div class="r-right"><span class="r-valor">' + formatCurrency(setor.total) + '</span><div class="r-bar-bg"><div class="r-bar-fill purple" style="width: ' + pct + '%"></div></div></div></div>';
  });
  if(htmlSet === '') htmlSet = '<div class="empty-state"><div class="empty-text">Sem dados faturados</div></div>';
  divSetores.innerHTML = htmlSet;
}

// ══════════════════════════════════════════════════════════════
//  MODAL: DETALHE DA CIDADE (Visual Limpo)
// ══════════════════════════════════════════════════════════════
function abrirCidade(nome) {
  var cid = dadosCompletos.cidades.find(function(c) { return c.nome === nome; });
  if(!cid) return;

  document.getElementById('cidadeModalTitle').textContent = '🏙️ ' + cid.nome;
  var h = '<div class="cidade-header"><div class="ch-total">' + formatCurrency(cid.total) + '</div><div style="color:var(--text-tertiary); font-size:0.8rem; margin-top:5px;">' + cid.itens + ' itens faturados</div></div>';

  if (cid.setores.length === 0) {
      h += '<div class="empty-state"><div class="empty-icon">📁</div><div class="empty-text">Nenhuma requisição válida.</div></div>';
  } else {
      cid.setores.forEach(function(setor) {
          h += '<div class="setor-block">';
          h += '<div class="setor-header"><div class="sh-left"><div class="sh-badge ' + getSetorClass(setor.nome) + '">📂</div><div class="sh-nome">' + escapeHtml(setor.nome) + '</div></div><div class="sh-total">' + formatCurrency(setor.total) + '</div></div>';
          h += '<div class="setor-items">';
          setor.itens.forEach(function(item) {
              var statusTag = item.status && item.status !== '' ? '<div class="item-status ' + item.status.toLowerCase() + '">' + item.status + '</div>' : '';
              h += '<div class="item-row">';
              h += '<div class="item-id">' + escapeHtml(item.requisicao || '-') + '</div>';
              h += '<div class="item-desc">' + escapeHtml(item.descricao) + ' <span style="color:var(--text-tertiary); font-size:0.7rem;">(x' + item.quantidade + ')</span></div>';
              h += '<div class="item-valor">' + formatCurrency(item.total) + '</div>';
              h += statusTag;
              h += '</div>';
          });
          h += '</div></div>';
      });
  }

  document.getElementById('cidadeBody').innerHTML = h;
  document.getElementById('cidadeModal').classList.add('show');
}

function fecharCidade() {
  document.getElementById('cidadeModal').classList.remove('show');
}

// ══════════════════════════════════════════════════════════════
//  RESUMO PARA WHATSAPP
// ══════════════════════════════════════════════════════════════
function toggleRelatorio() {
  var btn = document.getElementById('switchRelatorio');
  if(btn) { btn.classList.add('on'); setTimeout(function(){ btn.classList.remove('on'); }, 1000); }

  if(!dadosCompletos) { toast('Carregue os dados primeiro'); return; }

  var texto = '📋 *ORÇAMENTO DE REQUISIÇÕES*\n';
  var d = new Date();
  texto += '📅 ' + String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear() + '\n';
  texto += '━━━━━━━━━━━━━━━━━━━━\n\n';

  var total = 0;
  var cidadesOrdenadas = [...dadosCompletos.cidades].sort(function(a, b) { return b.total - a.total; });

  cidadesOrdenadas.forEach(function(cid) {
      if(cid.itens > 0) {
          texto += '🏙️ *' + cid.nome.toUpperCase() + '*\n';
          texto += '   💰 ' + formatCurrency(cid.total) + ' (' + cid.itens + ' itens)\n\n';
          total += cid.total;
      }
  });

  texto += '━━━━━━━━━━━━━━━━━━━━\n';
  texto += '📊 *TOTAL GERAL: ' + formatCurrency(total) + '*\n\n';
  texto += '_Requisições Digital — CRV/LAS_';

  if(navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function() {
          showSuccess('✅', 'Resumo Copiado!', 'O texto formatado foi copiado para a sua área de transferência.');
      }).catch(function() { toast('Erro ao copiar.'); });
  } else { toast('Copie o resumo manualmente.'); }
}

// ══════════════════════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════════════════════
function getSetorClass(nome) {
  var n = nome.toUpperCase();
  if(n.indexOf('EDUCAÇÃO') > -1) return 'edu';
  if(n.indexOf('SAÚDE') > -1) return 'sau';
  if(n.indexOf('ASSISTÊNCIA') > -1) return 'ass';
  if(n.indexOf('ADMINISTRAÇÃO') > -1) return 'adm';
  if(n.indexOf('INFRAESTRUTURA') > -1) return 'inf';
  return 'adm';
}

function formatCurrency(val) {
  if (typeof val !== 'number' || isNaN(val)) val = 0;
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showSuccess(icon, msg, detail) {
  document.getElementById('successIcon').textContent = icon; document.getElementById('successMsg').textContent = msg; document.getElementById('successDetail').textContent = detail || ''; var ov = document.getElementById('successOverlay'); ov.classList.add('show'); setTimeout(function () { ov.classList.remove('show'); }, 3000);
}

function toast(msg) {
  var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(function () { t.classList.remove('show'); }, 3500);
}
