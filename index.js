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
    console.log(`Bot is online as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content) {
        try {
            message.channel.sendTyping();
            
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const result = await model.generateContent(message.content);
            const response = await result.response;
            
            await message.reply(response.text());
        } catch (error) {
            console.error(error);
            await message.reply('عذراً، حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
