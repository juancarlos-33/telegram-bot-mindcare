import type { Context } from "telegraf";
import { prisma, ensureUser } from "./db.js";

export async function handleAfkCommand(ctx: Context, arg: string) {
  if (!prisma || !ctx.from) return;
  const dbUser = await ensureUser(ctx.from);
  if (!dbUser) return;

  const reason = arg || "Sin especificar";
  
  await prisma.user.update({
    where: { id: dbUser.id },
    data: { afkReason: reason, afkSince: new Date() }
  });

  await ctx.reply(`💤 @${ctx.from.username || ctx.from.first_name} ahora está AFK.\nMotivo: ${reason}`);
}

export async function checkAfkStatus(ctx: Context) {
  if (!prisma || !ctx.from) return;
  
  // 1. Remove AFK if the user sent a message
  const senderId = String(ctx.from.id);
  const dbSender = await prisma.user.findUnique({ where: { telegramId: senderId } });
  
  if (dbSender && dbSender.afkSince) {
    const timeAfk = Math.round((new Date().getTime() - dbSender.afkSince.getTime()) / 60000);
    await prisma.user.update({
      where: { id: dbSender.id },
      data: { afkReason: null, afkSince: null }
    });
    await ctx.reply(`👋 @${ctx.from.username || ctx.from.first_name} ya no está AFK.\nEstuvo inactivo por ${timeAfk} minutos.`);
  }

  // 2. Alert if someone mentions or replies to an AFK user
  const message = ctx.message as any;
  if (message && message.reply_to_message && message.reply_to_message.from) {
    const targetId = String(message.reply_to_message.from.id);
    const dbTarget = await prisma.user.findUnique({ where: { telegramId: targetId } });
    
    if (dbTarget && dbTarget.afkSince) {
      await ctx.reply(`⚠️ El usuario al que le respondes está AFK.\nMotivo: ${dbTarget.afkReason}`);
    }
  }
}
