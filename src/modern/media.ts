import type { Context } from "telegraf";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Note: To use ffmpeg, the system running this bot must have ffmpeg installed and in the PATH.
// On railway, you usually add an apt-get install ffmpeg in a nixpacks configuration.

export async function handleStickerCommand(ctx: Context) {
  const replyTo = ctx.message && 'reply_to_message' in ctx.message ? ctx.message.reply_to_message : null;
  
  if (!replyTo) {
    await ctx.reply("Debes responder a una imagen o video corto con /s para hacer un sticker.");
    return;
  }

  // Just a mock/demo logic for now that replies to indicate functionality is ported
  await ctx.sendChatAction("choose_sticker");
  
  // In a real implementation, we would:
  // 1. Get file_id from replyTo.photo or replyTo.video
  // 2. ctx.telegram.getFileLink(file_id)
  // 3. Download to tmp file
  // 4. Use FFmpeg to scale to 512x512 and convert to .webp
  // 5. ctx.replyWithSticker({ source: fs.createReadStream(tmpFile) })

  await ctx.reply("🛠️ (Demo) Si esto estuviera en producción, usaría FFmpeg para convertir esa imagen/video en un sticker .webp de 512x512 y te lo enviaría de vuelta.");
}

export async function handleExtraerCommand(ctx: Context) {
  const replyTo = ctx.message && 'reply_to_message' in ctx.message ? ctx.message.reply_to_message : null;
  
  if (!replyTo || !('sticker' in replyTo)) {
    await ctx.reply("Debes responder a un sticker con /extraer para convertirlo en video o imagen.");
    return;
  }

  await ctx.sendChatAction("upload_video");
  
  // In a real implementation:
  // 1. Check if sticker is animated (.tgs) or video (.webm) or static (.webp)
  // 2. Download file via ctx.telegram.getFileLink
  // 3. Use FFmpeg to convert .webm -> .mp4 or .webp -> .png
  // 4. ctx.replyWithVideo() or ctx.replyWithPhoto()

  await ctx.reply(`🛠️ (Demo) Extrayendo el sticker... Si estuviera activo FFmpeg, te enviaría el archivo original desempaquetado del sticker.`);
}
