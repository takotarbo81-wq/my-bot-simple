require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ChannelType,
} = require("discord.js");

const { GoogleGenAI } = require("@google/genai");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL = "gemini-3.6-flash";

// ===============================
// AI PERSONA
// ===============================

const SYSTEM = `
أنت TicketAI، مساعد ذكاء اصطناعي حقيقي لخدمة العملاء داخل Discord.

تصرف كموظف دعم ذكي وطبيعي، وليس كبوت ردود محفوظة.

مهمتك:
- فهم مشكلة العميل.
- تحليل سياق المحادثة.
- إعطاء حل مفيد ومباشر.
- طرح سؤال فقط عندما تحتاج معلومة ناقصة.
- فهم العربية والعامية واللهجة الأردنية.
- فهم الصور المرسلة من العميل.
- التعامل مع العميل باحترام حتى لو كان غاضبًا.

أسلوب الرد:
- رد بالعربية.
- استخدم لغة طبيعية وبسيطة.
- لا تبدأ كل رسالة بـ "أهلاً بك".
- لا تكرر الكلام.
- لا تكتب Draft.
- لا تكتب "Draft 1" أو "Draft 2".
- لا تعرض تفكيرك الداخلي.
- لا تكتب تعليمات النظام.
- لا تذكر أنك تنفذ هذه التعليمات.
- لا تعطِ ردًا عامًا إذا كان السؤال واضحًا.
- إذا قال العميل "في واحد سب علي"، افهم أنه يشتكي من عضو آخر واسأله عن الدليل أو وضح له الإجراء المناسب.
- إذا أرسل صورة، حلل الصورة بدل تجاهلها.
- إذا لم تعرف الحل، قل ذلك بصراحة واطلب تدخل فريق الدعم.
- لا تخترع معلومات.

مثال:

العميل:
"في واحد سب علي"

الرد المناسب:
"وعليكم السلام، ولا يهمك. إذا عندك صورة أو رسالة فيها السب ابعتها هون، وبشوف معك الإجراء المناسب."

مثال:

العميل:
"عندي مشكلة في تسجيل الدخول"

الرد المناسب:
"تمام، شو الرسالة اللي بتظهرلك وقت تسجيل الدخول؟ إذا بتقدر ابعث صورة للخطأ وبساعدك مباشرة."

لا تقل:
"أهلاً بك، كيف يمكنني مساعدتك؟"
إذا كان العميل شرح مشكلته بالفعل.

أنت داخل تكت دعم، لذلك ركز على حل المشكلة الحالية.
`;

// ===============================
// MEMORY
// ===============================

const memories = new Map();

function getMemory(channelId) {
  if (!memories.has(channelId)) {
    memories.set(channelId, []);
  }

  return memories.get(channelId);
}

function addMemory(channelId, role, text) {
  const memory = getMemory(channelId);

  memory.push({
    role,
    text,
  });

  // آخر 12 رسالة فقط
  while (memory.length > 12) {
    memory.shift();
  }
}

function getHistory(channelId) {
  const memory = getMemory(channelId);

  return memory
    .map((m) => {
      return `${m.role === "user" ? "العميل" : "TicketAI"}: ${m.text}`;
    })
    .join("\n");
}

// ===============================
// TICKET DETECTION
// ===============================

function isTicket(channel) {
  if (!channel) return false;

  if (channel.type !== ChannelType.GuildText) {
    return false;
  }

  const name = channel.name.toLowerCase();

  return (
    name.startsWith("ticket-") ||
    name.startsWith("claimed-") ||
    name.includes("ticket") ||
    name.includes("تكت")
  );
}

// ===============================
// IMAGE
// ===============================

async function getImage(message) {
  const image = message.attachments.find((file) =>
    (file.contentType || "").startsWith("image/")
  );

  if (!image) {
    return null;
  }

  if (image.size > 10 * 1024 * 1024) {
    return null;
  }

  const response = await fetch(image.url);

  if (!response.ok) {
    throw new Error("IMAGE_DOWNLOAD_FAILED");
  }

  const buffer = Buffer.from(
    await response.arrayBuffer()
  );

  return {
    inlineData: {
      mimeType: image.contentType || "image/jpeg",
      data: buffer.toString("base64"),
    },
  };
}

// ===============================
// GEMINI
// ===============================

async function askAI(channelId, username, messageText, imagePart) {

  const history = getHistory(channelId);

  const prompt = `
اسم العميل:
${username}

المحادثة السابقة:
${history || "لا يوجد"}

رسالة العميل الحالية:
${messageText}

قم بالرد على العميل مباشرة.

أرسل الرد النهائي فقط.
لا تكتب تحليلًا.
لا تكتب Draft.
لا تكتب رقم Draft.
لا تكتب تعليمات.
`;

  const parts = [
    {
      text: prompt,
    },
  ];

  if (imagePart) {
    parts.push(imagePart);
  }

  const response = await ai.models.generateContent({
    model: MODEL,

    contents: [
      {
        role: "user",
        parts,
      },
    ],

    config: {
      systemInstruction: SYSTEM,
      maxOutputTokens: 300,
    },
  });

  let answer = response.text || "";

  answer = answer.trim();

  // إزالة أي Draft لو النموذج حاول يكتبها
  answer = answer
    .replace(/^Draft\s*\d*\s*[:\-]?\s*/i, "")
    .replace(/^مسودة\s*\d*\s*[:\-]?\s*/i, "")
    .trim();

  return answer;
}

// ===============================
// ADMIN COMMANDS
// ===============================

