const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder } = require('discord.js');
const OpenAI = require('openai');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// إعداد الذكاء الاصطناعي
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const TOKEN = process.env.DISCORD_TOKEN;

// 1. أمر إرسال زر فتح التذكرة
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content === '!setup') {
        const embed = new EmbedBuilder()
            .setTitle('مركز الدعم الذكي | AI Support')
            .setDescription('تحتاج مساعدة؟ اضغط على الزر أدناه لفتح تذكرة وسيساعدك المساعد الذكي فوراً.')
            .setColor('#0099ff');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_ticket')
                .setLabel('فتح تذكرة جديدة 🎫')
                .setStyle(ButtonStyle.Success)
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete();
    }

    // 2. الذكاء الاصطناعي يرد داخل التكت
    if (message.channel.name.startsWith('ticket-')) {
        await message.channel.sendTyping();

        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "أنت مساعد دعم فني ذكي وودود جداً على ديسكورد. مهمتك مساعدة المستخدمين في حل مشاكلهم التقنية أو الإجابة على استفساراتهم باختصار ووضوح باللغة العربية." },
                    { role: "user", content: message.content }
                ],
            });

            const aiReply = completion.choices[0].message.content;
            await message.reply(aiReply);

        } catch (error) {
            console.error('خطأ في الذكاء الاصطناعي:', error);
            await message.reply('عذراً، حدث خطأ بسيط. يمكنك الضغط على "طلب وكيل" لتتواصل مع الإدارة مباشرة.');
        }
    }
});

// 3. التفاعل مع الأزرار (فتح، طلب وكيل، إغلاق)
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'open_ticket') {
        const channel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
        });

        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('call_agent').setLabel('طلب وكيل 👨‍💼').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق 🔒').setStyle(ButtonStyle.Danger)
        );

        await channel.send({
            content: `أهلاً بك <@${interaction.user.id}>! أنا المساعد الذكي. تفضل بطرح مشكلتك وسأحاول حلها. إذا احتجت بشرياً، اضغط "طلب وكيل".`,
            components: [actionRow]
        });

        await interaction.reply({ content: `✅ تم فتح تذكرتك هنا: ${channel}`, ephemeral: true });
    }

    if (interaction.customId === 'call_agent') {
        await interaction.reply({ content: '🚨 **تم طلب وكيل بنجاح!** سيقوم أحد مشرفي الإدارة بالدخول لمساعدتك قريباً.' });
    }

    if (interaction.customId === 'close_ticket') {
        await interaction.reply({ content: '🔒 جاري إغلاق التذكرة وحذف القناة...' });
        setTimeout(() => interaction.channel.delete(), 3000);
    }
});

client.once('ready', () => {
    console.log(`البوت الذكي شغال بنجاح: ${client.user.tag}`);
});

client.login(TOKEN);
