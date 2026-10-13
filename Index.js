"use strict";

/*
 * ATWORK LIFF Frontend
 * เชื่อมต่อ:
 *   GitHub Pages
 *   LINE LIFF
 *   Google Apps Script
 *   Google Sheets / Google Drive
 */

const LIFF_ID = "2011817085-Mqy2mWhy";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzo86xOy48YydkIGVeyd1t2L1dUdSqoERGoKBZvPLfspWA9dy6567ZHiG0Tjk2WTBph/exec";

const CHUNK_SIZE = 2 * 1024 * 1024;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/*
 * แปลงตัวเลือกใน HTML ให้ตรงกับ ALLOWED_POSITIONS
 * ใน Code.gs โดยไม่ต้องแก้ข้อความที่ผู้ใช้เห็น
 */
const POSITION_MAP = {
  "ช่าง": "ช่างเทคนิค",
  "พนักงานโรงงาน": "พนักงานฝ่ายผลิต",
  "ออฟฟิศ": "พนักงานออฟฟิศ"
};

let lineIdToken = "";
let lineUserProfile = null;
let isSubmitting = false;

/* ==========================================
   DOM HELPERS
========================================== */

function el(id) {
  return document.getElementById(id);
}

function showStatus(message, type = "info") {
  const box = el("submitStatus");

  if (!box) return;

  box.textContent = message;
  box.className = "status show " + type;
}

function clearStatus() {
  const box = el("submitStatus");

  if (!box) return;

  box.textContent = "";
  box.className = "status";
}

function setConnectionStatus(message, isConnected = false) {
  const status = el("connectionStatus");
  const button = el("submitButton");
  const lineUser = el("lineUser");

  if (status) {
    status.textContent = message;
    status.style.color = isConnected ? "#16a34a" : "#dc2626";
  }

  if (lineUser) {
    lineUser.style.display = "flex";
    lineUser.classList.remove("hidden");
  }

  if (button) {
    button.disabled = !isConnected;
    button.textContent = isConnected
      ? "ส่งใบสมัครและฝาก Resume"
      : "เชื่อมต่อ LINE ไม่สำเร็จ";
  }
}

function setLoading(show, title, stage, detail) {
  const overlay = el("loadingOverlay");

  if (!overlay) return;

  overlay.classList.toggle("show", Boolean(show));

  if (title !== undefined && el("loadingTitle")) {
    el("loadingTitle").textContent = title;
  }

  if (stage !== undefined && el("loadingStage")) {
    el("loadingStage").textContent = stage;
  }

  if (detail !== undefined && el("loadingDetail")) {
    el("loadingDetail").textContent = detail;
  }
}

function setUploadProgress(percent) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  const spinner = el("loadingSpinner");
  const progress = el("uploadProgress");
  const label = el("uploadPercent");
  const ring = el("progressRingValue");

  if (spinner) spinner.style.display = "none";
  if (progress) progress.hidden = false;
  if (label) label.textContent = Math.round(value) + "%";

  if (ring) {
    const circumference = 2 * Math.PI * 52;
    ring.style.strokeDasharray = String(circumference);
    ring.style.strokeDashoffset =
      String(circumference * (1 - value / 100));
  }
}

function resetUploadProgress() {
  const spinner = el("loadingSpinner");
  const progress = el("uploadProgress");
  const label = el("uploadPercent");
  const ring = el("progressRingValue");

  if (spinner) spinner.style.display = "";
  if (progress) progress.hidden = true;
  if (label) label.textContent = "0%";

  if (ring) {
    const circumference = 2 * Math.PI * 52;
    ring.style.strokeDasharray = String(circumference);
    ring.style.strokeDashoffset = String(circumference);
  }
}

/* ==========================================
   INITIALIZE LIFF
========================================== */

