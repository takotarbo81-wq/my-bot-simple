const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const TOKEN = process.env.DISCORD_TOKEN;

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // 1. أمر إرسال البنر والزر
    if (message.content === '!setup') {
        const embed = new EmbedBuilder()
            .setTitle('مركز الدعم | Support Center')
            .setDescription('Need help? Open a private ticket and our support team will assist you.\n\nتحتاج إلى مساعدة؟ افتح تذكرة خاصة وسيساعدك فريق الدعم.')
            .setColor('#0099ff');

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('open_ticket')
                    .setLabel('فتح تذكرة | Open Ticket')
                    .setStyle(ButtonStyle.Success)
            );

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete();
    }

    // 2. الرد الذكي داخل قنوات التكت
    if (message.channel.name.startsWith('ticket-')) {
        const content = message.content.toLowerCase();
        
        if (content.includes('سلام') || content.includes('مرحبا')) {
            message.reply('وعليكم السلام ورحمة الله! كيف يمكنني مساعدتك اليوم؟');
        } else if (content.includes('مشكلة')) {
            message.reply('أنا أسمعك، تفضل بشرح مشكلتك بالتفصيل وسأحاول مساعدتك.');
        } else {
            message.reply('تم استلام رسالتك، الدعم الفني سيقوم بالرد عليك قريباً.');
        }
    }
});

// 3. التفاعل مع الأزرار (فتح وإغلاق التذكرة)
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'open_ticket') {
        const channel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            ],
        });

        await channel.send({
            content: `أهلاً <@${interaction.user.id}>! تفضل بطرح مشكلتك.`,
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق 🔒').setStyle(ButtonStyle.Danger)
                )
            ]
        });
        await interaction.reply({ content: `تم فتح تذكرتك هنا: ${channel}`, ephemeral: true });
    }

    if (interaction.customId === 'close_ticket') {
        await interaction.reply('جاري إغلاق التذكرة...');
        setTimeout(() => interaction.channel.delete(), 3000);
    }
});

client.once('ready', () => {
    console.log(`تم تشغيل نظام التذاكر بنجاح: ${client.user.tag}`);
});

client.login(TOKEN);

    

