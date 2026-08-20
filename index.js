require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

// ==============================
// ENV
// ==============================

const TOKEN = process.env.DISCORD_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN غير موجود");
  process.exit(1);
}

if (!GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY غير موجود");
  process.exit(1);
}

if (!GUILD_ID) {
  console.error("❌ GUILD_ID غير موجود");
  process.exit(1);
}

// ==============================
// CLIENT
// ==============================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ==============================
// SETTINGS
// ==============================

const settings = {
  aiChatId: null,
  aiCategoryId: null,
  aiTickets: new Set(),
  messages: 0
};

// ==============================
// COMMANDS
// ==============================

const commands = [

  new SlashCommandBuilder()
    .setName("ai-chat")
    .setDescription("تحديد شات الذكاء الاصطناعي")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("اختر شات AI")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ai-category")
    .setDescription("تحديد كاتيجوري تكتات AI")
    .addChannelOption(option =>
      option
        .setName("category")
        .setDescription("اختر كاتيجوري التكتات")
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ai-ticket")
    .setDescription("إرسال بانل تكت AI"),

  new SlashCommandBuilder()
    .setName("ai-stats")
    .setDescription("عرض إحصائيات AI"),

  new SlashCommandBuilder()
    .setName("ai-reset")
    .setDescription("إعادة إعدادات AI")

].map(command => command.toJSON());

// ==============================
// READY
// ==============================

client.once("ready", async () => {

  console.log("");
  console.log("================================");
  console.log("🤖 AI BOT ONLINE");
  console.log(`👤 ${client.user.tag}`);
  console.log("================================");

  try {

    const rest = new REST({
      version: "10"
    }).setToken(TOKEN);

    console.log("⏳ تسجيل أوامر السيرفر...");

    const result = await rest.put(
      Routes.applicationGuildCommands(
        client.user.id,
        GUILD_ID
      ),
      {
        body: commands
      }
    );

    console.log(
      `✅ تم تسجيل ${result.length} أوامر`
    );

    console.log(
      `🏠 Guild ID: ${GUILD_ID}`
    );

  } catch (error) {

    console.error("❌ خطأ تسجيل الأوامر:");

    if (error?.rawError) {
      console.error(error.rawError);
    } else {
      console.error(error);
    }
  }

  client.user.setPresence({
    activities: [
      {
        name: "AI Support 🤖",
        type: 3
      }
    ],
    status: "online"
  });

});

// ==============================
// CHECK ADMIN
// ==============================

function isAdmin(interaction) {

  return interaction.memberPermissions?.has(
    PermissionFlagsBits.Administrator
  );
}

// ==============================
// GROQ AI
// ==============================

async function askAI(userMessage) {

  try {

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },

        body: JSON.stringify({

          model: "llama-3.1-8b-instant",

          messages: [

            {
              role: "system",

              content: `
أنت مساعد دعم فني داخل سيرفر Discord.

تكلم بالعربية وباللهجة الأردنية عندما يكون ذلك مناسبًا.

ساعد المستخدم في:
- Discord
- السيرفرات
- الرتب
- التكتات
- البوتات
- المشاكل التقنية

إذا قال المستخدم إن شخصًا سبه:
اطلب منه إرسال صورة أو دليل.

إذا قال إن شخصًا سحب رتبته:
اطلب منه شرح المشكلة وإرسال صورة إذا لزم.

إذا كانت المشكلة تحتاج تدخل موظف:
قل له أن يطلب تحويل المشكلة للدعم.

كن مختصرًا وواضحًا.

لا تدّعي أنك موظف حقيقي.
لا تخترع صلاحيات.
لا تسب المستخدم.
` 
            },

            {
              role: "user",
              content: userMessage
            }

          ],

          temperature: 0.5,

          max_tokens: 500

        })
      }
    );

    const data = await response.json();

    if (!response.ok) {

      console.error("❌ GROQ ERROR:", data);

      return "❌ صار خطأ مؤقت بالذكاء الاصطناعي، حاول مرة ثانية.";
    }

    const answer =
      data?.choices?.[0]?.message?.content;

    if (!answer) {
      return "❌ ما قدرت أطلع رد.";
    }

    return answer.trim();

  } catch (error) {

    console.error("❌ AI CONNECTION ERROR:", error);

    return "❌ ما قدرت أتصل بالذكاء الاصطناعي حاليًا.";
  }
}