async function initializeLiff() {
  try {
    setConnectionStatus("กำลังโหลดระบบ LINE...");

    if (!window.liff) {
      throw new Error(
        "โหลด LINE LIFF SDK ไม่สำเร็จ กรุณาตรวจการเชื่อมต่ออินเทอร์เน็ต"
      );
    }

    /*
     * ป้องกันหน้าเว็บรอการเริ่มต้น LIFF ไม่สิ้นสุด
     */
    await Promise.race([
      window.liff.init({
        liffId: LIFF_ID
      }),

      new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              "เชื่อมต่อ LIFF นานเกินไป กรุณาปิดแล้วเปิดแบบฟอร์มใหม่"
            )
          );
        }, 15000);
      })
    ]);

    if (!window.liff.isLoggedIn()) {
      setConnectionStatus("กำลังเข้าสู่ระบบ LINE...");

      window.liff.login({
        redirectUri: window.location.href
      });

      return;
    }

    lineIdToken = window.liff.getIDToken() || "";

    if (!lineIdToken) {
      throw new Error(
        "ไม่พบ LINE ID Token กรุณาตรวจว่า LIFF เปิดใช้ scope openid แล้ว"
      );
    }

    /*
     * ดึงโปรไฟล์เพื่อแสดงชื่อและรูป
     * หากดึงรูปไม่ได้ ยังให้ทำงานต่อด้วย ID Token ได้
     */
    try {
      lineUserProfile = await window.liff.getProfile();

      if (el("lineDisplayName")) {
        el("lineDisplayName").textContent =
          lineUserProfile.displayName || "ผู้ใช้ LINE";
      }

      if (
        lineUserProfile.pictureUrl &&
        el("linePicture")
      ) {
        el("linePicture").src = lineUserProfile.pictureUrl;
      }
    } catch (profileError) {
      console.warn(
        "ไม่สามารถโหลดโปรไฟล์ LINE ได้:",
        profileError.message
      );

      if (el("lineDisplayName")) {
        el("lineDisplayName").textContent = "เชื่อมต่อ LINE แล้ว";
      }
    }

    setConnectionStatus("เชื่อมต่อ LINE สำเร็จ", true);

    clearStatus();

    console.log("ATWORK LIFF initialized successfully");

  } catch (error) {
    console.error("ATWORK LIFF INIT ERROR:", error);

    lineIdToken = "";

    setConnectionStatus(
      error.message || "เชื่อมต่อ LINE ไม่สำเร็จ"
    );

    showStatus(
      error.message ||
      "เชื่อมต่อ LINE ไม่สำเร็จ กรุณาเปิดผ่าน LINE OA อีกครั้ง",
      "error"
    );
  }
}

/* ==========================================
   GOOGLE APPS SCRIPT API
   ส่ง POST ผ่าน hidden iframe
   แล้วรับผลผ่าน JSONP
========================================== */

function createRequestId() {
  return "req_" +
    Date.now() + "_" +
    Math.random().toString(36).slice(2, 12);
}

function postFormToAppsScript(action, requestId, idToken, data) {
  return new Promise((resolve, reject) => {
    let frame = el("postFrame");

    if (!frame) {
      frame = document.createElement("iframe");
      frame.id = "postFrame";
      frame.name = "atworkPostFrame";
      frame.style.display = "none";
      document.body.appendChild(frame);
    }

    const form = document.createElement("form");

    form.method = "POST";
    form.action = APPS_SCRIPT_URL;
    form.target = "atworkPostFrame";
    form.style.display = "none";

    const values = {
      action: action,
      requestId: requestId,
      idToken: idToken,
      data: JSON.stringify(data || {})
    };

    for (const [name, value] of Object.entries(values)) {
      const input = document.createElement("input");

      input.type = "hidden";
      input.name = name;
      input.value = String(value);

      form.appendChild(input);
    }

    document.body.appendChild(form);

    try {
      form.submit();
      resolve();
    } catch (error) {
      reject(error);
    } finally {
      form.remove();
    }
  });
}

