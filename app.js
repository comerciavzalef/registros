/* ============================================================
   REQUISIÇÕES DIGITAL — APP.JS v2.1
   Apple-Inspired Design · Grupo Carlos Vaz
   ============================================================ */

// ── API ──────────────────────────────────────────────────────
var API_URL = 'https://script.google.com/macros/s/AKfycbzXuhmVkTDsMGotRuG3-i-YYnx0_nLFWDWjb7hNsTZ2HUg5SzWKDK6jbad_HqOEsnxt/exec';

// ── STATE ────────────────────────────────────────────────────
var currentUser = null;
var currentNivel = null;
var dadosCompletos = null;
var cidadeSelecionada = null;
var setorSelecionado = null;
var autoRefreshTimer = null;
var lastSync = null;

// ── CIDADES & SETORES (mirror Código.gs) ─────────────────────
var CIDADES = ['Ibicuí', 'Nova Canaã', 'Boa Nova', 'Dário Meira', 'Floresta Azul'];
var SETORES = ['EDUCAÇÃO', 'SAÚDE', 'ASSISTÊNCIA SOCIAL', 'ADMINISTRAÇÃO', 'INFRAESTRUTURA'];

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
    initApp();
});

function initApp() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(function () { });
    }

    var saved = localStorage.getItem('requisicoes_session');
    if (saved) {
        try {
            var s = JSON.parse(saved);
            if (s && s.user && s.nivel) {
                currentUser = s.user;
                currentNivel = s.nivel;
                showApp();
                return;
            }
        } catch (e) { }
    }

    showLogin();
}

// ── LOGIN ────────────────────────────────────────────────────
function showLogin() {
    document.getElementById('loginScreen').classList.add('active');
    document.getElementById('appScreen').classList.remove('active');
    document.getElementById('loadingOverlay').classList.remove('active');
}

function showApp() {
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('appScreen').classList.add('active');

    var el = document.getElementById('userName');
    if (el) el.textContent = currentUser;

    var badge = document.getElementById('userBadge');
    if (badge) {
        badge.textContent = currentNivel === 'gestor' ? 'Gestor' : 'Colaborador';
        badge.className = 'user-badge ' + (currentNivel === 'gestor' ? 'gestor' : 'colab');
    }

    updateSyncTime();
    carregarDados();

    clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(function () {
        carregarDados();
    }, 300000);
}

function toggleSenha() {
    var inp = document.getElementById('loginPass');
    var icon = document.getElementById('eyeIcon');
    if (!inp) return;
    if (inp.type === 'password') {
        inp.type = 'text';
        if (icon) icon.textContent = '🙈';
    } else {
        inp.type = 'password';
        if (icon) icon.textContent = '👁️';
    }
}

function fazerLogin() {
    var usuario = (document.getElementById('loginUser').value || '').trim().toUpperCase();
    var senha = (document.getElementById('loginPass').value || '').trim();

    if (!usuario || !senha) {
        mostrarToast('Preencha usuário e senha', 'error');
        return;
    }

    var btn = document.getElementById('loginBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
    }

    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'acao=login&usuario=' + encodeURIComponent(usuario) + '&senha=' + encodeURIComponent(senha)
    })
        .then(function (r) { return r.json(); })
        .then(function (d) {
            if (d.status === 'ok') {
                currentUser = d.nome || usuario;
                currentNivel = d.nivel || 'colaborador';

                localStorage.setItem('requisicoes_session', JSON.stringify({
                    user: currentUser,
                    nivel: currentNivel
                }));

                mostrarToast('Bem-vindo, ' + currentUser, 'success');
                showApp();
            } else {
                mostrarToast(d.msg || d.mensagem || 'Credenciais inválidas', 'error');
            }
        })
        .catch(function () {
            mostrarToast('Erro de conexão', 'error');
        })
        .finally(function () {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'Entrar';
            }
        });
}

function logout() {
    currentUser = null;
    currentNivel = null;
    dadosCompletos = null;
    cidadeSelecionada = null;
    setorSelecionado = null;
    lastSync = null;

    clearInterval(autoRefreshTimer);
    localStorage.removeItem('requisicoes_session');

    var u = document.getElementById('loginUser');
    var s = document.getElementById('loginPass');
    if (u) u.value = '';
    if (s) { s.value = ''; s.type = 'password'; }

    showLogin();
}

