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

  // 🔍 會員查詢
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

        // ✅ 顯示常用收件地址
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

  // 📦 渲染常用地區
  function renderRecents(stores, addresses) {
    if (!recentBox || !recentList) return;
    recentList.innerHTML = "";
    if (stores.length === 0 && addresses.length === 0) {
      recentBox.classList.add("hidden");
      return;
    }

    recentBox.classList.remove("hidden");

    // 預設顯示「超商」
    let currentType = "store";
    renderList(currentType);

    const tabBtns = recentBox.querySelectorAll(".recent-tab");
    tabBtns.forEach((btn) => {
      btn.onclick = () => {
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
    div.innerHTML = `
      <span class="icon">${type === "store" ? "🏪" : "📦"}</span>
      <span class="text">${
        type === "store" ? `${r.carrier?.toUpperCase()} ${r.name}` : r.address
      }</span>
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

            // 🏙️ 改進版縣市／行政區自動帶入
            if (citySelect && districtSelect && r.address) {
                const match = r.address.match(/^(.{2,3}(市|縣))(.{1,4}(區|鄉|鎮))/);
                if (match) {
                    const cityFull = match[1];
                    const districtFull = match[3];
                    const cityShort = cityFull.replace(/市|縣/g, "");
                    const districtShort = districtFull.replace(/區|鄉|鎮/g, "");
                    const normalize = (s) => s.replace("臺", "台").replace(/\s/g, "");

                    // 🏙️ 等縣市選項載入再設定
                    let cityRetry = 0;
                    const trySelectCity = setInterval(() => {
                    const cityOpts = Array.from(citySelect.options);
                    if (cityOpts.length > 1) {
                        const cityOption = cityOpts.find(opt => {
                        const val = normalize(opt.value);
                        const text = normalize(opt.text);
                        return (
                            val === normalize(cityFull) ||
                            text === normalize(cityFull) ||
                            val === normalize(cityShort) ||
                            text === normalize(cityShort)
                        );
                        });

                        if (cityOption) {
                        citySelect.value = cityOption.value;
                        citySelect.dispatchEvent(new Event("change"));
                        console.log("🏙️ 已選縣市:", cityOption.value);
                        clearInterval(trySelectCity);

                        // 🕓 等行政區載入再設定
                        let districtRetry = 0;
                        const trySelectDistrict = setInterval(() => {
                            const districtOpts = Array.from(districtSelect.options);
                            if (districtOpts.length > 1) {
                            const districtOption = districtOpts.find(opt => {
                                const val = normalize(opt.value);
                                const text = normalize(opt.text);
                                return (
                                val === normalize(districtFull) ||
                                text === normalize(districtFull) ||
                                val === normalize(districtShort) ||
                                text === normalize(districtShort)
                                );
                            });

                            if (districtOption) {
                                districtSelect.value = districtOption.value;
                                districtSelect.dispatchEvent(new Event("change"));
                                console.log("🏘️ 已選行政區:", districtOption.value);
                                clearInterval(trySelectDistrict);
                            }
                            }

                            if (++districtRetry > 20) {
                            clearInterval(trySelectDistrict);
                            console.warn("⚠️ 行政區未載入完成，放棄自動帶入");
                            }
                        }, 100);
                        }
                    }

                    if (++cityRetry > 20) {
                        clearInterval(trySelectCity);
                        console.warn("⚠️ 縣市未載入完成，放棄自動帶入");
                    }
                    }, 100);
                }

                // ✂️ 裁掉縣市區
                const trimmed = r.address.replace(/^.{2,3}(市|縣).{1,4}(區|鄉|鎮)/, "");
                addressInput.value = trimmed.trim();
                }





            const shipRadio = document.querySelector("input[value='cod']");
            if (shipRadio) {
                shipRadio.checked = true;
                shipRadio.dispatchEvent(new Event("change"));
            }

            toast(`📦 已套用地址：${r.address}`);

            // 🚀 自動滾動到宅配區塊
            addressInput.scrollIntoView({ behavior: "smooth", block: "center" });
            }
    };

    // ✅ 只留這一行
    recentList.appendChild(div);
  }

  // ✅ 綁定事件
  phoneInput.addEventListener("blur", lookup);
  phoneInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      lookup();
    }
  });
}
