// API 配置文件
// 这个文件定义了不同环境下的 API 地址

const API_CONFIG = {
  // 本地开发
  'localhost:3000': 'http://localhost:3000/api',
  'localhost': 'http://localhost:3000/api',
  '127.0.0.1:3000': 'http://localhost:3000/api',
  '127.0.0.1': 'http://localhost:3000/api',
  
  // 生产环境
  'foxprocs.top': 'https://api.foxprocs.top/api',
  'www.foxprocs.top': 'https://api.foxprocs.top/api',
  'foxpro.top': 'https://api.foxpro.top/api',
  'www.foxpro.top': 'https://api.foxpro.top/api',
};

// 获取 API 基础 URL
function getAPIBase() {
  const host = window.location.host;
  
  // 优先使用配置文件中的地址
  if (API_CONFIG[host]) {
    return API_CONFIG[host];
  }
  
  // 如果不在配置中，使用动态构造（同域名）
  const protocol = window.location.protocol;
  return `${protocol}//${host}/api`;
}

const API_BASE = getAPIBase();

// 调试输出
console.log('[Config] Current host:', window.location.host);
console.log('[Config] API_BASE:', API_BASE);
