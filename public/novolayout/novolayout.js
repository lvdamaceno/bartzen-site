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