// ── CARREGAR DADOS ───────────────────────────────────────────
function carregarDados() {
    var loading = document.getElementById('loadingOverlay');
    if (loading) loading.classList.add('active');

    var url = API_URL + '?senha=GP.Carlos2026&dados=todos';

    fetch(url)
        .then(function (r) { return r.json(); })
        .then(function (d) {
            dadosCompletos = d;
            lastSync = new Date();
            updateSyncTime();
            renderDashboard();
        })
        .catch(function (err) {
            console.error('Erro ao carregar dados:', err);
            mostrarToast('Erro ao carregar dados', 'error');
        })
        .finally(function () {
            if (loading) loading.classList.remove('active');
        });
}

function updateSyncTime() {
    var el = document.getElementById('syncTime');
    if (!el) return;
    if (!lastSync) {
        el.textContent = 'Carregando...';
        return;
    }
    var h = String(lastSync.getHours()).padStart(2, '0');
    var m = String(lastSync.getMinutes()).padStart(2, '0');
    el.textContent = 'Atualizado às ' + h + ':' + m;
}

// ── RENDER DASHBOARD ─────────────────────────────────────────
function renderDashboard() {
    if (!dadosCompletos) return;

    cidadeSelecionada = null;
    setorSelecionado = null;

    var cidadesView = document.getElementById('cidadesView');
    var detalheView = document.getElementById('detalheView');
    if (cidadesView) cidadesView.style.display = '';
    if (detalheView) detalheView.style.display = 'none';

    renderStats();
    renderCidadeCards();
}

function renderStats() {
    if (!dadosCompletos || !dadosCompletos.dados) return;

    var totalGeral = 0;
    var totalItens = 0;
    var totalSetores = 0;
    var cidadesComDados = 0;
    var setoresUnicos = {};

    dadosCompletos.dados.forEach(function (cidade) {
        if (cidade.total > 0) cidadesComDados++;
        totalGeral += cidade.total || 0;

        if (cidade.setores) {
            cidade.setores.forEach(function (setor) {
                setoresUnicos[setor.nome] = true;
                if (setor.itens) {
                    totalItens += setor.itens.length;
                }
            });
        }
    });

    totalSetores = Object.keys(setoresUnicos).length;

    var elTotal = document.getElementById('statTotal');
    var elCidades = document.getElementById('statCidades');
    var elSetores = document.getElementById('statSetores');
    var elItens = document.getElementById('statItens');

    if (elTotal) elTotal.textContent = formatCurrency(totalGeral);
    if (elCidades) elCidades.textContent = cidadesComDados + '/' + CIDADES.length;
    if (elSetores) elSetores.textContent = totalSetores;
    if (elItens) elItens.textContent = totalItens;
}

function renderCidadeCards() {
    var container = document.getElementById('cidadeCards');
    if (!container || !dadosCompletos || !dadosCompletos.dados) return;

    container.innerHTML = '';

    dadosCompletos.dados.forEach(function (cidade) {
        var card = document.createElement('div');
        card.className = 'cidade-card';
        card.onclick = function () { abrirCidade(cidade.cidade); };

        var numSetores = cidade.setores ? cidade.setores.length : 0;
        var numItens = 0;
        if (cidade.setores) {
            cidade.setores.forEach(function (s) {
                if (s.itens) numItens += s.itens.length;
            });
        }

        card.innerHTML =
            '<div class="cidade-card-header">' +
            '<div class="cidade-card-icon"><i class="fas fa-city"></i></div>' +
            '<div class="cidade-card-info">' +
            '<h3 class="cidade-card-name">' + escapeHtml(cidade.cidade) + '</h3>' +
            '<span class="cidade-card-meta">' + numSetores + ' setores · ' + numItens + ' itens</span>' +
            '</div>' +
            '<div class="cidade-card-arrow"><i class="fas fa-chevron-right"></i></div>' +
            '</div>' +
            '<div class="cidade-card-footer">' +
            '<span class="cidade-card-total">' + formatCurrency(cidade.total || 0) + '</span>' +
            '</div>';

        container.appendChild(card);
    });
}

