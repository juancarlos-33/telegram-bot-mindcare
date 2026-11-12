import type { Context } from "telegraf";
import { prisma } from "./db.js";

export async function handleTopXpCommand(ctx: Context) {
  if (!prisma) {
    await ctx.reply("❌ Error conectando a la base de datos.");
    return;
  }

  const users = await prisma.user.findMany({
    orderBy: { xp: 'desc' },
    take: 10
  });

  if (!users.length) {
    await ctx.reply("Aún no hay nadie en el ranking de experiencia.");
    return;
  }

  const ranking = users.map((u, i) => 
    `${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🏅"} ${i + 1}. ${u.username ? '@' + u.username : u.firstName} - Lvl ${u.level} (${u.xp} XP)`
  ).join("\n");

  await ctx.reply(`🏆 **TOP 10 USUARIOS MÁS ACTIVOS (XP)** 🏆\n\n${ranking}`);
}

export async function handleTopMoneyCommand(ctx: Context) {
  if (!prisma) {
    await ctx.reply("❌ Error conectando a la base de datos.");
    return;
  }

  const users = await prisma.user.findMany({
    orderBy: { money: 'desc' },
    take: 10
  });

  if (!users.length) {
    await ctx.reply("Aún no hay nadie en el ranking de dinero.");
    return;
  }

  const ranking = users.map((u, i) => 
    `${i === 0 ? "🤑" : i === 1 ? "💰" : i === 2 ? "🪙" : "💸"} ${i + 1}. ${u.username ? '@' + u.username : u.firstName} - ${u.money} monedas`
  ).join("\n");

  await ctx.reply(`👑 **TOP 10 MÁS RICOS (ECONOMÍA)** 👑\n\n${ranking}`);
}
