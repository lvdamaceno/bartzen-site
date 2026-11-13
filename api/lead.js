// Prova do aceite (LGPD) que vai junto com o lead e fica guardada no card do Happy.
// Ao mudar o texto da caixa no index.html ou a data da política em privacidade.html, atualize aqui também.
const ACEITE_TEXTO =
  "Autorizo a Casa Contente a entrar em contato comigo pelo WhatsApp ou telefone sobre este projeto, e li a Política de Privacidade.";
const POLITICA_VERSAO = "julho de 2026";

export default async function (req, res) {
  // Configuração ausente
  if (!process.env.KANBAN_URL || !process.env.KANBAN_TOKEN) {
    return res.status(500).json({
      ok: false,
      erro: "Serviço indisponível no momento."
    });
  }

  const body = req.body;

  // ---- Honeypot: campo invisível. Se veio preenchido, é bot. ----
  if (body.website && String(body.website).trim() !== "") {
    return res.json({ ok: true }); // finge sucesso
  }

  // ---- Validação ----
  const nome = String(body.nome || "").trim();
  const sobrenome = String(body.sobrenome || "").trim();
  const whatsapp = String(body.whatsapp || "").trim();
  const tipoProjeto = String(body.tipoProjeto || "").trim();
  const consentimento = body.consentimento === true;

  if (!nome) {
    return res.status(400).json({
      ok: false,
      erro: "Informe seu nome."
    });
  }

  if (whatsapp.replace(/\D/g, "").length < 10) {
    return res.status(400).json({
      ok: false,
      erro: "Informe um WhatsApp válido com DDD."
    });
  }

  if (!consentimento) {
    return res.status(400).json({
      ok: false,
      erro: "É necessário aceitar a Política de Privacidade."
    });
  }

  // ---- Repassa ao Happy (kanban dos planejados) ----
  try {
    const resp = await fetch(process.env.KANBAN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        token: process.env.KANBAN_TOKEN,
        acao: "registrarLead",
        lead: {
          nome,
          sobrenome,
          whatsapp,
          tipoProjeto,
          consentimento: {
            aceito: true,
            texto: ACEITE_TEXTO,
            politica: POLITICA_VERSAO
          }
        }
      })
    });

    console.log("Status:", resp.status);

    const texto = await resp.text();

    console.log("Resposta:");
    console.log(texto);

    let resultado;

    try {
      resultado = JSON.parse(texto);
    } catch {
      return res.status(502).json({
        ok: false,
        erro: "Não foi possível registrar agora."
      });
    }

    if (resultado?.ok) {
      return res.json({ ok: true });
    }

    return res.status(502).json({
      ok: false,
      erro: resultado?.erro || "Não foi possível registrar agora."
    });

  } catch (err) {
    console.error(err);

    return res.status(502).json({
      ok: false,
      erro: "Não foi possível registrar agora. Tente novamente."
    });
  }
}