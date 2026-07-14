import { env } from "../../lib/env";
import { http } from "../../lib/http";
import type {
  ReportCashResponse,
  ReportListFilters,
  ReportOverview,
  ReportPeriodFilters,
  ReportProductsResponse,
  ReportSalesResponse,
  ReportStockResponse
} from "../../types/api";

function toQuery(filters: ReportPeriodFilters | ReportListFilters) {
  const query = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

function toPeriodFilters(filters: ReportPeriodFilters | ReportListFilters): ReportPeriodFilters {
  return {
    period: filters.period,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo
  };
}

export const reportsService = {
  overview(token: string, filters: ReportPeriodFilters) {
    return http<ReportOverview>(`/reports/overview${toQuery(toPeriodFilters(filters))}`, { token });
  },
  sales(token: string, filters: ReportListFilters) {
    return http<ReportSalesResponse>(`/reports/sales${toQuery(filters)}`, { token });
  },
  products(token: string, filters: ReportPeriodFilters) {
    return http<ReportProductsResponse>(`/reports/products${toQuery(toPeriodFilters(filters))}`, { token });
  },
  cash(token: string, filters: ReportListFilters) {
    return http<ReportCashResponse>(`/reports/cash${toQuery(filters)}`, { token });
  },
  stock(token: string, filters: ReportListFilters) {
    return http<ReportStockResponse>(`/reports/stock${toQuery(filters)}`, { token });
  },
  async downloadCsv(token: string, type: "sales" | "products" | "cash" | "stock", filters: ReportListFilters) {
    const queryFilters = type === "products" ? toPeriodFilters(filters) : filters;
    const response = await fetch(`${env.apiUrl}/reports/${type}.csv${toQuery(queryFilters)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error("Nao foi possivel exportar o relatorio.");
    }

    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition");
    const fileName = /filename="([^"]+)"/.exec(disposition ?? "")?.[1] ?? `relatorio-${type}.csv`;

    return { blob, fileName };
  }
};
