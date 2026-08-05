import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

/** Danh sách email admin — nguồn duy nhất, dùng chung cho toàn app. */
export const ADMIN_EMAILS = ['hoankb4@gmail.com'];

interface AuthValue {
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  balance: number;
  refreshBalance: () => Promise<void>;
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
  balance: 0,
  refreshBalance: async () => {},
  signIn: async () => {},
  signUp: async () => {},
  verifyOtp: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // isAdmin là giá trị DERIVED từ session — luôn đồng bộ trong cùng một render,
  // không còn cửa sổ race (loading=false, session!=null nhưng isAdmin chưa kịp set).
  const isAdmin = useMemo(() => {
    const email = session?.user?.email?.toLowerCase();
    return email ? ADMIN_EMAILS.includes(email) : false;
  }, [session]);

  const fetchBalance = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', userId)
        .single() as any;
      if (!error && data) {
        setBalance(data.balance || 0);
      }
    } catch (err) {
      console.error('Error fetching balance:', err);
    }
  };

  const refreshBalance = async () => {
    if (session?.user?.id) {
      await fetchBalance(session.user.id);
    }
  };

  // Nạp số dư theo user hiện tại (chỉ liên quan balance, KHÔNG đụng auth flow).
  useEffect(() => {
    if (session?.user?.id) {
      fetchBalance(session.user.id);
    } else {
      setBalance(0);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    let alive = true;

    // Phục hồi session từ storage khi app khởi động.
    // .finally() đảm bảo loading LUÔN kết thúc, kể cả khi getSession() lỗi
    // (mạng/token hỏng) — tránh spinner loading vô hạn.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) setSession(data.session);
      })
      .catch((err) => {
        console.error('[Auth] getSession failed:', err);
        if (alive) setSession(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    // Theo dõi mọi thay đổi auth (login/logout/refresh token) sau đó.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (alive) {
        setSession(s);
        setLoading(false);
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
    <AuthContext.Provider value={{ session, loading, isAdmin, balance, refreshBalance, signIn, signUp, verifyOtp, signInWithGoogle, signOut }}>
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
