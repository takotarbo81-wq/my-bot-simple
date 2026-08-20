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

// ==========================================
// إعدادات
// ==========================================

let aiChat = null;
let aiCategory = null;
const aiTickets = new Set();

// ==========================================
// الأوامر
// ==========================================

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

].map(x => x.toJSON());

// ==========================================
// BOT READY
// ==========================================

client.once("ready", async () => {

  console.log("");
  console.log("================================");
  console.log("🤖 البوت اشتغل");
  console.log("👤 " + client.user.tag);
  console.log("================================");

  const guild = client.guilds.cache.get(GUILD_ID);

  if (!guild) {
    console.log("❌ البوت مش موجود في السيرفر");
    console.log("GUILD_ID:", GUILD_ID);
    return;
  }

  try {

    await guild.commands.set(commands);

    console.log("✅ تم تسجيل الأوامر");
    console.log("🏠 السيرفر:", guild.name);

  } catch (error) {

    console.log("❌ فشل تسجيل الأوامر");
    console.error(error);

  }

  client.user.setActivity("AI Support 🤖");
});

// ==========================================
// AI
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
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.log("❌ Groq:", data);
      return "❌ الذكاء الاصطناعي غير متاح حاليًا.";
    }

    return (
      data.choices?.[0]?.message?.content ||
      "❌ لم أستطع إنشاء رد."
    );

  } catch (error) {

    console.log("❌ AI ERROR:", error);

    return "❌ حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.";
  }
}

// ==========================================
// SLASH COMMANDS
// ==========================================

client.on("interactionCreate", async interaction => {

  if (interaction.isChatInputCommand()) {

    // --------------------------------------
    // AI CHAT
    // --------------------------------------

    if (interaction.commandName === "ai-chat") {

      if (!interaction.memberPermissions.has(
        PermissionFlagsBits.Administrator
      )) {
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

    // --------------------------------------
    // AI CATEGORY
    // --------------------------------------

    if (interaction.commandName === "ai-category") {

      if (!interaction.memberPermissions.has(
        PermissionFlagsBits.Administrator
      )) {
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

    // --------------------------------------
    // AI TICKET
    // --------------------------------------

    if (interaction.commandName === "ai-ticket") {

      if (!interaction.memberPermissions.has(
        PermissionFlagsBits.Administrator
      )) {
        return interaction.reply({
          content: "❌ تحتاج Administrator.",
          ephemeral: true
        });
      }

      if (!aiCategory) {
        return interaction.reply({
          content:
            "❌ أولاً استخدم `/ai-category`.",
          ephemeral: true
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

    // --------------------------------------
    // STATS
    // --------------------------------------

    if (interaction.commandName === "ai-stats") {

      return interaction.reply({
        content:
          `🤖 AI: Online\n` +
          `💬 AI Chat: ${
            aiChat ? `<#${aiChat}>` : "غير محدد"
          }\n` +
          `📁 Category: ${
            aiCategory ? `<#${aiCategory}>` : "غير محددة"
          }\n` +
          `🎫 AI Tickets: ${aiTickets.size}`
      });
    }
  }

  // ========================================
  // BUTTON
  // ========================================

  if (interaction.isButton()) {

    if (interaction.customId === "open_ai") {

      if (!aiCategory) {
        return interaction.reply({
          content: "❌ AI Category غير محددة.",
          ephemeral: true
        });
      }

      const channel =
        await interaction.guild.channels.create({
          name:
            `ai-${interaction.user.username}`
              .toLowerCase()
              .replace(/[^a-z0-9-]/g, "-")
              .slice(0, 80),

          type: ChannelType.GuildText,

          parent: aiCategory,

          permissionOverwrites: [

            {
              id: interaction.guild.roles.everyone.id,
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
              .setCustomId("close_ai")
              .setLabel("إغلاق التكت")
              .setEmoji("🔒")
              .setStyle(ButtonStyle.Danger)
          );

      await channel.send({
        content:
          `${interaction.user}\n🤖 اكتب مشكلتك هنا وسأساعدك.`,
        components: [closeRow]
      });

      return interaction.reply({
        content:
          `✅ تم فتح التكت ${channel}`,
        ephemeral: true
      });
    }

    // ======================================
    // CLOSE
    // ======================================

    if (interaction.customId === "close_ai") {

      if (!aiTickets.has(interaction.channel.id)) {
        return interaction.reply({
          content: "❌ هذا ليس AI Ticket.",
          ephemeral: true
        });
      }

      await interaction.reply(
        "🔒 سيتم إغلاق التكت بعد 3 ثوانٍ."
      );

      aiTickets.delete(interaction.channel.id);

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 3000);
    }
  }
});

// ==========================================
// MESSAGE AI
// ==========================================

client.on("messageCreate", async message => {

  if (message.author.bot) return;
  if (!message.guild) return;

  // فقط AI Chat أو AI Tickets
  const allowed =
    message.channel.id === aiChat ||
    aiTickets.has(message.channel.id);

  if (!allowed) return;

  if (!message.content.trim()) return;

  await message.channel.sendTyping();

  const answer =
    await askAI(message.content);

  await message.reply({
    content: answer.slice(0, 1900),
    allowedMentions: {
      repliedUser: false
    }
  });
});

// ==========================================
// ERROR
// ==========================================

process.on("unhandledRejection", error => {
  console.log("❌ Unhandled:", error);
});

process.on("uncaughtException", error => {
  console.log("❌ Exception:", error);
});

// ==========================================
// LOGIN
// ==========================================

client.login(TOKEN);
