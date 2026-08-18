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

    const text = message.content.toLowerCase();

    // نظام ذكاء اصطناعي داخلي مخصص للتكتات والدعم الفني
    if (text.includes('سب') || text.includes('شتم') || text.includes('أهال') || text.includes('احترام')) {
        await message.reply('أهلاً بك يا غالي. نعتذر منك عما حدث، يرجى تزويدنا بصورة الشاشة (منشن الإدارة أو التكت) ليتم اتخاذ الإجراء اللازم بحق المسيء فوراً.');
    } 
    else if (text.includes('مشكلة') || text.includes('مساعدة') || text.includes('بدي')) {
        await message.reply('أهلاً بك في التكت! تفضل بوضع تفاصيل مشكلتك وسيقوم فريق الإدارة بالرد عليك بأقرب وقت.');
    } 
    else if (text.includes('مرحبا') || text.includes('السلام') || text.includes('هلا')) {
        await message.reply('وعليكم السلام ورحمة الله وبركاته! أهلاً بك في قسم التكتات، تفضل قل لنا كيف يمكننا مساعدتك اليوم؟');
    } 
    else {
        await message.reply(`تم استلام استفسارك: "${message.content}". جارِ مراجعة طلبك من قبل فريق الدعم الفني، يرجى الانتظار قليلاً.`);
    }
});

client.login(process.env.DISCORD_TOKEN);
