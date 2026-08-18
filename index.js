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

// 1. أمر إرسال البنر والأزرار
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content === '!ticket') {
        const embed = new EmbedBuilder()
            .setTitle('مركز الدعم | Support Center')
            .setDescription('Need help? Open a private ticket and our support team will assist you.\n\nتحتاج إلى مساعدة؟ افتح تذكرة خاصة وسيساعدك فريق الدعم.\n\nPlease include useful details so we can help faster.')
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

    // 2. رد الذكاء الاصطناعي الحقيقي داخل روم التكت
    if (message.channel.name && message.channel.name.startsWith('ticket-')) {
        try {
            await message.channel.sendTyping();

            const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: "أنت مساعد دعم فني ذكي وإنسان ودود جداً تعمل في تكتات ديسكورد. أجب على رسالة العضو التالية وحل مشكلته باختصار ولطف واحترافية عالية: " + message.content }]
                    }]
                })
            });

            const data = await response.json();

            if (data.candidates && data.candidates[0].content.parts[0].text) {
                let replyText = data.candidates[0].content.parts[0].text;
                
                // إذا أراد المستخدم إغلاق التكت أو شكر البوت
                if (message.content.toLowerCase().includes('شكرا') || message.content.toLowerCase().includes('انحلت')) {
                    replyText += "\n\n(سيتم إغلاق التكت تلقائياً، يوم سعيد!)";
                    await message.reply(replyText);
                    setTimeout(async () => {
                        try { await message.channel.delete(); } catch (e) {}
                    }, 4000);
                    return;
                }

                await message.reply(replyText);
            } else {
                await message.reply('أهلاً بك، معك مساعد الدعم. تفضل بطرح تفاصيل مشكلتك لأقوم بمساعدتك فوراً.');
            }

        } catch (err) {
            await message.reply('أهلاً بك، تم استلام رسالتك وجاهز لمساعدتك في حل المشكلة.');
        }
    }
});

// 3. إنشاء روم التكت عند الضغط على الزر
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'open_ticket') {
        await interaction.reply({ content: 'جاري إنشاء تذكرة خاصة لك...', ephemeral: true });

        try {
            const guild = interaction.guild;
            const channelName = `ticket-${interaction.user.username}`;
            
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

            await ticketChannel.send(`أهلاً بك يا ${interaction.user} في تذكرتك الخاصة! تفضل بطرح مشكلتك وسأقوم بمساعدتك فوراً كذكاء اصطناعي.`);
        } catch (error) {
            await interaction.followUp({ content: 'حدث خطأ أثناء إنشاء التذكرة، تأكد من صلاحيات البوت في السيرفر.', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
