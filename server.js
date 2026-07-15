import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import lead from "./api/lead.js";

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

app.use(express.static(__dirname));

app.post("/api/lead", lead);

app.listen(process.env.PORT || 3000, () => {
  console.log("Servidor iniciado");
});