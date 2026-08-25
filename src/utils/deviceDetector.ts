/**
 * Device Detector Utility
 * Phát hiện loại thiết bị, hệ điều hành, trình duyệt và quản lý Device ID
 */

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
}

const DEVICE_ID_KEY = 'shopofbow_device_id';

/**
 * Lấy hoặc khởi tạo Device ID ngẫu nhiên lưu trong localStorage
 */
export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'dev_' + Math.random().toString(36).substring(2, 11);
  }
}

/**
 * Phân tích user agent của trình duyệt hiện tại
 */
export function detectCurrentDevice(): DeviceInfo {
  const userAgent = navigator.userAgent || '';
  const deviceId = getOrCreateDeviceId();

  // 1. Nhận diện OS
  let os = 'Không xác định';
  if (/windows nt 10/i.test(userAgent)) os = 'Windows 10/11';
  else if (/windows nt 6\.3/i.test(userAgent)) os = 'Windows 8.1';
  else if (/windows nt 6\.2/i.test(userAgent)) os = 'Windows 8';
  else if (/windows nt 6\.1/i.test(userAgent)) os = 'Windows 7';
  else if (/windows/i.test(userAgent)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(userAgent)) os = 'macOS';
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';
  else if (/android/i.test(userAgent)) os = 'Android';
  else if (/linux/i.test(userAgent)) os = 'Linux';

  // 2. Nhận diện Trình duyệt
  let browser = 'Trình duyệt Web';
  if (/edg/i.test(userAgent)) browser = 'Microsoft Edge';
  else if (/brave/i.test(userAgent) || (navigator as any).brave) browser = 'Brave';
  else if (/chrome|crios/i.test(userAgent) && !/opr|opera/i.test(userAgent)) browser = 'Google Chrome';
  else if (/safari/i.test(userAgent) && !/chrome|crios/i.test(userAgent)) browser = 'Safari';
  else if (/firefox|fxios/i.test(userAgent)) browser = 'Mozilla Firefox';
  else if (/opr|opera/i.test(userAgent)) browser = 'Opera';

  // 3. Nhận diện Loại thiết bị
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (/ipad|tablet/i.test(userAgent) || (navigator.maxTouchPoints > 1 && /macintosh/i.test(userAgent))) {
    deviceType = 'tablet';
  } else if (/mobile|iphone|ipod|android.*mobile/i.test(userAgent)) {
    deviceType = 'mobile';
  }

  // 4. Tạo tên hiển thị thân thiện cho thiết bị
  const deviceName = `${browser} trên ${os}`;

  return {
    deviceId,
    deviceName,
    deviceType,
    browser,
    os,
  };
}
