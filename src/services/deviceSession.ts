import { supabase } from '../lib/supabase';
import { detectCurrentDevice } from '../utils/deviceDetector';

export interface UserDeviceRecord {
  id: string;
  user_id: string;
  device_id: string;
  device_name: string;
  device_type: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  ip_address?: string;
  last_active_at: string;
  created_at: string;
  is_current?: boolean;
}

/**
 * Đăng ký hoặc cập nhật phiên thiết bị hiện tại lên bảng user_devices
 */
export async function trackCurrentDevice(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const currentDevice = detectCurrentDevice();

    // Upsert bản ghi thiết bị
    await (supabase as any).from('user_devices').upsert(
      {
        user_id: userId,
        device_id: currentDevice.deviceId,
        device_name: currentDevice.deviceName,
        device_type: currentDevice.deviceType,
        browser: currentDevice.browser,
        os: currentDevice.os,
        last_active_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,device_id' }
    );
  } catch (err) {
    console.warn('[DeviceSession] Could not track device:', err);
  }
}

/**
 * Lấy danh sách toàn bộ thiết bị đã đăng nhập của người dùng
 */
export async function getUserDevices(userId: string): Promise<UserDeviceRecord[]> {
  if (!userId) return [];
  try {
    const currentDevice = detectCurrentDevice();

    const { data, error } = await (supabase as any)
      .from('user_devices')
      .select('*')
      .eq('user_id', userId)
      .order('last_active_at', { ascending: false });

    if (error) {
      console.warn('[DeviceSession] Error fetching devices:', error);
      // Fallback: trả về chính thiết bị hiện tại
      return [
        {
          id: 'current',
          user_id: userId,
          device_id: currentDevice.deviceId,
          device_name: currentDevice.deviceName,
          device_type: currentDevice.deviceType,
          browser: currentDevice.browser,
          os: currentDevice.os,
          last_active_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          is_current: true,
        },
      ];
    }

    const records = (data || []) as UserDeviceRecord[];

    // Nếu trong DB chưa có thiết bị hiện tại, thêm vào đầu
    const hasCurrent = records.some((d) => d.device_id === currentDevice.deviceId);
    if (!hasCurrent) {
      records.unshift({
        id: 'current',
        user_id: userId,
        device_id: currentDevice.deviceId,
        device_name: currentDevice.deviceName,
        device_type: currentDevice.deviceType,
        browser: currentDevice.browser,
        os: currentDevice.os,
        last_active_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        is_current: true,
      });
    }

    return records.map((d) => ({
      ...d,
      is_current: d.device_id === currentDevice.deviceId,
    }));
  } catch (err) {
    console.error('[DeviceSession] Unexpected error:', err);
    return [];
  }
}

/**
 * Xóa một thiết bị đăng xuất từ xa
 */
export async function removeDeviceSession(userId: string, deviceId: string): Promise<void> {
  try {
    await (supabase as any)
      .from('user_devices')
      .delete()
      .eq('user_id', userId)
      .eq('device_id', deviceId);
  } catch (err) {
    console.error('[DeviceSession] Error removing device:', err);
    throw err;
  }
}

/**
 * Đăng xuất khỏi tất cả các thiết bị khác (ngoại trừ thiết bị hiện tại)
 */
export async function signOutOtherDevices(userId: string): Promise<void> {
  const currentDevice = detectCurrentDevice();
  try {
    // 1. Supabase Auth signOut with scope 'others'
    await supabase.auth.signOut({ scope: 'others' });

    // 2. Xóa các bản ghi thiết bị khác trong DB
    await (supabase as any)
      .from('user_devices')
      .delete()
      .eq('user_id', userId)
      .neq('device_id', currentDevice.deviceId);
  } catch (err) {
    console.error('[DeviceSession] Error signing out other devices:', err);
    throw err;
  }
}
