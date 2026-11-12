import type { Context } from "telegraf";

export async function handleQrCommand(ctx: Context, arg: string) {
  if (!arg) {
    await ctx.reply("Uso: /qr <enlace o texto>\nEjemplo: /qr https://google.com");
    return;
  }

  await ctx.sendChatAction("upload_photo");

  try {
    // Generar el código QR usando una API pública rápida
    const encodedData = encodeURIComponent(arg);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodedData}`;

    // Enviar la imagen directamente al chat
    await ctx.replyWithPhoto(
      { url: qrUrl },
      { caption: `✅ Código QR generado para:\n${arg}` }
    );
  } catch (error) {
    await ctx.reply("❌ Ocurrió un error al intentar generar el código QR. Intenta con un texto más corto.");
  }
}
