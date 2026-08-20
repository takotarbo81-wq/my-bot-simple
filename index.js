require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const Groq = require("groq-sdk");
const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// ==============================
// النماذج
// ==============================

const TEXT_MODEL = "openai/gpt-oss-20b";
const VISION_MODEL = "qwen/qwen3.6-27b";

// ==============================
// إعدادات
// ==============================

const SUPPORT_ROLE_ID =
  process.env.SUPPORT_ROLE_ID || "";

const MAX_MEMORY = 12;

const DATA_FILE = "./ticket-data.json";

let data = {
  memories: {},
  ratings: {},
  stats: {
    opened: 0,
    closed: 0,
    transferred: 0,
    ratings: 0,
    ratingSum: 0
  }
};

// ==============================
// تحميل البيانات
// ==============================

try {
  if (fs.existsSync(DATA_FILE)) {
    data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );
  }
} catch (error) {
  console.log("⚠️ لم يتم تحميل البيانات القديمة.");
}

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2)
    );
  } catch (error) {
    console.error(
      "❌ Data Save Error:",
      error.message
    );
  }
}

// ==============================
// تشغيل البوت
// ==============================

client.once("ready", () => {
  console.log("================================");
  console.log("🤖 TicketAI Online");
  console.log("🧠 Text: " + TEXT_MODEL);
  console.log("🖼️ Vision: " + VISION_MODEL);
  console.log("================================");
});

// ==============================
// هل القناة تكت؟
/ ==============================

function isTicket(channel) {
  if (!channel) return false;

  if (
    channel.type !== ChannelType.GuildText
  ) {
    return false;
  }

  const name =
    channel.name.toLowerCase();

  return (
    name.startsWith("ticket-") ||
    name.startsWith("تكت-") ||
    name.includes("ticket")
  );
}

// ==============================
// الذاكرة
// ==============================

function getMemory(channelId) {
  if (!data.memories[channelId]) {
    data.memories[channelId] = [];
  }

  return data.memories[channelId];
}

function addMemory(
  channelId,
  role,
  content
) {
  const memory =
    getMemory(channelId);

  memory.push({
    role,
    content
  });

  while (
    memory.length > MAX_MEMORY
  ) {
    memory.shift();
  }

  saveData();
}

function getHistory(channelId) {
  return getMemory(channelId)
    .map(
      x =>
        `${x.role}: ${x.content}`
    )
    .join("\n");
}

// ==============================
// تحليل رسالة المستخدم
// ==============================

async function detectIntent(text) {
  try {
    const response =
      await groq.chat.completions.create({
        model: TEXT_MODEL,

        messages: [
          {
            role: "system",

            content: `
حلل رسالة عضو Discord.

اختر نوعًا واحدًا فقط:

NORMAL
ROLE_PROBLEM
ABUSE
RESOLVED

المعاني:

ROLE_PROBLEM:
المستخدم يقول إن شخصًا سحب رتبته،
أزال رتبته، أخذ صلاحياته، أو ظلمَه في الرتب.

ABUSE:
المستخدم يقول إن شخصًا سبه،
شتمه، أهانه، أو أساء له.

RESOLVED:
المستخدم يقول إن المشكلة انحلت،
أو يشكر الدعم بعد حل المشكلة.

NORMAL:
أي شيء آخر.

أرسل الكلمة فقط.
`
          },
          {
            role: "user",
            content: text
          }
        ],

        temperature: 0.1,
        max_completion_tokens: 20
      });

    const result =
      response.choices?.[0]
        ?.message?.content
        ?.trim()
        ?.toUpperCase();

    if (
      result === "ROLE_PROBLEM" ||
      result === "ABUSE" ||
      result === "RESOLVED"
    ) {
      return result;
    }

    return "NORMAL";

  } catch (error) {
    console.error(
      "Intent Error:",
      error.message
    );

    return "NORMAL";
  }
}

// ==============================
// فحص الصورة
// ==============================

