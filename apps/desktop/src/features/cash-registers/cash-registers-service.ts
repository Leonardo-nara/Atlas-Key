import { http } from "../../lib/http";
import type {
  CashRegister,
  CashRegisterSession,
  CashRegisterSessionReport,
  CashRegisterSessionStatus,
  PaginatedResponse
} from "../../types/api";

export interface CashMovementInput {
  amount: number;
  reason: string;
}

export const cashRegistersService = {
  list(token: string) {
    return http<CashRegister[]>("/cash-registers", { token });
  },
  create(token: string, name: string) {
    return http<CashRegister>("/cash-registers", {
      method: "POST",
      token,
      body: JSON.stringify({ name })
    });
  },
  update(token: string, cashRegisterId: string, input: { name?: string; active?: boolean }) {
    return http<CashRegister>(`/cash-registers/${cashRegisterId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(input)
    });
  },
  open(token: string, cashRegisterId: string, openingAmount: number, notes?: string) {
    return http<CashRegisterSession>(`/cash-registers/${cashRegisterId}/open`, {
      method: "POST",
      token,
      body: JSON.stringify({ openingAmount, notes })
    });
  },
  currentSession(token: string, cashRegisterId: string) {
    return http<CashRegisterSession | null>(`/cash-registers/${cashRegisterId}/current-session`, { token });
  },
  listSessions(
    token: string,
    options?: { page?: number; status?: CashRegisterSessionStatus; cashRegisterId?: string }
  ) {
    const query = new URLSearchParams();

    if (options?.page) {
      query.set("page", String(options.page));
    }

    if (options?.status) {
      query.set("status", options.status);
    }

    if (options?.cashRegisterId) {
      query.set("cashRegisterId", options.cashRegisterId);
    }

    const suffix = query.toString() ? `?${query.toString()}` : "";

    return http<PaginatedResponse<CashRegisterSession>>(`/cash-register-sessions${suffix}`, { token });
  },
  getSession(token: string, sessionId: string) {
    return http<CashRegisterSession>(`/cash-register-sessions/${sessionId}`, { token });
  },
  cashIn(token: string, sessionId: string, input: CashMovementInput) {
    return http<CashRegisterSession>(`/cash-register-sessions/${sessionId}/cash-in`, {
      method: "POST",
      token,
      body: JSON.stringify(input)
    });
  },
  cashOut(token: string, sessionId: string, input: CashMovementInput) {
    return http<CashRegisterSession>(`/cash-register-sessions/${sessionId}/cash-out`, {
      method: "POST",
      token,
      body: JSON.stringify(input)
    });
  },
  close(token: string, sessionId: string, countedCashAmount: number, notes?: string) {
    return http<CashRegisterSession>(`/cash-register-sessions/${sessionId}/close`, {
      method: "POST",
      token,
      body: JSON.stringify({ countedCashAmount, notes })
    });
  },
  report(token: string, sessionId: string) {
    return http<CashRegisterSessionReport>(`/cash-register-sessions/${sessionId}/report`, { token });
  }
};
