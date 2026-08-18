const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`Bot is ready: ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    try {
        await message.channel.sendTyping();

        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: message.content }],
                stream: false
            })
        });

        const data = await response.json();

        if (data.choices && data.choices.length > 0) {
            await message.reply(data.choices[0].message.content);
        } else if (data.error) {
            await message.reply('خطأ من دييب سيك: ' + data.error.message);
        } else {لم أتمكن من الرد');
        }

    } catch (err) {
        await message.reply('حدث خطأ في الاتصال.');
    }
});

client.login(process.env.DISCORD_TOKEN);
