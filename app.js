function fazerLogin() {
    var usuario = (document.getElementById('usuario').value || '').trim().toUpperCase();
    var senha = (document.getElementById('senha').value || '').trim();

    if (!usuario || !senha) {
        mostrarToast('Preencha usuário e senha', 'error');
        return;
    }

    var btn = document.getElementById('loginBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
    }

    // POST login — formato compatível com Código.gs
    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'acao=login&usuario=' + encodeURIComponent(usuario) + '&senha=' + encodeURIComponent(senha)
    })
        .then(function (r) { return r.json(); })
        .then(function (d) {
            // Código.gs retorna {status:'ok', nome:'...', nivel:'...'}
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
                btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
            }
        });
}
