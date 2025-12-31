/**
 * Page Manager - 前端页面内容管理工具
 * 用于从后台管理系统加载和显示页面内容
 */

// 获取当前页面ID
function getCurrentPageId() {
  const path = window.location.pathname;
  const filename = path.split('/').pop() || 'index.html';
  
  const pageMap = {
    'index.html': 'home',
    'about.html': 'about',
    'market.html': 'market',
    'trade.html': 'trade',
    'assets.html': 'assets',
    'account.html': 'account',
    'recharge.html': 'recharge',
    'withdraw.html': 'withdraw',
    'customer-support.html': 'customer-support',
    'terms.html': 'terms'
  };
  
  return pageMap[filename] || null;
}

/**
 * 从后台加载页面内容
 * @param {string} pageId - 页面ID
 * @returns {Promise<object>} - 页面内容对象
 */
async function loadPageContent(pageId) {
  try {
    // 仅在管理员或需要的时候加载
    // 普通用户使用静态HTML内容
    const response = await fetch(`${API_BASE}/admin/pages/${pageId}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.warn('Failed to load page content from admin:', error);
    return null;
  }
}

/**
 * 应用页面内容到DOM
 * @param {object} pageContent - 页面内容对象
 * @param {object} selectors - CSS选择器映射 { heading: '.page-heading', description: '.page-desc', ... }
 */
function applyPageContent(pageContent, selectors) {
  if (!pageContent || !selectors) return;

  // 应用标题
  if (selectors.heading && pageContent.heading) {
    const el = document.querySelector(selectors.heading);
    if (el) el.textContent = pageContent.heading;
  }

  // 应用描述
  if (selectors.description && pageContent.description) {
    const el = document.querySelector(selectors.description);
    if (el) el.textContent = pageContent.description;
  }

  // 应用内容
  if (selectors.content && pageContent.content) {
    const el = document.querySelector(selectors.content);
    if (el) el.innerHTML = pageContent.content;
  }

  // 应用主题颜色
  if (pageContent.themeColor) {
    document.documentElement.style.setProperty('--admin-theme', pageContent.themeColor);
  }

  // 应用状态
  if (pageContent.status === 'maintenance') {
    showMaintenanceMode();
  } else if (pageContent.status === 'disabled') {
    showDisabledMode();
  }
}

/**
 * 显示维护模式提示
 */
function showMaintenanceMode() {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
    color: white;
    padding: 12px;
    text-align: center;
    z-index: 9999;
    font-weight: 600;
  `;
  banner.textContent = '⚠️ 此页面正在维护中，请稍后返回';
  document.body.prepend(banner);
}

/**
 * 显示禁用模式提示
 */
function showDisabledMode() {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    padding: 12px;
    text-align: center;
    z-index: 9999;
    font-weight: 600;
  `;
  banner.textContent = '❌ 此页面已禁用';
  document.body.prepend(banner);
}

/**
 * 初始化页面管理
 * @param {object} selectorConfig - 选择器配置
 */
async function initPageManager(selectorConfig) {
  const pageId = getCurrentPageId();
  if (!pageId) return;

  const pageContent = await loadPageContent(pageId);
  if (pageContent) {
    applyPageContent(pageContent, selectorConfig);
  }
}

/**
 * 为特定元素绑定可编辑内容（用于内容预览和快速编辑）
 * @param {string} selector - 选择器
 * @param {string} key - 内容键名
 */
function makeEditableElement(selector, key) {
  const element = document.querySelector(selector);
  if (!element) return;

  element.addEventListener('click', function(e) {
    if (!isAdmin()) return; // 只有管理员可以编辑

    // 显示编辑框
    const currentText = element.textContent;
    const input = document.createElement('textarea');
    input.value = currentText;
    input.style.cssText = `
      width: 100%;
      min-height: ${element.offsetHeight}px;
      padding: 8px;
      border: 2px solid var(--primary);
      border-radius: 4px;
      font-family: inherit;
      font-size: inherit;
    `;

    element.style.display = 'none';
    element.parentNode.insertBefore(input, element);
    input.focus();

    function save() {
      const newText = input.value;
      element.textContent = newText;
      element.style.display = '';
      input.remove();
      
      // 保存到后台
      saveEditableContent(key, newText);
    }

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') save();
    });
  });
}

/**
 * 保存可编辑元素的内容
 * @param {string} key - 内容键名
 * @param {string} value - 新值
 */
async function saveEditableContent(key, value) {
  try {
    const pageId = getCurrentPageId();
    if (!pageId) return;

    const token = localStorage.getItem('adminToken');
    const payload = {};
    payload[key] = value;

    const response = await fetch(`${API_BASE}/admin/pages/${pageId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log('Content saved successfully');
    }
  } catch (error) {
    console.error('Failed to save content:', error);
  }
}

/**
 * 检查当前用户是否为管理员
 */
function isAdmin() {
  const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
  return adminUser.isAdmin === true || adminUser.isAdmin === 1;
}

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getCurrentPageId,
    loadPageContent,
    applyPageContent,
    initPageManager,
    makeEditableElement,
    saveEditableContent,
    isAdmin
  };
}
