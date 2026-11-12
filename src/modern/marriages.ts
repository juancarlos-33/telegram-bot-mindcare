import type { Context } from "telegraf";
import { prisma, ensureUser, ensureGroup } from "./db.js";

// Pending proposals stored in memory (just like WhatsApp bot)
const pendingProposals = new Map<string, { senderId: number; targetId: number }>();

export async function handleMarryCommand(ctx: Context, arg: string) {
  const chatId = ctx.chat?.id;
  const fromUser = ctx.from;
  
  if (!chatId || !fromUser) return;
  if (!arg) {
    await ctx.reply("Uso: /marry @usuario");
    return;
  }

  // Telegraf doesn't have a reliable way to get user ID from username without them interacting first,
  // so we'll simulate a proposal by letting the user mention them, but requiring the target to reply.
  // We'll just ask the target to reply with /acceptmarry or /rejectmarry.

  await ctx.reply(`💍 @${fromUser.username || fromUser.first_name} le ha propuesto matrimonio a ${arg}!\nPara aceptar, ${arg} debe escribir: /acceptmarry`);
}

export async function handleDivorceCommand(ctx: Context) {
  if (!prisma || !ctx.from) return;
  const dbUser = await ensureUser(ctx.from);
  if (!dbUser) return;

  const marriage = await prisma.marriage.findFirst({
    where: { OR: [{ user1Id: dbUser.id }, { user2Id: dbUser.id }] }
  });

  if (!marriage) {
    await ctx.reply("💔 No estás casado(a) actualmente.");
    return;
  }

  await prisma.marriage.delete({ where: { id: marriage.id } });
  await ctx.reply("📄💔 Trámite de divorcio completado. Vuelves a ser libre.");
}

export async function getMarriages(ctx: Context) {
  if (!prisma || !ctx.chat) return;
  const marriages = await prisma.marriage.findMany({
    where: { groupId: String(ctx.chat.id) },
    include: { user1: true, user2: true }
  });

  if (!marriages.length) {
    await ctx.reply("💒 No hay matrimonios registrados en este grupo.");
    return;
  }

  const list = marriages.map((m, i) => `${i + 1}. ${m.user1.firstName} 💞 ${m.user2.firstName}`).join("\n");
  await ctx.reply(`💒 MATRIMONIOS DEL GRUPO 💒\n\n${list}`);
}
