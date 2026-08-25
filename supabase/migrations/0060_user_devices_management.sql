-- Migration 0060: Quản lý thiết bị đăng nhập (User Devices Management)
CREATE TABLE IF NOT EXISTS public.user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    device_name TEXT NOT NULL DEFAULT 'Trình duyệt Web',
    device_type TEXT NOT NULL DEFAULT 'desktop', -- 'desktop', 'mobile', 'tablet'
    browser TEXT,
    os TEXT,
    ip_address TEXT,
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, device_id)
);

-- Bật Row Level Security (RLS)
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- Policy: User có thể xem danh sách thiết bị của chính mình
CREATE POLICY "Users can view their own devices"
    ON public.user_devices
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: User có thể insert hoặc update thiết bị của chính mình
CREATE POLICY "Users can insert/update their own devices"
    ON public.user_devices
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices"
    ON public.user_devices
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: User có thể xóa thiết bị của chính mình (đăng xuất từ xa)
CREATE POLICY "Users can delete their own devices"
    ON public.user_devices
    FOR DELETE
    USING (auth.uid() = user_id);

-- Tạo Index để tối ưu truy vấn theo user_id và device_id
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_lookup ON public.user_devices(user_id, device_id);
