const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzo86xOy48YydkIGVeyd1t2L1dUdSqoERGoKBZvPLfspWA9dy6567ZHiG0Tjk2WTBph/exec";

export default {
  async fetch(request, env) {

    if (request.method !== "POST") {
      return new Response("ATWORK Webhook OK", {
        status: 200
      });
    }

    try {

      const body = await request.text();

      // ตรวจสอบลายเซ็นจาก LINE
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

      // ส่ง Webhook ต่อไปยัง Apps Script
      const response =
        await fetch(APPS_SCRIPT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: body
        });

      console.log(
        "Apps Script response:",
        response.status
      );

      // LINE ต้องการ HTTP 200 จาก Webhook ตัวนี้
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
          ok: false,
          message: "Webhook error"
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
// LINE Webhook Signature Verification
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
      new TextEncoder().encode(channelSecret),
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

  const expectedSignature =
    arrayBufferToBase64(signatureBytes);

  return timingSafeEqual(
    expectedSignature,
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