// ── DETALHE CIDADE ───────────────────────────────────────────
function abrirCidade(nomeCidade) {
    if (!dadosCompletos || !dadosCompletos.dados) return;

    cidadeSelecionada = null;
    dadosCompletos.dados.forEach(function (c) {
        if (c.cidade === nomeCidade) cidadeSelecionada = c;
    });

    if (!cidadeSelecionada) {
        mostrarToast('Cidade não encontrada', 'error');
        return;
    }

    setorSelecionado = null;

    var cidadesView = document.getElementById('cidadesView');
    var detalheView = document.getElementById('detalheView');
    if (cidadesView) cidadesView.style.display = 'none';
    if (detalheView) detalheView.style.display = '';

    var titleEl = document.getElementById('detalheCidadeNome');
    var totalEl = document.getElementById('detalheCidadeTotal');
    if (titleEl) titleEl.textContent = cidadeSelecionada.cidade;
    if (totalEl) totalEl.textContent = formatCurrency(cidadeSelecionada.total || 0);

    renderSetorFilter();
    renderSetores();
}

function voltarCidades() {
    cidadeSelecionada = null;
    setorSelecionado = null;

    var cidadesView = document.getElementById('cidadesView');
    var detalheView = document.getElementById('detalheView');
    if (cidadesView) cidadesView.style.display = '';
    if (detalheView) detalheView.style.display = 'none';
}

// ── SETOR FILTER ─────────────────────────────────────────────
function renderSetorFilter() {
    var container = document.getElementById('setorFilter');
    if (!container || !cidadeSelecionada) return;

    container.innerHTML = '';

    var allPill = document.createElement('button');
    allPill.className = 'setor-pill' + (!setorSelecionado ? ' active' : '');
    allPill.textContent = 'Todos';
    allPill.onclick = function () {
        setorSelecionado = null;
        renderSetorFilter();
        renderSetores();
    };
    container.appendChild(allPill);

    if (cidadeSelecionada.setores) {
        cidadeSelecionada.setores.forEach(function (setor) {
            var pill = document.createElement('button');
            pill.className = 'setor-pill' + (setorSelecionado === setor.nome ? ' active' : '');
            pill.textContent = setor.nome;
            pill.onclick = function () {
                setorSelecionado = setor.nome;
                renderSetorFilter();
                renderSetores();
            };
            container.appendChild(pill);
        });
    }
}

// ── RENDER SETORES ───────────────────────────────────────────
function renderSetores() {
    var container = document.getElementById('setoresContainer');
    if (!container || !cidadeSelecionada) return;

    container.innerHTML = '';

    if (!cidadeSelecionada.setores || cidadeSelecionada.setores.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhuma requisição nesta cidade</p></div>';
        return;
    }

    var setoresFiltrados = cidadeSelecionada.setores;
    if (setorSelecionado) {
        setoresFiltrados = setoresFiltrados.filter(function (s) {
            return s.nome === setorSelecionado;
        });
    }

    var searchVal = (document.getElementById('searchInput') ? document.getElementById('searchInput').value : '').trim().toLowerCase();

    setoresFiltrados.forEach(function (setor) {
        var itens = setor.itens || [];

        if (searchVal) {
            itens = itens.filter(function (item) {
                var descricao = (item.descricao || item.item || '').toLowerCase();
                return descricao.indexOf(searchVal) !== -1;
            });
            if (itens.length === 0) return;
        }

        var block = document.createElement('div');
        block.className = 'setor-block';

        var subtotal = 0;
        itens.forEach(function (item) {
            subtotal += (item.totalItem || item.total || 0);
        });

        var header = document.createElement('div');
        header.className = 'setor-header';
        header.innerHTML =
            '<div class="setor-header-left">' +
            '<i class="fas ' + getSetorIcon(setor.nome) + '"></i>' +
            '<span class="setor-nome">' + escapeHtml(setor.nome) + '</span>' +
            '<span class="setor-count">' + itens.length + '</span>' +
            '</div>' +
            '<span class="setor-subtotal">' + formatCurrency(subtotal) + '</span>';
        block.appendChild(header);

        var table = document.createElement('div');
        table.className = 'items-table';

        var thead = document.createElement('div');
        thead.className = 'items-table-header';
        thead.innerHTML =
            '<span class="col-id">#</span>' +
            '<span class="col-desc">Item</span>' +
            '<span class="col-qtd">Qtd</span>' +
            '<span class="col-unit">Unitário</span>' +
            '<span class="col-total">Total</span>';
        table.appendChild(thead);

        itens.forEach(function (item) {
            var row = document.createElement('div');
            row.className = 'items-table-row';

            var id = item.id || item.numero || '-';
            var desc = item.descricao || item.item || '-';
            var qtd = item.quantidade || item.qtd || 0;
            var unitario = item.valorUnitario || item.unitario || 0;
            var total = item.totalItem || item.total || 0;

            row.innerHTML =
                '<span class="col-id">' + escapeHtml(String(id)) + '</span>' +
                '<span class="col-desc">' + escapeHtml(desc) + '</span>' +
                '<span class="col-qtd">' + qtd + '</span>' +
                '<span class="col-unit">' + formatCurrency(unitario) + '</span>' +
                '<span class="col-total">' + formatCurrency(total) + '</span>';

            table.appendChild(row);
        });

        block.appendChild(table);
        container.appendChild(block);
    });

    if (container.children.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>Nenhum item encontrado</p></div>';
    }
}

