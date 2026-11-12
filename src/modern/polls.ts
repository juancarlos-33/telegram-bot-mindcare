import type { Context } from "telegraf";

export async function handlePollCommand(ctx: Context, arg: string) {
  if (!ctx.chat) return;
  
  if (!arg || !arg.includes("|")) {
    await ctx.reply("Uso: /encuesta <Pregunta> | <Opcion1> | <Opcion2> | [Opcion3...]\n\nEjemplo: /encuesta ¿Qué comemos hoy? | Pizza | Hamburguesa | Tacos");
    return;
  }

  const parts = arg.split("|").map(s => s.trim()).filter(Boolean);
  
  if (parts.length < 3) {
    await ctx.reply("❌ Necesitas dar al menos una pregunta y dos opciones.");
    return;
  }

  const question = parts[0] as string;
  const options = parts.slice(1);

  if (options.length > 10) {
    await ctx.reply("❌ Telegram solo permite un máximo de 10 opciones por encuesta.");
    return;
  }

  try {
    await ctx.replyWithPoll(question, options, {
      is_anonymous: false, // Para que sepamos quién vota qué
      allows_multiple_answers: false
    });
  } catch (error) {
    await ctx.reply("❌ Hubo un error al crear la encuesta. Asegúrate de que las opciones no sean muy largas.");
  }
}
