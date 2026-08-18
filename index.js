const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');

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

    // 1. أمر البنر
    if (message.content === '!ticket') {
        const embed = new EmbedBuilder()
            .setTitle('مركز الدعم | Support Center')
            .setDescription('Need help? Open a private ticket and our support team will assist you.\n\nتحتاج إلى مساعدة؟ افتح تذكرة خاصة وسيساعدك فريق الدعم.')
            .setColor('#2b2d31');

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('open_ticket')
                    .setLabel('فتح تذكرة | Open Ticket')
                    .setStyle(ButtonStyle.Success)
            );

        await message.channel.send({ embeds: [embed], components: [row] });
        return;
    }

    // 2. الرد داخل التكت بشكل ذكي ومتنوع (بدون تكرار)
    if (message.channel.name && message.channel.name.startsWith('ticket-')) {
        const text = message.content.toLowerCase();

        if (text.includes('وكيل') || text.includes('مشرف') || text.includes('إدارة')) {
            await message.reply('تم تحويلك إلى أحد وكلاء الدعم الفني، يرجى الانتظار لحين رد الإدارة عليك.');
        } 
        else if (text.includes('شكرا') || text.includes('انحلت') || text.includes('تسلم')) {
            await message.reply('العفو! الحمد لله أن مشكلتك انحلت، سيتم إغلاق التكت الآن.');
            setTimeout(async () => {
                try { await message.channel.delete(); } catch (e) {}
            }, 3000);
        } 
        else if (text.includes('سب') || text.includes('شتم') || text.includes('رتبتي')) {
            await message.reply('ولا يهمك يا غالي، حقك محفوظ. هل لديك صورة أو دليل لما حدث لنتخذ الإجراء اللازم؟');
        } 
        else {
            await message.reply(`فهمت مشكلتك المتعلقة بـ ("${message.content}"). هل يمكنك تزويدي بتفاصيل أكثر لكي أتمكن من مساعدتك بحلها فوراً؟`);
        }
    }
});

// 3. إنشاء التكت عبر الزر
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'open_ticket') {
        await interaction.reply({ content: 'جاري إنشاء تذكرة خاصة لك...', ephemeral: true });

        try {
            const guild = interaction.guild;
            const channelName = `ticket-${interaction.user.username}-${Math.floor(Math.random() * 1000)}`;
            
            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                    },
                ],
            });

            await ticketChannel.send(`أهلاً بك يا ${interaction.user} في تذكرتك الخاصة! تفضل بطرح مشكلتك وسأكون هنا لمساعدتك خطوة بخطوة.`);
        } catch (error) {
            await interaction.followUp({ content: 'حدث خطأ أثناء إنشاء التذكرة، تأكد من صلاحيات البوت.', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
