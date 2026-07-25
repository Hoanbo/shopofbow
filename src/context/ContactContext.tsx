import { createContext, useContext, type ReactNode } from 'react';
import { fetchContactSettings, type ContactSettings } from '../data/api';
import { useAsync } from '../hooks/useAsync';

const FALLBACK: ContactSettings = {
  facebookUrl: '#',
  zaloUrl: '#',
  supportPhone: '',
  supportEmail: '',
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
