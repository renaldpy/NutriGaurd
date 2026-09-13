(function () {
  if (document.getElementById('nutriguard-root')) return;


  // 1. Create root host element
  const root = document.createElement('div');
  root.id = 'nutriguard-root';
  document.body.appendChild(root);


  // 2. Add styles directly
  const style = document.createElement('style');
  style.textContent = `
    #nutriguard-toggle-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483646;
      background: #2563eb;
      color: #ffffff;
      border: none;
      border-radius: 30px;
      padding: 12px 20px;
      font-family: -apple-system, sans-serif;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.25);
      transition: transform 0.2s;
    }
    #nutriguard-toggle-btn:hover { transform: scale(1.05); }


    #nutriguard-drawer {
      position: fixed;
      top: 0;
      right: -420px;
      width: 380px;
      height: 100vh;
      z-index: 2147483647;
      background: #ffffff;
      box-shadow: -10px 0 30px rgba(0, 0, 0, 0.2);
      padding: 24px;
      box-sizing: border-box;
      overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      transition: right 0.3s ease-in-out;
      color: #0f172a;
    }


    #nutriguard-drawer.open { right: 0; }


    .ng-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .ng-title { font-size: 1.25rem; font-weight: 700; margin: 0; }
    .ng-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748b; }
    .ng-subtitle { color: #64748b; font-size: 0.85rem; margin: 0 0 20px 0; }


    .ng-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
    .ng-member-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-weight: 600; }
    .ng-section-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #64748b; margin: 10px 0 6px 0; }

    .ng-tag-group { display: flex; flex-wrap: wrap; gap: 6px; }
    .ng-tag {
      padding: 4px 10px; font-size: 0.78rem; border-radius: 16px; border: 1px solid #cbd5e1;
      background: #ffffff; cursor: pointer; user-select: none; color: #334155;
    }
    .ng-tag.selected-diet { background: #dcfce7; border-color: #16a34a; color: #15803d; }
    .ng-tag.selected-allergen { background: #fee2e2; border-color: #dc2626; color: #b91c1c; }
    .ng-tag.selected-condition { background: #e0f2fe; border-color: #0284c7; color: #0369a1; }


    .ng-btn { padding: 10px 14px; font-size: 0.85rem; font-weight: 600; border-radius: 6px; border: none; cursor: pointer; width: 100%; }
    .ng-btn-secondary { background: #e2e8f0; color: #334155; margin-bottom: 8px; }
    .ng-btn-primary { background: #2563eb; color: #ffffff; }
    .ng-btn-danger { background: transparent; color: #ef4444; border: none; cursor: pointer; font-size: 0.8rem; }

    .ng-status { font-size: 0.8rem; text-align: center; margin-top: 8px; min-height: 1em; color: #16a34a; }
  `;
  document.head.appendChild(style);


  // 3. Inject UI Elements
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'nutriguard-toggle-btn';
  toggleBtn.innerText = '🥗 NutriGuard Setup';
  document.body.appendChild(toggleBtn);


  const drawer = document.createElement('div');
  drawer.id = 'nutriguard-drawer';
  drawer.innerHTML = `
    <div class="ng-header">
      <h2 class="ng-title">Family Profile</h2>
      <button class="ng-close" id="ngBtnClose">×</button>
    </div>
    <p class="ng-subtitle">Set restrictions for live cart monitoring.</p>
    <div id="ngMembersContainer"></div>
    <div style="margin-top: 16px;">
      <button class="ng-btn ng-btn-secondary" id="ngBtnAddMember">+ Add Family Member</button>
      <button class="ng-btn ng-btn-primary" id="ngBtnSaveProfile">Save Profile & Sync</button>
      <p class="ng-status" id="ngStatus"></p>
    </div>
  `;
  document.body.appendChild(drawer);


  // 4. State & Logic
  const DIETS = ["Vegetarian", "Vegan", "Pescetarian"];
  const ALLERGENS = ["Peanuts", "Milk", "Eggs", "Fish", "Soybean", "Wheat", "Tree Nuts", "Shellfish", "Sesame"];
  const CONDITIONS = ["Iron deficiency", "Vitamin D deficiency", "Vitamin B12 deficiency", "Calcium deficiency"];
  const DEFICIENCY_SUFFIX = / deficiency$/i;

  // Backend prompts expect a bare nutrient name ("Vitamin D"), not "Vitamin D deficiency".
  function toNutrientName(condition) {
    return condition.replace(DEFICIENCY_SUFFIX, '');
  }

  let members = [{ id: 1, name: "Member 1", diets: [], allergens: [], conditions: [] }];


  function render() {
    const container = document.getElementById('ngMembersContainer');
    container.innerHTML = '';


    members.forEach((m, idx) => {
      const card = document.createElement('div');
      card.className = 'ng-card';
      card.innerHTML = `
        <div class="ng-member-header">
          <span>${m.name}</span>
          ${members.length > 1 ? `<button class="ng-btn-danger" data-action="remove" data-idx="${idx}">Remove</button>` : ''}
        </div>

        <div class="ng-section-label">Dietary Preferences</div>
        <div class="ng-tag-group">
          ${DIETS.map(d => `<div class="ng-tag ${m.diets.includes(d) ? 'selected-diet' : ''}" data-action="toggle" data-idx="${idx}" data-category="diets" data-value="${d}">${d}</div>`).join('')}
        </div>


        <div class="ng-section-label">Allergens</div>
        <div class="ng-tag-group">
          ${ALLERGENS.map(a => `<div class="ng-tag ${m.allergens.includes(a) ? 'selected-allergen' : ''}" data-action="toggle" data-idx="${idx}" data-category="allergens" data-value="${a}">${a}</div>`).join('')}
        </div>


        <div class="ng-section-label">Deficiencies & Goals</div>
        <div class="ng-tag-group">
          ${CONDITIONS.map(c => `<div class="ng-tag ${m.conditions.includes(c) ? 'selected-condition' : ''}" data-action="toggle" data-idx="${idx}" data-category="conditions" data-value="${c}">${c}</div>`).join('')}
        </div>
      `;
      container.appendChild(card);
    });
  }


  // 5. Event Listeners
  toggleBtn.addEventListener('click', () => drawer.classList.toggle('open'));
  document.getElementById('ngBtnClose').addEventListener('click', () => drawer.classList.remove('open'));


  document.getElementById('ngMembersContainer').addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (!action) return;


    const idx = parseInt(e.target.dataset.idx);
    if (action === 'toggle') {
      const category = e.target.dataset.category;
      const value = e.target.dataset.value;
      const list = members[idx][category];
      const itemIdx = list.indexOf(value);
      if (itemIdx === -1) list.push(value);
      else list.splice(itemIdx, 1);
      render();
    } else if (action === 'remove') {
      members.splice(idx, 1);
      render();
    }
  });


  document.getElementById('ngBtnAddMember').addEventListener('click', () => {
    members.push({ id: Date.now(), name: `Member ${members.length + 1}`, diets: [], allergens: [], conditions: [] });
    render();
  });


  function showStatus(message) {
    const statusEl = document.getElementById('ngStatus');
    if (!statusEl) return;
    statusEl.textContent = message;
    setTimeout(() => { statusEl.textContent = ''; }, 2500);
  }

  document.getElementById('ngBtnSaveProfile').addEventListener('click', () => {
    const aggregateAllergens = [...new Set(members.flatMap(m => m.allergens))];
    const aggregateConditions = [...new Set(members.flatMap(m => m.conditions))];
    const aggregateDiets = [...new Set(members.flatMap(m => m.diets))];


    const familyPayload = {
      rawMembers: members,
      allergens: aggregateAllergens,
      targetVitamins: aggregateConditions.map(toNutrientName),
      diets: aggregateDiets
    };


    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ familyDB: familyPayload }, () => {
        showStatus('Profile saved!');
      });
    } else {
      localStorage.setItem('familyDB', JSON.stringify(familyPayload));
      showStatus('Saved locally!');
    }
  });


  function hydrateFromStoredProfile(storedFamilyDB) {
    if (storedFamilyDB && Array.isArray(storedFamilyDB.rawMembers) && storedFamilyDB.rawMembers.length > 0) {
      members = storedFamilyDB.rawMembers;
    }
    render();
  }

  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['familyDB'], (result) => hydrateFromStoredProfile(result.familyDB));
  } else {
    const stored = localStorage.getItem('familyDB');
    hydrateFromStoredProfile(stored ? JSON.parse(stored) : null);
  }
})();
