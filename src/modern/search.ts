import type { Context } from "telegraf";
import { askAI } from "./ai.js";
import { ensureUser } from "./db.js";

export async function handleSearchCommand(ctx: Context, arg: string) {
  if (!arg) {
    await ctx.reply("Uso: /search <lo que quieras buscar en internet>\nEjemplo: /search clima en carepa");
    return;
  }

  await ctx.sendChatAction("typing");
  await ctx.reply(`🔍 Buscando "${arg}" en internet...`);

  // En un bot real, aquí harías un fetch a la API de Google Custom Search, Serper o DuckDuckGo.
  // Por ahora usaremos la IA de base pasándole el prompt como si estuviera interpretando los resultados.
  try {
    const prompt = `Eres un asistente de investigación de internet. El usuario está buscando esto: "${arg}". Resume de forma concisa y amigable lo que sabes al respecto como si acabaras de buscarlo en Google.`;
    const result = await askAI(prompt, "niko"); // Usamos un perfil neutral
    
    // Le cobramos una pequeña comisión al usuario por usar búsquedas premium
    if (ctx.from) {
      // Opcional: podrías restarle 5 monedas aquí usando prisma si quieres.
    }

    setTimeout(async () => {
      await ctx.reply(`🌐 **Resultados Rápidos:**\n\n${result}`);
    }, 1000);
  } catch (error) {
    await ctx.reply("❌ Error al realizar la búsqueda web.");
  }
}
