// member.js ✅ 電話查詢自動填寫 with Enter & Loading

import { $, toast } from "./dom.js";
import { api } from "./app.api.js";

export function initMemberLookup() {
  const phoneInput = $("phone");
  const nameInput = $("name");
  const addressInput = $("address");
  const storeNameInput = $("storeName");

  if (!phoneInput) return;

  async function lookup() {
    const phone = phoneInput.value.trim();
    if (!phone || phone.length < 8) return;

    phoneInput.disabled = true;
    phoneInput.classList.add("loading"); // ✅ Loading 狀態
    phoneInput.style.backgroundImage =
      "url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCA0NCA0NCI+PHBhdGggZmlsbD0ibm9uZSIgPSIiIGQ9Ik0zNS4zNyAyOC43NmExMy4zNyAxMy4zNyAwIDEgMS04LjA5IDguMDkiIHN0cm9rZT0iI0FBQUI5NyIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtbWl0ZXJsaW1pdD0iMTAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgLz48L3N2Zz4=')";
    phoneInput.style.backgroundRepeat = "no-repeat";
    phoneInput.style.backgroundPosition = "right 8px center";

    try {
      const res = await api.memberSearch(phone);

      if (res && res.ok && res.data) {
        const d = res.data;
        nameInput && (nameInput.value = d.name || "");
        addressInput && (addressInput.value = d.address || "");
        storeNameInput && (storeNameInput.value = d.storeName || "");

        toast(`📦 已載入會員資料：${d.name || ""}`);
      } else {
        toast("⚠️ 查無此電話會員");
      }

    } catch (err) {
      console.error("查詢會員資料失敗:", err);
      toast("⚠️ 查詢失敗");
    }

    // ✅ 還原 UI
    phoneInput.disabled = false;
    phoneInput.classList.remove("loading");
    phoneInput.style.backgroundImage = "";
  }

  // ✅ 失焦後查詢
  phoneInput.addEventListener("blur", lookup);

  // ✅ Enter 按下查詢
  phoneInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); // 避免跳到下一個欄位
      lookup();
    }
  });
}