// ==============================
// INTERACTIONS
// ==============================

client.on("interactionCreate", async interaction => {

  try {

    // =================================
    // SLASH COMMANDS
    // =================================

    if (interaction.isChatInputCommand()) {

      if (!isAdmin(interaction)) {

        return interaction.reply({
          content: "❌ تحتاج Administrator لاستخدام هذا الأمر.",
          ephemeral: true
        });

      }

      // ==============================
      // AI CHAT
      // ==============================

      if (interaction.commandName === "ai-chat") {

        const channel =
          interaction.options.getChannel("channel");

        settings.aiChatId = channel.id;

        return interaction.reply({
          content:
            `✅ تم تحديد شات AI:\n${channel}`,
          ephemeral: true
        });
      }

      // ==============================
      // AI CATEGORY
      // ==============================

      if (interaction.commandName === "ai-category") {

        const category =
          interaction.options.getChannel("category");

        settings.aiCategoryId =
          category.id;

        return interaction.reply({
          content:
            `✅ تم تحديد كاتيجوري AI:\n${category}`,
          ephemeral: true
        });
      }

      // ==============================
      // AI TICKET PANEL
      // ==============================

      if (interaction.commandName === "ai-ticket") {

        if (!settings.aiCategoryId) {

          return interaction.reply({
            content:
              "❌ حدد AI Category أولًا باستخدام `/ai-category`.",
            ephemeral: true
          });
        }

        const embed =
          new EmbedBuilder()

            .setTitle("🤖 الدعم الفني AI")

            .setDescription(
              "تحتاج مساعدة؟\n\n" +
              "اضغط الزر بالأسفل لفتح تذكرة مع مساعد الذكاء الاصطناعي."
            )

            .setColor(0x5865f2);

        const row =
          new ActionRowBuilder()
            .addComponents(

              new ButtonBuilder()
                .setCustomId("open_ai_ticket")
                .setLabel("فتح تذكرة")
                .setEmoji("🎫")
                .setStyle(ButtonStyle.Primary)

            );

        return interaction.reply({
          embeds: [embed],
          components: [row]
        });
      }

      // ==============================
      // AI STATS
      // ==============================

      if (interaction.commandName === "ai-stats") {

        return interaction.reply({

          embeds: [

            new EmbedBuilder()

              .setTitle("📊 AI Statistics")

              .addFields(

                {
                  name: "🤖 AI Chat",
                  value:
                    settings.aiChatId
                      ? `<#${settings.aiChatId}>`
                      : "❌ غير محدد",
                  inline: true
                },

                {
                  name: "📁 AI Category",
                  value:
                    settings.aiCategoryId
                      ? `<#${settings.aiCategoryId}>`
                      : "❌ غير محددة",
                  inline: true
                },

                {
                  name: "🎫 AI Tickets",
                  value:
                    `${settings.aiTickets.size}`,
                  inline: true
                },

                {
                  name: "💬 AI Messages",
                  value:
                    `${settings.messages}`,
                  inline: true
                }

              )

              .setColor(0x5865f2)

          ]

        });
      }

      // ==============================
      // RESET
      // ==============================

      if (interaction.commandName === "ai-reset") {

        settings.aiChatId = null;
        settings.aiCategoryId = null;

        return interaction.reply({
          content:
            "♻️ تم إعادة إعدادات AI.",
          ephemeral: true
        });
      }
    }

    // =================================
    // BUTTONS
    // =================================

    if (interaction.isButton()) {

      // ==============================
      // OPEN TICKET
      // ==============================

      if (
        interaction.customId ===
        "open_ai_ticket"
      ) {

        if (!settings.aiCategoryId) {

          return interaction.reply({
            content:
              "❌ AI Category غير محددة.",
            ephemeral: true
          });
        }

        // منع تكتين
        const oldTicket =
          [...settings.aiTickets]
            .map(id =>
              interaction.guild.channels.cache.get(id)
            )
            .find(channel => {

              if (!channel) return false;

              return channel.topic ===
                `AI_OWNER:${interaction.user.id}`;

            });

        if (oldTicket) {

          return interaction.reply({
            content:
              `❌ عندك تكت مفتوحة بالفعل: ${oldTicket}`,
            ephemeral: true
          });
        }

        // ==============================
        // CREATE CHANNEL
        // ==============================

        const ticket =
          await interaction.guild.channels.create({

            name:
              `ai-${interaction.user.username}`
                .toLowerCase()
                .replace(/[^a-z0-9-_]/g, "-")
                .slice(0, 70),

            type: ChannelType.GuildText,

            parent:
              settings.aiCategoryId,

            topic:
              `AI_OWNER:${interaction.user.id}`,

            permissionOverwrites: [

              {
                id:
                  interaction.guild.roles.everyone.id,

                deny: [
                  PermissionFlagsBits.ViewChannel
                ]
              },

              {
                id:
                  interaction.user.id,

                allow: [

                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.AttachFiles

                ]
              },

              {
                id:
                  client.user.id,

                allow: [

                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.ManageChannels

                ]
              }

            ]

          });

        settings.aiTickets.add(
          ticket.id
        );

        // ==============================
        // TICKET MESSAGE
        // ==============================

        const embed =
          new EmbedBuilder()

            .setTitle("🤖 AI Support")

            .setDescription(
              `أهلًا ${interaction.user} 👋\n\n` +
              "اكتب مشكلتك هنا وسأساعدك.\n\n" +
              "📸 إذا احتجت إثباتًا، أرسل صورة.\n" +
              "🎫 هذه التذكرة خاصة بنظام AI."
            )

            .setColor(0x5865f2);

        const row =
          new ActionRowBuilder()
            .addComponents(

              new ButtonBuilder()
                .setCustomId("close_ai_ticket")
                .setLabel("إغلاق التكت")
                .setEmoji("🔒")
                .setStyle(ButtonStyle.Danger)

            );

        await ticket.send({
          content:
            `${interaction.user}`,
          embeds: [embed],
          components: [row]
        });

        return interaction.reply({
          content:
            `✅ تم فتح تكت AI: ${ticket}`,
          ephemeral: true
        });
      }

      // ==============================
      // CLOSE TICKET
      // ==============================

      if (
        interaction.customId ===
        "close_ai_ticket"
      ) {

        if (
          !settings.aiTickets.has(
            interaction.channel.id
          )
        ) {

          return interaction.reply({
            content:
              "❌ هذا ليس AI Ticket.",
            ephemeral: true
          });
        }

        await interaction.reply(
          "🔒 سيتم إغلاق التكت بعد 3 ثوانٍ..."
        );

        settings.aiTickets.delete(
          interaction.channel.id
        );

        setTimeout(async () => {

          try {
            await interaction.channel.delete();
          } catch (error) {
            console.error(
              "❌ Ticket delete error:",
              error
            );
          }

        }, 3000);

      }
    }

  } catch (error) {

    console.error(
      "❌ Interaction error:",
      error
    );

  }

});

