var enviando = false;
var captchaToken = null;
var captchaLigado = false;
var TEXTO_BOTAO = 'Quero realizar meu projeto';

function erro(txt) {
  var m = document.getElementById('msg');
  m.textContent = txt;
  m.classList.add('show');
}
function limpar() {
  document.getElementById('msg').classList.remove('show');
}

// ---------- Armazenamento (pode falhar em aba anônima ou com dados bloqueados) ----------
function ler(area, chave) {
  try {
    return window[area].getItem(chave);
  } catch (e) {
    return null;
  }
}
function gravar(area, chave, valor) {
  try {
    window[area].setItem(chave, valor);
  } catch (e) {}
}

// ---------- Origem da visita (campanha e site de onde veio), enviada só junto com o formulário ----------
var CHAVES_UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
function guardarOrigem() {
  var q = new URLSearchParams(location.search);
  var o = {};
  CHAVES_UTM.forEach(function (k) {
    if (q.get(k)) o[k] = q.get(k).slice(0, 100);
  });
  // Links antigos dos QR codes da Casaliv: ?origem=casaliv-<ambiente>-<código>.
  var antigo = (q.get('origem') || '').trim().slice(0, 100);
  if (antigo && !o.utm_source) {
    o.utm_source = antigo.split('-')[0];
    o.utm_campaign = antigo;
  }
  if (q.get('gclid')) o.gclid = true;
  if (q.get('fbclid')) o.fbclid = true;
  var temCampanha = Object.keys(o).length > 0;
  try {
    var ref = document.referrer ? new URL(document.referrer).hostname : '';
    if (ref && ref !== location.hostname) o.referrer = ref;
  } catch (e) {}
  // A primeira origem da visita vale; uma campanha nova no meio da visita substitui.
  if (temCampanha || !ler('sessionStorage', 'bz_origem')) {
    gravar('sessionStorage', 'bz_origem', JSON.stringify(o));
  }
}
function origem() {
  try {
    return JSON.parse(ler('sessionStorage', 'bz_origem') || 'null');
  } catch (e) {
    return null;
  }
}
guardarOrigem();

// ---------- Medição (GA4 e Pixel da Meta): só depois do aceite no aviso de cookies ----------
var config = {};
function carregarScript(src) {
  var s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
  return s;
}
function ligarMedicao() {
  if (config.ga4 && !window.gtag) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', config.ga4);
    carregarScript('https://www.googletagmanager.com/gtag/js?id=' + config.ga4);
  }
  if (config.metaPixel && !window.fbq) {
    var f = (window.fbq = function () {
      f.callMethod ? f.callMethod.apply(f, arguments) : f.queue.push(arguments);
    });
    window._fbq = f;
    f.push = f;
    f.loaded = true;
    f.version = '2.0';
    f.queue = [];
    carregarScript('https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', config.metaPixel);
    window.fbq('track', 'PageView');
  }
}
function registrarConversao(tipo) {
  if (window.gtag) window.gtag('event', 'generate_lead', { project_type: tipo || 'não informado' });
  if (window.fbq) window.fbq('track', 'Lead', { content_category: tipo || 'não informado' });
}
function avisoCookies(forcar) {
  if (!config.ga4 && !config.metaPixel) return;
  var escolha = ler('localStorage', 'bz_cookies');
  if (escolha === 'sim') ligarMedicao();
  if (escolha && !forcar) return;
  var antigo = document.getElementById('aviso-cookies');
  if (antigo) antigo.remove();
  var div = document.createElement('div');
  div.id = 'aviso-cookies';
  div.setAttribute('role', 'dialog');
  div.setAttribute('aria-label', 'Aviso de cookies');
  div.innerHTML =
    '<p>Usamos cookies de medição (' +
    [config.ga4 && 'Google Analytics', config.metaPixel && 'Meta'].filter(Boolean).join(' e ') +
    ') para saber como as pessoas chegam ao site e melhorar nossos anúncios. ' +
    'Você escolhe se aceita. Saiba mais na <a href="/privacidade.html#cookies">Política de Privacidade</a>.</p>' +
    '<div class="aviso-botoes"><button type="button" class="aviso-nao">Recusar</button>' +
    '<button type="button" class="aviso-sim">Aceitar</button></div>';
  document.body.appendChild(div);
  div.querySelector('.aviso-sim').addEventListener('click', function () {
    gravar('localStorage', 'bz_cookies', 'sim');
    div.remove();
    ligarMedicao();
  });
  div.querySelector('.aviso-nao').addEventListener('click', function () {
    gravar('localStorage', 'bz_cookies', 'nao');
    div.remove();
    // Quem aceitou antes e agora recusa: a medição para na próxima página.
    if (window.gtag || window.fbq) location.reload();
  });
}

