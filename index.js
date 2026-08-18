const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`Bot Ready: ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // رد تجريبي مباشر للتأكد من أن البوت شغال 100%
    await message.reply(`أهلاً بكِ! لقد استلمت رسالتك: "${message.content}"`);
});

client.login(process.env.DISCORD_TOKEN);