// ==============================
// MESSAGE AI
// ==============================

client.on("messageCreate", async message => {

  try {

    // لا يرد على البوتات
    if (message.author.bot) return;

    // لازم سيرفر
    if (!message.guild) return;

    // =================================
    // AI CHAT فقط
    // =================================

    const inAIChat =
      settings.aiChatId ===
      message.channel.id;

    // =================================
    // AI TICKET فقط
    // =================================

    const inAITicket =
      settings.aiTickets.has(
        message.channel.id
      );

    // =================================
    // أي مكان ثاني = تجاهل
    // =================================

    if (!inAIChat && !inAITicket) {
      return;
    }

    if (!message.content.trim()) {
      return;
    }

    settings.messages++;

    await message.channel.sendTyping();

    const answer =
      await askAI(
        message.content
      );

    // Discord max 2000 chars
    if (answer.length <= 1900) {

      await message.reply({
        content: answer,
        allowedMentions: {
          repliedUser: false
        }
      });

    } else {

      const chunks =
        answer.match(/[\s\S]{1,1900}/g);

      for (const chunk of chunks) {

        await message.channel.send(
          chunk
        );

      }
    }

  } catch (error) {

    console.error(
      "❌ Message error:",
      error
    );

  }

});

// ==============================
// ERRORS
// ==============================

process.on(
  "unhandledRejection",
  error => {
    console.error(
      "❌ Unhandled Rejection:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  error => {
    console.error(
      "❌ Uncaught Exception:",
      error
    );
  }
);

// ==============================
// LOGIN
// ==============================

client.login(TOKEN);