// ---------- Captcha (Cloudflare Turnstile), só se a chave estiver configurada ----------
function ligarCaptcha(chave) {
  var alvo = document.getElementById('captcha');
  if (!alvo) return;
  captchaLigado = true;
  window.bzCaptchaPronto = function () {
    window.turnstile.render(alvo, {
      sitekey: chave,
      language: 'pt-br',
      theme: 'light',
      callback: function (t) {
        captchaToken = t;
      },
      'expired-callback': function () {
        captchaToken = null;
      },
      'error-callback': function () {
        captchaToken = null;
      },
    });
  };
  carregarScript('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=bzCaptchaPronto');
}
function reiniciarCaptcha() {
  captchaToken = null;
  if (captchaLigado && window.turnstile) window.turnstile.reset();
}

fetch('/api/config')
  .then(function (r) {
    return r.json();
  })
  .then(function (c) {
    config = c || {};
    if (config.turnstile) ligarCaptcha(config.turnstile);
    avisoCookies(false);
    // O link "Preferências de cookies" do rodapé só aparece quando há medição para escolher.
    var preferencias = document.getElementById('preferencias-cookies');
    if (preferencias && (config.ga4 || config.metaPixel)) {
      preferencias.hidden = false;
      preferencias.addEventListener('click', function (e) {
        e.preventDefault();
        avisoCookies(true);
      });
    }
  })
  .catch(function () {});

// ---------- Botões que levam ao formulário: rolam sem pôr #projeto no endereço ----------
// (um link copiado com #projeto abriria a página já no fim para quem recebe)
document.querySelectorAll('a[href="#projeto"]').forEach(function (a) {
  a.addEventListener('click', function (e) {
    var alvo = document.getElementById('projeto');
    if (!alvo) return;
    e.preventDefault();
    alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// ---------- Formulário ----------
// Só nas páginas que têm o formulário (a política de privacidade e a 404 usam este arquivo pelo aviso de cookies).
if (document.getElementById('enviar')) {
  document.getElementById('whatsapp').addEventListener('input', function (e) {
    var d = e.target.value.replace(/\D/g, '').slice(0, 11),
      out = d;
    if (d.length > 2) out = '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length > 7) out = '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    e.target.value = out;
  });

  function liberarBotao(btn) {
    enviando = false;
    btn.disabled = false;
    btn.textContent = TEXTO_BOTAO;
  }

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
      captcha: captchaToken,
      origem: origem(),
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
      erro('É necessário aceitar a Política de Privacidade para continuar.');
      return;
    }
    if (captchaLigado && !captchaToken) {
      erro('Aguarde a verificação de segurança logo acima do botão e tente de novo.');
      return;
    }

    enviando = true;
    var btn = document.getElementById('enviar');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    var controle = window.AbortController ? new AbortController() : null;
    var limite = setTimeout(function () {
      if (controle) controle.abort();
    }, 25000);

    fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
      signal: controle ? controle.signal : undefined,
    })
      .then(function (r) {
        clearTimeout(limite);
        // O servidor respondeu: se não veio JSON, é falha do servidor, não da conexão.
        return r.json().catch(function () {
          return { ok: false, erro: 'Não foi possível enviar agora. Tente novamente em instantes.' };
        });
      })
      .then(function (res) {
        liberarBotao(btn);
        if (res && res.ok) {
          registrarConversao(dados.tipoProjeto);
          document.getElementById('cardForm').style.display = 'none';
          document.getElementById('cardSucesso').style.display = 'block';
          document.getElementById('cardSucesso').scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          reiniciarCaptcha();
          erro((res && res.erro) || 'Não foi possível enviar agora. Tente novamente.');
        }
      })
      .catch(function (e) {
        clearTimeout(limite);
        liberarBotao(btn);
        reiniciarCaptcha();
        erro(
          e && e.name === 'AbortError'
            ? 'O envio demorou demais. Tente novamente ou fale conosco pelo WhatsApp.'
            : 'Não foi possível enviar agora. Verifique sua conexão e tente novamente.'
        );
      });
  });
}
