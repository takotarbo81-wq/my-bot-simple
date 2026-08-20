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
  SlashCommandBuilder
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const GROQ_KEY = process.env.GROQ_API_KEY;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN) {
  console.log("❌ DISCORD_TOKEN ناقص");
  process.exit(1);
}

if (!GROQ_KEY) {
  console.log("❌ GROQ_API_KEY ناقص");
  process.exit(1);
}

if (!GUILD_ID) {
  console.log("❌ GUILD_ID ناقص");
  process.exit(1);
}

// ================================
// إعدادات السيرفر
// ================================

let aiChat = null;
let aiCategory = null;

const aiTickets = new Set();

// ================================
// الأوامر
// ================================

const commands = [

  new SlashCommandBuilder()
    .setName("ai-chat")
    .setDescription("تحديد شات الذكاء الاصطناعي")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("اختر شات AI")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    ),

  new SlashCommandBuilder()
    .setName("ai-category")
    .setDescription("تحديد كاتيجوري تكتات AI")
    .addChannelOption(option =>
      option
        .setName("category")
        .setDescription("اختر الكاتيجوري")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildCategory)
    ),

  new SlashCommandBuilder()
    .setName("ai-ticket")
    .setDescription("إرسال بانل تذاكر AI"),

  new SlashCommandBuilder()
    .setName("ai-stats")
    .setDescription("عرض حالة نظام AI")

].map(command => command.toJSON());

// ================================
// تشغيل البوت
// ================================

client.once("ready", async () => {

  console.log("================================");
  console.log("🤖 TicketAI Online");
  console.log("👤 " + client.user.tag);
  console.log("================================");

  const guild = client.guilds.cache.get(GUILD_ID);

  if (!guild) {
    console.log("❌ البوت غير موجود في السيرفر");
    console.log("تأكد من GUILD_ID");
    return;
  }

  try {

    await guild.commands.set(commands);

    console.log("✅ تم تسجيل جميع الأوامر");
    console.log("🏠 السيرفر: " + guild.name);

  } catch (error) {

    console.log("❌ فشل تسجيل الأوامر");
    console.error(error);

  }

  client.user.setActivity("AI Support 🤖");
});

// ================================
// GROQ AI
// ================================

