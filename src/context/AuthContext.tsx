import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { subscribe } from '../services/realtime/eventBus';

/** Danh sách email admin — nguồn duy nhất, chỉ có duy nhất hoankb4@gmail.com */
export const ADMIN_EMAILS = ['hoankb4@gmail.com'];

export interface UserProfile {
  id: string;
  role: 'member' | 'ctv' | 'admin';
  referral_code?: string;
  referred_by?: string;
  affiliate_earnings?: number;
  balance?: number;
  full_name?: string;
  email?: string;
  avatar_url?: string;
}

interface AuthValue {
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isCtv: boolean;
  balance: number;
  profile: UserProfile | null;
  refreshBalance: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue>({
  session: null,
  loading: true,
  isAdmin: false,
  isCtv: false,
  balance: 0,
  profile: null,
  refreshBalance: async () => {},
  refreshProfile: async () => {},
  signIn: async () => {},
  signUp: async () => {},
  verifyOtp: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // isAdmin là giá trị DERIVED từ session + profile role (chỉ hoankb4@gmail.com hoặc role admin)
  const isAdmin = useMemo(() => {
    const email = session?.user?.email?.toLowerCase();
    if (!email) return false;
    const isEmailAdmin = ADMIN_EMAILS.includes(email);
    const isRoleAdmin = profile?.role === 'admin';
    return isEmailAdmin || isRoleAdmin;
  }, [session, profile?.role]);

  const isCtv = useMemo(() => {
    return profile?.role === 'ctv';
  }, [profile?.role]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single() as any;
      if (!error && data) {
        setProfile(data);
        setBalance(data.balance || 0);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const refreshBalance = async () => {
    if (session?.user?.id) {
      await fetchProfile(session.user.id);
    }
  };

  const refreshProfile = async () => {
    if (session?.user?.id) {
      await fetchProfile(session.user.id);
    }
  };

  // Nạp thông tin profile theo user hiện tại
  useEffect(() => {
    if (session?.user?.id) {
      fetchProfile(session.user.id);
    } else {
      setProfile(null);
      setBalance(0);
    }
  }, [session?.user?.id]);

  // Cập nhật balance / profile ngay khi RealtimeHub phát profiles:UPDATE cho user này
  // — không cần round-trip DB thêm
  useEffect(() => {
    if (!session?.user?.id) return;
    const uid = session.user.id;
    return subscribe('profiles:UPDATE', (e) => {
      if (e.payload.id !== uid) return;
      setBalance(e.payload.balance ?? 0);
      setProfile((prev) =>
        prev ? { ...prev, balance: e.payload.balance ?? 0, role: (e.payload.role as any) ?? prev.role, full_name: e.payload.full_name ?? prev.full_name } : prev,
      );
    });
  }, [session?.user?.id]);

  useEffect(() => {
    let alive = true;

    // Phục hồi session từ storage khi app khởi động.
    const cleanUrlHash = () => {
      if (window.location.hash && (window.location.hash.includes('access_token') || window.location.hash.includes('error'))) {
        setTimeout(() => {
          if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }, 500);
      }
    };

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (alive) {
          setSession(data.session);
          if (data.session?.user?.id) {
            await fetchProfile(data.session.user.id);
          }
          cleanUrlHash();
        }
      })
      .catch((err) => {
        console.error('[Auth] getSession failed:', err);
        if (alive) setSession(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    // Theo dõi mọi thay đổi auth (login/logout/refresh token) sau đó.
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      if (alive) {
        setSession(s);
        if (s?.user?.id) {
          await fetchProfile(s.user.id);
        }
        setLoading(false);
        cleanUrlHash();
      }
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
    });
    if (error) throw error;
    // Supabase trả về data.user với identities = [] nếu email đã được đăng ký trước đó
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('User already registered');
    }
  };

  const verifyOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: 'signup',
    });
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setBalance(0);
  };

  return (
    <AuthContext.Provider value={{ session, loading, isAdmin, isCtv, balance, profile, refreshBalance, refreshProfile, signIn, signUp, verifyOtp, signInWithGoogle, signOut }}>
      {/* Chỉ render App sau khi auth khởi tạo xong — tránh mọi redirect chạy
          khi session chưa được phục hồi (F5 bị logout, redirect sai). */}
      {loading ? (
        <div className="grid min-h-dvh place-items-center bg-sky-soft">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-500" />
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
