// popup.js - DriveTranslate Searchable Dropdowns Logic

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const body = document.body;
  const glassContainer = document.querySelector('.glass-container');
  const themeToggle = document.getElementById('theme-toggle');
  const autoTranslateToggle = document.getElementById('auto-translate-toggle');

  const sourceDropdown = document.getElementById('source-dropdown');
  const sourceTrigger = sourceDropdown.querySelector('.dropdown-trigger');
  const sourceSelectedVal = document.getElementById('source-selected-val');
  const sourceSearch = document.getElementById('source-search-input');
  const sourceOptionsContainer = document.getElementById('source-options');

  const targetDropdown = document.getElementById('target-dropdown');
  const targetTrigger = targetDropdown.querySelector('.dropdown-trigger');
  const targetSelectedVal = document.getElementById('target-selected-val');
  const targetSearch = document.getElementById('target-search-input');
  const targetOptionsContainer = document.getElementById('target-options');

  // App State
  let currentTheme = 'dark';
  let selectedSourceLang = 'auto';
  let selectedTargetLang = 'en';

  // 1. Populate Dropdowns
  function initDropdowns() {
    // Clear containers
    sourceOptionsContainer.innerHTML = '';
    targetOptionsContainer.innerHTML = '';

    // Populate Source (Include 'auto' for Detect Language)
    Object.entries(LANGUAGES).forEach(([code, name]) => {
      const option = document.createElement('div');
      option.className = 'option-item';
      option.dataset.value = code;
      option.textContent = name;
      if (code === selectedSourceLang) {
        option.classList.add('selected');
        sourceSelectedVal.textContent = name;
      }
      option.addEventListener('click', () => selectSource(code, name));
      sourceOptionsContainer.appendChild(option);
    });

    // Populate Target (Exclude 'auto')
    Object.entries(LANGUAGES).forEach(([code, name]) => {
      if (code === 'auto') return;
      const option = document.createElement('div');
      option.className = 'option-item';
      option.dataset.value = code;
      option.textContent = name;
      if (code === selectedTargetLang) {
        option.classList.add('selected');
        targetSelectedVal.textContent = name;
      }
      option.addEventListener('click', () => selectTarget(code, name));
      targetOptionsContainer.appendChild(option);
    });
  }

  // 2. Select Handlers
  function selectSource(code, name) {
    selectedSourceLang = code;
    sourceSelectedVal.textContent = name;
    
    // Update active class in options list
    sourceOptionsContainer.querySelectorAll('.option-item').forEach(item => {
      if (item.dataset.value === code) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });

    saveSetting('lastSourceLang', code);
    closeAllDropdowns();
  }

  // Custom target handler
  function selectTarget(code, name) {
    selectedTargetLang = code;
    targetSelectedVal.textContent = name;

    // Update active class in options list
    targetOptionsContainer.querySelectorAll('.option-item').forEach(item => {
      if (item.dataset.value === code) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });

    saveSetting('lastTargetLang', code);
    closeAllDropdowns();
  }

  // 3. Dropdown Toggle Handlers
  sourceTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isAlreadyActive = sourceDropdown.classList.contains('active');
    closeAllDropdowns();
    if (!isAlreadyActive) {
      sourceDropdown.classList.add('active');
      glassContainer.classList.add('has-open-dropdown');
      sourceSearch.focus();
    }
  });

  targetTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isAlreadyActive = targetDropdown.classList.contains('active');
    closeAllDropdowns();
    if (!isAlreadyActive) {
      targetDropdown.classList.add('active');
      glassContainer.classList.add('has-open-dropdown');
      targetSearch.focus();
    }
  });

  // Prevent dropdown closing when clicking inside menu (e.g. search box)
  sourceDropdown.querySelector('.dropdown-menu').addEventListener('click', (e) => {
    e.stopPropagation();
  });
  targetDropdown.querySelector('.dropdown-menu').addEventListener('click', (e) => {
    e.stopPropagation();
  });

  function closeAllDropdowns() {
    sourceDropdown.classList.remove('active');
    targetDropdown.classList.remove('active');
    glassContainer.classList.remove('has-open-dropdown');
    
    // Clear search values when closing
    sourceSearch.value = '';
    targetSearch.value = '';
    filterOptions(sourceOptionsContainer, '');
    filterOptions(targetOptionsContainer, '');
  }

  // Close menus when clicking outside
  document.addEventListener('click', () => {
    closeAllDropdowns();
  });

  // 4. Search Filter Implementation
  sourceSearch.addEventListener('input', (e) => {
    filterOptions(sourceOptionsContainer, e.target.value);
  });

  targetSearch.addEventListener('input', (e) => {
    filterOptions(targetOptionsContainer, e.target.value);
  });

  function filterOptions(container, query) {
    const items = container.querySelectorAll('.option-item');
    const lowerQuery = query.toLowerCase().trim();

    items.forEach(item => {
      item.classList.remove('highlighted'); // Clear highlight on filter
      const text = item.textContent.toLowerCase();
      if (text.includes(lowerQuery)) {
        item.classList.remove('hidden');
      } else {
        item.classList.add('hidden');
      }
    });
  }

  // Keyboard Navigation Implementation
  function handleKeydown(e, container) {
    const items = Array.from(container.querySelectorAll('.option-item:not(.hidden)'));
    if (items.length === 0) return;

    let currentIndex = items.findIndex(item => item.classList.contains('highlighted'));

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      currentIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      currentIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentIndex >= 0 && currentIndex < items.length) {
        items[currentIndex].click();
      } else if (items.length > 0) {
        // Select first item if nothing is highlighted
        items[0].click();
      }
      return;
    } else {
      return; // Let native typing handle other keys
    }

    items.forEach(item => item.classList.remove('highlighted'));
    items[currentIndex].classList.add('highlighted');
    items[currentIndex].scrollIntoView({ block: 'nearest' });
  }

  sourceSearch.addEventListener('keydown', (e) => handleKeydown(e, sourceOptionsContainer));
  targetSearch.addEventListener('keydown', (e) => handleKeydown(e, targetOptionsContainer));

  // 5. Settings Sync Storage
  function loadSavedSettings() {
    chrome.storage.local.get([
      'lastSourceLang',
      'lastTargetLang',
      'lastTheme',
      'autoTranslateEnabled'
    ], (result) => {
      // Setup Defaults
      selectedSourceLang = result.lastSourceLang || 'auto';
      selectedTargetLang = result.lastTargetLang || 'en';

      // Set Checkbox state
      autoTranslateToggle.checked = result.autoTranslateEnabled !== false;

      // Populate & Highlight values
      initDropdowns();

      // Theme toggle initialization
      if (result.lastTheme) {
        currentTheme = result.lastTheme;
        if (currentTheme === 'light') {
          body.classList.remove('dark-mode');
          body.classList.add('light-mode');
        } else {
          body.classList.remove('light-mode');
          body.classList.add('dark-mode');
        }
      }
    });
  }

  function saveSetting(key, value) {
    chrome.storage.local.set({ [key]: value });
  }

  // 6. Theme Switching Action
  themeToggle.addEventListener('click', () => {
    if (body.classList.contains('dark-mode')) {
      body.classList.remove('dark-mode');
      body.classList.add('light-mode');
      currentTheme = 'light';
    } else {
      body.classList.remove('light-mode');
      body.classList.add('dark-mode');
      currentTheme = 'dark';
    }
    saveSetting('lastTheme', currentTheme);
  });

  // 7. Auto Translate Toggle Changed Listener
  autoTranslateToggle.addEventListener('change', () => {
    saveSetting('autoTranslateEnabled', autoTranslateToggle.checked);
  });

  // Initialize on start
  loadSavedSettings();
});