async function askAI(text) {

  try {

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_KEY}`
        },

        body: JSON.stringify({

          model: "llama-3.1-8b-instant",

          messages: [

            {
              role: "system",
              content:
                "أنت بوت دعم فني عربي في Discord. " +
                "ساعد المستخدم في مشاكل Discord والسيرفرات والبوتات والتكتات. " +
                "تكلم بالعربية وبأسلوب واضح ومختصر. " +
                "إذا ذكر المستخدم مشكلة، حاول إعطاءه حل عملي. " +
                "إذا قال إن شخصاً سبه أو أساء إليه، اطلب منه إرسال صورة أو دليل. " +
                "لا تدّعي أنك موظف حقيقي."
            },

            {
              role: "user",
              content: text
            }

          ],

          temperature: 0.5,
          max_tokens: 500

        })
      }
    );

    const data = await response.json();

    if (!response.ok) {

      console.log("❌ GROQ ERROR:");
      console.log(data);

      return "❌ الذكاء الاصطناعي غير متاح حاليًا.";

    }

    return (
      data.choices?.[0]?.message?.content ||
      "❌ لم أستطع إنشاء رد."
    );

  } catch (error) {

    console.log("❌ AI ERROR:");
    console.error(error);

    return "❌ حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.";

  }
}

// ================================
// الأوامر والتفاعلات
// ================================

client.on("interactionCreate", async interaction => {

  // ==============================
  // SLASH COMMANDS
  // ==============================

  if (interaction.isChatInputCommand()) {

    // ------------------------------
    // /ai-chat
    // ------------------------------

    if (interaction.commandName === "ai-chat") {

      if (
        !interaction.memberPermissions.has(
          PermissionFlagsBits.Administrator
        )
      ) {

        return interaction.reply({
          content: "❌ تحتاج Administrator.",
          ephemeral: true
        });

      }

      const channel =
        interaction.options.getChannel("channel");

      aiChat = channel.id;

      return interaction.reply({
        content:
          `✅ تم تشغيل AI في ${channel}`,
        ephemeral: true
      });

    }

    // ------------------------------
    // /ai-category
    // ------------------------------

    if (interaction.commandName === "ai-category") {

      if (
        !interaction.memberPermissions.has(
          PermissionFlagsBits.Administrator
        )
      ) {

        return interaction.reply({
          content: "❌ تحتاج Administrator.",
          ephemeral: true
        });

      }

      const category =
        interaction.options.getChannel("category");

      aiCategory = category.id;

      return interaction.reply({
        content:
          `✅ تم تحديد ${category} لتكتات AI`,
        ephemeral: true
      });

    }

    // ------------------------------
    // /ai-ticket
    // ------------------------------

    if (interaction.commandName === "ai-ticket") {

      if (
        !interaction.memberPermissions.has(
          PermissionFlagsBits.Administrator
        )
      ) {

        return interaction.reply({
          content: "❌ تحتاج Administrator.",
          ephemeral: true
        });

      }

      if (!aiCategory) {

        return interaction.reply({
          content:
            "❌ استخدم `/ai-category` أولاً.",
          ephemeral: true
        });

      }

      const embed = new EmbedBuilder()

        .setTitle("🤖 الدعم الفني AI")

        .setDescription(
          "تحتاج مساعدة؟\n\n" +
          "اضغط الزر بالأسفل لفتح تذكرة مع الذكاء الاصطناعي."
        )

        .setColor(0x5865F2);

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

    // ------------------------------
    // /ai-stats
    // ------------------------------

    if (interaction.commandName === "ai-stats") {

      return interaction.reply({

        content:
          "🤖 **TicketAI**\n\n" +

          `🟢 AI: Online\n` +

          `💬 AI Chat: ${
            aiChat
              ? `<#${aiChat}>`
              : "غير محدد"
          }\n` +

          `📁 AI Category: ${
            aiCategory
              ? `<#${aiCategory}>`
              : "غير محددة"
          }\n` +

          `🎫 AI Tickets: ${aiTickets.size}`

      });

    }
  }

  // ==============================
  // فتح التكت
  // ==============================

  if (interaction.isButton()) {

    if (interaction.customId === "open_ai_ticket") {

      if (!aiCategory) {

        return interaction.reply({
          content:
            "❌ لم يتم تحديد AI Category.",
          ephemeral: true
        });

      }

      try {

        const username =
          interaction.user.username
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "-")
            .slice(0, 25);

        const channel =
          await interaction.guild.channels.create({

            name: `ai-${username}`,

            type: ChannelType.GuildText,

            parent: aiCategory,

            permissionOverwrites: [

              {
                id:
                  interaction.guild.roles.everyone.id,

                deny: [
                  PermissionFlagsBits.ViewChannel
                ]
              },

              {
                id: interaction.user.id,

                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.AttachFiles
                ]
              },

              {
                id: client.user.id,

                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.ManageChannels
                ]
              }

            ]

          });

        aiTickets.add(channel.id);

        const closeRow =
          new ActionRowBuilder()
            .addComponents(

              new ButtonBuilder()
                .setCustomId("close_ai_ticket")
                .setLabel("إغلاق التكت")
                .setEmoji("🔒")
                .setStyle(ButtonStyle.Danger)

            );

        await channel.send({

          content:
            `${interaction.user}\n\n` +
            "🤖 **مرحبًا بك في AI Support**\n" +
            "اكتب مشكلتك هنا وسأحاول مساعدتك.",

          components: [closeRow]

        });

        return interaction.reply({

          content:
            `✅ تم فتح تكت AI: ${channel}`,

          ephemeral: true

        });

      } catch (error) {

        console.error(error);

        return interaction.reply({

          content:
            "❌ فشل إنشاء التكت. تأكد أن البوت معه Manage Channels.",

          ephemeral: true

        });

      }
    }

    // ==============================
    // إغلاق التكت
    // ==============================

    if (interaction.customId === "close_ai_ticket") {

      if (!aiTickets.has(interaction.channel.id)) {

        return interaction.reply({
          content:
            "❌ هذه ليست AI Ticket.",
          ephemeral: true
        });

      }

      await interaction.reply(
        "🔒 سيتم إغلاق التكت بعد 3 ثوانٍ."
      );

      aiTickets.delete(interaction.channel.id);

      setTimeout(() => {

        interaction.channel
          .delete()
          .catch(() => {});

      }, 3000);

    }

  }

});

// ================================
// رسائل AI
// ================================

client.on("messageCreate", async message => {

  if (message.author.bot) return;

  if (!message.guild) return;

  // فقط الشات الذي حددته
  const isAIChat =
    message.channel.id === aiChat;

  // أو تكت AI
  const isAITicket =
    aiTickets.has(message.channel.id);

  // تجاهل كل شيء آخر
  if (!isAIChat && !isAITicket) return;

  if (!message.content.trim()) return;

  try {

    await message.channel.sendTyping();

    const answer =
      await askAI(message.content);

    await message.reply({

      content:
        answer.slice(0, 1900),

      allowedMentions: {
        repliedUser: false
      }

    });

  } catch (error) {

    console.error(error);

  }

});

// ================================
// أخطاء
// ================================

process.on("unhandledRejection", error => {
  console.error("❌ Unhandled:", error);
});

process.on("uncaughtException", error => {
  console.error("❌ Exception:", error);
});

// ================================
// LOGIN
// ================================

client.login(TOKEN);
