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
  MessageFlags
} = require("discord.js");

// ================================
// DISCORD CLIENT
// ================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ================================
// VARIABLES
// ================================

const TOKEN = process.env.DISCORD_TOKEN;
const GROQ_KEY = process.env.GROQ_API_KEY;
const GUILD_ID = process.env.GUILD_ID;

// اختياري:
// إذا حطيتهم في Railway يبقوا محفوظين بعد Restart
let aiChat = process.env.AI_CHAT_ID || null;
let aiCategory = process.env.AI_CATEGORY_ID || null;

// ================================
// CHECK VARIABLES
// ================================

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
// COMMANDS
// ================================

const commands = [
  new SlashCommandBuilder()
    .setName("ai-chat")
    .setDescription("تحديد شات الذكاء الاصطناعي")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("اختر الشات")
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
    .setDescription("إرسال بانل AI Ticket"),

  new SlashCommandBuilder()
    .setName("ai-stats")
    .setDescription("حالة نظام AI")
].map(command => command.toJSON());

// ================================
// READY
// ================================

client.once("clientReady", async () => {
  console.log("================================");
  console.log("🤖 TicketAI Online");
  console.log("👤 " + client.user.tag);
  console.log("🧠 AI: Groq");
  console.log("================================");

  const guild = client.guilds.cache.get(GUILD_ID);

  if (!guild) {
    console.log("❌ البوت مش موجود في السيرفر");
    console.log("GUILD_ID:", GUILD_ID);
    return;
  }

  try {
    await guild.commands.set(commands);

    console.log("✅ تم تسجيل جميع الأوامر");
    console.log("🏠 السيرفر:", guild.name);

  } catch (error) {
    console.log("❌ فشل تسجيل الأوامر");
    console.error(error);
  }

  // ==================================
  // محاولة استرجاع AI Category
  // ==================================

  if (!aiCategory) {
    const existingAITicket = guild.channels.cache.find(channel =>
      channel.type === ChannelType.GuildText &&
      channel.name.startsWith("ai-") &&
      channel.parentId
    );

    if (existingAITicket) {
      aiCategory = existingAITicket.parentId;

      console.log(
        "♻️ تم استرجاع AI Category:",
        aiCategory
      );
    }
  }

  // ==================================
  // محاولة استرجاع AI Chat
  // ==================================

  if (!aiChat) {
    const possibleChat = guild.channels.cache.find(channel =>
      channel.type === ChannelType.GuildText &&
      (
        channel.name === "ai-chat" ||
        channel.name === "ai-chatting" ||
        channel.name.includes("ai-chat")
      )
    );

    if (possibleChat) {
      aiChat = possibleChat.id;

      console.log(
        "♻️ تم استرجاع AI Chat:",
        aiChat
      );
    }
  }

  client.user.setActivity("AI Support 🤖");
});

// ================================
// GROQ AI
// ================================

async function askAI(text) {
  try {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 30000);

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
                "رد بالعربية وبشكل مختصر وواضح. " +
                "ساعد المستخدم في مشاكل Discord والبوتات والسيرفرات والتكتات. " +
                "إذا قال إن شخصاً سبه اطلب منه إرسال صورة أو دليل. " +
                "إذا احتاج موظفاً أخبره أنه يحتاج تدخل الدعم."
            },

            {
              role: "user",
              content: text
            }
          ],

          temperature: 0.5,
          max_tokens: 500
        }),

        signal: controller.signal
      }
    );

    clearTimeout(timeout);

    const data = await response.json();

    if (!response.ok) {
      console.log("❌ Groq Error:", data);

      return "❌ الذكاء الاصطناعي غير متاح حالياً.";
    }

    return (
      data.choices?.[0]?.message?.content ||
      "❌ لم أستطع إنشاء رد."
    );

  } catch (error) {

    console.log("❌ AI ERROR:", error);

    if (error.name === "AbortError") {
      return "❌ Groq أخذ وقتاً طويلاً للرد، حاول مرة ثانية.";
    }

    return "❌ حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.";
  }
}

// ================================
// INTERACTIONS
// ================================

