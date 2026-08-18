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

// تهيئة جوجل جيميني باستخدام مفتاح البيئة
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

client.once('ready', () => {
    console.log(`Bot is online as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // إذا تم عمل إشارة للبوت أو كتب في الخاص
    if (message.content) {
        try {
            message.channel.sendTyping();
            
            // استخدام نموذج جيميني لتوليد الرد
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: message.content,
            });

            await message.reply(response.text);
        } catch (error) {
            console.error(error);
            await message.reply('عذراً، حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.');
        }
    }
});

// تشغيل البوت باستخدام توكن ديسكورد
client.login(process.env.DISCORD_TOKEN);
