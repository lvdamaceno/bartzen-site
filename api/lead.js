// Prova do aceite (LGPD) que vai junto com o lead e fica guardada no card do Happy.
// Ao mudar o texto da caixa no public/index.html ou a data da política em public/privacidade.html, atualize aqui também.
const ACEITE_TEXTO =
  "Autorizo a Casa Contente a entrar em contato comigo pelo WhatsApp ou telefone sobre este projeto, e li a Política de Privacidade.";
const POLITICA_VERSAO = "novembro de 2026";

// As mesmas opções do <select id="tipoProjeto"> do public/index.html.
const TIPOS = new Set([
  "Cozinha",
  "Dormitório do casal",
  "Dormitório solteiro / infantil",
  "Closet",
  "Home / Sala de estar",
  "Home office / Escritório",
  "Sala de jantar",
  "Banheiro / Lavabo",
  "Área de serviço",
  "Área gourmet / Varanda",
  "Casa completa",
  "Ainda não sei / quero orientação"
]);

// Mensagens do Happy que podem ir para o visitante. Qualquer outra (token, configuração) vira a genérica.
const ERROS_DO_HAPPY = [
  "Informe seu nome.",
  "Informe um WhatsApp válido com DDD.",
  "É necessário aceitar a Política de Privacidade.",
  "Muitas solicitações agora. Tente novamente em instantes."
];

const GENERICO = "Não foi possível registrar agora. Tente novamente em instantes.";

// ---- Limite por IP: 5 envios a cada 10 minutos ----
const JANELA_MS = 10 * 60 * 1000;
const MAX_POR_IP = 5;
const envios = new Map();
setInterval(() => {
  const agora = Date.now();
  for (const [ip, a] of envios) if (a.ate < agora) envios.delete(ip);
}, JANELA_MS).unref();

function ipDe(req) {
  // O site fica atrás do Cloudflare, que manda o IP do visitante neste cabeçalho.
  return String(
    req.headers["cf-connecting-ip"] ||
      String(req.headers["x-forwarded-for"] || "").split(",")[0] ||
      req.socket.remoteAddress ||
      ""
  ).trim();
}

function estourou(ip) {
  const agora = Date.now();
  const a = envios.get(ip);
  if (!a || a.ate < agora) {
    envios.set(ip, { n: 1, ate: agora + JANELA_MS });
    return false;
  }
  a.n++;
  return a.n > MAX_POR_IP;
}

const texto = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// Origem da visita (parâmetros de campanha e o site de onde veio), só com chaves conhecidas e valores curtos.
function origemDe(o) {
  if (!o || typeof o !== "object") return null;
  const r = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const v = texto(o[k], 100);
    if (v) r[k] = v;
  }
  if (o.gclid) r.gclid = true;
  if (o.fbclid) r.fbclid = true;
  const ref = texto(o.referrer, 100).toLowerCase();
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(ref)) r.referrer = ref;
  return Object.keys(r).length ? r : null;
}

async function captchaOk(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // captcha desligado
  if (!token || typeof token !== "string") return false;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token.slice(0, 2048), remoteip: ip }),
      signal: AbortSignal.timeout(8000)
    });
    return (await r.json())?.success === true;
  } catch (err) {
    console.error("Turnstile:", err.name);
    return false;
  }
}

export default async function (req, res) {
  if (!process.env.KANBAN_URL || !process.env.KANBAN_TOKEN) {
    console.error("KANBAN_URL ou KANBAN_TOKEN não configurado");
    return res.status(500).json({ ok: false, erro: "Serviço indisponível no momento." });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};

  // ---- Honeypot: campo invisível. Se veio preenchido, é robô. ----
  if (body.website && String(body.website).trim() !== "") {
    return res.json({ ok: true }); // finge sucesso
  }

  const ip = ipDe(req);
  if (estourou(ip)) {
    return res.status(429).json({
      ok: false,
      erro: "Você já enviou alguns pedidos agora. Aguarde alguns minutos ou fale conosco pelo WhatsApp."
    });
  }

  // ---- Validação ----
  const nome = texto(body.nome, 60);
  const sobrenome = texto(body.sobrenome, 80);
  const whatsapp = texto(body.whatsapp, 20);
  const tipoProjeto = TIPOS.has(body.tipoProjeto) ? body.tipoProjeto : "";
  const digitos = whatsapp.replace(/\D/g, "");

  if (!nome) {
    return res.status(400).json({ ok: false, erro: "Informe seu nome." });
  }
  if (digitos.length < 10 || digitos.length > 13) {
    return res.status(400).json({ ok: false, erro: "Informe um WhatsApp válido com DDD." });
  }
  if (body.consentimento !== true) {
    return res.status(400).json({ ok: false, erro: "É necessário aceitar a Política de Privacidade." });
  }
  if (!(await captchaOk(body.captcha, ip))) {
    return res.status(400).json({
      ok: false,
      erro: "Não conseguimos confirmar que você não é um robô. Recarregue a página e tente de novo."
    });
  }

  // ---- Repassa ao Happy (kanban dos planejados) ----
  try {
    const resp = await fetch(process.env.KANBAN_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        token: process.env.KANBAN_TOKEN,
        acao: "registrarLead",
        lead: {
          nome,
          sobrenome,
          whatsapp,
          tipoProjeto,
          consentimento: { aceito: true, texto: ACEITE_TEXTO, politica: POLITICA_VERSAO },
          origem: origemDe(body.origem)
        }
      }),
      signal: AbortSignal.timeout(15000)
    });

    let resultado = null;
    try {
      resultado = JSON.parse(await resp.text());
    } catch {
      // resposta que não é JSON: tratada abaixo como falha
    }

    if (resultado?.ok) {
      console.log("Lead registrado");
      return res.json({ ok: true });
    }

    // Sem dados do visitante no log: só o status e o motivo devolvido pelo Happy.
    console.error("Lead recusado:", resp.status, String(resultado?.erro || "resposta inválida").slice(0, 120));
    const erro = ERROS_DO_HAPPY.includes(resultado?.erro) ? resultado.erro : GENERICO;
    return res.status(502).json({ ok: false, erro });
  } catch (err) {
    console.error("Falha ao falar com o Happy:", err.name === "TimeoutError" ? "tempo esgotado" : err.message);
    return res.status(502).json({ ok: false, erro: GENERICO });
  }
}
