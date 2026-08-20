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

// ===============================
// إعدادات
// ===============================

const TOKEN = process.env.DISCORD_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const MODEL = "llama-3.1-8b-instant";

// ===============================
// التحقق من المفاتيح
// ===============================

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN غير موجود");
  process.exit(1);
}

if (!GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY غير موجود");
  process.exit(1);
}

// ===============================
// Client
// ===============================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===============================
// إعدادات السيرفرات
// ===============================

const guildSettings = new Map();

// شكل البيانات:
// {
//   chatId: null,
//   categoryId: null,
//   tickets: Set()
// }

// ===============================
// الحصول على إعدادات السيرفر
// ===============================

function getSettings(guildId) {
  if (!guildSettings.has(guildId)) {
    guildSettings.set(guildId, {
      chatId: null,
      categoryId: null,
      tickets: new Set()
    });
  }

  return guildSettings.get(guildId);
}

// ===============================
// هل هذه AI Chat؟
// ===============================

function isAIChat(channel) {
  if (!channel || !channel.guild) {
    return false;
  }

  const settings =
    getSettings(channel.guild.id);

  return settings.chatId === channel.id;
}

// ===============================
// هل هذا AI Ticket؟
// ===============================

function isAITicket(channel) {
  if (!channel || !channel.guild) {
    return false;
  }

  const settings =
    getSettings(channel.guild.id);

  return settings.tickets.has(channel.id);
}

// ===============================
// أوامر Slash
// ===============================

const commands = [

  new SlashCommandBuilder()
    .setName("ai-chat")
    .setDescription("تحديد شات الذكاء الاصطناعي")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("الشات الذي يعمل فيه AI")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ai-category")
    .setDescription("تحديد كاتيجوري تكتات AI")
    .addChannelOption(option =>
      option
        .setName("category")
        .setDescription("كاتيجوري التكتات")
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ai-ticket")
    .setDescription("إرسال بانل تكتات AI"),

  new SlashCommandBuilder()
    .setName("ai-stats")
    .setDescription("عرض إحصائيات AI")

].map(command => command.toJSON());

// ===============================
// تشغيل البوت
// ===============================

client.once("ready", async () => {

  console.log("================================");
  console.log("🤖 AI Ticket Bot Online");
  console.log("🧠 Model: " + MODEL);
  console.log("================================");

  client.user.setActivity(
    "AI Support 🤖",
    {
      type: 3
    }
  );

  try {

    const rest =
      new REST({
        version: "10"
      }).setToken(TOKEN);

    await rest.put(
      Routes.applicationCommands(
        client.user.id
      ),
      {
        body: commands
      }
    );

    console.log(
      "✅ AI commands registered"
    );

  } catch (error) {

    console.error(
      "❌ Command registration error:",
      error
    );

  }
});

// ===============================
// Groq AI
// ===============================

async function askAI(message) {

  try {

    const response =
      await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",

          headers: {
            "Authorization":
              `Bearer ${GROQ_API_KEY}`,

            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({

            model: MODEL,

            messages: [

              {
                role: "system",

                content: `
أنت مساعد ذكاء اصطناعي داخل Discord.

تحدث بالعربية بشكل طبيعي.
افهم اللهجة الأردنية والعربية العامية.

ساعد المستخدم في:
- Discord
- السيرفرات
- الرتب
- القنوات
- البوتات
- التذاكر
- المشاكل التقنية

إذا كانت المشكلة تحتاج صورة:
اطلب من المستخدم إرسال Screenshot.

إذا كانت المشكلة تحتاج تدخل موظف:
أخبره أن يفتح تذكرة أو يطلب الدعم.

لا تدعي أنك شخص حقيقي.
لا تخترع معلومات.
لا تسب المستخدم.
لا تكرر نفس الكلام.
اجعل الرد واضحًا ومختصرًا.
`
              },

              {
                role: "user",
                content: message
              }

            ],

            temperature: 0.6,

            max_tokens: 400

          })
        }
      );

    const data =
      await response.json();

    if (!response.ok) {

      console.error(
        "❌ Groq Error:",
        data
      );

      return "❌ صار خطأ مؤقت بالذكاء الاصطناعي.";

    }

    return (
      data?.choices?.[0]
        ?.message?.content
        ?.trim()
      ||
      "❌ ما قدرت أفهم سؤالك."
    );

  } catch (error) {

    console.error(
      "❌ AI Error:",
      error
    );

    return "❌ تعذر الاتصال بالذكاء الاصطناعي.";

  }
}

// ===============================
// Slash Commands
// ===============================