// ── SEARCH ───────────────────────────────────────────────────
function filtrarItens() {
    if (cidadeSelecionada) {
        renderSetores();
    }
}

// ── REFRESH ──────────────────────────────────────────────────
function refreshDados() {
    carregarDados();
}

// ── RESUMO WHATSAPP ──────────────────────────────────────────
function gerarResumoWhatsApp() {
    if (!dadosCompletos || !dadosCompletos.dados) {
        mostrarToast('Carregue os dados primeiro', 'error');
        return;
    }

    var texto = '📋 *REQUISIÇÕES — GRUPO CARLOS VAZ*\n';
    texto += '📅 ' + formatDate(new Date()) + '\n\n';

    dadosCompletos.dados.forEach(function (cidade) {
        if (!cidade.total || cidade.total === 0) return;

        texto += '🏙️ *' + cidade.cidade.toUpperCase() + '* — ' + formatCurrency(cidade.total) + '\n';

        if (cidade.setores) {
            cidade.setores.forEach(function (setor) {
                var subtotal = 0;
                var numItens = setor.itens ? setor.itens.length : 0;
                if (setor.itens) {
                    setor.itens.forEach(function (i) { subtotal += (i.totalItem || i.total || 0); });
                }
                texto += '  └ ' + setor.nome + ': ' + numItens + ' itens · ' + formatCurrency(subtotal) + '\n';
            });
        }
        texto += '\n';
    });

    texto += '💰 *TOTAL GERAL: ' + formatCurrency(dadosCompletos.totalGeral || 0) + '*\n';
    texto += '\n_Gerado automaticamente pelo Requisições Digital_';

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(function () {
            mostrarToast('Resumo copiado!', 'success');
        }).catch(function () {
            fallbackCopy(texto);
        });
    } else {
        fallbackCopy(texto);
    }
}

function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        mostrarToast('Resumo copiado!', 'success');
    } catch (e) {
        mostrarToast('Não foi possível copiar', 'error');
    }
    document.body.removeChild(ta);
}

// ── TOAST ────────────────────────────────────────────────────
function mostrarToast(msg, tipo) {
    var t = document.getElementById('toast');
    if (!t) return;

    t.textContent = msg;
    t.className = 'toast ' + (tipo || 'info') + ' show';

    setTimeout(function () {
        t.classList.remove('show');
    }, 3000);
}

// ── HELPERS ──────────────────────────────────────────────────
function formatCurrency(val) {
    if (typeof val !== 'number' || isNaN(val)) val = 0;
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(d) {
    if (!d) return '-';
    var day = String(d.getDate()).padStart(2, '0');
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var year = d.getFullYear();
    return day + '/' + month + '/' + year;
}

function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function getSetorIcon(nome) {
    var icons = {
        'EDUCAÇÃO': 'fa-graduation-cap',
        'SAÚDE': 'fa-heartbeat',
        'ASSISTÊNCIA SOCIAL': 'fa-hands-helping',
        'ADMINISTRAÇÃO': 'fa-building',
        'INFRAESTRUTURA': 'fa-hard-hat'
    };
    return icons[nome] || 'fa-folder';
}

// ── KEYBOARD SHORTCUT ────────────────────────────────────────
document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        var loginScreen = document.getElementById('loginScreen');
        if (loginScreen && loginScreen.classList.contains('active')) {
            fazerLogin();
        }
    }
});
