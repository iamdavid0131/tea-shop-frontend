// member.js ✅ 查詢會員 + 常用收件地自動填入（含全家/宅配/縣市自動帶入）
import { $, toast } from "./dom.js";
import { api } from "./app.api.js";

export function initMemberLookup() {
  const phoneInput = $("phone");
  const nameInput = $("name");
  const addressInput = $("address");
  const storeNameInput = $("storeName");
  const carrierSelect = $("carrier");
  const citySelect = $("city");
  const districtSelect = $("district");
  const recentBox = $("recentBox");
  const recentList = recentBox?.querySelector(".recent-list");

  if (!phoneInput) return;

  async function lookup() {
    const phone = phoneInput.value.trim();
    if (!phone || phone.length < 8) return;

    phoneInput.disabled = true;
    phoneInput.classList.add("loading");

    try {
      const res = await api.memberSearch(phone);
      if (res?.ok && res.data) {
        const d = res.data;

        if (nameInput) nameInput.value = d.name || "";
        if (addressInput) addressInput.value = d.address || "";
        if (storeNameInput) storeNameInput.value = d.storeName || "";

        // ✅ 設定超商下拉選單
        if (carrierSelect && d.storeName) {
          const n = d.storeName.toLowerCase();
          if (n.includes("7")) carrierSelect.value = "7-11";
          else if (n.includes("family")) carrierSelect.value = "familymart";
          else if (n.includes("hi")) carrierSelect.value = "hilife";
        }

        // ✅ 顯示常用收件地
        renderRecents(d.recentStores || [], d.recentAddresses || []);
        toast(`📦 已載入會員資料：${d.name || ""}`);
      } else {
        toast("⚠️ 查無此電話會員");
        recentBox?.classList.add("hidden");
      }
    } catch (err) {
      console.error("查詢會員資料失敗:", err);
      toast("⚠️ 查詢失敗");
    }

    phoneInput.disabled = false;
    phoneInput.classList.remove("loading");
  }

  function renderRecents(stores, addresses) {
    if (!recentBox || !recentList) return;
    recentList.innerHTML = "";
    if (stores.length === 0 && addresses.length === 0) {
      recentBox.classList.add("hidden");
      return;
    }

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
        if (carrierSelect) carrierSelect.value = r.carrier.toLowerCase();
        if (storeNameInput) storeNameInput.value = r.name;
        const shipRadio = document.querySelector("input[value='store']");
        if (shipRadio) {
          shipRadio.checked = true;
          shipRadio.dispatchEvent(new Event("change"));
        }
        toast(`🏪 已套用門市：${r.carrier} ${r.name}`);
      } else {
        if (addressInput) addressInput.value = r.address;

        // 🏙️ 自動帶入縣市區
        if (citySelect && districtSelect) {
          const city = r.address.slice(0, 3).replace(/市|縣/g, "");
          const district = r.address.match(/區|鄉|鎮/)
            ? r.address.split(/市|縣/)[1].split(/[路街]/)[0]
            : "";
          citySelect.value = city;
          districtSelect.value = district;
        }

        const shipRadio = document.querySelector("input[value='cod']");
        if (shipRadio) {
          shipRadio.checked = true;
          shipRadio.dispatchEvent(new Event("change"));
        }
        toast(`📦 已套用地址：${r.address}`);
      }
    };

    recentList.appendChild(div);
  }

  phoneInput.addEventListener("blur", lookup);
  phoneInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      lookup();
    }
  });
}
