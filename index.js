const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`بوت DeepSeek يعمل الآن كـ: ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    try {
        await message.channel.sendTyping();

        // إرسال الطلب مباشرة إلى خادم DeepSeek
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'user', content: message.content }
                ],
                stream: false
            })
        });

        const data = await response.json();
        
        if (data.choices && data.choices.length > 0) {
            const replyText = data.choices[0].message.content;
            await message.reply(replyText);
        } else {
            await message.reply('عذراً، لم أتمكن من الحصول على رد من DeepSeek.');
        }

    } catch (error) {
        console.error('خطأ في الاتصال:', error);
        await message.reply('عذراً، حدث خطأ أثناء الاتصال بخادم الذكاء الاصطناعي.');
    }
});

client.login(process.env.DISCORD_TOKEN);
