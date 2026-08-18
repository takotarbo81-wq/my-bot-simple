const { Client, GatewayIntentBits } = require('discord.js');
const { GoogleGenAI } = require('@google/generative-ai');

// تهيئة بوت الديسكورد
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// تهيئة جوجل جيميني بالشكل الصحيح
const ai = new GoogleGenAI({});

client.once('ready', () => {
    console.log(`Bot is online as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content) {
        try {
            message.channel.sendTyping();
            
            // استدعاء الموديل بالطريقة الرسمية الصحيحة
            const response = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: message.content,
            });

            await message.reply(response.text);
        } catch (error) {
            console.error(error);
            await message.reply('عذراً، حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
