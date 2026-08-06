import { createContext, useContext, type ReactNode } from 'react';
import { fetchContactSettings, type ContactSettings } from '../data/api';
import { useAsync } from '../hooks/useAsync';

const FALLBACK: ContactSettings = {
  facebookUrl: 'https://www.facebook.com/Bobowcon',
  zaloUrl: 'https://zalo.me/0966821315',
  instagramUrl: 'https://www.instagram.com/bobowcon',
  tiktokUrl: 'https://www.tiktok.com/@bobowcon',
  discordUrl: 'https://discord.gg/tT2aSRXv',
  locketUrl: 'https://locket.cam/bowcon',
  supportPhone: '+84 966 821 315',
  supportEmail: 'hoankb4@gmail.com',
};

const ContactContext = createContext<ContactSettings>(FALLBACK);

export function ContactProvider({ children }: { children: ReactNode }) {
  const { data } = useAsync(fetchContactSettings, [], FALLBACK);
  return <ContactContext.Provider value={data ?? FALLBACK}>{children}</ContactContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useContact() {
  return useContext(ContactContext);
}
