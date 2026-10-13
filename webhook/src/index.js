javascript
const LIFF_URL =
  "https://liff.line.me/2011817085-Mqy2mWhy";

const STATUS_LIFF_URL =
  "https://liff.line.me/2011817085-3jHPlME0";

export default {
  async fetch(request, env, ctx) {
    // GET: ตรวจสอบว่า Worker ทำงานอยู่
    if (request.method === "GET") {
      return new Response("ATWORK Webhook OK", {
        status: 200
      });
    }

    // รับเฉพาะ POST
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405
      });
    }

    try {
      const body = await request.text();
      const signature =
        request.headers.get("x-line-signature") || "";

      // ตรวจสอบ LINE Signature
      if (!signature) {
        return new Response("Missing signature", {
          status: 400
        });
      }

      const valid = await verifyLineSignature(
        body,
        signature,
        env.LINE_CHANNEL_SECRET
      );

      if (!valid) {
        return new Response("Invalid signature", {
          status: 401
        });
      }

      const data = JSON.parse(body);

      // ตอบ LINE ก่อน แล้วประมวลผลต่อเบื้องหลัง
      ctx.waitUntil(processLineEvents(data, env));

      return new Response(
        JSON.stringify({ ok: true }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    } catch (error) {
      console.error("ATWORK WEBHOOK ERROR:", error);

      return new Response(
        JSON.stringify({ ok: false }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }
  }
};

// ==========================================
// ประมวลผล LINE Events
// ==========================================

async function processLineEvents(data, env) {
  const events = Array.isArray(data.events)
    ? data.events
    : [];

  for (const event of events) {
    if (
      event.type === "message" &&
      event.message &&
      event.message.type === "text"
    ) {
      const message =
        String(event.message.text || "").trim();

      // คำสั่งเมนูสำหรับผู้หางาน
      if (
        message === "สำหรับผู้หางาน" &&
        event.replyToken
      ) {
        await sendAtworkWelcomeFlex(
          event.replyToken,
          env.LINE_CHANNEL_ACCESS_TOKEN
        );
      }
    }
  }
}

// ==========================================
// ATWORK FLEX MESSAGE
// ==========================================

async function sendAtworkWelcomeFlex(
  replyToken,
  channelAccessToken
) {
  if (!channelAccessToken) {
    console.error("Missing LINE_CHANNEL_ACCESS_TOKEN");
    return;
  }

  const url =
    "https://api.line.me/v2/bot/message/reply";

  const message = {
    type: "flex",
    altText: "@attwork เมนูสำหรับผู้หางาน",

    contents: {
      type: "bubble",
      size: "mega",

      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "20px",
        spacing: "md",
        backgroundColor: "#FFFFFF",

        contents: [
          {
            type: "text",
            text: "@attwork",
            weight: "bold",
            size: "xl",
            color: "#222222"
          },
          {
            type: "text",
            text: "JOB Services",
            size: "xs",
            color: "#888888"
          },
          {
            type: "separator",
            margin: "md",
            color: "#EEEEEE"
          },
          {
            type: "button",
            style: "secondary",
            height: "md",
            action: {
              type: "uri",
              label: "ฝาก Resume",
              uri: LIFF_URL
            }
          },
          {
            type: "button",
            style: "secondary",
            height: "md",
            action: {
              type: "uri",
              label: "ดูตำแหน่งงานว่าง",
              uri: LIFF_URL
            }
          },
          {
            type: "button",
            style: "secondary",
            height: "md",
            action: {
              type: "uri",
              label: "ตรวจสอบสถานะการสมัคร",
              uri: STATUS_LIFF_URL
            }
          }
        ]
      }
    }
  };

  const response = await fetch(url, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + channelAccessToken
    },

    body: JSON.stringify({
      replyToken: replyToken,
      messages: [message]
    })
  });

  const result = await response.text();

  console.log(
    "LINE Reply:",
    response.status,
    result
  );
}

// ==========================================
// ตรวจสอบ LINE Signature
// ==========================================

async function verifyLineSignature(
  body,
  signature,
  channelSecret
) {
  if (!channelSecret) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(channelSecret),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body)
  );

  const expected =
    arrayBufferToBase64(signatureBytes);

  return timingSafeEqual(expected, signature);
}

// ==========================================
// Helpers
// ==========================================

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
