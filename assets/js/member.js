// member.js ✅ 查詢會員 + 常用收件地自動填入（祥興風格強化版）
import { $, toast } from "./dom.js";
import { api } from "./app.api.js";

export function initMemberLookup() {
  const phoneInput = $("phone");
  const nameInput = $("name");
  const addressInput = $("address");
  const storeNameInput = $("storeName");
  const carrierSelect = $("carrier");
  const recentBox = $("recentBox");
  const recentList = recentBox?.querySelector(".recent-list");

  if (!phoneInput) return;

  async function lookup() {
    const phone = phoneInput.value.trim();
    if (!phone || phone.length < 8) return;

    // 🔄 Loading 狀態
    phoneInput.disabled = true;
    phoneInput.classList.add("loading");
    phoneInput.style.backgroundImage =
      "url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCA0NCA0NCI+PHBhdGggZmlsbD0ibm9uZSIgZD0iTTM1LjM3IDI4Ljc2YTEzLjM3IDEzLjM3IDAgMSAxLTguMDkgOC4wOSIgc3Ryb2tlPSIjQUFBQjk3IiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1taXRlcmxpbWl0PSIxMCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiAvPjwvc3ZnPg==')";
    phoneInput.style.backgroundRepeat = "no-repeat";
    phoneInput.style.backgroundPosition = "right 8px center";

    try {
      const res = await api.memberSearch(phone);
      if (res && res.ok && res.data) {
        const d = res.data;

        // 📋 填入基本欄位
        if (nameInput) nameInput.value = d.name || "";
        if (addressInput) addressInput.value = d.address || "";
        if (storeNameInput) storeNameInput.value = d.storeName || "";

        // ✅ 設定超商選單（根據店名判斷）
        if (carrierSelect && d.storeName) {
          const normalized = d.storeName.toLowerCase();
          if (normalized.includes("7")) carrierSelect.value = "7-11";
          else if (normalized.includes("family")) carrierSelect.value = "familymart";
          else if (normalized.includes("hi")) carrierSelect.value = "hilife";
          else carrierSelect.value = "";
        }

        // ✅ 顯示常用收件地
        const stores = d.recentStores || [];
        const addresses = d.recentAddresses || [];

        if (recentBox && recentList) {
          recentList.innerHTML = "";
          if (stores.length === 0 && addresses.length === 0) {
            recentBox.classList.add("hidden");
          } else {
            recentBox.classList.remove("hidden");

            if (stores.length > 0) {
              const title = document.createElement("div");
              title.className = "recent-subtitle";
              title.textContent = "🏪 常用超商";
              recentList.appendChild(title);
              stores.forEach((r) => renderRecentItem(r, "store"));
            }

            if (addresses.length > 0) {
              const title = document.createElement("div");
              title.className = "recent-subtitle";
              title.textContent = "📦 常用宅配地址";
              recentList.appendChild(title);
              addresses.forEach((r) => renderRecentItem(r, "address"));
            }
          }
        }

        toast(`📦 已載入會員資料：${d.name || ""}`);
      } else {
        toast("⚠️ 查無此電話會員");
        if (recentBox) recentBox.classList.add("hidden");
      }
    } catch (err) {
      console.error("查詢會員資料失敗:", err);
      toast("⚠️ 查詢失敗");
    }

    // 🔄 還原 UI
    phoneInput.disabled = false;
    phoneInput.classList.remove("loading");
    phoneInput.style.backgroundImage = "";
  }

  // 🧩 建立每個常用項目卡片
  function renderRecentItem(r, type) {
    const div = document.createElement("div");
    div.className = "recent-item";
    div.innerHTML = `
      <span class="icon">${type === "store" ? "🏪" : "📦"}</span>
      <span class="text">${type === "store"
        ? `${r.carrier?.toUpperCase()} ${r.name}`
        : r.address}</span>
    `;

    div.onclick = () => {
      if (type === "store") {
        if (carrierSelect) carrierSelect.value = r.carrier;
        if (storeNameInput) storeNameInput.value = r.name;
        const shipRadio = document.querySelector("input[value='store']");
        if (shipRadio) shipRadio.checked = true;
        toast(`🏪 已套用門市：${r.carrier} ${r.name}`);
      } else {
        if (addressInput) addressInput.value = r.address;
        const shipRadio = document.querySelector("input[value='cod']");
        if (shipRadio) shipRadio.checked = true;
        toast(`📦 已套用地址：${r.address}`);
      }
    };
    recentList.appendChild(div);
  }

  // 事件綁定
  phoneInput.addEventListener("blur", lookup);
  phoneInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      lookup();
    }
  });
}
