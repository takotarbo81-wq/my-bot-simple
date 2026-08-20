const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const OpenAI = require("openai");
require("dotenv").config();

// =========================
// CHECK ENV
// =========================

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN غير موجود في Railway Variables");
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY غير موجود في Railway Variables");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// =========================
// SETTINGS
// =========================

const AI_MODEL = process.env.AI_MODEL || "gpt-5-mini";

const SYSTEM_PROMPT = `
أنت TicketAI، بوت دعم فني عربي داخل Discord.

قواعدك:
- رد بالعربية بشكل واضح ومختصر.
- ساعد المستخدم في حل مشكلته.
- لا تدّعي أنك إنسان.
- إذا كانت المشكلة تحتاج صلاحيات أو تدخل إداري، قل له ذلك.
- لا تكرر نفس الكلام.
- كن محترماً وودوداً.
- لا تستخدم Markdown بشكل مبالغ فيه.
`;

// =========================
// SLASH COMMANDS
// =========================

const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("إرسال لوحة فتح التكت")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("فحص البوت"),
].map(command => command.toJSON());

// =========================
// REGISTER COMMANDS
// =========================

client.once("ready", async () => {
  console.log("================================");
  console.log("🤖 TicketAI Online");
  console.log(`👤 ${client.user.tag}`);
  console.log(`🌐 Servers: ${client.guilds.cache.size}`);
  console.log("================================");

  try {
    const rest = new REST({ version: "10" }).setToken(
      process.env.DISCORD_TOKEN
    );

    await rest.put(
      Routes.applicationCommands(client.user.id),
      {
        body: commands,
      }
    );

    console.log("✅ تم تسجيل جميع الأوامر");
  } catch (error) {
    console.error("❌ خطأ تسجيل الأوامر:", error);
  }

  client.user.setPresence({
    activities: [
      {
        name: "التذاكر 🎫",
        type: 3,
      },
    ],
    status: "online",
  });
});

// =========================
// SLASH COMMANDS
// =========================

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // /ping
  if (interaction.commandName === "ping") {
    return interaction.reply({
      content: `🏓 Pong!\nLatency: ${client.ws.ping}ms`,
    });
  }

  // /panel
  if (interaction.commandName === "panel") {
    const embed = new EmbedBuilder()
      .setTitle("🤖 TicketAI Support")
      .setDescription(
        "مرحباً بك في الدعم الفني!\n\n" +
        "افتح تكت وسيقوم الذكاء الاصطناعي بمساعدتك."
      )
      .setColor(0x5865f2);

    const button = new ButtonBuilder()
      .setCustomId("create_ticket")
      .setLabel("🎫 فتح تكت")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    return interaction.reply({
      embeds: [embed],
      components: [row],
    });
  }
});

// =========================
// BUTTONS
// =========================

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  // =========================
  // CREATE TICKET
  // =========================

  if (interaction.customId === "create_ticket") {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guild = interaction.guild;

      const existing = guild.channels.cache.find(
        channel =>
          channel.name === `ticket-${interaction.user.id}` &&
          channel.type === 0
      );

      if (existing) {
        return interaction.editReply({
          content: `❌ عندك تكت مفتوح بالفعل: ${existing}`,
        });
      }

      const channel = await guild.channels.create({
        name: `ticket-${interaction.user.id}`,
        type: 0,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          {
            id: client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.ManageChannels,
            ],
          },
        ],
      });

      const embed = new EmbedBuilder()
        .setTitle("🤖 مرحباً بك في AI Support")
        .setDescription(
          "اكتب مشكلتك هنا وسأحاول مساعدتك.\n\n" +
          "💡 يمكنك إرسال أكثر من رسالة."
        )
        .setColor(0x5865f2);

      const closeButton = new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("🔒 إغلاق التكت")
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(closeButton);

      await channel.send({
        content: `<@${interaction.user.id}>`,
        embeds: [embed],
        components: [row],
      });

      await interaction.editReply({
        content: `✅ تم إنشاء التكت: ${channel}`,
      });

      console.log(`🎫 Ticket created: ${channel.name}`);
    } catch (error) {
      console.error("❌ Ticket error:", error);

      await interaction.editReply({
        content: "❌ حدث خطأ أثناء إنشاء التكت.",
      });
    }

    return;
  }

  // =========================
  // CLOSE TICKET
  // =========================

  if (interaction.customId === "close_ticket") {
    await interaction.deferReply();

    try {
      await interaction.editReply("🔒 سيتم إغلاق التكت خلال 3 ثوانٍ...");

      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch (error) {
          console.error("❌ Close ticket error:", error);
        }
      }, 3000);
    } catch (error) {
      console.error("❌ Close error:", error);
    }

    return;
  }
});

// =========================
// AI FUNCTION
// =========================

async function askAI(message) {
  const response = await openai.responses.create({
    model: AI_MODEL,

    instructions: SYSTEM_PROMPT,

    input: message,

    max_output_tokens: 500,
  });

  return response.output_text?.trim();
}

// =========================
// TICKET AI
// =========================

client.on("messageCreate", async message => {
  try {
    // تجاهل البوتات
    if (message.author.bot) return;

    // لازم يكون داخل سيرفر
    if (!message.guild) return;

    // لازم يكون تكت
    const isTicket =
      message.channel.name.startsWith("ticket-") ||
      message.channel.name.includes("ticket");

    if (!isTicket) return;

    // تجاهل الرسائل الفارغة
    if (!message.content.trim()) return;

    console.log(
      `💬 Ticket message from ${message.author.tag}: ${message.content}`
    );

    // رسالة انتظار
    const thinkingMessage = await message.channel.send(
      "🤖 جاري التفكير..."
    );

    try {
      const answer = await askAI(message.content);

      if (!answer) {
        return thinkingMessage.edit(
          "❌ الذكاء الاصطناعي لم يُرجع رداً."
        );
      }

      // Discord يسمح بحد 2000 حرف للرسالة
      const chunks = [];

      for (let i = 0; i < answer.length; i += 1900) {
        chunks.push(answer.substring(i, i + 1900));
      }

      await thinkingMessage.edit(chunks.shift());

      for (const chunk of chunks) {
        await message.channel.send(chunk);
      }

      console.log("✅ AI replied successfully");
    } catch (error) {
      console.error("❌ OpenAI ERROR:");

      if (error?.status) {
        console.error("Status:", error.status);
      }

      if (error?.message) {
        console.error("Message:", error.message);
      }

      await thinkingMessage.edit(
        "❌ حصل خطأ في الاتصال بالذكاء الاصطناعي.\n" +
        "تأكد أن `OPENAI_API_KEY` موجود وصحيح في Railway."
      );
    }
  } catch (error) {
    console.error("❌ Message error:", error);
  }
});

// =========================
// LOGIN
// =========================

client.login(process.env.DISCORD_TOKEN);
