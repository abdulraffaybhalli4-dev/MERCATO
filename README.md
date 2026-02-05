# Mercato Nero

Sito gestionale con backend API, database SQLite e bot Discord.

## Funzionalità
- Famiglie: crea, modifica, elimina, storico calcoli.
- Calcolatore pulizia: importo + percentuale, salva nello storico.
- Resoconti: intervallo date, per famiglia e totale globale.
- Listino prezzi: articoli con tipo e prezzo unitario.
- Ordini: totale pulito, sporco = doppio, ID univoco.
- Bot Discord: comando /genera_ordine <id> con embed.

## Avvio rapido
1) Installa le dipendenze
- root: npm install

2) Backend
- npm run dev:server

3) Frontend
- npm run dev:web

4) Bot Discord (opzionale)
- Copia server/.env.example in server/.env e compila le variabili.
- npm run bot

## Variabili ambiente
- PORT (default 4000)
- DATABASE_FILE (default mercato-nero.sqlite)
- DISCORD_TOKEN
- DISCORD_APP_ID
- DISCORD_GUILD_ID
- DISCORD_CLIENT_ID
- DISCORD_CLIENT_SECRET
- DISCORD_REDIRECT_URI (default http://localhost:4000/api/auth/callback)
- DISCORD_BOT_TOKEN
- DISCORD_ROLE_ID
- SESSION_SECRET

## Accesso con Discord (solo utenti con ruolo)
1) Crea una App Discord e abilita OAuth2.
2) Imposta Redirect URI su: http://localhost:4000/api/auth/callback
3) Inserisci in server/.env: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DISCORD_ROLE_ID, SESSION_SECRET.
4) Avvia backend e frontend, poi clicca “Accedi con Discord”.

## Bot ordini (unificato)
Comando:
`/genera_ordine famiglia:"Nome Famiglia" oggetti:"Tirapugni:1, P90:2"`
Richiede il ruolo `GENERA_ORDINE_ROLE_ID`.
