(function () {
  if (document.getElementById('nutriguard-scan-root')) return;

  const MAX_PAGE_TEXT_CHARS = 8000;

  const root = document.createElement('div');
  root.id = 'nutriguard-scan-root';
  document.body.appendChild(root);

  const style = document.createElement('style');
  style.textContent = `
    #nutriguard-scan-toggle-btn {
      position: fixed;
      bottom: 20px;
      left: 20px;
      z-index: 2147483646;
      background: #16a34a;
      color: #ffffff;
      border: none;
      border-radius: 30px;
      padding: 12px 20px;
      font-family: -apple-system, sans-serif;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.25);
    }

    #nutriguard-scan-panel {
      position: fixed;
      top: 0;
      left: -380px;
      width: 340px;
      height: 100vh;
      z-index: 2147483647;
      background: #ffffff;
      box-shadow: 10px 0 30px rgba(0, 0, 0, 0.2);
      padding: 20px;
      box-sizing: border-box;
      overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      transition: left 0.3s ease-in-out;
      color: #0f172a;
    }

    #nutriguard-scan-panel.open { left: 0; }

    .ngs-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .ngs-title { font-size: 1.1rem; font-weight: 700; margin: 0; }
    .ngs-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748b; }

    .ngs-btn { padding: 10px 14px; font-size: 0.85rem; font-weight: 600; border-radius: 6px; border: none; cursor: pointer; width: 100%; margin-bottom: 8px; }
    .ngs-btn-primary { background: #16a34a; color: #ffffff; }
    .ngs-btn-secondary { background: #e2e8f0; color: #334155; }

    .ngs-status { font-size: 0.8rem; text-align: center; margin: 8px 0; color: #64748b; }

    .ngs-section { margin-top: 16px; }
    .ngs-section-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
    .ngs-warning { background: #fee2e2; border: 1px solid #dc2626; color: #b91c1c; border-radius: 6px; padding: 8px; font-size: 0.85rem; margin-bottom: 6px; }
    .ngs-rec { display: block; background: #f0fdf4; border: 1px solid #16a34a; color: #15803d; border-radius: 6px; padding: 8px; font-size: 0.8rem; margin-bottom: 6px; text-decoration: none; }
    .ngs-summary { background: #e0f2fe; border: 1px solid #0284c7; color: #0369a1; border-radius: 6px; padding: 8px; font-size: 0.85rem; }
  `;
  document.head.appendChild(style);

  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'nutriguard-scan-toggle-btn';
  toggleBtn.innerText = '🔍 Scan';
  document.body.appendChild(toggleBtn);

  const panel = document.createElement('div');
  panel.id = 'nutriguard-scan-panel';
  panel.innerHTML = `
    <div class="ngs-header">
      <h2 class="ngs-title">Cart Scanner</h2>
      <button class="ngs-close" id="ngsBtnClose">×</button>
    </div>
    <button class="ngs-btn ngs-btn-primary" id="ngsBtnScanPage">Scan Checkout Page</button>
    <button class="ngs-btn ngs-btn-secondary" id="ngsBtnScanReceipt">Upload Receipt Photo</button>
    <input type="file" id="ngsReceiptInput" accept="image/*" style="display:none;">
    <p class="ngs-status" id="ngsStatus"></p>
    <div id="ngsResults"></div>
  `;
  document.body.appendChild(panel);

  function showStatus(message) {
    document.getElementById('ngsStatus').textContent = message;
  }

  function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function toStringArray(value) {
    return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
  }

  // Mirrors the server's Zod boundary check (parseAnalyzeCartInput) so an obviously
  // bad request is rejected locally instead of round-tripping to the backend first.
  function validatePayload(payload) {
    const hasDomText = isNonEmptyString(payload.domText);
    const hasReceiptImage = Boolean(
      payload.receiptImage
        && isNonEmptyString(payload.receiptImage.base64)
        && isNonEmptyString(payload.receiptImage.mimeType)
    );

    if (!hasDomText && !hasReceiptImage) {
      return 'No checkout text or receipt photo to analyze.';
    }
    if (!Array.isArray(payload.allergens)) {
      return 'Family profile is missing a valid allergens list. Re-save your profile.';
    }
    return null;
  }

  function readFamilyProfile() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['familyDB'], (result) => resolve(result.familyDB || null));
      } else {
        const stored = localStorage.getItem('familyDB');
        resolve(stored ? JSON.parse(stored) : null);
      }
    });
  }

  function analyzeCart(payload) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'ANALYZE_CART', payload }, (response) => {
        resolve(response || { success: false, error: 'No response from background script' });
      });
    });
  }

  function renderResults(data) {
    const container = document.getElementById('ngsResults');

    const warningsHtml = (data.warnings || [])
      .map((w) => `<div class="ngs-warning">⚠️ ${w}</div>`)
      .join('');

    const verification = data.allergenVerification || { items: [], citations: [] };
    const verificationHtml = verification.items
      .filter((v) => v.containsAllergen)
      .map((v) => `<div class="ngs-warning">🔎 ${v.name} confirmed to contain ${v.allergen}</div>`)
      .join('');

    const citationsHtml = verification.citations
      .map((url) => `<a class="ngs-rec" href="${url}" target="_blank" rel="noopener">${url}</a>`)
      .join('');

    const recsHtml = (data.recommendations || [])
      .map((r) => `<a class="ngs-rec" href="${r.url}" target="_blank" rel="noopener">${r.title}</a>`)
      .join('');

    container.innerHTML = `
      ${warningsHtml || verificationHtml ? `<div class="ngs-section"><div class="ngs-section-label">Warnings</div>${warningsHtml}${verificationHtml}</div>` : ''}
      ${citationsHtml ? `<div class="ngs-section"><div class="ngs-section-label">Verification Sources</div>${citationsHtml}</div>` : ''}
      ${data.nutritionSummary ? `<div class="ngs-section"><div class="ngs-section-label">Nutrition</div><div class="ngs-summary">${data.nutritionSummary}</div></div>` : ''}
      ${recsHtml ? `<div class="ngs-section"><div class="ngs-section-label">Recommendations</div>${recsHtml}</div>` : ''}
    `;
  }

  async function runScan(payloadFields) {
    showStatus('Loading family profile…');
    const profile = await readFamilyProfile();
    if (!profile) {
      showStatus('No family profile saved yet. Set one up first.');
      return;
    }

    const payload = {
      allergens: toStringArray(profile.allergens),
      targetVitamins: toStringArray(profile.targetVitamins),
      ...payloadFields
    };

    const validationError = validatePayload(payload);
    if (validationError) {
      showStatus(validationError);
      return;
    }

    showStatus('Analyzing…');
    const response = await analyzeCart(payload);
    if (!response.success) {
      showStatus(`Scan failed: ${response.error || response.data?.error || 'unknown error'}`);
      return;
    }

    showStatus('Scan complete.');
    renderResults(response.data);
  }

  toggleBtn.addEventListener('click', () => panel.classList.toggle('open'));
  document.getElementById('ngsBtnClose').addEventListener('click', () => panel.classList.remove('open'));

  document.getElementById('ngsBtnScanPage').addEventListener('click', () => {
    const domText = document.body.innerText.slice(0, MAX_PAGE_TEXT_CHARS);
    runScan({ domText });
  });

  const receiptInput = document.getElementById('ngsReceiptInput');
  document.getElementById('ngsBtnScanReceipt').addEventListener('click', () => receiptInput.click());

  receiptInput.addEventListener('change', () => {
    const file = receiptInput.files && receiptInput.files[0];
    if (!file) return;

    if (!file.type || !file.type.startsWith('image/')) {
      showStatus('Please choose an image file.');
      receiptInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(',')[1];
      runScan({ receiptImage: { base64, mimeType: file.type } });
    };
    reader.readAsDataURL(file);
  });
})();
