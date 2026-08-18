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

        // استخدام أحدث رابط Endpoint رسمي وثابت لـ Gemini
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: "أنت مساعد ذكي ومحترف لخدمة العملاء والدعم الفني في سيرفر ديسكورد. أجب على السؤال التالي بشكل مفيد ومباشر وبطريقة لطيفة: " + message.content }]
                }]
            })
        });

        const data = await response.json();

        if (data.candidates && data.candidates[0].content.parts[0].text) {
            await message.reply(data.candidates[0].content.parts[0].text);
        } else if (data.error) {
            await message.reply('خطأ من الذكاء الاصطناعي: ' + data.error.message);
        } else {
            await message.reply('عذراً، لم أتمكن من معالجة الرد.');
        }

    } catch (err) {
        await message.reply('خطأ في الاتصال: ' + err.message);
    }
});

client.login(process.env.DISCORD_TOKEN);
