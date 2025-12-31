// ============================================
// 公共认证函数 (Common Authentication Functions)
// ============================================

// 动态获取API基础URL
const API_BASE = (() => {
  const protocol = window.location.protocol;
  const host = window.location.host;
  return `${protocol}//${host}/api`;
})();

/**
 * 检查用户是否已登录
 * @returns {boolean}
 */
function isLoggedIn() {
  const token = localStorage.getItem('token') || localStorage.getItem('userToken');
  return !!token;
}

/**
 * 获取当前用户信息
 * @returns {Object|null} 返回用户对象 {token, username, userId} 或 null
 */
function getCurrentUser() {
  const token = localStorage.getItem('token') || localStorage.getItem('userToken');
  const username = localStorage.getItem('username');
  const userId = localStorage.getItem('userId');
  
  if (token) {
    return {
      token,
      username: username || 'User',
      userId: userId || ''
    };
  }
  return null;
}

/**
 * 保存用户登录信息到本地存储
 * @param {Object} userInfo - 用户信息对象 {token, username, userId}
 */
function saveUserInfo(userInfo) {
  if (userInfo.token) {
    localStorage.setItem('token', userInfo.token);
    localStorage.setItem('userToken', userInfo.token);
  }
  if (userInfo.username) {
    localStorage.setItem('username', userInfo.username);
  }
  if (userInfo.userId) {
    localStorage.setItem('userId', userInfo.userId);
  }
}

/**
 * 清除用户登录信息
 */
function clearUserInfo() {
  localStorage.removeItem('token');
  localStorage.removeItem('userToken');
  localStorage.removeItem('username');
  localStorage.removeItem('userId');
}

/**
 * 用户登出
 */
function logout() {
  const token = localStorage.getItem('token') || localStorage.getItem('userToken');
  
  if (token) {
    fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).catch(err => console.log('Logout API error:', err));
  }
  
  clearUserInfo();
  window.location.href = 'index.html';
}

/**
 * 更新导航栏显示（显示/隐藏用户相关UI）
 */
function updateNavbar() {
  const user = getCurrentUser();
  const userInfo = document.getElementById('userInfo');
  const username = document.getElementById('username');
  const logoutBtn = document.getElementById('logoutBtn');
  const loginButtons = document.querySelector('.topbar-auth');
  
  if (user) {
    // 用户已登录
    if (userInfo) userInfo.style.display = 'block';
    if (username) username.textContent = user.username;
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    if (loginButtons) loginButtons.style.display = 'none';
  } else {
    // 用户未登录
    if (userInfo) userInfo.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (loginButtons) loginButtons.style.display = 'flex';
  }
}

/**
 * 加载支持链接
 */
function loadSupportLink() {
  const supportLink = document.getElementById('supportLink');
  if (supportLink) {
    const user = getCurrentUser();
    if (user) {
      supportLink.style.display = 'block';
      supportLink.href = 'customer-support.html';
    } else {
      supportLink.style.display = 'none';
    }
  }
}

/**
 * 保护页面 - 如果未登录则重定向到登录页
 */
function protectPage() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
  }
  return user;
}

/**
 * 加载用户资产数据
 */
async function loadUserAssets() {
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('userToken');
    
    if (!token) {
      console.log('[Auth] No token available for loading assets');
      return null;
    }

    const response = await fetch(`${API_BASE}/assets`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token 失效
        clearUserInfo();
        return null;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success && data.data) {
      // 更新导航栏的余额显示
      const balanceEl = document.getElementById('userBalance');
      if (balanceEl && data.data.totalBalance) {
        balanceEl.textContent = `$${(data.data.totalBalance || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
      }
      return data.data;
    }
  } catch (error) {
    console.error('[Auth] Error loading assets:', error);
  }
  return null;
}

console.log('[Auth.js] Loaded successfully');