client.on(
  "interactionCreate",
  async interaction => {

    if (!interaction.isChatInputCommand()) {
      return;
    }

    try {

      // =========================
      // AI CHAT
      // =========================

      if (
        interaction.commandName ===
        "ai-chat"
      ) {

        if (
          !interaction.memberPermissions.has(
            PermissionFlagsBits.Administrator
          )
        ) {

          return interaction.reply({
            content:
              "❌ تحتاج Administrator.",
            ephemeral: true
          });

        }

        const channel =
          interaction.options.getChannel(
            "channel"
          );

        const settings =
          getSettings(
            interaction.guild.id
          );

        settings.chatId =
          channel.id;

        await interaction.reply({
          content:
            `✅ تم تحديد ${channel} كشات AI.`,
          ephemeral: true
        });

        return;
      }

      // =========================
      // AI CATEGORY
      // =========================

      if (
        interaction.commandName ===
        "ai-category"
      ) {

        if (
          !interaction.memberPermissions.has(
            PermissionFlagsBits.Administrator
          )
        ) {

          return interaction.reply({
            content:
              "❌ تحتاج Administrator.",
            ephemeral: true
          });

        }

        const category =
          interaction.options.getChannel(
            "category"
          );

        const settings =
          getSettings(
            interaction.guild.id
          );

        settings.categoryId =
          category.id;

        await interaction.reply({
          content:
            `✅ تم تحديد ${category} ككاتيجوري AI.`,
          ephemeral: true
        });

        return;
      }

      // =========================
      // AI TICKET PANEL
      // =========================

      if (
        interaction.commandName ===
        "ai-ticket"
      ) {

        if (
          !interaction.memberPermissions.has(
            PermissionFlagsBits.Administrator
          )
        ) {

          return interaction.reply({
            content:
              "❌ تحتاج Administrator.",
            ephemeral: true
          });

        }

        const embed =
          new EmbedBuilder()

            .setTitle(
              "🤖 AI Support"
            )

            .setDescription(
              "تحتاج مساعدة؟\n\n" +
              "اضغط الزر بالأسفل لفتح تذكرة خاصة مع AI."
            )

            .setColor(0x5865f2)

            .setFooter({
              text:
                "AI Support System"
            });

        const row =
          new ActionRowBuilder()
            .addComponents(

              new ButtonBuilder()

                .setCustomId(
                  "ai_open_ticket"
                )

                .setLabel(
                  "فتح تذكرة"
                )

                .setEmoji("🎫")

                .setStyle(
                  ButtonStyle.Primary
                )

            );

        await interaction.reply({
          embeds: [embed],
          components: [row]
        });

        return;
      }

      // =========================
      // AI STATS
      // =========================

      if (
        interaction.commandName ===
        "ai-stats"
      ) {

        const settings =
          getSettings(
            interaction.guild.id
          );

        const chat =
          settings.chatId
            ? `<#${settings.chatId}>`
            : "غير محدد";

        const category =
          settings.categoryId
            ? `<#${settings.categoryId}>`
            : "غير محدد";

        const tickets =
          settings.tickets.size;

        const embed =
          new EmbedBuilder()

            .setTitle(
              "📊 AI Statistics"
            )

            .addFields(

              {
                name:
                  "🤖 AI Chat",
                value:
                  chat,
                inline: true
              },

              {
                name:
                  "📁 AI Category",
                value:
                  category,
                inline: true
              },

              {
                name:
                  "🎫 التكتات الحالية",
                value:
                  `${tickets}`,
                inline: true
              }

            )

            .setColor(
              0x5865f2
            );

        await interaction.reply({
          embeds: [embed]
        });

        return;
      }

    } catch (error) {

      console.error(
        "❌ Command error:",
        error
      );

    }

  }
);

// ===============================
// Buttons
// ===============================

