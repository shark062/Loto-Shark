import { Router } from "express";
import {
  listProviders,
  addProvider,
  updateProvider,
  deleteProvider,
  testProvider,
  callBestProvider,
  getEvolutionLog,
} from "../lib/aiProviders";

const router = Router();

router.get("/", (req, res) => {
  res.json(listProviders());
});

router.get("/evolution", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  res.json({ log: getEvolutionLog(limit) });
});

router.post("/", (req, res) => {
  const { type, name, apiKey, model, baseUrl } = req.body;
  if (!type || !name || !apiKey) {
    return res.status(400).json({ message: "type, name e apiKey são obrigatórios" });
  }
  const provider = addProvider({ type, name, apiKey, model, baseUrl });
  res.status(201).json(provider);
});

router.put("/:id", (req, res) => {
  const updated = updateProvider(req.params.id, req.body);
  if (!updated) return res.status(404).json({ message: "Provider não encontrado" });
  res.json(updated);
});

router.delete("/:id", (req, res) => {
  const ok = deleteProvider(req.params.id);
  if (!ok) return res.status(404).json({ message: "Provider não encontrado" });
  res.json({ success: true });
});

router.post("/:id/test", async (req, res) => {
  const result = await testProvider(req.params.id);
  res.json(result);
});

router.post("/chat", async (req, res) => {
  const { prompt, systemPrompt } = req.body;
  if (!prompt) return res.status(400).json({ message: "prompt é obrigatório" });
  try {
    const text = await callBestProvider(prompt, systemPrompt);
    res.json({ text });
  } catch (err: any) {
    res.status(503).json({ message: err.message });
  }
});

export default router;
