const { Client, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// تهيئة مفتاح الذكاء الاصطناعي
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

client.once('ready', () => {
    console.log(`البوت يعمل الآن: ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    try {
        message.channel.sendTyping();
        
        // استخدام gemini-pro وهو موديل عام ومستقر
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(message.content);
        const response = await result.response;
        const text = response.text();
        
        await message.reply(text);
    } catch (error) {
        console.error('خطأ في الذكاء الاصطناعي:', error);
        await message.reply('عذراً، لا أستطيع الرد حالياً، تأكدي من مفتاح API في إعدادات ريلواي.');
    }
});

client.login(process.env.DISCORD_TOKEN);
