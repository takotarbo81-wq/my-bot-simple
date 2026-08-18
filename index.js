const { Client, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

client.once('ready', () => {
    console.log(`Bot Ready: ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    try {
        await message.channel.sendTyping();
        
        // استخدام الطريقة الرسمية المعتمدة للمكتبة
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent("أنت مساعد دعم فني ذكي لخدمة التكتات في ديسكورد، أجب باختصار ولطف: " + message.content);
        const response = await result.response;
        
        await message.reply(response.text());
    } catch (error) {
        await message.reply('عذراً، حدث خطأ في النظام. تأكد من صحة مفتاح Gemini في ريلواي.');
    }
});

client.login(process.env.DISCORD_TOKEN);