async function checkImage(
  imageUrl
) {
  try {
    const response =
      await groq.chat.completions.create({
        model: VISION_MODEL,

        messages: [
          {
            role: "user",

            content: [
              {
                type: "text",

                text: `
هذه صورة أرسلها عضو في تذكرة دعم.

نريد معرفة هل الصورة تحتوي على دليل واضح على:
- سب أو شتم أو إهانة بين أعضاء Discord
- إساءة واضحة
- رسالة مخالفة واضحة

لا تفترض وجود إساءة إذا لم تكن ظاهرة.

أجب بهذا الشكل فقط:

YES

أو:

NO
`
              },

              {
                type: "image_url",

                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],

        temperature: 0.1,
        max_completion_tokens: 20
      });

    const result =
      response.choices?.[0]
        ?.message?.content
        ?.trim()
        ?.toUpperCase();

    return result === "YES";

  } catch (error) {
    console.error(
      "Vision Error:",
      error.message
    );

    return false;
  }
}

// ==============================
// تحويل التكت للوكيل
// ==============================

async function transferToSupport(
  message,
  reason
) {
  const channel =
    message.channel;

  if (!SUPPORT_ROLE_ID) {
    await message.reply(
      "⚠️ لم يتم إعداد رتبة الوكلاء في البوت."
    );

    return;
  }

  const botMember =
    message.guild.members.me;

  if (!botMember) return;

  if (
    !botMember.permissions.has(
      PermissionsBitField.Flags.ManageChannels
    )
  ) {
    await message.reply(
      "❌ البوت يحتاج Manage Channels حتى يحوّل التكت."
    );

    return;
  }

  try {

    await channel.permissionOverwrites.edit(
      SUPPORT_ROLE_ID,
      {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      }
    );

    await channel.setName(
      "وكيل-" +
      channel.name
        .replace(/^ticket-/, "")
        .substring(0, 70)
    );

    data.stats.transferred++;
    saveData();

    await message.reply({
      content:
        `👮 تم تحويل التكت إلى وكيل الدعم.\n` +
        `📌 السبب: ${reason}\n\n` +
        `<@&${SUPPORT_ROLE_ID}>`,
      allowedMentions: {
        roles: [SUPPORT_ROLE_ID]
      }
    });

    console.log(
      "👮 Ticket transferred."
    );

  } catch (error) {

    console.error(
      "Transfer Error:",
      error.message
    );

    await message.reply(
      "❌ ما قدرت أحوّل التكت للوكيل."
    );
  }
}

// ==============================
// تغيير اسم التكت
// ==============================

async function renameTicket(
  message,
  text
) {
  const channel =
    message.channel;

  if (!isTicket(channel)) {
    return;
  }

  const botMember =
    message.guild.members.me;

  if (!botMember) return;

  if (
    !botMember.permissions.has(
      PermissionsBitField.Flags.ManageChannels
    )
  ) {
    return;
  }

  try {

    const response =
      await groq.chat.completions.create({
        model: TEXT_MODEL,

        messages: [
          {
            role: "system",

            content: `
حوّل مشكلة المستخدم إلى اسم قناة Discord.

القواعد:
- 2 إلى 4 كلمات.
- عربي.
- استخدم - بين الكلمات.
- لا تستخدم @ أو #.
- لا تستخدم ticket.
- لا تكتب شرح.
- أرسل الاسم فقط.
`
          },
          {
            role: "user",
            content: text
          }
        ],

        temperature: 0.2,
        max_completion_tokens: 30
      });

    let name =
      response.choices?.[0]
        ?.message?.content
        ?.trim();

    if (!name) return;

    name = name
      .replace(/```/g, "")
      .replace(/`/g, "")
      .replace(/@/g, "")
      .replace(/#/g, "")
      .replace(/\s+/g, "-")
      .replace(
        /[^a-zA-Z0-9\u0600-\u06FF-]/g,
        ""
      )
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 90);

    if (!name) return;

    await channel.setName(name);

    console.log(
      "🏷️ Ticket renamed: " + name
    );

  } catch (error) {
    console.log(
      "Rename Error:",
      error.message
    );
  }
}

// ==============================
// تقييم
// ==============================

async function sendRating(
  channel,
  userId
) {
  const embed =
    new EmbedBuilder()
      .setTitle("⭐ تقييم الدعم")
      .setDescription(
        "تم حل مشكلتك؟\n\n" +
        "قيّم تجربة الدعم من 1 إلى 5:"
      );

  const row =
    new ActionRowBuilder();

  for (
    let i = 1;
    i <= 5;
    i++
  ) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(
          `rating_${userId}_${i}`
        )
        .setLabel(`${i} ⭐`)
        .setStyle(
          ButtonStyle.Primary
        )
    );
  }

  await channel.send({
    embeds: [embed],
    components: [row]
  });
}

// ==============================
// إغلاق التكت
// ==============================

async function closeTicket(
  channel
) {
  try {

    const everyone =
      channel.guild.roles.everyone;

    await channel.permissionOverwrites.edit(
      everyone,
      {
        SendMessages: false
      }
    );

    await channel.setName(
      "closed-" +
      channel.name
        .replace(/^closed-/, "")
        .substring(0, 80)
    );

    data.stats.closed++;
    saveData();

    console.log(
      "🔒 Ticket closed."
    );

  } catch (error) {

    console.error(
      "Close Error:",
      error.message
    );
  }
}

// ==============================
// أزرار التقييم
// ==============================

client.on(
  "interactionCreate",
  async interaction => {

    if (!interaction.isButton()) {
      return;
    }

    if (
      !interaction.customId.startsWith(
        "rating_"
      )
    ) {
      return;
    }

    const parts =
      interaction.customId.split("_");

    const userId = parts[1];
    const rating =
      Number(parts[2]);

    if (
      interaction.user.id !== userId
    ) {
      await interaction.reply({
        content:
          "❌ هذا التقييم ليس لك.",
        ephemeral: true
      });

      return;
    }

    if (
      rating < 1 ||
      rating > 5
    ) {
      return;
    }

    const ratingKey =
      `${interaction.channel.id}_${userId}`;

    if (
      data.ratings[ratingKey]
    ) {
      await interaction.reply({
        content:
          "❌ لقد قيّمت هذا التكت مسبقًا.",
        ephemeral: true
      });

      return;
    }

    data.ratings[ratingKey] =
      rating;

    data.stats.ratings++;
    data.stats.ratingSum +=
      rating;

    saveData();

    await interaction.reply({
      content:
        `⭐ شكرًا! تقييمك **${rating}/5** تم تسجيله.`,
      ephemeral: true
    });

    await interaction.channel.send(
      "🔒 شكرًا لتقييمك، سيتم إغلاق التكت الآن."
    );

    // نعطي Discord لحظة لإرسال الرسالة
    setTimeout(
      async () => {
        await closeTicket(
          interaction.channel
        );
      },
      2000
    );
  }
);

// ==============================
// الرسائل
// ==============================

client.on(
  "messageCreate",
  async message => {

    if (message.author.bot) {
      return;
    }

    if (!message.guild) {
      return;
    }

    if (!isTicket(message.channel)) {
      return;
    }

    const text =
      message.content.trim();

    // ==========================
    // إذا أرسل صورة
    // ==========================

    if (
      message.attachments.size > 0
    ) {

      const image =
        message.attachments.find(
          file =>
            file.contentType &&
            file.contentType.startsWith(
              "image/"
            )
        );

      if (image) {

        await message.channel
          .sendTyping()
          .catch(() => {});

        await message.reply(
          "🔎 لحظة، أراجع الصورة..."
        );

        const isEvidence =
          await checkImage(
            image.url
          );

        if (isEvidence) {

          await transferToSupport(
            message,
            "تم العثور على دليل واضح في الصورة."
          );

        } else {

          await message.reply(
            "⚠️ لم أستطع تأكيد المخالفة من الصورة. إذا كانت هناك صورة أوضح، أرسلها."
          );
        }

        return;
      }
    }

    if (!text) {
      return;
    }

    console.log(
      `📩 ${message.author.username}: ${text}`
    );

    try {

      await message.channel
        .sendTyping()
        .catch(() => {});

      // حفظ الرسالة
      addMemory(
        message.channel.id,
        "العضو",
        text
      );

      // ==========================
      // فهم نية المستخدم
      // ==========================

      const intent =
        await detectIntent(text);

      console.log(
        "🧠 Intent:",
        intent
      );

      // ==========================
      // مشكلة رتبة
      // ==========================

      if (
        intent === "ROLE_PROBLEM"
      ) {

        await message.reply(
          "تمام، فهمت مشكلتك. 👮 راح أحوّل التكت لوكيل الدعم حتى يساعدك."
        );

        await transferToSupport(
          message,
          "مشكلة في الرتب أو الصلاحيات."
        );

        return;
      }

      // ==========================
      // سب / إساءة
      // ==========================

      if (
        intent === "ABUSE"
      ) {

        await message.reply(
          "📸 إذا كان شخص سبّك أو أساء لك، أرسل Screenshot واضحة للمحادثة حتى أراجعها."
        );

        return;
      }

      // ==========================
      // المشكلة انحلت
      // ==========================

      if (
        intent === "RESOLVED"
      ) {

        await message.reply(
          "❤️ ممتاز! سعيد إن مشكلتك انحلت. قبل إغلاق التكت، قيّم تجربة الدعم."
        );

        await sendRating(
          message.channel,
          message.author.id
        );

        return;
      }

      // ==========================
      // تغيير الاسم
      // ==========================

      await renameTicket(
        message,
        text
      );

      // ==========================
      // AI
      // ==========================

      const history =
        getHistory(
          message.channel.id
        );

      const response =
        await groq.chat.completions.create({
          model: TEXT_MODEL,

          messages: [
            {
              role: "system",

              content: `
أنت TicketAI، مساعد دعم فني داخل Discord.

افهم Discord والتذاكر والرتب والقنوات
والصلاحيات والبوتات والمشاكل التقنية.

تحدث بالعربية الطبيعية وباللهجة العامية
إذا كان المستخدم يستخدمها.

ساعد المستخدم بشكل مباشر.

إذا احتاج صورة:
اطلب منه Screenshot.

إذا لم تفهم المشكلة:
اسأل سؤالًا واضحًا.

لا تسب.
لا تكرر الرد.
لا تقل إنك مجرد بوت.
لا تكتب Draft.
لا تخترع معلومات.

سياق التكت السابق:
${history}
`
            },
            {
              role: "user",
              content: text
            }
          ],

          temperature: 0.7,
          max_completion_tokens: 500
        });

      const answer =
        response.choices?.[0]
          ?.message?.content
          ?.trim();

      if (!answer) {
        await message.reply(
          "❌ ما قدرت أجهز رد حاليًا."
        );

        return;
      }

      await message.reply({
        content:
          answer.substring(0, 1900),

        allowedMentions: {
          repliedUser: false
        }
      });

      addMemory(
        message.channel.id,
        "TicketAI",
        answer
      );

    } catch (error) {

      console.error(
        "================================"
      );

      console.error(
        "❌ AI ERROR:",
        error
      );

      console.error(
        "================================"
      );

      await message.reply(
        "❌ صار خطأ مؤقت بالذكاء الاصطناعي."
      ).catch(() => {});
    }
  }
);

// ==============================
// إحصائيات
// ==============================

client.on(
  "messageCreate",
  async message => {

    if (message.author.bot) {
      return;
    }

    if (
      message.content ===
      "!ticketstats"
    ) {

      if (
        !message.member.permissions.has(
          PermissionsBitField.Flags.ManageGuild
        )
      ) {
        return;
      }

      const average =
        data.stats.ratings > 0
          ? (
              data.stats.ratingSum /
              data.stats.ratings
            ).toFixed(2)
          : "لا يوجد";

      await message.reply(
        `📊 **TicketAI Stats**\n\n` +
        `🎫 التكتات المغلقة: ${data.stats.closed}\n` +
        `👮 المحولة للوكلاء: ${data.stats.transferred}\n` +
        `⭐ التقييمات: ${data.stats.ratings}\n` +
        `📈 المتوسط: ${average}/5`
      );
    }
  }
);

// ==============================
// أخطاء
// ==============================

process.on(
  "unhandledRejection",
  error => {
    console.error(
      "Unhandled Rejection:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  error => {
    console.error(
      "Uncaught Exception:",
      error
    );
  }
);

// ==============================
// Variables
// ==============================

if (!process.env.DISCORD_TOKEN) {
  console.error(
    "❌ DISCORD_TOKEN غير موجود."
  );

  process.exit(1);
}

if (!process.env.GROQ_API_KEY) {
  console.error(
    "❌ GROQ_API_KEY غير موجود."
  );

  process.exit(1);
}

if (!process.env.SUPPORT_ROLE_ID) {
  console.error(
    "❌ SUPPORT_ROLE_ID غير موجود."
  );

  process.exit(1);
}

// ==============================
// Login
// ==============================

client.login(
  process.env.DISCORD_TOKEN
);