function pollAppsScriptResult(requestId, maxAttempts = 80) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    function poll() {
      attempts += 1;

      if (attempts > maxAttempts) {
        reject(
          new Error(
            "รอผลจาก Google Apps Script นานเกินไป กรุณาตรวจสถานะการทำงานของ Apps Script"
          )
        );
        return;
      }

      const callbackName =
        "ATWORK_CB_" + Date.now() + "_" + attempts;

      const script = document.createElement("script");

      let finished = false;

      function cleanup() {
        if (finished) return;

        finished = true;

        clearTimeout(timeoutId);
        script.remove();

        try {
          delete window[callbackName];
        } catch (ignore) {
          window[callbackName] = undefined;
        }
      }

      function retry() {
        cleanup();
        setTimeout(poll, 1000);
      }

      const url = new URL(APPS_SCRIPT_URL);

      url.searchParams.set("action", "status");
      url.searchParams.set("requestId", requestId);
      url.searchParams.set("callback", callbackName);
      url.searchParams.set("_t", String(Date.now()));

      window[callbackName] = function(result) {
        cleanup();

        if (result && result.pending) {
          setTimeout(poll, 700);
          return;
        }

        resolve(result || {
          success: false,
          ok: false,
          message: "ไม่ได้รับผลลัพธ์จากระบบ"
        });
      };

      script.onerror = retry;

      const timeoutId = setTimeout(() => {
        retry();
      }, 8000);

      script.src = url.toString();

      document.head.appendChild(script);
    }

    poll();
  });
}

async function callAppsScript(action, data = {}) {
  if (!lineIdToken) {
    throw new Error(
      "ไม่พบ LINE ID Token กรุณาปิดแล้วเปิดแบบฟอร์มจาก LINE ใหม่"
    );
  }

  const requestId = createRequestId();

  await postFormToAppsScript(
    action,
    requestId,
    lineIdToken,
    data
  );

  const result = await pollAppsScriptResult(requestId);

  if (
    !result ||
    result.success === false ||
    result.ok === false
  ) {
    throw new Error(
      (result && result.message) ||
      "Google Apps Script ไม่สามารถดำเนินการได้"
    );
  }

  return result;
}

/* ==========================================
   FILE HELPERS
========================================== */

function getFileMimeType(file) {
  if (file.type) return file.type;

  const name = file.name.toLowerCase();

  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (name.endsWith(".png")) {
    return "image/png";
  }

  return "application/octet-stream";
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(0) + " KB";
  }

  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function bytesToBase64(bytes) {
  let binary = "";
  const segmentSize = 0x8000;

  for (let i = 0; i < bytes.length; i += segmentSize) {
    const segment = bytes.subarray(
      i,
      Math.min(i + segmentSize, bytes.length)
    );

    binary += String.fromCharCode.apply(null, segment);
  }

  return btoa(binary);
}

async function fileChunkToBase64(file, start, end) {
  const buffer = await file.slice(start, end).arrayBuffer();

  return bytesToBase64(new Uint8Array(buffer));
}

/* ==========================================
   RESUME UPLOAD
========================================== */

