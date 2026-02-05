require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('approva')
    .setDescription('Concede accesso al sito')
    .addStringOption(option =>
      option
        .setName('user_id')
        .setDescription('ID Discord utente da approvare')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('revoca')
    .setDescription('Revoca accesso al sito')
    .addStringOption(option =>
      option
        .setName('user_id')
        .setDescription('ID Discord utente da revocare')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('compra')
    .setDescription('Completa un ordine esistente tramite ID')
    .addStringOption(option =>
      option
        .setName('id_ordine')
        .setDescription('ID numerico dell\'ordine')
        .setRequired(true)
    ),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands }
  );
  console.log('✅ Comandi registrati');
})();
