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

// ==========================================
// CLIENT
// ==========================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ==========================================
// VARIABLES
// ==========================================

const TOKEN = process.env.DISCORD_TOKEN;
const GROQ_KEY = process.env.GROQ_API_KEY;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN) {
  console.log("❌ DISCORD_TOKEN غير موجود");
  process.exit(1);
}

if (!GROQ_KEY) {
  console.log("❌ GROQ_API_KEY غير موجود");
  process.exit(1);
}

if (!GUILD_ID) {
  console.log("❌ GUILD_ID غير موجود");
  process.exit(1);
}

// ==========================================
// SETTINGS
// ==========================================

let aiChat = null;
let aiCategory = null;

const aiTickets = new Set();

// ==========================================
// COMMANDS
// ==========================================

const commands = [

  // /ai-chat
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

  // /ai-category
  new SlashCommandBuilder()
    .setName("ai-category")
    .setDescription("تحديد كاتيجوري تكتات AI")
    .addChannelOption(option =>
      option
        .setName("category")
        .setDescription("اختر كاتيجوري AI")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildCategory)
    ),

  // /ai-ticket
  new SlashCommandBuilder()
    .setName("ai-ticket")
    .setDescription("إرسال بانل تكت AI"),

  // /ai-stats
  new SlashCommandBuilder()
    .setName("ai-stats")
    .setDescription("عرض حالة نظام AI")

].map(command => command.toJSON());

// ==========================================
// READY
// ==========================================

client.once("clientReady", async () => {

  console.log("=================================");
  console.log("🤖 TicketAI Online");
  console.log("👤 " + client.user.tag);
  console.log("=================================");

  const guild = client.guilds.cache.get(GUILD_ID);

  if (!guild) {
    console.log("❌ البوت غير موجود في السيرفر");
    console.log("GUILD_ID:", GUILD_ID);
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

// ==========================================
// GROQ AI
// ==========================================

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

          model: "openai/gpt-oss-20b",

          messages: [

            {
              role: "system",

              content:
                "أنت بوت دعم فني عربي داخل Discord. " +
                "تكلم بالعربية وبشكل واضح ومختصر. " +
                "ساعد المستخدم في مشاكل Discord والسيرفرات والبوتات والتكتات. " +
                "إذا قال المستخدم إن شخصاً سبه أو أساء له، اطلب منه إرسال صورة أو دليل. " +
                "إذا كانت المشكلة تحتاج موظف دعم، أخبره أن يطلب تدخل الدعم. " +
                "لا تدعي أنك موظف حقيقي. " +
                "لا تخترع معلومات غير مؤكدة."
            },

            {
              role: "user",
              content: text
            }

          ],

          temperature: 0.5,

          max_tokens: 700,

          include_reasoning: false

        })
      }
    );

    const data = await response.json();

    if (!response.ok) {

      console.log("❌ GROQ ERROR:");
      console.log(JSON.stringify(data, null, 2));

      return "❌ الذكاء الاصطناعي غير متاح حاليًا. حاول مرة ثانية.";

    }

    const answer =
      data?.choices?.[0]?.message?.content;

    if (!answer) {

      console.log("❌ Groq لم يرجع جواب");
      console.log(data);

      return "❌ لم أستطع إنشاء رد.";

    }

    return answer;

  } catch (error) {

    console.log("❌ AI CONNECTION ERROR:");
    console.error(error);

    return "❌ حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.";

  }

}

// ==========================================
// INTERACTIONS
// ==========================================