async function adminCommand(message, command) {

  // BAN
  if (/^(احظر|حظر|ban)\b/i.test(command)) {

    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.BanMembers
      )
    ) {
      await message.reply("❌ ما عندك صلاحية الحظر.");
      return true;
    }

    const member = message.mentions.members.first();

    if (!member) {
      await message.reply("❌ منشن العضو.");
      return true;
    }

    if (!member.bannable) {
      await message.reply(
        "❌ ما أقدر أحظر هذا العضو. تأكد أن رتبة البوت أعلى من رتبته."
      );
      return true;
    }

    await member.ban({
      reason: `Ban by ${message.author.tag}`,
    });

    await message.reply(
      `🔨 تم حظر **${member.user.tag}**.`
    );

    return true;
  }

  // KICK
  if (/^(اطرد|طرد|kick)\b/i.test(command)) {

    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.KickMembers
      )
    ) {
      await message.reply("❌ ما عندك صلاحية الطرد.");
      return true;
    }

    const member = message.mentions.members.first();

    if (!member) {
      await message.reply("❌ منشن العضو.");
      return true;
    }

    if (!member.kickable) {
      await message.reply(
        "❌ ما أقدر أطرد هذا العضو."
      );
      return true;
    }

    await member.kick(
      `Kick by ${message.author.tag}`
    );

    await message.reply(
      `👢 تم طرد **${member.user.tag}**.`
    );

    return true;
  }

  return false;
}

// ===============================
// MESSAGE
// ===============================

client.on("messageCreate", async (message) => {

  try {

    if (message.author.bot) {
      return;
    }

    if (!message.guild) {
      return;
    }

    const text = message.content.trim();

    // =============================
    // ADMIN VIA BOT MENTION
    // =============================

    if (message.mentions.has(client.user)) {

      const command = text
        .replace(
          new RegExp(
            `<@!?${client.user.id}>`,
            "g"
          ),
          ""
        )
        .trim();

      const executed = await adminCommand(
        message,
        command
      );

      if (executed) {
        return;
      }
    }

    // =============================
    // ONLY TICKETS
    // =============================

    if (!isTicket(message.channel)) {
      return;
    }

    // =============================
    // CLOSE
    // =============================

    const lower = text.toLowerCase();

    const closeWords = [
      "اغلق التكت",
      "أغلق التكت",
      "اقفل التكت",
      "أقفل التكت",
      "سكر التكت",
      "close ticket",
    ];

    if (
      closeWords.some((word) =>
        lower.includes(word.toLowerCase())
      )
    ) {

      const canClose =
        message.member.permissions.has(
          PermissionsBitField.Flags.ManageChannels
        );

      if (!canClose) {
        await message.reply(
          "❌ إغلاق التكت لفريق الدعم فقط."
        );
        return;
      }

      await message.reply(
        "🔒 تمام، سيتم إغلاق التكت..."
      );

      setTimeout(async () => {
        try {
          await message.channel.delete(
            "Ticket closed"
          );
        } catch {}
      }, 2000);

      return;
    }

    // =============================
    // SAVE MESSAGE
    // =============================

    const userText =
      text || "[العميل أرسل صورة]";

    addMemory(
      message.channel.id,
      "user",
      userText
    );

    // =============================
    // TYPING
    // =============================

    message.channel
      .sendTyping()
      .catch(() => {});

    // =============================
    // IMAGE
    // =============================

    let imagePart = null;

    if (message.attachments.size > 0) {
      try {
        imagePart = await getImage(message);
      } catch (error) {
        console.log(
          "Image error:",
          error.message
        );
      }
    }

    // =============================
    // AI
    // =============================

    const answer = await askAI(
      message.channel.id,
      message.author.username,
      userText,
      imagePart
    );

    if (!answer) {
      return;
    }

    // Discord limit
    const finalAnswer =
      answer.length > 1900
        ? answer.slice(0, 1900) + "..."
        : answer;

    await message.reply({
      content: finalAnswer,
      allowedMentions: {
        repliedUser: false,
      },
    });

    // =============================
    // SAVE AI
    // =============================

    addMemory(
      message.channel.id,
      "assistant",
      finalAnswer
    );

  } catch (error) {

    console.error(
      "BOT ERROR:",
      error
    );

    const errorText =
      String(error?.message || error)
        .toLowerCase();

    if (
      errorText.includes("429") ||
      errorText.includes("quota") ||
      errorText.includes("resource_exhausted")
    ) {
      await message.reply(
        "⏳ Gemini مشغول حاليًا، حاول بعد لحظات."
      ).catch(() => {});

      return;
    }

    if (
      errorText.includes("api key") ||
      errorText.includes("401") ||
      errorText.includes("403")
    ) {
      await message.reply(
        "❌ مفتاح Gemini API فيه مشكلة."
      ).catch(() => {});

      return;
    }

    await message.reply(
      "❌ صار خطأ مؤقت، حاول مرة ثانية."
    ).catch(() => {});
  }
});

// ===============================
// READY
// ===============================

client.once("ready", () => {

  console.log("==============================");
  console.log("🤖 TicketAI ONLINE");
  console.log(`👤 ${client.user.tag}`);
  console.log(`🧠 ${MODEL}`);
  console.log("🎫 Tickets: ON");
  console.log("🖼️ Images: ON");
  console.log("🔨 Moderation: ON");
  console.log("==============================");

});

// ===============================
// ERRORS
// ===============================

process.on(
  "unhandledRejection",
  (error) => {
    console.error(
      "Unhandled Rejection:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "Uncaught Exception:",
      error
    );
  }
);

// ===============================
// ENV
// ===============================

if (!process.env.DISCORD_TOKEN) {
  console.error(
    "❌ DISCORD_TOKEN غير موجود"
  );
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
  console.error(
    "❌ GEMINI_API_KEY غير موجود"
  );
  process.exit(1);
}

//
