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

    // 1. إذا طلب المستخدم تحويل لوكيل أو إداري
    if (text.includes('وكيل') || text.includes('مشرف') || text.includes('إدارة') || text.includes('إداري') || text.includes('شخص حقيقي') || text.includes('حدا يرد')) {
        await message.reply('تم تحويلك إلى أحد وكلاء الإدارة والدعم الفني المختصين. يرجى الانتظار قليلاً وسيتم خدمتك قريباً.');
        return;
    }

    // 2. إذا انحلت المشكلة أو شكر البوت (إغلاق التكت أو إنهاء المحادثة)
    if (text.includes('شكرا') || text.includes('انحلت') || text.includes('تسلم') || text.includes('يعطيك العافية') || text.includes('مش الحال')) {
        await message.reply('العفو يا غالي! الحمد لله أن مشكلتك انحلت. سيتم إغلاق التكت الآن، ولا تتردد في فتح تكت جديد لو احتجت أي شي ثاني. يوم سعيد!');
        
        // محاولة إغلاق التكت تلقائياً إذا كان اسم الروم فيه كلمة ticket
        setTimeout(async () => {
            try {
                if (message.channel.name && message.channel.name.includes('ticket')) {
                    await message.channel.delete();
                }
            } catch (e) {
                // في حال لم تكن صلاحيات البوت كافية لحذف الروم
            }
        }, 4000);
        return;
    }

    // 3. التفاعل البشري الذكي حسب الكلام
    if (text.includes('سب') || text.includes('شتم') || text.includes('رتبتي') || text.includes('انسرقت') || text.includes('احتراف')) {
        await message.reply('ولا يهمك يا غالي، حقك محفوظ. هل معك دليل أو صورة للمشكلة عشان نقدر نساعدك بشكل أسرع ونرجعلك حقك؟');
    } 
    else if (text.includes('مرحبا') || text.includes('السلام') || text.includes('هلا') || text.includes('السلام عليكم')) {
        await message.reply('وعليكم السلام ورحمة الله! أهلاً بك، معك مساعد الدعم. تفضل اطرح مشكلتك أو استفسارك عشان أقدر أحلها لك.');
    } 
    else {
        await message.reply('فهمت عليك. تفضل كمل، شو تفاصيل الموضوع أكثر عشان أساعدك خطوة بخطوة؟ وإذا بدك أحولك لإداري بس اطلب مني.');
    }
});

client.login(process.env.DISCORD_TOKEN);
