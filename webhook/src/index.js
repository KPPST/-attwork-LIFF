const LIFF_URL =
  "https://liff.line.me/2011817085-Mqy2mWhy";

export default {
  async fetch(request, env, ctx) {

    // ==========================================
    // GET
    // ==========================================
    if (request.method === "GET") {
      return new Response("ATWORK Webhook OK", {
        status: 200
      });
    }

    // ==========================================
    // รับเฉพาะ POST
    // ==========================================
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405
      });
    }

    try {

      // อ่าน body
      const body = await request.text();

      // ==========================================
      // ตรวจ LINE Signature
      // ==========================================
      const signature =
        request.headers.get("x-line-signature") || "";

      if (!signature) {
        return new Response("Missing signature", {
          status: 400
        });
      }

      const valid =
        await verifyLineSignature(
          body,
          signature,
          env.LINE_CHANNEL_SECRET
        );

      if (!valid) {
        return new Response("Invalid signature", {
          status: 401
        });
      }

      // ==========================================
      // Parse LINE webhook
      // ==========================================
      const data = JSON.parse(body);

      // ==========================================
      // ตอบ LINE ก่อนทันที
      // ==========================================
      ctx.waitUntil(
        processLineEvents(data, env)
      );

      return new Response(
        JSON.stringify({
          ok: true
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );

    } catch (error) {

      console.error(
        "ATWORK WEBHOOK ERROR:",
        error
      );

      return new Response(
        JSON.stringify({
          ok: false
        }),
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


// =====================================================
// ประมวลผล LINE Events
// =====================================================

async function processLineEvents(data, env) {

  const events =
    Array.isArray(data.events)
      ? data.events
      : [];

  for (const event of events) {

    // ------------------------------------------
    // ข้อความจากผู้ใช้
    // ------------------------------------------
    if (
      event.type === "message" &&
      event.message &&
      event.message.type === "text"
    ) {

      const message =
        String(
          event.message.text || ""
        ).trim();

      // ------------------------------------------
      // สำหรับผู้หางาน
      // ------------------------------------------
      if (
        message === "สำหรับผู้หางาน" &&
        event.replyToken
      ) {

        await sendAtworkWelcomeFlex(
          event.replyToken,
          env.LINE_CHANNEL_ACCESS_TOKEN
        );

        continue;
      }
    }
  }
}


// =====================================================
// ATWORK FLEX
// =====================================================

async function sendAtworkWelcomeFlex(
  replyToken,
  channelAccessToken
) {

  const url =
    "https://api.line.me/v2/bot/message/reply";

  const message = {
    type: "flex",
    altText: "ATWORK เมนูสำหรับผู้หางาน",

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
            text: "ATWORK",
            weight: "bold",
            size: "xl",
            color: "#222222"
          },

          {
            type: "text",
            text: "Recruitment Services",
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
              uri:
                "https://liff.line.me/2011817085-Mqy2mWhy"
            }
          },

          {
            type: "button",
            style: "secondary",
            height: "md",

            action: {
              type: "uri",
              label: "ดูตำแหน่งงานว่าง",
              uri:
                "https://liff.line.me/2011817085-Mqy2mWhy"
            }
          },

          {
            type: "button",
            style: "secondary",
            height: "md",

            action: {
              type: "uri",
              label: "ตรวจสอบสถานะการสมัคร",
              uri:
                "https://liff.line.me/2011817085-Mqy2mWhy"
            }
          }

        ]
      }
    }
  };

  const response =
    await fetch(url, {

      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization":
          "Bearer " +
          channelAccessToken
      },

      body: JSON.stringify({
        replyToken: replyToken,
        messages: [message]
      })
    });

  const result =
    await response.text();

  console.log(
    "LINE Reply:",
    response.status,
    result
  );
}


// =====================================================
// LINE Signature Verification
// =====================================================

async function verifyLineSignature(
  body,
  signature,
  channelSecret
) {

  if (!channelSecret) {
    return false;
  }

  const key =
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(
        channelSecret
      ),
      {
        name: "HMAC",
        hash: "SHA-256"
      },
      false,
      ["sign"]
    );

  const signatureBytes =
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(body)
    );

  const expected =
    arrayBufferToBase64(
      signatureBytes
    );

  return timingSafeEqual(
    expected,
    signature
  );
}


// =====================================================
// Helpers
// =====================================================

function arrayBufferToBase64(buffer) {

  const bytes =
    new Uint8Array(buffer);

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

    result |=
      a.charCodeAt(i) ^
      b.charCodeAt(i);
  }

  return result === 0;
}
