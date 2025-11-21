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

  // 預設隱藏常用收件地區塊
  if (recentBox) {
    recentBox.classList.add("hidden");
  }

  if (!phoneInput) return;

  // 🔍 會員查詢核心函式
  async function lookup() {
    const phone = phoneInput.value.trim();
    // 台灣手機號碼基本驗證 (09開頭, 10碼) 或市話
    if (!phone || phone.length < 8) return;

    // 避免重複查詢 (若值未變)
    if (phoneInput.dataset.lastQuery === phone) return;
    phoneInput.dataset.lastQuery = phone;

    phoneInput.disabled = true;
    phoneInput.classList.add("loading"); // CSS 需配合顯示轉圈圈或變色

    try {
      const res = await api.memberSearch(phone);
      const d = res?.data || {};
      const stores = Array.isArray(d.recentStores) ? d.recentStores : [];
      const addresses = Array.isArray(d.recentAddresses) ? d.recentAddresses : [];

      if (res?.ok && d && (d.name || d.address || stores.length || addresses.length)) {
        if (nameInput && d.name) nameInput.value = d.name;
        if (addressInput && d.address) addressInput.value = d.address;
        if (storeNameInput && d.storeName) storeNameInput.value = d.storeName;

        // ✅ 超商下拉自動設定 (更嚴謹的判斷)
        if (carrierSelect && d.storeName) {
          const n = String(d.storeName).toLowerCase();
          if (n.includes("7") || n.includes("seven")) carrierSelect.value = "7-11";
          else if (n.includes("family") || n.includes("全家")) carrierSelect.value = "familymart";
          else if (n.includes("hi") || n.includes("萊爾富")) carrierSelect.value = "hilife";
        }

        // ✅ 有資料才渲染
        if (stores.length > 0 || addresses.length > 0) {
          renderRecents(stores, addresses);
          toast(`📦 歡迎回來，${d.name || "老朋友"}！`);
          
          // ✨ UX 優化：自動滾動到常用地址區塊，讓使用者看到
          setTimeout(() => {
            recentBox?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 500);

        } else {
          recentBox?.classList.add("hidden");
          // 如果有名字但沒地址，也提示一下
          if (d.name) toast(`👋 嗨 ${d.name}，這是您的第一次線上訂購嗎？`);
        }
      } else {
        // 查無資料 (可能是新客)
        // toast("ℹ️ 這是新電話號碼，將為您建立新會員"); // Optional: 不一定要跳提示，以免干擾
        recentBox?.classList.add("hidden");
      }
    } catch (err) {
      console.error("查詢會員資料失敗:", err);
      // toast("⚠️ 網路不穩，無法自動帶入資料"); // Optional
      recentBox?.classList.add("hidden");
    } finally {
      phoneInput.disabled = false;
      phoneInput.classList.remove("loading");
      // 查詢後讓焦點回到姓名欄位 (方便繼續填寫)
      if (!nameInput.value) nameInput.focus();
    }
  }

  // 📦 渲染常用地區（依最近使用時間排序）
  // 📦 渲染常用地區（初始化）
  function renderRecents(stores = [], addresses = []) {
    if (!recentBox || !recentList) return;

    // 資料處理... (維持原樣)
    stores = Array.isArray(stores) ? stores : [];
    addresses = Array.isArray(addresses) ? addresses : [];
    
    const sortByRecent = (arr) =>
      [...arr].sort((a, b) => new Date(b.updatedAt || b.time || 0) - new Date(a.updatedAt || a.time || 0));
    stores = sortByRecent(stores);
    addresses = sortByRecent(addresses);

    if (stores.length === 0 && addresses.length === 0) {
      recentBox.classList.add("hidden");
      return;
    }

    // ✅ 顯示區塊
    recentBox.classList.remove("hidden");
    
    // 🔥 新增：初始化標題的「選中提示」元素 (如果還沒有的話)
    let hintSpan = recentBox.querySelector(".selected-hint");
    if (!hintSpan) {
      const title = recentBox.querySelector(".recent-title");
      hintSpan = document.createElement("span");
      hintSpan.className = "selected-hint";
      title.appendChild(hintSpan);
      
      // 🔥 綁定標題點擊事件：切換收合/展開
      title.onclick = () => {
        recentBox.classList.toggle("collapsed");
      };
    }
    // 重置提示文字
    hintSpan.textContent = ""; 
    recentBox.classList.remove("collapsed"); // 剛載入時預設展開

    recentList.innerHTML = "";

    // 預設 Tab 邏輯 (維持原樣)
    let currentType = stores.length > 0 ? "store" : "address";
    
    const tabBtns = recentBox.querySelectorAll(".recent-tab");
    tabBtns.forEach(b => {
        if(b.dataset.type === currentType) b.classList.add("active");
        else b.classList.remove("active");
    });

    renderList(currentType);

    // Tab 切換事件
    tabBtns.forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        tabBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentType = btn.dataset.type;
        renderList(currentType);
      };
    });

    function renderList(type) {
      recentList.innerHTML = "";
      const list = type === "store" ? stores : addresses;
      if (list.length === 0) {
        recentList.innerHTML = `<div class="empty-tip">尚無常用${type === "store" ? "門市" : "地址"} ☕</div>`;
        return;
      }
      list.forEach((r) => renderRecentItem(r, type));
    }
  }

  // 🏪 單筆項目渲染
  function renderRecentItem(r, type) {
    const div = document.createElement("div");
    div.className = "recent-item";

    const lastUsed = r.updatedAt || r.time;
    const timeLabel = lastUsed
      ? new Date(lastUsed).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" })
      : "";

    const icon = type === "store" ? "🏪" : "📦";
    // 為了顯示方便，這裡存一個簡短名稱
    const shortName = type === "store" ? r.name : r.address.substring(0, 6) + "..."; 
    const content = type === "store" 
        ? `<span style="font-weight:700; margin-right:4px;">${(r.carrier || "").toUpperCase()}</span> ${r.name || ""}`
        : r.address || "";

    div.innerHTML = `
      <span class="icon">${icon}</span>
      <span class="text">${content}</span>
      ${timeLabel ? `<span style="font-size:12px; color:#999; margin-left:auto;">${timeLabel}</span>` : ""}
    `;

    // ✅ 點擊行為
    div.onclick = () => {
      if (type === "store") {
        if (carrierSelect) carrierSelect.value = (r.carrier || "").toLowerCase();
        if (storeNameInput) storeNameInput.value = r.name || "";
        const shipRadio = document.querySelector("input[value='store']");
        if (shipRadio) { shipRadio.checked = true; shipRadio.dispatchEvent(new Event("change")); }
        toast(`🏪 已套用門市：${r.name}`);
      } else {
        if (addressInput) addressInput.value = r.address;
        autoSelectAddress(r.address);
        const shipRadio = document.querySelector("input[value='cod']");
        if (shipRadio) { shipRadio.checked = true; shipRadio.dispatchEvent(new Event("change")); }
        toast(`📦 已套用地址`);
      }
      
      // 高亮動畫
      div.classList.add("highlight");
      setTimeout(() => div.classList.remove("highlight"), 600);

      // ✅ 1. 收起選單 (變成 Accordion 標題)
    setTimeout(() => {
      recentBox.classList.add("collapsed");
      const hint = recentBox.querySelector(".selected-hint");
      // 更新標題旁邊的提示文字
      const shortName = type === "store" ? r.name : r.address.substring(0, 6) + "..."; 
      if (hint) hint.textContent = `(已選：${shortName})`;
    }, 300);

    // ✅ 2.【關鍵新增】自動滑動到付款區塊 (Payment Card)
    setTimeout(() => {
      const paymentCard = document.getElementById("paymentCard");
      if (paymentCard) {
        paymentCard.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 500); // 設定 500ms 延遲，讓使用者先看到「選取高亮」和「收合動畫」，再滑下去，體驗最順
  };

    recentList.appendChild(div);
  }

  // 🛠️ 地址自動選取邏輯 (獨立函式，保持乾淨)
  function autoSelectAddress(fullAddress) {
    if (!citySelect || !districtSelect || !fullAddress) return;

    const match = fullAddress.match(/^(.{2,3}(市|縣))(.{1,4}(區|鄉|鎮))/);
    if (!match) return;

    const cityFull = match[1];
    const districtFull = match[3];
    const cityShort = cityFull.replace(/市|縣/g, "");
    const districtShort = districtFull.replace(/區|鄉|鎮/g, "");
    
    // 正規化：台/臺、去空白
    const normalize = (s) => s.replace(/臺/g, "台").replace(/\s/g, "").trim();

    // 1. 選縣市
    const trySelectCity = setInterval(() => {
      const cityOpts = Array.from(citySelect.options);
      if (cityOpts.length <= 1) return; // 選單還沒載入

      const cityOption = cityOpts.find((opt) => {
        const val = normalize(opt.value);
        const text = normalize(opt.text);
        const target = normalize(cityFull);
        const targetShort = normalize(cityShort);
        return val === target || text === target || val === targetShort || text === targetShort;
      });

      if (cityOption) {
        citySelect.value = cityOption.value;
        citySelect.dispatchEvent(new Event("change")); // 觸發載入行政區
        clearInterval(trySelectCity);

        // 2. 選行政區 (巢狀等待)
        let districtRetry = 0;
        const trySelectDistrict = setInterval(() => {
          const districtOpts = Array.from(districtSelect.options);
          // 確保行政區選單已更新 (不僅僅是預設選項)
          if (districtOpts.length > 1 && districtOpts[1].value) {
             const districtOption = districtOpts.find((opt) => {
                const val = normalize(opt.value);
                const text = normalize(opt.text);
                const target = normalize(districtFull);
                const targetShort = normalize(districtShort);
                return val === target || text === target || val === targetShort || text === targetShort;
             });

             if (districtOption) {
               districtSelect.value = districtOption.value;
               districtSelect.dispatchEvent(new Event("change"));
               clearInterval(trySelectDistrict);
             }
          }
          if (++districtRetry > 20) clearInterval(trySelectDistrict); // 2秒超時
        }, 100);
      }
    }, 100);

    // 自動填入除去縣市行政區後的詳細地址
    const trimmed = fullAddress.replace(/^.{2,3}(市|縣).{1,4}(區|鄉|鎮)/, "");
    if(addressInput) addressInput.value = trimmed.trim();
  }

  // ✅ 綁定事件
  phoneInput.addEventListener("blur", lookup);
  phoneInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      lookup();
    }
  });
  
  // 🔥 新增：輸入滿 10 碼自動查詢 (提升體驗)
  phoneInput.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      if (val.length === 10 && val.startsWith("09")) {
          lookup();
      }
  });
}