const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const Groq = require("groq-sdk");

// ===============================
// ENV
// ===============================

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN غير موجود");
  process.exit(1);
}

if (!GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY غير موجود");
  process.exit(1);
}

// ===============================
// CLIENT
// ===============================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const groq = new Groq({
  apiKey: GROQ_API_KEY
});

// ===============================
// COMMANDS
// ===============================

const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("إنشاء لوحة التكت"),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("فحص البوت"),

  new SlashCommandBuilder()
    .setName("close")
    .setDescription("إغلاق التكت")
].map(command => command.toJSON());

// ===============================
// READY
// ===============================

client.once("ready", async () => {
  console.log("================================");
  console.log(`✅ البوت شغال: ${client.user.tag}`);
  console.log(`🆔 ID: ${client.user.id}`);
  console.log("================================");

  try {
    const rest = new REST({ version: "10" })
      .setToken(DISCORD_TOKEN);

    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log("✅ تم تسجيل أوامر Slash");
  } catch (error) {
    console.error("❌ خطأ تسجيل الأوامر:", error);
  }

  client.user.setPresence({
    activities: [
      {
        name: "🎫 التكتات",
        type: 3
      }
    ],
    status: "online"
  });
});

// ===============================
// INTERACTIONS
// ===============================

client.on("interactionCreate", async interaction => {
  try {

    // =============================
    // SLASH COMMANDS
    // =============================

    if (interaction.isChatInputCommand()) {

      // PING
      if (interaction.commandName === "ping") {

        return interaction.reply({
          content: `🏓 Pong!\n⚡ Ping: ${client.ws.ping}ms`,
          ephemeral: true
        });
      }

      // SETUP
      if (interaction.commandName === "setup") {

        if (
          !interaction.memberPermissions.has(
            PermissionsBitField.Flags.ManageGuild
          )
        ) {
          return interaction.reply({
            content: "❌ تحتاج صلاحية Manage Server.",
            ephemeral: true
          });
        }

        const embed = new EmbedBuilder()
          .setTitle("🎫 Ticket AI")
          .setDescription(
            "مرحباً بك في الدعم الفني.\n\n" +
            "اضغط الزر بالأسفل لفتح تكت.\n" +
            "🤖 الذكاء الاصطناعي سيساعدك داخل التكت."
          )
          .setFooter({
            text: "Ticket AI"
          });

        const button = new ButtonBuilder()
          .setCustomId("open_ticket")
          .setLabel("فتح تكت")
          .setEmoji("🎫")
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder()
          .addComponents(button);

        await interaction.channel.send({
          embeds: [embed],
          components: [row]
        });

        return interaction.reply({
          content: "✅ تم إنشاء لوحة التكت.",
          ephemeral: true
        });
      }

      // CLOSE COMMAND
      if (interaction.commandName === "close") {

        if (
          !interaction.channel ||
          !interaction.channel.name.startsWith("ticket-")
        ) {
          return interaction.reply({
            content: "❌ هذا الأمر يعمل داخل التكت فقط.",
            ephemeral: true
          });
        }

        await interaction.reply(
          "🔒 سيتم إغلاق التكت خلال 3 ثواني..."
        );

        setTimeout(() => {
          interaction.channel.delete().catch(() => {});
        }, 3000);

        return;
      }
    }

    // =============================
    // BUTTONS
    // =============================

    if (interaction.isButton()) {

      // OPEN TICKET
      if (interaction.customId === "open_ticket") {

        const guild = interaction.guild;
        const user = interaction.user;

        const existingTicket = guild.channels.cache.find(
          channel =>
            channel.type === ChannelType.GuildText &&
            channel.name === `ticket-${user.id}`
        );

        if (existingTicket) {
          return interaction.reply({
            content: `❌ عندك تكت مفتوح بالفعل: ${existingTicket}`,
            ephemeral: true
          });
        }

        const ticket = await guild.channels.create({
          name: `ticket-${user.id}`,
          type: ChannelType.GuildText,

          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,

              deny: [
                PermissionsBitField.Flags.ViewChannel
              ]
            },

            {
              id: user.id,

              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory
              ]
            },

            {
              id: client.user.id,

              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.ManageChannels
              ]
            }
          ]
        });

        const embed = new EmbedBuilder()
          .setTitle("🎫 تكت الدعم")
          .setDescription(
            `أهلاً ${user} 👋\n\n` +
            "اكتب مشكلتك هنا.\n" +
            "🤖 سيقوم Ticket AI بمساعدتك.\n\n" +
            "عند الانتهاء اضغط **إغلاق التكت**."
          );

        const closeButton = new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("إغلاق التكت")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder()
          .addComponents(closeButton);

        await ticket.send({
          content: `${user}`,
          embeds: [embed],
          components: [row]
        });

        return interaction.reply({
          content: `✅ تم فتح التكت: ${ticket}`,
          ephemeral: true
        });
      }

      // CLOSE BUTTON
      if (interaction.customId === "close_ticket") {

        if (
          !interaction.channel ||
          !interaction.channel.name.startsWith("ticket-")
        ) {
          return interaction.reply({
            content: "❌ هذا ليس تكت.",
            ephemeral: true
          });
        }

        await interaction.reply(
          "🔒 سيتم إغلاق التكت خلال 3 ثواني..."
        );

        setTimeout(() => {
          interaction.channel.delete().catch(() => {});
        }, 3000);
      }
    }

  } catch (error) {

    console.error("❌ Interaction Error:", error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ حدث خطأ.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// ===============================
// AI داخل التكت
// ===============================

client.on("messageCreate", async message => {

  if (message.author.bot) return;

  if (!message.guild) return;

  // فقط داخل التكت
  if (!message.channel.name?.startsWith("ticket-")) {
    return;
  }

  try {

    await message.channel.sendTyping();

    const completion = await groq.chat.completions.create({

      model: "llama-3.3-70b-versatile",

      messages: [
        {
          role: "system",
          content:
            "أنت Ticket AI مساعد دعم فني داخل Discord. " +
            "تحدث بالعربية بشكل واضح ومختصر. " +
            "ساعد المستخدم في حل مشكلته. " +
            "لا تدّعي أنك إنسان. " +
            "إذا لم تعرف الإجابة قل ذلك بصراحة."
        },

        {
          role: "user",
          content: message.content
        }
      ],

      temperature: 0.7,
      max_tokens: 1000
    });

    const answer =
      completion.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      return message.channel.send(
        "⚠️ ما قدرت أطلع إجابة."
      );
    }

    // Discord يسمح برسائل حتى 2000 حرف
    const chunks = answer.match(/[\s\S]{1,1900}/g) || [];

    for (const chunk of chunks) {
      await message.channel.send(chunk);
    }

  } catch (error) {

    console.error("❌ Groq Error:");

    console.error(error);

    await message.channel.send(
      "⚠️ صار خطأ أثناء الاتصال بالذكاء الاصطناعي."
    ).catch(() => {});
  }
});

// ===============================
// ERRORS
// ===============================

process.on("unhandledRejection", error => {
  console.error("❌ Unhandled Rejection:", error);
});

process.on("uncaughtException", error => {
  console.error("❌ Uncaught Exception:", error);
});

// ===============================
// LOGIN
// ===============================

client.login(DISCORD_TOKEN);
