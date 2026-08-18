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

    try {
        await message.channel.sendTyping();

        // الاتصال المباشر برابط OpenAI الرسمي
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: message.content }]
            })
        });

        const data = await response.json();

        if (data.choices && data.choices[0]) {
            await message.reply(data.choices[0].message.content);
        } else if (data.error) {
            await message.reply('خطأ من OpenAI: ' + data.error.message);
        } else {
            await message.reply('لم يتم الرد بشكل صحيح.');
        }

    } catch (err) {
        await message.reply('خطأ في الاتصال: ' + err.message);
    }
});

client.login(process.env.DISCORD_TOKEN);
