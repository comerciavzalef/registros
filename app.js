// ============================================================
//  REQUISIÇÕES DIGITAL — app.js v3.0 (Sincronizado)
//  Grupo Carlos Vaz — CRV/LAS
// ============================================================

var API_URL = 'https://script.google.com/macros/s/AKfycbzXuhmVkTDsMGotRuG3-i-YYnx0_nLFWDWjb7hNsTZ2HUg5SzWKDK6jbad_HqOEsnxt/exec';
var SESSION_KEY = 'cv_requisicoes_sessao';

var CREDS_OFFLINE = {
  'ALEF': 'GP.Carlos2026',
  'CARLOS VAZ': 'GP.Carlos2026'
};

var sessao = null;
var dadosCompletos = null;
var filtroStatusAtual = 'TODOS';
var autoRefreshTimer = null;

// ══════════════════════════════════════════════════════════════
//  INIT & LOGIN
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

function fazerLogin() {
  var user = document.getElementById('loginUser').value.trim().toUpperCase();
  var pass = document.getElementById('loginPass').value.trim();
  var err = document.getElementById('loginError');
  var btn = document.getElementById('loginBtn');
  
  err.textContent = '';
  if (!user || !pass) { err.textContent = 'Preencha todos os campos'; shakeLogin(); return; }
  
  btn.disabled = true; btn.textContent = 'Verificando...';

  fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ acao: 'login', usuario: user, senha: pass }), redirect: 'follow' })
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
      if (CREDS_OFFLINE[user] && CREDS_OFFLINE[user] === pass) { 
        sessao = { nome: user, nivel: 'gestor', senha: pass }; 
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessao)); 
        esconderLogin(); iniciarApp(); 
      } else { 
        err.textContent = 'Sem conexão e credenciais inválidas'; shakeLogin(); 
      }
    }).finally(function () { btn.disabled = false; btn.textContent = 'Entrar'; });
}

function shakeLogin() { var c = document.querySelector('.login-card'); c.classList.add('shake'); setTimeout(function () { c.classList.remove('shake'); }, 500); }
function esconderLogin() { document.getElementById('loginScreen').classList.add('hidden'); }

function logout() {
  sessao = null; dadosCompletos = null; localStorage.removeItem(SESSION_KEY);
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  document.getElementById('mainApp').style.display = 'none'; 
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('loginUser').value = ''; 
  document.getElementById('loginPass').value = ''; 
  document.getElementById('loginPass').type = 'password';
  document.getElementById('eyeIcon').textContent = '👁️'; 
  document.getElementById('loginError').textContent = '';
}

// Escuta a tecla Enter no input de senha
document.addEventListener('DOMContentLoaded', function() {
  var passField = document.getElementById('loginPass');
  if(passField) passField.addEventListener('keydown', function(e){ if(e.key === 'Enter') fazerLogin(); });
});

// ══════════════════════════════════════════════════════════════
//  CARREGAR DADOS & RENDERIZAÇÃO
// ══════════════════════════════════════════════════════════════
function iniciarApp() {
  document.getElementById('ldScreen').classList.remove('hidden');
  document.getElementById('mainApp').style.display = 'block';
  document.getElementById('userBadge').textContent = sessao.nome;
  carregarDados();
  autoRefreshTimer = setInterval(carregarDados, 300000); // Atualiza a cada 5 min
}

