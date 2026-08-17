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
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'open_ticket') {
        const guild = interaction.guild;
        const userName = interaction.user.username;

        const channel = await guild.channels.create({
            name: `ticket-${userName}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                },
                {
                    id: client.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                },
            ],
        });

        const closeRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('إغلاق التذكرة 🔒')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('claim_ticket')
                    .setLabel('تحويل للدعم 👨‍💻')
                    .setStyle(ButtonStyle.Secondary)
            );

        await channel.send({
            content: `أهلاً بك <@${interaction.user.id}>! هذا تكت الدعم الخاص بك. تفضل بطرح مشكلتك وسيقوم البوت بمساعدتك.`,
            components: [closeRow]
        });

        await interaction.reply({ content: `تم فتح التذكرة الخاصة بك بنجاح: ${channel}`, ephemeral: true });
    }

    if (interaction.customId === 'close_ticket') {
        await interaction.reply({ content: 'جاري إغلاق التذكرة وحذف القناة...' });
        setTimeout(async () => {
            await interaction.channel.delete();
        }, 3000);
    }

    if (interaction.customId === 'claim_ticket') {
        await interaction.reply({ content: '🚨 تم تنبيه فريق الدعم والوكلاء للتدخل وحل المشكلة في أقرب وقت!' });
    }
});

client.once('ready', () => {
    console.log(`تم تشغيل نظام التذاكر بنجاح: ${client.user.tag}`);
});

client.login(TOKEN);

