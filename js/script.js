
var enviando = false;
function erro(txt) {
  var m = document.getElementById('msg');
  m.textContent = txt;
  m.classList.add('show');
}
function limpar() {
  document.getElementById('msg').classList.remove('show');
}

document
  .getElementById('whatsapp')
  .addEventListener('input', function (e) {
    var d = e.target.value.replace(/\D/g, '').slice(0, 11),
      out = d;
    if (d.length > 2) out = '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length > 7)
      out = '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    e.target.value = out;
  });

document.getElementById('enviar').addEventListener('click', function () {
  if (enviando) return;
  limpar();
  var dados = {
    nome: document.getElementById('nome').value.trim(),
    sobrenome: document.getElementById('sobrenome').value.trim(),
    whatsapp: document.getElementById('whatsapp').value.trim(),
    tipoProjeto: document.getElementById('tipoProjeto').value,
    consentimento: document.getElementById('consentimento').checked,
    website: document.getElementById('website').value,
  };
  if (!dados.nome) {
    erro('Por favor, informe seu nome.');
    return;
  }
  if (dados.whatsapp.replace(/\D/g, '').length < 10) {
    erro('Informe um WhatsApp válido com DDD.');
    return;
  }
  if (!dados.consentimento) {
    erro(
      'É necessário aceitar a Política de Privacidade para continuar.'
    );
    return;
  }

  enviando = true;
  var btn = document.getElementById('enviar');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  fetch('/api/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
    .then(function (r) {
      return r.json();
    })
    .then(function (res) {
      enviando = false;
      btn.disabled = false;
      btn.textContent = 'Quero realizar meu projeto';
      if (res && res.ok) {
        document.getElementById('cardForm').style.display = 'none';
        document.getElementById('cardSucesso').style.display = 'block';
        document
          .getElementById('cardSucesso')
          .scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        erro(
          (res && res.erro) ||
          'Não foi possível enviar agora. Tente novamente.'
        );
      }
    })
    .catch(function () {
      enviando = false;
      btn.disabled = false;
      btn.textContent = 'Quero realizar meu projeto';
      erro(
        'Não foi possível enviar agora. Verifique sua conexão e tente novamente.'
      );
    });
});