function carregarDados() {
  fetch(API_URL + '?senha=GP.Carlos2026&dados=todos')
    .then(function(r) { return r.json(); })
    .then(function(d) {
       document.getElementById('ldScreen').classList.add('hidden');
       dadosCompletos = d;
       renderPainel();
       var hoje = new Date();
       document.getElementById('syncTime').textContent = 'Atualizado às ' + String(hoje.getHours()).padStart(2,'0') + ':' + String(hoje.getMinutes()).padStart(2,'0');
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

function renderPainel() {
  if(!dadosCompletos || !dadosCompletos.cidades) return;
  var grid = document.getElementById('cidadesGrid');
  var html = '';
  var totalGeral = 0;

  // Monta os Cards das Cidades
  dadosCompletos.cidades.forEach(function(cid) {
     totalGeral += cid.total;
     html += '<div class="cidade-card" onclick="abrirCidade(\'' + escapeHtml(cid.nome) + '\')">';
     html += '<div class="cidade-icon">🏙️</div>';
     html += '<div class="cidade-info">';
     html += '<div class="cidade-nome">' + escapeHtml(cid.nome) + '</div>';
     html += '<div class="cidade-meta">' + cid.setores.length + ' setores · ' + cid.itens + ' itens</div>';
     html += '</div>';
     html += '<div class="cidade-valor">' + formatCurrency(cid.total) + '</div>';
     html += '</div>';
  });

  grid.innerHTML = html;
  document.getElementById('statTotal').textContent = formatCurrency(totalGeral);

  // Renderiza a lista corrida de requisições debaixo dos cards
  renderListaGeral();
}

function renderListaGeral() {
  if(!dadosCompletos || !dadosCompletos.cidades) return;
  var list = document.getElementById('cidadesList');
  var search = document.getElementById('searchInput').value.toLowerCase();
  var html = '';

  dadosCompletos.cidades.forEach(function(cid) {
      var setoresFiltrados = [];
      cid.setores.forEach(function(setor) {
          var itensFiltrados = setor.itens.filter(function(item) {
              var matchBusca = (item.descricao.toLowerCase().indexOf(search) > -1 || item.requisicao.toLowerCase().indexOf(search) > -1 || cid.nome.toLowerCase().indexOf(search) > -1);
              var matchStatus = (filtroStatusAtual === 'TODOS' || item.status === filtroStatusAtual);
              return matchBusca && matchStatus;
          });
          if(itensFiltrados.length > 0) {
              setoresFiltrados.push({nome: setor.nome, itens: itensFiltrados, total: setor.total});
          }
      });

      if(setoresFiltrados.length > 0) {
          html += '<div class="section-label" style="margin-top:20px; color:var(--blue);">' + escapeHtml(cid.nome) + '</div>';
          
          setoresFiltrados.forEach(function(setor) {
              html += '<div class="setor-block">';
              html += '<div class="setor-header"><div class="sh-left"><div class="sh-badge ' + getSetorClass(setor.nome) + '">📂</div><div class="sh-nome">' + escapeHtml(setor.nome) + '</div></div></div>';
              html += '<div class="setor-items">';
              
              setor.itens.forEach(function(item) {
                  html += '<div class="item-row">';
                  html += '<div class="item-id">' + escapeHtml(item.requisicao) + '</div>';
                  html += '<div class="item-desc">' + escapeHtml(item.descricao) + ' <span style="color:var(--text-tertiary); font-size:0.7rem;">(x' + item.quantidade + ')</span></div>';
                  html += '<div class="item-valor">' + formatCurrency(item.total) + '</div>';
                  html += '<div class="item-status ' + item.status.toLowerCase() + '">' + item.status + '</div>';
                  html += '</div>';
              });
              html += '</div></div>';
          });
      }
  });

  if(html === '') html = '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">Nenhuma requisição encontrada</div></div>';
  list.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════
//  FILTROS & INTERAÇÕES
// ══════════════════════════════════════════════════════════════
function filtrarGeral() { renderListaGeral(); }

function filtrarStatus(btn, status) {
  document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  filtroStatusAtual = status;
  renderListaGeral();
}

function abrirCidade(nome) {
  var cid = dadosCompletos.cidades.find(function(c) { return c.nome === nome; });
  if(!cid) return;

  document.getElementById('cidadeModalTitle').textContent = '🏙️ ' + cid.nome;

  var h = '<div class="cidade-header"><div class="ch-total">' + formatCurrency(cid.total) + '</div><div style="color:var(--text-tertiary); font-size:0.8rem; margin-top:5px;">' + cid.itens + ' itens cadastrados no total</div></div>';

  cid.setores.forEach(function(setor) {
      h += '<div class="setor-block">';
      h += '<div class="setor-header"><div class="sh-left"><div class="sh-badge ' + getSetorClass(setor.nome) + '">📂</div><div class="sh-nome">' + escapeHtml(setor.nome) + '</div></div><div class="sh-total">' + formatCurrency(setor.total) + '</div></div>';
      h += '<div class="setor-items">';
      setor.itens.forEach(function(item) {
          h += '<div class="item-row">';
          h += '<div class="item-id">' + escapeHtml(item.requisicao) + '</div>';
          h += '<div class="item-desc">' + escapeHtml(item.descricao) + ' <span style="color:var(--text-tertiary); font-size:0.7rem;">(x' + item.quantidade + ')</span></div>';
          h += '<div class="item-valor">' + formatCurrency(item.total) + '</div>';
          h += '<div class="item-status ' + item.status.toLowerCase() + '">' + item.status + '</div>';
          h += '</div>';
      });
      h += '</div></div>';
  });

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
  btn.classList.add('on');
  setTimeout(function(){ btn.classList.remove('on'); }, 1000);

  if(!dadosCompletos) { toast('Carregue os dados primeiro'); return; }

  var texto = '📋 *RESUMO DE REQUISIÇÕES*\n';
  var d = new Date();
  texto += '📅 ' + String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear() + '\n';
  texto += '━━━━━━━━━━━━━━━━━━━━\n\n';

  var total = 0;
  dadosCompletos.cidades.forEach(function(cid) {
      if(cid.itens > 0) {
          texto += '🏙️ *' + cid.nome.toUpperCase() + '*\n';
          texto += '   📦 ' + cid.itens + ' itens\n';
          texto += '   💰 ' + formatCurrency(cid.total) + '\n\n';
          total += cid.total;
      }
  });

  texto += '━━━━━━━━━━━━━━━━━━━━\n';
  texto += '💰 *TOTAL GERAL: ' + formatCurrency(total) + '*\n\n';
  texto += '_Gerado por Requisições Digital_';

  if(navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function() {
          showSuccess('✅', 'Resumo Copiado!', 'O texto formatado para o WhatsApp foi copiado para a sua área de transferência.');
      }).catch(function() { toast('Erro ao copiar. Use o PC.'); });
  } else {
      toast('Copie o resumo manualmente.');
  }
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
  return 'adm'; // default
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
  document.getElementById('successIcon').textContent = icon;
  document.getElementById('successMsg').textContent = msg;
  document.getElementById('successDetail').textContent = detail || '';
  var ov = document.getElementById('successOverlay');
  ov.classList.add('show');
  setTimeout(function () { ov.classList.remove('show'); }, 3000);
}

function toast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function () { t.classList.remove('show'); }, 3500);
}