client.on("interactionCreate", async interaction => {

  // ========================================
  // SLASH COMMANDS
  // ========================================

  if (interaction.isChatInputCommand()) {

    // --------------------------------------
    // /ai-chat
    // --------------------------------------

    if (interaction.commandName === "ai-chat") {

      if (
        !interaction.memberPermissions.has(
          PermissionFlagsBits.Administrator
        )
      ) {

        return interaction.reply({
          content: "❌ تحتاج Administrator لاستخدام هذا الأمر.",
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

    // --------------------------------------
    // /ai-category
    // --------------------------------------

    if (interaction.commandName === "ai-category") {

      if (
        !interaction.memberPermissions.has(
          PermissionFlagsBits.Administrator
        )
      ) {

        return interaction.reply({
          content: "❌ تحتاج Administrator لاستخدام هذا الأمر.",
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

    // --------------------------------------
    // /ai-ticket
    // --------------------------------------

    if (interaction.commandName === "ai-ticket") {

      if (
        !interaction.memberPermissions.has(
          PermissionFlagsBits.Administrator
        )
      ) {

        return interaction.reply({
          content: "❌ تحتاج Administrator لاستخدام هذا الأمر.",
          ephemeral: true
        });

      }

      if (!aiCategory) {

        return interaction.reply({
          content:
            "❌ حدد الكاتيجوري أولاً باستخدام `/ai-category`.",
          ephemeral: true
        });

      }

      const embed = new EmbedBuilder()

        .setTitle("🤖 الدعم الفني AI")

        .setDescription(
          "مرحباً بك في الدعم الفني.\n\n" +
          "اضغط الزر بالأسفل لفتح تكت خاصة بالذكاء الاصطناعي."
        )

        .setColor(0x5865F2)

        .setFooter({
          text: "AI Support"
        });

      const row =
        new ActionRowBuilder()
          .addComponents(

            new ButtonBuilder()
              .setCustomId("open_ai")
              .setLabel("فتح تذكرة")
              .setEmoji("🎫")
              .setStyle(ButtonStyle.Primary)

          );

      return interaction.reply({
        embeds: [embed],
        components: [row]
      });

    }

    // --------------------------------------
    // /ai-stats
    // --------------------------------------

    if (interaction.commandName === "ai-stats") {

      return interaction.reply({

        content:
          "🤖 **حالة AI**\n\n" +
          "🟢 Bot: Online\n" +
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

  // ========================================
  // BUTTONS
  // ========================================

  if (interaction.isButton()) {

    // --------------------------------------
    // OPEN AI TICKET
    // --------------------------------------

    if (interaction.customId === "open_ai") {

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
            .replace(/[^a-z0-9]/g, "-")
            .slice(0, 50);

        const channel =
          await interaction.guild.channels.create({

            name: `ai-${username}`,

            type: ChannelType.GuildText,

            parent: aiCategory,

            permissionOverwrites: [

              // Everyone
              {
                id: interaction.guild.roles.everyone.id,

                deny: [
                  PermissionFlagsBits.ViewChannel
                ]
              },

              // User
              {
                id: interaction.user.id,

                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.AttachFiles
                ]
              },

              // Bot
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
                .setCustomId("close_ai")
                .setLabel("إغلاق التكت")
                .setEmoji("🔒")
                .setStyle(ButtonStyle.Danger)

            );

        await channel.send({

          content:
            `${interaction.user}`,

          embeds: [

            new EmbedBuilder()

              .setTitle("🤖 AI Support")

              .setDescription(
                "مرحباً بك في الدعم الفني AI.\n\n" +
                "اكتب مشكلتك هنا وسأحاول مساعدتك."
              )

              .setColor(0x5865F2)

          ],

          components: [closeRow]

        });

        return interaction.reply({

          content:
            `✅ تم فتح تكتك ${channel}`,

          ephemeral: true

        });

      } catch (error) {

        console.log("❌ CREATE TICKET ERROR:");
        console.error(error);

        return interaction.reply({

          content:
            "❌ حدث خطأ أثناء فتح التكت.",

          ephemeral: true

        });

      }

    }

    // --------------------------------------
    // CLOSE AI TICKET
    // --------------------------------------

    if (interaction.customId === "close_ai") {

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

      aiTickets.delete(
        interaction.channel.id
      );

      setTimeout(() => {

        interaction.channel
          .delete()
          .catch(() => {});

      }, 3000);

    }

  }

});

// ==========================================
// MESSAGE AI
// ==========================================

client.on("messageCreate", async message => {

  // تجاهل البوتات
  if (message.author.bot) return;

  // تجاهل الخاص
  if (!message.guild) return;

  // فقط AI Chat أو AI Tickets
  const allowed =
    message.channel.id === aiChat ||
    aiTickets.has(message.channel.id);

  if (!allowed) return;

  // تجاهل الرسائل الفارغة
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

    console.log("❌ MESSAGE ERROR:");
    console.error(error);

  }

});

// ==========================================
// ERRORS
// ==========================================

process.on(
  "unhandledRejection",
  error => {

    console.log("❌ Unhandled Rejection:");
    console.error(error);

  }
);

process.on(
  "uncaughtException",
  error => {

    console.log("❌ Uncaught Exception:");
    console.error(error);

  }
);

// ==========================================
// LOGIN
// ==========================================

client.login(TOKEN);
