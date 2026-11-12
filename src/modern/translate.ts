import type { Context } from "telegraf";
import { askAI } from "./ai.js";

export async function handleTranslateCommand(ctx: Context, arg: string) {
  if (!arg) {
    await ctx.reply("Uso: /traducir <texto> (o responde a un mensaje con /traducir)\n\nTambién puedes especificar el idioma: /traducir al ingles Hola a todos");
    return;
  }

  // Verificar si hay claves de IA
  if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
    await ctx.reply("❌ Error: No hay API Keys configuradas para realizar la traducción. Configura GROQ_API_KEY.");
    return;
  }

  await ctx.sendChatAction("typing");

  try {
    const prompt = `Eres un traductor profesional. Traduce el siguiente texto. Si no se especifica el idioma, asume que debe traducirse al español. Si ya está en español y no se especifica, tradúcelo al inglés. Solo responde con la traducción, sin texto adicional ni comillas. El texto es:\n\n${arg}`;
    const result = await askAI(prompt, "niko"); // Using niko to just bypass logic, but in reality just a plain call
    await ctx.reply(`🌍 Traducción:\n\n${result}`);
  } catch (error) {
    await ctx.reply("❌ Hubo un error al traducir el texto.");
  }
}
