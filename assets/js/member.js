// member.js ✅ 查詢會員 + 常用收件地自動填入
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

    // Loading 狀態
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

        // 填入基本欄位
        if (nameInput) nameInput.value = d.name || "";
        if (addressInput) addressInput.value = d.address || "";
        if (storeNameInput) storeNameInput.value = d.storeName || "";

        // ✅ 同步設定超商下拉選單
        if (carrierSelect && d.storeCarrier) {
          const normalized = d.storeCarrier.toLowerCase();
          if (normalized.includes("7")) carrierSelect.value = "7-11";
          else if (normalized.includes("family")) carrierSelect.value = "familymart";
          else carrierSelect.value = "";
        }

        // ✅ 顯示最近常用收件地
        const stores = d.recentStores || [];
        const addresses = d.recentAddresses || [];
        const allRecent = [...stores, ...addresses].slice(0, 3);

        if (recentBox && recentList) {
          recentList.innerHTML = "";
          if (allRecent.length === 0) {
            recentBox.classList.add("hidden");
          } else {
            recentBox.classList.remove("hidden");

            allRecent.forEach((r) => {
              const div = document.createElement("div");
              div.className = "recent-item";

              if (r.carrier && r.name) {
                // 超商收件
                div.textContent = `${r.carrier.toUpperCase()} ${r.name}`;
                div.onclick = () => {
                  if (carrierSelect) carrierSelect.value = r.carrier;
                  if (storeNameInput) storeNameInput.value = r.name;
                  const shipRadio = document.querySelector("input[value='store']");
                  if (shipRadio) shipRadio.checked = true;
                  toast(`🏪 已套用門市：${r.carrier} ${r.name}`);
                };
              } else if (r.address) {
                // 宅配地址
                div.textContent = r.address;
                div.onclick = () => {
                  if (addressInput) addressInput.value = r.address;
                  const shipRadio = document.querySelector("input[value='cod']");
                  if (shipRadio) shipRadio.checked = true;
                  toast(`📦 已套用地址：${r.address}`);
                };
              }

              recentList.appendChild(div);
            });
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

    // 還原 UI
    phoneInput.disabled = false;
    phoneInput.classList.remove("loading");
    phoneInput.style.backgroundImage = "";
  }

  // ✅ 失焦後查詢
  phoneInput.addEventListener("blur", lookup);

  // ✅ Enter 按下查詢
  phoneInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      lookup();
    }
  });
}
