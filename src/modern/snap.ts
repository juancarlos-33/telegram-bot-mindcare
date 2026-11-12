import type { Context } from "telegraf";

export async function handleSnapCommand(ctx: Context, arg: string) {
  if (!arg) {
    await ctx.reply("Uso: /bomba <mensaje secreto>\nEl bot enviará tu mensaje secreto y lo destruirá automáticamente en 10 segundos.");
    return;
  }

  // Delete the user's original message to hide the evidence
  if (ctx.message && ctx.chat?.type !== "private") {
    try {
      await ctx.deleteMessage(ctx.message.message_id);
    } catch (e) {
      // Ignorar si no tenemos permisos
    }
  }

  // Send the self-destructing message
  const msg = await ctx.reply(`💣 **Mensaje Secreto** (se autodestruye en 10s):\n\n${arg}`);

  // Schedule deletion
  setTimeout(async () => {
    try {
      await ctx.telegram.deleteMessage(ctx.chat!.id, msg.message_id);
      
      // Opcional: enviar un humito para confirmar
      const smoke = await ctx.reply("💨 *El mensaje secreto ha explotado.*", { parse_mode: "Markdown" });
      
      // Borrar el humo después de 3 segundos
      setTimeout(async () => {
        try { await ctx.telegram.deleteMessage(ctx.chat!.id, smoke.message_id); } catch(e){}
      }, 3000);
      
    } catch (error) {
      console.log("No pude borrar el mensaje de la bomba.");
    }
  }, 10000); // 10 segundos
}