client.on("interactionCreate", async interaction => {

  // ==================================
  // SLASH COMMANDS
  // ==================================

  if (interaction.isChatInputCommand()) {

    // ------------------------------
    // AI CHAT
    // ------------------------------

    if (interaction.commandName === "ai-chat") {

      if (
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.Administrator
        )
      ) {
        return interaction.reply({
          content: "❌ تحتاج Administrator.",
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.deferReply({
        flags: MessageFlags.Ephemeral
      });

      try {

        const channel =
          interaction.options.getChannel("channel");

        aiChat = channel.id;

        await interaction.editReply(
          `✅ تم تشغيل AI في ${channel}`
        );

      } catch (error) {

        console.log("❌ ai-chat error:", error);

        await interaction.editReply(
          "❌ حدث خطأ أثناء تحديد الشات."
        );
      }

      return;
    }

    // ------------------------------
    // AI CATEGORY
    // ------------------------------

    if (interaction.commandName === "ai-category") {

      if (
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.Administrator
        )
      ) {
        return interaction.reply({
          content: "❌ تحتاج Administrator.",
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.deferReply({
        flags: MessageFlags.Ephemeral
      });

      try {

        const category =
          interaction.options.getChannel("category");

        aiCategory = category.id;

        await interaction.editReply(
          `✅ تم تحديد ${category} لتكتات AI`
        );

      } catch (error) {

        console.log("❌ ai-category error:", error);

        await interaction.editReply(
          "❌ حدث خطأ أثناء تحديد الكاتيجوري."
        );
      }

      return;
    }

    // ------------------------------
    // AI TICKET PANEL
    // ------------------------------

    if (interaction.commandName === "ai-ticket") {

      if (
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.Administrator
        )
      ) {
        return interaction.reply({
          content: "❌ تحتاج Administrator.",
          flags: MessageFlags.Ephemeral
        });
      }

      if (!aiCategory) {

        return interaction.reply({
          content:
            "❌ AI Category غير محددة.\n" +
            "استخدم `/ai-category` أولاً.",
          flags: MessageFlags.Ephemeral
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("🤖 الدعم الفني")
        .setDescription(
          "تحتاج مساعدة؟\n\n" +
          "اضغط الزر لفتح تكت AI خاصة بك."
        )
        .setColor(0x5865f2);

      const row = new ActionRowBuilder()
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

    // ------------------------------
    // AI STATS
    // ------------------------------

    if (interaction.commandName === "ai-stats") {

      const guild = interaction.guild;

      let ticketCount = 0;

      if (guild) {
        ticketCount = guild.channels.cache.filter(
          channel =>
            channel.type === ChannelType.GuildText &&
            channel.name.startsWith("ai-")
        ).size;
      }

      return interaction.reply({
        content:
          `🤖 AI: Online\n` +
          `🧠 Provider: Groq\n` +
          `💬 AI Chat: ${
            aiChat ? `<#${aiChat}>` : "غير محدد"
          }\n` +
          `📁 Category: ${
            aiCategory ? `<#${aiCategory}>` : "غير محددة"
          }\n` +
          `🎫 AI Tickets: ${ticketCount}`
      });
    }
  }

  // ==================================
  // BUTTONS
  // ==================================

  if (interaction.isButton()) {

    // ================================
    // OPEN AI TICKET
    // ================================

    if (interaction.customId === "open_ai") {

      // أهم إصلاح:
      // نعمل defer فوراً حتى لا يظهر
      // "didn't respond in time"

      await interaction.deferReply({
        flags: MessageFlags.Ephemeral
      });

      try {

        if (!aiCategory) {

          return interaction.editReply(
            "❌ AI Category غير محددة.\n" +
            "استخدم `/ai-category` أولاً."
          );
        }

        const guild = interaction.guild;

        if (!guild) {
          return interaction.editReply(
            "❌ حدث خطأ: السيرفر غير موجود."
          );
        }

        // ==============================
        // منع فتح أكثر من تكت
        // ==============================

        const existingTicket =
          guild.channels.cache.find(channel =>
            channel.type === ChannelType.GuildText &&
            channel.parentId === aiCategory &&
            channel.name.startsWith(
              `ai-${interaction.user.username}`
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, "-")
                .slice(0, 70)
            )
          );

        if (existingTicket) {

          return interaction.editReply(
            `❌ عندك تكت مفتوح بالفعل: ${existingTicket}`
          );
        }

        // ==============================
        // CREATE CHANNEL
        // ==============================

        const safeName =
          interaction.user.username
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "-")
            .replace(/-+/g, "-")
            .slice(0, 70);

        const channel =
          await guild.channels.create({

            name: `ai-${safeName}`,

            type: ChannelType.GuildText,

            parent: aiCategory,

            permissionOverwrites: [

              {
                id: guild.roles.everyone.id,

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
                  PermissionFlagsBits.ManageChannels,
                  PermissionFlagsBits.EmbedLinks
                ]
              }
            ]
          });

        // ==============================
        // TICKET MESSAGE
        // ==============================

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
            `${interaction.user}\n` +
            `🤖 **مرحباً بك في AI Support**\n\n` +
            `اكتب مشكلتك هنا وسأحاول مساعدتك.`,

          components: [closeRow]
        });

        await interaction.editReply(
          `✅ تم فتح التكت ${channel}`
        );

        console.log(
          `🎫 Ticket opened: ${channel.name}`
        );

      } catch (error) {

        console.log("❌ OPEN TICKET ERROR:");
        console.error(error);

        try {

          await interaction.editReply(
            "❌ حدث خطأ أثناء إنشاء التكت.\n" +
            "تأكد أن البوت عنده Manage Channels."
          );

        } catch {}
      }

      return;
    }

    // ================================
    // CLOSE AI TICKET
    // ================================

    if (interaction.customId === "close_ai") {

      // التكتات القديمة تظل تعمل بعد Restart
      // لأننا نعتمد على اسم القناة وليس Set فقط

      const channel = interaction.channel;

      if (
        !channel ||
        channel.type !== ChannelType.GuildText ||
        !channel.name.startsWith("ai-")
      ) {

        return interaction.reply({
          content: "❌ هذا ليس AI Ticket.",
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.deferUpdate();

      try {

        await channel.send(
          "🔒 سيتم إغلاق التكت بعد 3 ثوانٍ..."
        );

        console.log(
          `🔒 Closing ticket: ${channel.name}`
        );

        setTimeout(async () => {

          try {

            await channel.delete(
              "AI Ticket closed"
            );

          } catch (error) {

            console.log(
              "❌ DELETE TICKET ERROR:",
              error
            );
          }

        }, 3000);

      } catch (error) {

        console.log(
          "❌ CLOSE TICKET ERROR:",
          error
        );
      }

      return;
    }
  }
});

// ================================
// MESSAGE / AI
// ================================

client.on("messageCreate", async message => {

  try {

    if (
      message.author.bot ||
      !message.guild
    ) {
      return;
    }

    if (!message.content?.trim()) {
      return;
    }

    // ================================
    // AI CHAT
    // ================================

    const isAIChat =
      aiChat &&
      message.channel.id === aiChat;

    // ================================
    // AI TICKET
    // ================================

    const isAITicket =
      message.channel.type === ChannelType.GuildText &&
      message.channel.name.startsWith("ai-");

    // ================================
    // ALLOWED
    // ================================

    if (!isAIChat && !isAITicket) {
      return;
    }

    console.log(
      `💬 AI Message | ${message.author.tag} | ${message.channel.name}: ${message.content}`
    );

    // ================================
    // TYPING
    // ================================

    await message.channel.sendTyping();

    // ================================
    // AI
    // ================================

    const answer =
      await askAI(message.content);

    // ================================
    // DISCORD LIMIT
    // ================================

    const text =
      answer?.slice(0, 1900) ||
      "❌ لم أستطع إنشاء رد.";

    // ================================
    // REPLY
    // ================================

    await message.reply({

      content: text,

      allowedMentions: {
        repliedUser: false
      }

    });

    console.log(
      "✅ AI replied successfully"
    );

  } catch (error) {

    console.log(
      "❌ MESSAGE ERROR:"
    );

    console.error(error);

    try {

      await message.channel.send(
        "❌ حصل خطأ أثناء معالجة رسالتك."
      );

    } catch {}
  }
});

// ================================
// ERRORS
// ================================

process.on(
  "unhandledRejection",
  error => {
    console.log(
      "❌ Unhandled Rejection:"
    );
    console.error(error);
  }
);

process.on(
  "uncaughtException",
  error => {
    console.log(
      "❌ Uncaught Exception:"
    );
    console.error(error);
  }
);

// ================================
// LOGIN
// ================================

client
  .login(TOKEN)
  .then(() => {
    console.log("🔐 Connecting to Discord...");
  })
  .catch(error => {

    console.log(
      "❌ Discord Login Error:"
    );

    console.error(error);

    process.exit(1);
  });
