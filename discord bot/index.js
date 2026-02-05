require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
} = require('discord.js');

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // OBBLIGATORIO
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const accessChannelName = (process.env.ACCESS_CHANNEL_NAME || 'access site').toLowerCase();

// ===== READY =====
client.once('ready', () => {
  console.log(`✅ Bot online come ${client.user.tag}`);
});

// ===== INTERACTIONS =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // ⏳ rispondi SUBITO (evita timeout)
  await interaction.deferReply({ ephemeral: true });

  try {
    const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (interaction.commandName === 'compra') {
      const orderRoleId = process.env.GENERA_ORDINE_ROLE_ID;
      const hasOrderRole = orderRoleId && interaction.member.roles.cache.has(orderRoleId);
      if (!isAdmin && !hasOrderRole) {
        return interaction.editReply('❌ Non hai i permessi');
      }
    } else if (!isAdmin) {
      return interaction.editReply('❌ Non hai i permessi');
    }

    // 🧾 gestisci compra
    if (interaction.commandName === 'compra') {
      const orderId = interaction.options.getString('id_ordine');
      const apiBase = process.env.API_BASE_URL || 'http://localhost:4000';
      const botApiToken = process.env.BOT_API_TOKEN;

      if (!botApiToken) {
        return interaction.editReply('❌ BOT_API_TOKEN mancante');
      }

      if (!orderId) {
        return interaction.editReply('❌ Inserisci ID ordine');
      }

      const res = await fetch(`${apiBase}/api/bot/orders/${orderId}`, {
        method: 'GET',
        headers: {
          'x-bot-token': botApiToken
        }
      });

      if (!res.ok) {
        const text = await res.text();
        return interaction.editReply(`❌ Errore recupero ordine: ${text}`);
      }

      const fullOrder = await res.json();
      if (!fullOrder || !fullOrder.id) {
        return interaction.editReply('❌ Ordine non trovato');
      }

      const shippingItem = fullOrder.items.find((item) => item.name === 'Spedizione');
      const filteredItems = fullOrder.items.filter((item) => item.name !== 'Spedizione');

      const lines = filteredItems
        .map(item => `${item.name} x${item.quantity} (${Number(item.lineTotal).toFixed(2)})`)
        .join('\n');

      return interaction.editReply({
        embeds: [
          {
            title: `Ordine ${fullOrder.orderNumber || fullOrder.id}`,
            description: `Recuperato da @dr7ip\n${lines || 'Nessun articolo'}`,
            fields: [
              { name: 'Famiglia', value: fullOrder.familyName, inline: true },
              {
                name: 'Spedizione',
                value: shippingItem ? Number(shippingItem.lineTotal).toFixed(2) : '0',
                inline: true
              },
              { name: 'Totale pulito', value: Number(fullOrder.totalClean).toFixed(2), inline: true },
              { name: 'Totale sporco', value: Number(fullOrder.totalDirty).toFixed(2), inline: true }
            ]
          }
        ]
      });
    }

    // 👤 ID utente
    const userId = interaction.options.getString('user_id');
    if (!userId) {
      return interaction.editReply('❌ ID utente non valido');
    }

    // 🔄 fetch membro dal server
    const membro = await interaction.guild.members.fetch(userId);

    // 🎭 ruolo accesso
    const roleId = process.env.ROLE_ID;
    const roleName = process.env.ROLE_NAME || 'AccessoSito';
    const ruolo = roleId
      ? interaction.guild.roles.cache.get(roleId)
      : interaction.guild.roles.cache.find(r => r.name === roleName);
    if (!ruolo) {
      return interaction.editReply('❌ Ruolo accesso non trovato');
    }

    // ✅ APPROVA
    if (interaction.commandName === 'approva') {
      await membro.roles.add(ruolo);
      return interaction.editReply(`✅ Accesso concesso a <@${userId}>`);
    }

    // 🚫 REVOCA
    if (interaction.commandName === 'revoca') {
      await membro.roles.remove(ruolo);
      return interaction.editReply(`🚫 Accesso revocato a <@${userId}>`);
    }

  } catch (err) {
    console.error('❌ ERRORE:', err);
    return interaction.editReply(
      '❌ Errore interno (controlla permessi e ordine ruoli)'
    );
  }
});

// ===== APPROVA VIA MESSAGGIO =====
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (message.channel?.name?.toLowerCase() !== accessChannelName) return;

  // 🔐 solo admin possono usare il canale
  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Non hai i permessi');
  }

  const userId = message.content.trim();
  if (!/^\d{15,20}$/.test(userId)) {
    return message.reply('❌ Inserisci un ID Discord valido');
  }

  try {
    const membro = await message.guild.members.fetch(userId);
    const roleId = process.env.ROLE_ID;
    const roleName = process.env.ROLE_NAME || 'AccessoSito';
    const ruolo = roleId
      ? message.guild.roles.cache.get(roleId)
      : message.guild.roles.cache.find(r => r.name === roleName);
    if (!ruolo) {
      return message.reply('❌ Ruolo accesso non trovato');
    }

    await membro.roles.add(ruolo);
    return message.reply(`✅ Accesso concesso a <@${userId}>`);
  } catch (err) {
    console.error('❌ ERRORE:', err);
    return message.reply('❌ Errore: utente non trovato o permessi insufficienti');
  }
});

// ===== LOGIN =====
client.login(process.env.TOKEN);

