const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
} = require("discord.js");

const fs = require("fs");

// ===============================
// ENV
// ===============================

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN غير موجود في Railway Variables");
  process.exit(1);
}

if (!GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY غير موجود في Railway Variables");
  process.exit(1);
}

// ===============================
// CONFIG
// ===============================

const CONFIG_FILE = "./config.json";

let config = {
  aiChatId: null,
  ticketCategoryId: null
};

if (fs.existsSync(CONFIG_FILE)) {
  try {
    config = {
      ...config,
      ...JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"))
    };
  } catch {
    console.log("⚠️ config.json غير صالح، سيتم إنشاء إعداد جديد.");
  }
}

function saveConfig() {
  fs.writeFileSync(
    CONFIG_FILE,
    JSON.stringify(config, null, 2)
  );
}

// ===============================
// DISCORD
// ===============================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===============================
// SLASH COMMANDS
// ===============================

const commands = [

  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("إرسال بانل الدعم"),

  new SlashCommandBuilder()
    .setName("ai-ticket")
    .setDescription("إرسال بانل AI Ticket"),

  new SlashCommandBuilder()
    .setName("ai-chat")
    .setDescription("تحديد شات الذكاء الاصطناعي")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("الشات الذي سيرد فيه AI")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ai-category")
    .setDescription("تحديد كاتيجوري التكتات")
    .addChannelOption(option =>
      option
        .setName("category")
        .setDescription("كاتيجوري التكتات")
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ai-stats")
    .setDescription("عرض حالة نظام AI")

].map(command => command.toJSON());

// ===============================
// REGISTER COMMANDS
// ===============================

async function registerCommands() {

  try {

    const rest = new REST({
      version: "10"
    }).setToken(DISCORD_TOKEN);

    console.log("🔄 تسجيل أوامر Slash...");

    await rest.put(
      Routes.applicationCommands(client.user.id),
      {
        body: commands
      }
    );

    console.log("✅ تم تسجيل الأوامر.");

  } catch (error) {

    console.error("❌ خطأ تسجيل الأوامر:", error);

  }
}

// ===============================
// GROQ AI
// ===============================

async function askAI(text) {

  try {

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },

        body: JSON.stringify({
          model: "llama-3.1-8b-instant",

          messages: [
            {
              role: "system",
              content:
                "أنت بوت دعم عربي. أجب باللغة العربية بطريقة واضحة ومختصرة ومفيدة. لا تدعي أنك شخص حقيقي."
            },
            {
              role: "user",
              content: text
            }
          ],

          temperature: 0.6,
          max_completion_tokens: 1024
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {

      console.error("❌ Groq Error:", data);

      return "❌ حصل خطأ أثناء الاتصال بالذكاء الاصطناعي.";

    }

    return (
      data?.choices?.[0]?.message?.content ||
      "❌ لم يصلني رد من الذكاء الاصطناعي."
    );

  } catch (error) {

    console.error("❌ AI Error:", error);

    return "❌ حدث خطأ في الاتصال بالذكاء الاصطناعي.";

  }
}

// ===============================
// READY
// ===============================

client.once("clientReady", async () => {

  console.log("==============================");
  console.log(`🤖 البوت: ${client.user.tag}`);
  console.log("🟢 البوت متصل بنجاح");
  console.log("==============================");

  await registerCommands();

});

// ===============================
// MESSAGE AI
// ===============================

client.on("messageCreate", async message => {

  if (message.author.bot) return;

  if (!message.guild) return;

  // ============================
  // AI CHAT المحدد فقط
  // ============================

  if (
    config.aiChatId &&
    message.channel.id === config.aiChatId
  ) {

    try {

      await message.channel.sendTyping();

      const answer = await askAI(message.content);

      await message.reply({
        content: answer.slice(0, 2000)
      });

    } catch (error) {

      console.error(error);

    }

    return;
  }

  // ============================
  // AI TICKET فقط
  // ============================
  //
  // لا يرد داخل أي تكت عادي.
  // لازم يكون topic فيه AI_TICKET
  //

  if (
    message.channel.type === ChannelType.GuildText &&
    message.channel.topic?.startsWith("AI_TICKET:")
  ) {

    try {

      await message.channel.sendTyping();

      const answer = await askAI(message.content);

      await message.reply({
        content: answer.slice(0, 2000)
      });

    } catch (error) {

      console.error(error);

    }

  }

});

// ===============================
// INTERACTIONS
// ===============================

client.on("interactionCreate", async interaction => {

  // ============================
  // SLASH
  // ============================

  if (interaction.isChatInputCommand()) {

    // ==========================
    // /ai-chat
    // ==========================

    if (interaction.commandName === "ai-chat") {

      if (
        !interaction.member.permissions.has(
          PermissionsBitField.Flags.ManageGuild
        )
      ) {

        return interaction.reply({
          content: "❌ تحتاج صلاحية إدارة السيرفر.",
          flags: 64
        });

      }

      const channel =
        interaction.options.getChannel("channel");

      config.aiChatId = channel.id;

      saveConfig();

      return interaction.reply({
        content:
          `✅ تم تحديد شات AI:\n${channel}`,
        flags: 64
      });

    }

    // ==========================
    // /ai-category
    // ==========================

    if (interaction.commandName === "ai-category") {

      if (
        !interaction.member.permissions.has(
          PermissionsBitField.Flags.ManageGuild
        )
      ) {

        return interaction.reply({
          content: "❌ تحتاج صلاحية إدارة السيرفر.",
          flags: 64
        });

      }

      const category =
        interaction.options.getChannel("category");

      config.ticketCategoryId = category.id;

      saveConfig();

      return interaction.reply({
        content:
          `✅ تم تحديد كاتيجوري التكتات:\n${category}`,
        flags: 64
      });

    }

    // ==========================
    // /ai-stats
    // ==========================

    if (interaction.commandName === "ai-stats") {

      const embed = new EmbedBuilder()
        .setTitle("🤖 حالة نظام AI")
        .setDescription("نظام الذكاء الاصطناعي يعمل.")
        .addFields(
          {
            name: "🧠 شات AI",
            value: config.aiChatId
              ? `<#${config.aiChatId}>`
              : "❌ غير محدد"
          },
          {
            name: "🎫 كاتيجوري التكت",
            value: config.ticketCategoryId
              ? `<#${config.ticketCategoryId}>`
              : "❌ غير محددة"
          },
          {
            name: "🟢 البوت",
            value: "Online"
          }
        )
        .setTimestamp();

      return interaction.reply({
        embeds: [embed]
      });

    }

    // ==========================
    // /panel
    // ==========================

    if (interaction.commandName === "panel") {

      const embed = new EmbedBuilder()
        .setTitle("🎫 مركز الدعم")
        .setDescription(
          "اضغط على الزر بالأسفل لفتح تذكرة دعم خاصة."
        )
        .setColor(0x5865F2);

      const row = new ActionRowBuilder()
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

    // ==========================
    // /ai-ticket
    // ==========================

    if (interaction.commandName === "ai-ticket") {

      const embed = new EmbedBuilder()
        .setTitle("🤖 AI Ticket")
        .setDescription(
          "افتح تذكرة وسيقوم الذكاء الاصطناعي بمساعدتك."
        )
        .setColor(0x5865F2);

      const row = new ActionRowBuilder()
        .addComponents(

          new ButtonBuilder()
            .setCustomId("open_ai_ticket")
            .setLabel("فتح AI Ticket")
            .setEmoji("🤖")
            .setStyle(ButtonStyle.Success)

        );

      return interaction.reply({
        embeds: [embed],
        components: [row]
      });

    }

  }

  // ============================
  // OPEN TICKET
  // ============================

  if (
    interaction.isButton() &&
    interaction.customId === "open_ai_ticket"
  ) {

    if (!config.ticketCategoryId) {

      return interaction.reply({
        content:
          "❌ لم يتم تحديد الكاتيجوري.\nاستخدم `/ai-category` أولاً.",
        flags: 64
      });

    }

    const guild = interaction.guild;

    // منع تكت ثاني لنفس المستخدم

    const existing = guild.channels.cache.find(
      channel =>
        channel.type === ChannelType.GuildText &&
        channel.topic ===
          `AI_TICKET:${interaction.user.id}`
    );

    if (existing) {

      return interaction.reply({
        content:
          `❌ لديك تكت مفتوح بالفعل: ${existing}`,
        flags: 64
      });

    }

    try {

      const ticket =
        await guild.channels.create({

          name:
            `ai-ticket-${interaction.user.username}`
              .toLowerCase()
              .replace(/[^a-z0-9-]/g, "")
              .slice(0, 20) ||
            `ai-ticket-${interaction.user.id}`,

          type: ChannelType.GuildText,

          parent: config.ticketCategoryId,

          topic:
            `AI_TICKET:${interaction.user.id}`,

          permissionOverwrites: [

            {
              id: guild.roles.everyone.id,

              deny: [
                PermissionsBitField.Flags.ViewChannel
              ]
            },

            {
              id: interaction.user.id,

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
        .setTitle("🤖 AI Support")
        .setDescription(
          `أهلاً <@${interaction.user.id}> 👋\n\nاكتب مشكلتك هنا وسيرد عليك AI.\n\n🔒 عند الانتهاء اضغط إغلاق التكت.`
        )
        .setColor(0x5865F2);

      const row = new ActionRowBuilder()
        .addComponents(

          new ButtonBuilder()
            .setCustomId("close_ai_ticket")
            .setLabel("إغلاق التكت")
            .setEmoji("🔒")
            .setStyle(ButtonStyle.Danger)

        );

      await ticket.send({
        content: `<@${interaction.user.id}>`,
        embeds: [embed],
        components: [row]
      });

      return interaction.reply({
        content:
          `✅ تم إنشاء التكت: ${ticket}`,
        flags: 64
      });

    } catch (error) {

      console.error("❌ Ticket Error:", error);

      return interaction.reply({
        content:
          "❌ فشل إنشاء التكت. تأكد أن البوت لديه Manage Channels.",
        flags: 64
      });

    }

  }

  // ============================
  // CLOSE TICKET
  // ============================

  if (
    interaction.isButton() &&
    interaction.customId === "close_ai_ticket"
  ) {

    if (
      !interaction.channel.topic?.startsWith("AI_TICKET:")
    ) {

      return interaction.reply({
        content: "❌ هذا ليس AI Ticket.",
        flags: 64
      });

    }

    await interaction.reply(
      "🔒 سيتم إغلاق التكت خلال ثانيتين..."
    );

    setTimeout(async () => {

      try {

        await interaction.channel.delete();

      } catch (error) {

        console.error(error);

      }

    }, 2000);

  }

});

// ===============================
// LOGIN
// ===============================

client.login(DISCORD_TOKEN);
