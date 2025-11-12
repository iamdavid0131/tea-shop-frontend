// ✅ 運送方式 shippingUI.js
import { $ } from "./dom.js";
import { ZIP_MAP } from "./zipcode.js";

export function initShippingUI() {
  const radios = document.querySelectorAll('input[name="shipping"]');
  const storeFields = $("storeFields");
  const codFields = $("codFields");

  if (!storeFields || !codFields) return;

  // 預設顯示「超商」區塊
  storeFields.classList.add("active");
  codFields.classList.remove("active");

  radios.forEach((r) => {
    r.addEventListener("change", () => {
      const isStore = r.value === "store";

      // ✅ 使用 class 控制顯示＋動畫
      if (isStore) {
        storeFields.classList.add("active");
        codFields.classList.remove("active");
      } else {
        codFields.classList.add("active");
        storeFields.classList.remove("active");
        initCODAddressPicker(); // ✅ 初始化宅配地址表單
      }
    });
  });
}

/* ============================================================
🏠 宅配地址選單初始化（ZIP_MAP 載入）
============================================================ */
function initCODAddressPicker() {
  const citySel = $("city");
  const districtSel = $("district");
  const zipDisplay = $("zipDisplay");
  const addressInput = $("address");

  if (!citySel || !districtSel) return;

  // 1️⃣ 載入縣市清單
  const cities = Object.keys(ZIP_MAP);
  citySel.innerHTML =
    `<option value="">請選擇縣市</option>` +
    cities.map((c) => `<option value="${c}">${c}</option>`).join("");

  // 2️⃣ 監聽縣市變化 → 載入行政區
  citySel.addEventListener("change", (e) => {
    const city = e.target.value;
    const districts = ZIP_MAP[city] || {};
    districtSel.innerHTML =
      `<option value="">請選擇行政區</option>` +
      Object.keys(districts)
        .map(
          (d) => `<option value="${d}">${d}（${districts[d]}）</option>`
        )
        .join("");
    zipDisplay.textContent = "—";
  });

  // 3️⃣ 監聽行政區變化 → 顯示郵遞區號
  districtSel.addEventListener("change", (e) => {
    const city = citySel.value;
    const dist = e.target.value;
    const zip = ZIP_MAP[city]?.[dist] || "";
    zipDisplay.textContent = zip || "—";
  });
}
