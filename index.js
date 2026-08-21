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

const Groq = require("groq-sdk");

// ==============================
// Variables
// ==============================

const TOKEN = process.env.DISCORD_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!TOKEN) {
  console.log("❌ DISCORD_TOKEN غير موجود");
  process.exit(1);
}

if (!GROQ_API_KEY) {
  console.log("❌ GROQ_API_KEY غير موجود");
  process.exit(1);
}

// ==============================
// Groq
// ==============================

const groq = new Groq({
  apiKey: GROQ_API_KEY
});

// ==============================
// Discord
// ==============================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ==============================
// إعدادات السيرفر
// ==============================

const settings = new Map();

// لكل سيرفر:
// aiChat
// category

// ==============================
// أوامر Slash
// ==============================

const commands = [

  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("إرسال بانل الدعم"),

  new SlashCommandBuilder()
    .setName("ai-ticket")
    .setDescription("إرسال بانل AI Ticket"),

  new SlashCommandBuilder()
    .setName("ai-chat")
    .setDescription("تحديد شات AI")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("اختر شات AI")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ai-category")
    .setDescription("تحديد كاتيجوري التكتات")
    .addChannelOption(option =>
      option
        .setName("category")
        .setDescription("اختر كاتيجوري التكتات")
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ai-stats")
    .setDescription("عرض حالة AI"),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("عرض أوامر البوت")

].map(command => command.toJSON());

// ==============================
// تسجيل الأوامر
// ==============================

async function registerCommands() {

  try {

    const rest = new REST({
      version: "10"
    }).setToken(TOKEN);

    await rest.put(
      Routes.applicationCommands(client.user.id),
      {
        body: commands
      }
    );

    console.log("✅ تم تسجيل جميع الأوامر");

  } catch (error) {

    console.log(
      "❌ خطأ تسجيل الأوامر:",
      error
    );

  }

}

// ==============================
// AI
// ==============================

async function askAI(message) {

  try {

    const result =
      await groq.chat.completions.create({

        model: "llama-3.1-8b-instant",

        messages: [

          {
            role: "system",

            content:
              "أنت بوت دعم فني عربي داخل Discord. " +
              "ساعد المستخدم بطريقة واضحة ومختصرة وودية. " +
              "إذا قال المستخدم إن شخصاً سبه أو أساء إليه، " +
              "اطلب منه إرسال صورة أو دليل. " +
              "إذا كانت المشكلة تحتاج موظف دعم، أخبره أن يطلب تدخل الموظف."
          },

          {
            role: "user",
            content: message
          }

        ],

        temperature: 0.5,

        max_tokens: 600

      });

    return (
      result.choices?.[0]?.message?.content ||
      "❌ لم أستطع إنشاء رد."
    );

  } catch (error) {

    console.log("❌ GROQ ERROR:");

    console.log(error);

    return "❌ حدث خطأ في الذكاء الاصطناعي.";

  }

}

// ==============================
// جاهزية البوت
// ==============================

client.once("ready", async () => {

  console.log("");
  console.log("==============================");
  console.log("🤖 TicketAI");
  console.log(`👤 ${client.user.tag}`);
  console.log("🟢 Online");
  console.log("==============================");

  client.user.setActivity(
    "AI Support 🤖"
  );

  await registerCommands();

});

// ==============================
// إنشاء بانل
// ==============================

function ticketPanel() {

  const embed =
    new EmbedBuilder()

      .setTitle("🎫 AI Support")

      .setDescription(
        "تحتاج مساعدة؟\n\n" +
        "اضغط الزر بالأسفل لفتح تكت خاصة بك.\n\n" +
        "🤖 الذكاء الاصطناعي سيساعدك داخل التكت."
      )

      .setColor(0x5865F2)

      .setFooter({
        text: "TicketAI Support"
      });

  const row =
    new ActionRowBuilder()

      .addComponents(

        new ButtonBuilder()

          .setCustomId(
            "open_ai_ticket"
          )

          .setLabel(
            "فتح تكت AI"
          )

          .setEmoji("🎫")

          .setStyle(
            ButtonStyle.Primary
          )

      );

  return {

    embeds: [embed],

    components: [row]

  };

}

// ==============================
// Interactions
// ==============================

client.on(
  "interactionCreate",
  async interaction => {

    // ==========================
    // Slash Commands
    // ==========================

    if (
      interaction.isChatInputCommand()
    ) {

      if (!interaction.guild) {

        return interaction.reply({

          content:
            "❌ استخدم الأمر داخل السيرفر.",

          ephemeral: true

        });

      }

      const guildId =
        interaction.guild.id;

      // ========================
      // HELP
      // ========================

      if (
        interaction.commandName ===
        "help"
      ) {

        const embed =
          new EmbedBuilder()

            .setTitle(
              "🤖 TicketAI Help"
            )

            .setDescription(

              "`/panel` 🎫 إرسال بانل الدعم\n\n" +

              "`/ai-ticket` 🎫 إرسال بانل AI Ticket\n\n" +

              "`/ai-chat` 💬 تحديد شات AI\n\n" +

              "`/ai-category` 📁 تحديد كاتيجوري التكتات\n\n" +

              "`/ai-stats` 📊 حالة النظام\n\n" +

              "💬 البوت يرد تلقائياً فقط في شات AI المحدد وتكتاته."

            )

            .setColor(0x5865F2);

        return interaction.reply({

          embeds: [embed],

          ephemeral: true

        });

      }

      // ========================
      // صلاحيات الإدارة
      // ========================

      if (

        [
          "panel",
          "ai-ticket",
          "ai-chat",
          "ai-category"

        ].includes(
          interaction.commandName
        )

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

      }

      // ========================
      // AI CHAT
      // ========================

      if (
        interaction.commandName ===
        "ai-chat"
      ) {

        const channel =
          interaction.options.getChannel(
            "channel"
          );

        const old =
          settings.get(guildId) || {};

        settings.set(

          guildId,

          {

            ...old,

            aiChat:
              channel.id

          }

        );

        return interaction.reply({

          content:
            `✅ تم تحديد شات AI: ${channel}`,

          ephemeral: true

        });

      }

      // ========================
      // AI CATEGORY
      // ========================

      if (
        interaction.commandName ===
        "ai-category"
      ) {

        const category =
          interaction.options.getChannel(
            "category"
          );

        const old =
          settings.get(guildId) || {};

        settings.set(

          guildId,

          {

            ...old,

            category:
              category.id

          }

        );

        return interaction.reply({

          content:
            `✅ تم تحديد كاتيجوري AI: ${category}`,

          ephemeral: true

        });

      }

      // ========================
      // AI STATS
      // ========================

      if (
        interaction.commandName ===
        "ai-stats"
      ) {

        const data =
          settings.get(guildId) || {};

        const embed =
          new EmbedBuilder()

            .setTitle(
              "🤖 AI Stats"
            )

            .addFields(

              {

                name:
                  "🟢 البوت",

                value:
                  "Online",

                inline:
                  true

              },

              {

                name:
                  "💬 AI Chat",

                value:
                  data.aiChat
                    ? `<#${data.aiChat}>`
                    : "❌ غير محدد",

                inline:
                  true

              },

              {

                name:
                  "📁 Category",

                value:
                  data.category
                    ? `<#${data.category}>`
                    : "❌ غير محددة",

                inline:
                  true

              }

            )

            .setColor(
              0x57F287
            );

        return interaction.reply({

          embeds: [embed]

        });

      }

      // ========================
      // PANEL
      // ========================

      if (
        interaction.commandName ===
        "panel"
      ) {

        return interaction.reply(
          ticketPanel()
        );

      }

      // ========================
      // AI TICKET
      // ========================

      if (
        interaction.commandName ===
        "ai-ticket"
      ) {

        return interaction.reply(
          ticketPanel()
        );

      }

    }

    // ==========================
    // Buttons
    // ==========================

    if (
      interaction.isButton()
    ) {

      // ========================
      // فتح تكت
      // ========================

      if (
        interaction.customId ===
        "open_ai_ticket"
      ) {

        const guild =
          interaction.guild;

        const guildId =
          guild.id;

        const data =
          settings.get(guildId) || {};

        if (!data.category) {

          return interaction.reply({

            content:
              "❌ لم يتم تحديد الكاتيجوري.\nاستخدم `/ai-category` أولاً.",

            ephemeral: true

          });

        }

        // ======================
        // منع تكت مكررة
        // ======================

        const existing =
          guild.channels.cache.find(

            channel =>

              channel.type ===
                ChannelType.GuildText &&

              channel.topic ===
                `TICKETAI:${interaction.user.id}`

          );

        if (existing) {

          return interaction.reply({

            content:
              `❌ لديك تكت مفتوحة بالفعل: ${existing}`,

            ephemeral: true

          });

        }

        try {

          const ticket =
            await guild.channels.create({

              name:
                `ai-ticket-${interaction.user.username}`
                  .toLowerCase()
                  .replace(
                    /[^a-z0-9-]/g,
                    "-"
                  )
                  .slice(0, 70),

              type:
                ChannelType.GuildText,

              parent:
                data.category,

              topic:
                `TICKETAI:${interaction.user.id}`,

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

          // ======================
          // رسالة التكت
          // ======================

          const embed =
            new EmbedBuilder()

              .setTitle(
                "🤖 AI Support"
              )

              .setDescription(

                `أهلاً ${interaction.user} 👋\n\n` +

                "اكتب مشكلتك هنا وسيرد عليك الذكاء الاصطناعي.\n\n" +

                "إذا قال لك شخص كلاماً مسيئاً، أرسل صورة أو دليل.\n\n" +

                "🔒 عند الانتهاء اضغط إغلاق التكت."

              )

              .setColor(
                0x5865F2
              );

          const row =
            new ActionRowBuilder()

              .addComponents(

                new ButtonBuilder()

                  .setCustomId(
                    "close_ai_ticket"
                  )

                  .setLabel(
                    "إغلاق التكت"
                  )

                  .setEmoji(
                    "🔒"
                  )

                  .setStyle(
                    ButtonStyle.Danger
                  )

              );

          await ticket.send({

            content:
              `${interaction.user}`,

            embeds:
              [embed],

            components:
              [row]

          });

          return interaction.reply({

            content:
              `✅ تم فتح تكتك: ${ticket}`,

            ephemeral: true

          });

        } catch (error) {

          console.log(
            "❌ TICKET ERROR:",
            error
          );

          return interaction.reply({

            content:
              "❌ فشل إنشاء التكت. تأكد أن البوت لديه Manage Channels.",

            ephemeral: true

          });

        }

      }

      // ========================
      // إغلاق التكت
      // ========================

      if (
        interaction.customId ===
        "close_ai_ticket"
      ) {

        if (

          !interaction.channel.topic?.startsWith(
            "TICKETAI:"
          )

        ) {

          return interaction.reply({

            content:
              "❌ هذه ليست تكت AI.",

            ephemeral: true

          });

        }

        await interaction.reply(
          "🔒 سيتم إغلاق التكت خلال 3 ثوانٍ."
        );

        setTimeout(() => {

          interaction.channel
            .delete()
            .catch(() => {});

        }, 3000);

      }

    }

  }
);

// ==============================
// الرسائل
// ==============================

client.on(
  "messageCreate",
  async message => {

    if (message.author.bot)
      return;

    if (!message.guild)
      return;

    const data =
      settings.get(
        message.guild.id
      ) || {};

    // ==========================
    // AI CHAT
    // ==========================

    if (

      data.aiChat &&

      message.channel.id ===
        data.aiChat

    ) {

      await message.channel.sendTyping();

      const answer =
        await askAI(
          message.content
        );

      return message.reply({

        content:
          answer.slice(0, 1900),

        allowedMentions: {
          repliedUser: false
        }

      });

    }

    // ==========================
    // AI TICKET
    // ==========================

    if (

      message.channel.type ===
        ChannelType.GuildText &&

      message.channel.topic?.startsWith(
        "TICKETAI:"
      )

    ) {

      await message.channel.sendTyping();

      const answer =
        await askAI(
          message.content
        );

      return message.reply({

        content:
          answer.slice(0, 1900),

        allowedMentions: {
          repliedUser: false
        }

      });

    }

    // ==========================
    // كل شيء ثاني تجاهله
    // ==========================

  }
);

// ==============================
// Errors
// ==============================

process.on(
  "unhandledRejection",
  error => {

    console.log(
      "❌ Unhandled:",
      error
    );

  }
);

process.on(
  "uncaughtException",
  error => {

    console.log(
      "❌ Exception:",
      error
    );

  }
);

// ==============================
// LOGIN
// ==============================

client.login(TOKEN);