client.on(
  "interactionCreate",
  async interaction => {

    if (!interaction.isButton()) {
      return;
    }

    // =========================
    // OPEN AI TICKET
    // =========================

    if (
      interaction.customId ===
      "ai_open_ticket"
    ) {

      try {

        const guild =
          interaction.guild;

        const settings =
          getSettings(
            guild.id
          );

        if (
          !settings.categoryId
        ) {

          return interaction.reply({
            content:
              "❌ لم يتم تحديد AI Category.\nاستخدم `/ai-category` أولًا.",
            ephemeral: true
          });

        }

        // -------------------------
        // منع تكتين
        // -------------------------

        const existing =
          [...settings.tickets]

            .map(id =>
              guild.channels.cache.get(id)
            )

            .find(channel => {

              if (!channel) {
                return false;
              }

              return (
                channel.topic ===
                `AIUser:${interaction.user.id}`
              );

            });

        if (existing) {

          return interaction.reply({
            content:
              `❌ لديك تكت AI مفتوح بالفعل: ${existing}`,
            ephemeral: true
          });

        }

        // -------------------------
        // إنشاء التكت
        // -------------------------

        const channel =
          await guild.channels.create({

            name:
              `ai-${interaction.user.username}`
                .toLowerCase()
                .replace(
                  /[^a-z0-9-_]/g,
                  "-"
                )
                .slice(0, 80),

            type:
              ChannelType.GuildText,

            parent:
              settings.categoryId,

            topic:
              `AIUser:${interaction.user.id}`,

            permissionOverwrites: [

              {
                id:
                  guild.roles.everyone.id,

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

                  PermissionFlagsBits.AttachFiles,

                  PermissionFlagsBits.EmbedLinks

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

        // -------------------------
        // تسجيل التكت
        // -------------------------

        settings.tickets.add(
          channel.id
        );

        // -------------------------
        // رسالة التكت
        // -------------------------

        const embed =
          new EmbedBuilder()

            .setTitle(
              "🤖 AI Support"
            )

            .setDescription(
              `مرحبًا ${interaction.user} 👋\n\n` +

              "اكتب مشكلتك هنا، والذكاء الاصطناعي سيساعدك.\n\n" +

              "📸 إذا كانت المشكلة تحتاج صورة، أرسل Screenshot.\n\n" +

              "🔒 لإغلاق التكت استخدم الزر بالأسفل."
            )

            .setColor(
              0x5865f2
            );

        const row =
          new ActionRowBuilder()
            .addComponents(

              new ButtonBuilder()

                .setCustomId(
                  "ai_close_ticket"
                )

                .setLabel(
                  "إغلاق التكت"
                )

                .setEmoji("🔒")

                .setStyle(
                  ButtonStyle.Danger
                )

            );

        await channel.send({

          content:
            `${interaction.user}`,

          embeds: [
            embed
          ],

          components: [
            row
          ]

        });

        await interaction.reply({

          content:
            `✅ تم فتح تكت AI: ${channel}`,

          ephemeral: true

        });

      } catch (error) {

        console.error(
          "❌ Ticket error:",
          error
        );

        await interaction.reply({
          content:
            "❌ ما قدرت أفتح التكت.",
          ephemeral: true
        });

      }

      return;
    }

    // =========================
    // CLOSE AI TICKET
    // =========================

    if (
      interaction.customId ===
      "ai_close_ticket"
    ) {

      const settings =
        getSettings(
          interaction.guild.id
        );

      if (
        !settings.tickets.has(
          interaction.channel.id
        )
      ) {

        return interaction.reply({
          content:
            "❌ هذا ليس AI Ticket تابعًا لي.",
          ephemeral: true
        });

      }

      await interaction.reply(
        "🔒 سيتم إغلاق التكت خلال 5 ثوانٍ..."
      );

      settings.tickets.delete(
        interaction.channel.id
      );

      setTimeout(
        async () => {

          try {

            await interaction.channel.delete();

          } catch (error) {

            console.error(
              "❌ Delete error:",
              error
            );

          }

        },
        5000
      );

    }

  }
);

// ===============================
// AI CHAT + AI TICKETS
// ===============================

client.on(
  "messageCreate",
  async message => {

    try {

      // لا ترد على البوتات
      if (message.author.bot) {
        return;
      }

      // لا DM
      if (!message.guild) {
        return;
      }

      // =========================
      // تحديد مكان الرد
      // =========================

      const allowed =
        isAIChat(message.channel) ||
        isAITicket(message.channel);

      // أهم شيء:
      // باقي الشاتات والتكتات = تجاهل

      if (!allowed) {
        return;
      }

      // =========================
      // تجاهل الأوامر
      // =========================

      if (
        message.content.startsWith("/")
      ) {
        return;
      }

      if (
        !message.content.trim()
      ) {
        return;
      }

      // =========================
      // Typing
      // =========================

      await message.channel
        .sendTyping()
        .catch(() => {});

      // =========================
      // AI
      // =========================

      const answer =
        await askAI(
          message.content
        );

      // =========================
      // إرسال الرد
      // =========================

      if (
        answer.length <= 1900
      ) {

        await message.reply({
          content:
            answer,

          allowedMentions: {
            repliedUser:
              false
          }
        });

      } else {

        const chunks =
          answer.match(
            /[\s\S]{1,1900}/g
          );

        for (
          const chunk
          of chunks
        ) {

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

  }
);

// ===============================
// أخطاء
// ===============================

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

// ===============================
// LOGIN
// ===============================

client.login(TOKEN);