async function uploadResume(applicationId, file) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const mimeType = getFileMimeType(file);

  setLoading(
    true,
    "กำลังเตรียม Resume",
    "กำลังสร้างรายการอัปโหลด...",
    "กรุณารอสักครู่"
  );

  resetUploadProgress();

  const prepared = await callAppsScript(
    "prepareApplicationResumeUpload",
    {
      applicationId: applicationId,
      fileName: file.name,
      mimeType: mimeType,
      fileSize: file.size,
      totalChunks: totalChunks
    }
  );

  if (!prepared.uploadId || !prepared.uploadKey) {
    throw new Error(
      "ระบบไม่ได้ส่งข้อมูล Upload ID กลับมา"
    );
  }

  for (let index = 0; index < totalChunks; index++) {
    const start = index * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);

    setLoading(
      true,
      "กำลังอัปโหลด Resume",
      "กำลังส่งไฟล์ส่วนที่ " +
        (index + 1) + " จาก " + totalChunks,
      "อย่าปิดหน้าจนกว่าการอัปโหลดจะเสร็จสิ้น"
    );

    const chunkBase64 = await fileChunkToBase64(
      file,
      start,
      end
    );

    const result = await callAppsScript(
      "uploadApplicationChunk",
      {
        uploadId: prepared.uploadId,
        uploadKey: prepared.uploadKey,
        chunkIndex: index,
        chunkBase64: chunkBase64
      }
    );

    const percent = (end / file.size) * 100;

    setUploadProgress(percent);

    if (
      index === totalChunks - 1 &&
      result.status !== "COMPLETE"
    ) {
      throw new Error(
        "ส่งข้อมูลครบแล้ว แต่ระบบยังยืนยันการอัปโหลดไม่สำเร็จ กรุณาตรวจสถานะ Resume"
      );
    }
  }

  return {
    uploadId: prepared.uploadId,
    candidateId: prepared.candidateId || ""
  };
}

/* ==========================================
   SUBMIT APPLICATION
========================================== */

async function handleApplicationSubmit(event) {
  event.preventDefault();

  if (isSubmitting) return;

  if (!lineIdToken) {
    showStatus(
      "ยังเชื่อมต่อ LINE ไม่สำเร็จ กรุณาปิดแบบฟอร์มแล้วเปิดจาก LINE OA ใหม่",
      "error"
    );
    return;
  }

  const form = el("applicationForm");
  const fileInput = el("resumeFile");
  const file = fileInput && fileInput.files
    ? fileInput.files[0]
    : null;

  if (!form.reportValidity()) return;

  if (!file) {
    showStatus("กรุณาเลือกไฟล์ Resume", "error");
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    showStatus(
      "ไฟล์ Resume ต้องมีขนาดไม่เกิน 50 MB",
      "error"
    );
    return;
  }

  const selectedPosition = el("position").value;
  const position = POSITION_MAP[selectedPosition] || selectedPosition;

  const applicationData = {
    name: el("appName").value.trim(),
    phone: el("appPhone").value.trim(),
    email: el("appEmail").value.trim(),
    position: position,
    expectedSalary: el("salary").value,
    startDate: el("startDate").value,
    houseNo: el("houseNo").value.trim(),
    moo: el("moo").value.trim(),
    road: el("road").value.trim(),
    subdistrict: el("subdistrict").value.trim(),
    district: el("district").value.trim(),
    province: el("appProvince").value.trim(),
    postalCode: el("postalCode").value.trim()
  };

  let savedApplicationId = "";

  isSubmitting = true;
  el("submitButton").disabled = true;

  clearStatus();
  resetUploadProgress();

  try {
    setLoading(
      true,
      "กำลังส่งใบสมัคร",
      "กำลังบันทึกข้อมูลผู้สมัคร...",
      "กรุณาอย่าปิดหน้านี้"
    );

    /*
     * ขั้นตอนที่ 1: สร้างใบสมัครใน Apps Script
     */
    const application = await callAppsScript(
      "createApplication",
      applicationData
    );

    savedApplicationId = application.applicationId || "";

    if (!savedApplicationId) {
      throw new Error(
        "ระบบบันทึกใบสมัครแล้ว แต่ไม่พบหมายเลขใบสมัคร"
      );
    }

    /*
     * ขั้นตอนที่ 2: อัปโหลด Resume แบบแบ่ง Chunk
     */
    const resume = await uploadResume(
      savedApplicationId,
      file
    );

    /*
     * ขั้นตอนที่ 3: แสดงผลสำเร็จ
     */
    setLoading(false);

    if (el("successApplicationId")) {
      el("successApplicationId").textContent =
        savedApplicationId;
    }

    if (el("successResumeId")) {
      el("successResumeId").textContent =
        resume.uploadId || "-";
    }

    if (el("successOverlay")) {
      el("successOverlay").classList.add("show");
    }

    showStatus(
      "ส่งใบสมัครและแนบ Resume สำเร็จ",
      "success"
    );

  } catch (error) {
    console.error("ATWORK SUBMIT ERROR:", error);

    setLoading(false);

    if (savedApplicationId) {
      showStatus(
        "บันทึกใบสมัครหมายเลข " + savedApplicationId +
        " แล้ว แต่เกิดปัญหาในการแนบ Resume: " +
        (error.message || "ไม่ทราบสาเหตุ") +
        " กรุณาอย่าส่งใบสมัครซ้ำทันที",
        "error"
      );
    } else {
      showStatus(
        error.message || "ส่งใบสมัครไม่สำเร็จ กรุณาลองใหม่",
        "error"
      );
    }

  } finally {
    isSubmitting = false;

    if (el("submitButton")) {
      el("submitButton").disabled = !lineIdToken;

      el("submitButton").textContent = lineIdToken
        ? "ส่งใบสมัครและฝาก Resume"
        : "เชื่อมต่อ LINE ไม่สำเร็จ";
    }
  }
}

