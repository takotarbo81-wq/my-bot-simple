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

        const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: "أنت مساعد دعم فني ذكي للتكتات، أجب باختصار ولطف: " + message.content }]
                }]
            })
        });

        const data = await response.json();

        if (data.candidates && data.candidates[0].content.parts[0].text) {
            await message.reply(data.candidates[0].content.parts[0].text);
        } else {
            // رد احتياطي فوري إذا حدث أي شي، حتى لا يتوقف البوت أبداً
            await message.reply('أهلاً بك في التكت، كيف يمكنني مساعدتك اليوم؟');
        }

    } catch (err) {
        await message.reply('أهلاً بك، تم استلام رسالتك وجاهز للمساعدة!');
    }
});

client.login(process.env.DISCORD_TOKEN);
