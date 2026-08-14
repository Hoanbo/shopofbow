import { supabase } from './supabase';

export type TicketTelegramEvent = 'ticket_created' | 'ticket_user_message' | 'ticket_resolved' | 'ticket_closed';
export type TicketEmailType = 'ticket_reply' | 'ticket_resolved' | 'ticket_closed';

/**
 * Gửi thông báo Ticket tới Telegram Bot của Admin
 */
export async function sendTicketTelegramNotify(
  ticketId: string,
  event: TicketTelegramEvent,
  messageText?: string
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const res = await fetch('/api/telegram-notify', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ticket_id: ticketId,
        event,
        message: messageText || '',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[notify] Telegram notify returned non-ok status:', res.status, err);
    }
  } catch (err) {
    console.warn('[notify] sendTicketTelegramNotify error:', err);
  }
}

/**
 * Gửi Email thông báo Ticket tới Hộp thư Email của User
 */
export async function sendTicketEmailNotify(
  ticketId: string,
  type: TicketEmailType,
  messageSnippet?: string
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const res = await fetch('/api/email-notify', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ticket_id: ticketId,
        type,
        message: messageSnippet || '',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[notify] Email notify returned non-ok status:', res.status, err);
    }
  } catch (err) {
    console.warn('[notify] sendTicketEmailNotify error:', err);
  }
}