/* ==========================================
   FILE PICKER DISPLAY
========================================== */

function initializeFilePicker() {
  const input = el("resumeFile");

  if (!input) return;

  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    const selectedFile = el("selectedFile");

    if (!file) {
      if (selectedFile) {
        selectedFile.classList.remove("show");
      }
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      input.value = "";

      if (selectedFile) {
        selectedFile.classList.remove("show");
      }

      showStatus(
        "ไฟล์ Resume ต้องมีขนาดไม่เกิน 50 MB",
        "error"
      );

      return;
    }

    if (el("selectedFileName")) {
      el("selectedFileName").textContent = file.name;
    }

    if (el("selectedFileState")) {
      el("selectedFileState").textContent =
        formatFileSize(file.size) + " • พร้อมอัปโหลด";
    }

    if (selectedFile) {
      selectedFile.classList.add("show");
    }

    clearStatus();
  });
}

/* ==========================================
   SUCCESS MODAL / COPY BUTTONS
========================================== */

async function copyText(value) {
  const text = String(value || "");

  if (!text || text === "-") return;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");

      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";

      document.body.appendChild(textarea);
      textarea.select();

      const copied = document.execCommand("copy");

      textarea.remove();

      if (!copied) {
        throw new Error("Copy failed");
      }
    }

    showStatus("คัดลอกหมายเลขเรียบร้อยแล้ว", "success");

  } catch (error) {
    showStatus(
      "คัดลอกไม่สำเร็จ กรุณาเลือกและคัดลอกหมายเลขด้วยตนเอง",
      "error"
    );
  }
}

function initializeSuccessModal() {
  if (el("copyApplicationId")) {
    el("copyApplicationId").addEventListener("click", () => {
      copyText(
        el("successApplicationId")
          ? el("successApplicationId").textContent
          : ""
      );
    });
  }

  if (el("copyResumeId")) {
    el("copyResumeId").addEventListener("click", () => {
      copyText(
        el("successResumeId")
          ? el("successResumeId").textContent
          : ""
      );
    });
  }

  if (el("successCloseButton")) {
    el("successCloseButton").addEventListener("click", () => {
      if (el("successOverlay")) {
        el("successOverlay").classList.remove("show");
      }
    });
  }
}

/* ==========================================
   START
========================================== */

document.addEventListener("DOMContentLoaded", () => {
  const form = el("applicationForm");

  if (form) {
    form.addEventListener(
      "submit",
      handleApplicationSubmit
    );
  }

  initializeFilePicker();
  initializeSuccessModal();

  initializeLiff();
});
