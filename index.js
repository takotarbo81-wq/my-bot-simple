const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const TOKEN = process.env.DISCORD_TOKEN;

// أوامر البوت الأساسية
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content === '!setup') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('open_ticket_menu').setLabel('فتح تذكرة دعم 🎫').setStyle(ButtonStyle.Success)
        );
        await message.channel.send({ content: 'مرحباً، اضغط الزر أدناه لفتح تذكرة:', components: [row] });
        await message.delete();
    }

    // الرد الذكي: إذا المستخدم كتب كلمة وكيل في أي وقت
    if (message.channel.name.startsWith('ticket-') && message.content.toLowerCase().includes('وكيل')) {
        message.reply('🚨 تم استدعاء الوكيل! سيقوم أحد أعضاء الإدارة بالرد عليك قريباً.');
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        // فتح قائمة الاختيارات
        if (interaction.customId === 'open_ticket_menu') {
            const menu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ticket_type')
                    .setPlaceholder('اختر نوع المشكلة...')
                    .addOptions([
                        { label: 'مشكلة تقنية', value: 'tech', emoji: '🛠️' },
                        { label: 'شكوى / وكيل', value: 'agent', emoji: '👨‍💼' }
                    ])
            );
            await interaction.reply({ content: 'اختر نوع التذكرة:', components: [menu], ephemeral: true });
        }

        // إغلاق التذكرة + تقييم
        if (interaction.customId === 'close_ticket') {
            const rateRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('rate_5').setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary)
            );
            await interaction.reply({ content: 'شكراً لاستخدامك الدعم! كيف تقيمنا؟', components: [rateRow] });
            setTimeout(() => interaction.channel.delete(), 5000);
        }
    }

    if (interaction.isStringSelectMenu()) {
        const guild = interaction.guild;
        const channel = await guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText
        });

        const controlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق 🔒').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('call_agent').setLabel('طلب وكيل 👨‍💼').setStyle(ButtonStyle.Primary)
        );

        await channel.send({ 
            content: `أهلاً ${interaction.user}، نوع الطلب: ${interaction.values[0]}.\nيرجى شرح مشكلتك. إذا أردت وكيل، اضغط الزر بالأسفل.`, 
            components: [controlRow] 
        });
        await interaction.update({ content: '✅ تم فتح التذكرة!', components: [] });
    }
});

client.login(TOKEN);
