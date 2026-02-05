import dotenv from "dotenv";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionsBitField } from "discord.js";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

const token = process.env.DISCORD_TOKEN;
const appId = process.env.DISCORD_APP_ID;
const guildIdsRaw = process.env.DISCORD_GUILD_IDS || process.env.DISCORD_GUILD_ID || "";
const guildIds = guildIdsRaw.split(/[\s,/]+/).filter(Boolean);
const commandGuildIdsRaw = process.env.DISCORD_COMMAND_GUILD_ID || process.env.DISCORD_COMMAND_GUILD_IDS || "";
const commandGuildIds = commandGuildIdsRaw.split(/[\s,/]+/).filter(Boolean);
const apiBase = process.env.API_BASE_URL || "http://localhost:4000";
const botApiToken = process.env.BOT_API_TOKEN;
const channelGuildId = process.env.DISCORD_CHANNEL_GUILD_ID || commandGuildIds[0] || guildIds[0];
const commandRoleId = process.env.DISCORD_COMMAND_ROLE_ID || "";

if (!token || !appId || guildIds.length === 0) {
  console.error("Missing DISCORD_TOKEN, DISCORD_APP_ID, or DISCORD_GUILD_ID(S)");
  process.exit(1);
}

if (!botApiToken) {
  console.error("Missing BOT_API_TOKEN");
  process.exit(1);
}

if (!commandRoleId) {
  console.error("Missing DISCORD_COMMAND_ROLE_ID");
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName("crea")
    .setDescription("Crea una nuova fazione")
    .addStringOption((option) =>
      option.setName("nome").setDescription("Nome fazione").setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("tipo")
        .setDescription("Gang o Mafia")
        .setRequired(true)
        .addChoices(
          { name: "Gang", value: "gang" },
          { name: "Mafia", value: "mafia" }
        )
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName("cancella")
    .setDescription("Cancella una sezione tramite ID categoria")
    .addStringOption((option) =>
      option.setName("category_id").setDescription("ID categoria Discord").setRequired(true)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName("compra")
    .setDescription("Recupera un ordine esistente tramite ID")
    .addStringOption((option) =>
      option.setName("id_ordine").setDescription("ID ordine").setRequired(true)
    )
    .toJSON(),
];

const rest = new REST({ version: "10" }).setToken(token);

try {
  const targetGuilds = commandGuildIds.length ? commandGuildIds : guildIds;
  for (const guildId of targetGuilds) {
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
  }
} catch (error) {
  console.warn("Command registration skipped:", error?.message || error);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

client.on("error", (err) => {
  console.error("Client error:", err);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (commandGuildIds.length && !commandGuildIds.includes(interaction.guildId)) return;
    if (!["compra", "crea", "cancella"].includes(interaction.commandName)) return;

  if (!interaction.member?.roles?.cache?.has(commandRoleId)) {
    await interaction.reply({ content: "Non hai i permessi", ephemeral: true });
    return;
  }

  const isPublic = interaction.commandName === "compra";
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: !isPublic });
    }
  } catch (err) {
    console.warn("Defer failed:", err?.message || err);
    return;
  }

  if (interaction.commandName === "crea") {
    const name = interaction.options.getString("nome", true).trim();
    const tipo = interaction.options.getString("tipo", true);
    const heart = tipo === "mafia" ? " 💙" : " 💚";
    const displayName = `${name}${heart}`;
    try {
      const guild = await client.guilds.fetch(channelGuildId);
      const me = await guild.members.fetchMe();
      if (!me.permissions.has([PermissionsBitField.Flags.ManageRoles, PermissionsBitField.Flags.ManageChannels])) {
        await interaction.editReply({ content: "Permessi bot insufficienti (Manage Roles/Channels)" });
        return;
      }

      const role = await guild.roles.create({
        name: displayName,
        mentionable: false
      });

      const overwrites = [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: role.id,
          allow: [PermissionsBitField.Flags.ViewChannel]
        }
      ];

      const category = await guild.channels.create({
        name: displayName,
        type: ChannelType.GuildCategory,
        permissionOverwrites: overwrites
      });

      const channelNames = [
        "📦｜ᴄᴀʀɪᴄʜɪ",
        "📝｜ʟɪsᴛᴀ-ғᴜʀᴛɪ",
        "🔫│ᴘᴜʟɪᴢɪᴀ-ᴀʀᴍɪ"
      ];
      for (const channelName of channelNames) {
        await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites: overwrites
        });
      }

      await interaction.editReply({
        content: `Fazione creata: ${displayName} + sezioni private create`
      });
    } catch (error) {
      await interaction.editReply({
        content: `Fazione creata: ${displayName} ma errore creazione sezioni`
      });
    }
    return;
  }

  if (interaction.commandName === "cancella") {
    const categoryId = interaction.options.getString("category_id", true).trim();

    try {
      const guild = await client.guilds.fetch(channelGuildId);
      const me = await guild.members.fetchMe();
      if (!me.permissions.has([PermissionsBitField.Flags.ManageRoles, PermissionsBitField.Flags.ManageChannels])) {
        await interaction.editReply({ content: "Permessi bot insufficienti (Manage Roles/Channels)" });
        return;
      }

      await guild.channels.fetch();
      await guild.roles.fetch();

      const category = await guild.channels.fetch(categoryId);
      if (!category || category.type !== ChannelType.GuildCategory) {
        await interaction.editReply({ content: "Categoria non trovata" });
        return;
      }

      const children = guild.channels.cache.filter((ch) => ch.parentId === categoryId);
      for (const child of children.values()) {
        await child.delete();
      }

      const roleToDelete = guild.roles.cache.find((role) => role.name === category.name);
      if (roleToDelete) {
        await roleToDelete.delete();
      }

      await category.delete();
      await interaction.editReply({ content: "Sezione cancellata" });
    } catch (error) {
      await interaction.editReply({ content: "Errore cancellazione sezione" });
    }
    return;
  }

  const orderId = interaction.options.getString("id_ordine", true);
  const res = await fetch(`${apiBase}/api/bot/orders/${orderId}`, {
    method: "GET",
    headers: {
      "x-bot-token": botApiToken
    }
  });

  if (!res.ok) {
    await interaction.editReply({ content: "Ordine non trovato" });
    return;
  }

  const order = await res.json();
  const items = order.items || [];

  const formatMoney = (value) =>
    new Intl.NumberFormat("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(value || 0));

  const filteredItems = items.filter((item) => item.name !== "Spedizione");

  const lines = filteredItems
    .map((item) => `${item.name} x${item.quantity} (${formatMoney(item.lineTotal)})`)
    .join("\n");


  const embed = new EmbedBuilder()
    .setTitle(`Ordine ${order.orderNumber ?? order.id}`)
    .setColor(0xff2d55)
    .setDescription(`Creato da <@${interaction.user.id}>`)
    .addFields(
      { name: "Oggetti", value: lines || "Nessun articolo" },
      {
        name: "Mano D'opera",
        value: formatMoney(100000),
        inline: true
      },
      { name: "Totale Soldi Sporchi", value: formatMoney(order.totalDirty), inline: true },
      { name: "Totale Soldi Puliti", value: formatMoney(order.totalClean), inline: true }
    )
    .setFooter({ text: `Creato il ${order.createdAt}` });

  await interaction.editReply({ embeds: [embed] });
});

client.login(token);
