import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import lead from "./api/lead.js";

dotenv.config();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.disable("x-powered-by");

// Cabeçalhos básicos de segurança em todas as respostas.
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
  });
  next();
});

// /novolayout foi a página de testes do layout atual: quem tiver o link antigo vai para a principal.
app.get(/^\/novolayout(\/.*)?$/, (req, res) => res.redirect(301, "/"));

// Só a pasta public/ vai para o navegador (o código do servidor e a node_modules não).
app.use(express.static(path.join(__dirname, "public")));

// O que a página precisa saber do servidor: as chaves públicas do captcha e da medição.
// Cada item só aparece se a variável correspondente estiver configurada no Render.
app.get("/api/config", (req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json({
    turnstile: process.env.TURNSTILE_SITE_KEY || null,
    ga4: /^G-[A-Z0-9]{4,20}$/.test(process.env.GA4_ID || "") ? process.env.GA4_ID : null,
    metaPixel: /^\d{6,20}$/.test(process.env.META_PIXEL_ID || "") ? process.env.META_PIXEL_ID : null
  });
});

app.post("/api/lead", express.json({ limit: "10kb" }), lead);

// JSON malformado ou grande demais: responde 400/413 em vez de 500.
app.use((err, req, res, next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ ok: false, erro: "Envio inválido." });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ ok: false, erro: "Envio grande demais." });
  }
  console.error(err);
  res.status(500).json({ ok: false, erro: "Não foi possível registrar agora." });
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Servidor iniciado");
});
