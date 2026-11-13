// Transição leve entre as seções de tela cheia: a seção que ocupa a maior parte da tela ganha a classe
// "ativa" (o texto aparece e a foto assenta). Sem suporte ou com movimento reduzido, tudo fica visível.
(function () {
  var telas = document.querySelectorAll('.tela');
  var reduzir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || reduzir) {
    telas.forEach(function (t) {
      t.classList.add('ativa');
    });
    return;
  }
  var obs = new IntersectionObserver(
    function (entradas) {
      entradas.forEach(function (e) {
        // Entra com 35% visível; só "sai" quando quase some, para não piscar na troca.
        if (e.intersectionRatio >= 0.35) e.target.classList.add('ativa');
        else if (e.intersectionRatio < 0.05) e.target.classList.remove('ativa');
      });
    },
    { threshold: [0, 0.05, 0.35] }
  );
  telas.forEach(function (t) {
    obs.observe(t);
  });
})();

// Carrossel dos ambientes (só no celular): os pontinhos mostram o cartão atual e levam até o cartão tocado.
(function () {
  var trilho = document.getElementById('carrossel-ambientes');
  var pontos = document.querySelectorAll('.carrossel-pontos button');
  if (!trilho || !pontos.length) return;
  var cartoes = trilho.children;

  function atual() {
    var centro = trilho.scrollLeft + trilho.clientWidth / 2;
    var melhor = 0;
    var menor = Infinity;
    for (var i = 0; i < cartoes.length; i++) {
      var meio = cartoes[i].offsetLeft + cartoes[i].offsetWidth / 2;
      var d = Math.abs(meio - centro);
      if (d < menor) {
        menor = d;
        melhor = i;
      }
    }
    return melhor;
  }
  function marcar() {
    var i = atual();
    pontos.forEach(function (p, k) {
      if (k === i) p.setAttribute('aria-current', 'true');
      else p.removeAttribute('aria-current');
    });
  }
  var pendente = false;
  trilho.addEventListener(
    'scroll',
    function () {
      if (pendente) return;
      pendente = true;
      requestAnimationFrame(function () {
        pendente = false;
        marcar();
      });
    },
    { passive: true }
  );
  pontos.forEach(function (p, k) {
    p.addEventListener('click', function () {
      var c = cartoes[k];
      trilho.scrollTo({ left: c.offsetLeft - (trilho.clientWidth - c.offsetWidth) / 2, behavior: 'smooth' });
    });
  });
})();
