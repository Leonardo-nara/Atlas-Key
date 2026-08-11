import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { dashboardService } from "../features/dashboard/dashboard-service";
import { deliveryZonesService } from "../features/delivery-zones/delivery-zones-service";
import { reportsService } from "../features/reports/reports-service";
import { useAuth } from "../features/auth/auth-context";
import { ApiError } from "../lib/http";
import {
  AreaChart,
  ContentCard,
  DonutChart,
  EmptyState,
  ErrorState,
  MetricCard,
  PeriodFilter,
  SectionHeader,
  SkeletonCard,
  StatusBadge
} from "../shared/ui/premium";
import type {
  AdminDashboard,
  ReportOverview,
  ReportPeriod,
  ReportProductRow,
  ReportSaleRow,
  StoreDashboard,
  StoreDeliveryZone,
  StoreReadiness
} from "../types/api";

type DashboardPeriod = Extract<ReportPeriod, "today" | "7d" | "30d" | "current_month">;

type StoreDashboardData = {
  dashboard: StoreDashboard;
  readiness: StoreReadiness | null;
  overview: ReportOverview | null;
  sales: ReportSaleRow[];
  products: ReportProductRow[];
  zones: StoreDeliveryZone[];
};

type DashboardState =
  | { status: "idle" | "loading"; store: null; admin: null; error: null }
  | { status: "success"; store: StoreDashboardData | null; admin: AdminDashboard | null; error: null }
  | { status: "error"; store: null; admin: null; error: string };

const periodOptions: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "current_month", label: "Mes atual" }
];

const paymentColors = ["#38BDF8", "#60A5FA", "#34D399", "#FB923C", "#A78BFA"];

export function DashboardPage() {
  const { token, user, store } = useAuth();
  const isPlatformAdmin = isAdminRole(user?.role);
  const [period, setPeriod] = useState<DashboardPeriod>("7d");
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<DashboardState>({
    status: "idle",
    store: null,
    admin: null,
    error: null
  });

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    const currentToken = token;
    const currentUser = user;
    let isActive = true;
    setState({ status: "loading", store: null, admin: null, error: null });

    async function loadDashboard() {
      try {
        if (isAdminRole(currentUser.role)) {
          const adminDashboard = await dashboardService.getAdminDashboard(currentToken);

          if (isActive) {
            setState({
              status: "success",
              store: null,
              admin: adminDashboard,
              error: null
            });
          }

          return;
        }

        if (currentUser.role === "STORE_ADMIN") {
          const [
            storeDashboard,
            storeReadiness,
            reportOverview,
            reportSales,
            reportProducts,
            deliveryZones
          ] = await Promise.all([
            dashboardService.getStoreDashboard(currentToken),
            dashboardService.getStoreReadiness(currentToken),
            reportsService.overview(currentToken, { period }),
            reportsService.sales(currentToken, { period, page: 1, limit: 8 }),
            reportsService.products(currentToken, { period }),
            deliveryZonesService.list(currentToken)
          ]);

          if (isActive) {
            setState({
              status: "success",
              store: {
                dashboard: storeDashboard,
                readiness: storeReadiness,
                overview: reportOverview,
                sales: reportSales.items,
                products: reportProducts.items,
                zones: deliveryZones
              },
              admin: null,
              error: null
            });
          }

          return;
        }

        if (isActive) {
          setState({
            status: "error",
            store: null,
            admin: null,
            error: "Este perfil nao tem acesso ao dashboard do desktop."
          });
        }
      } catch (error) {
        if (!isActive) {
          return;
        }

        setState({
          status: "error",
          store: null,
          admin: null,
          error:
            error instanceof ApiError
              ? error.message
              : "Nao foi possivel carregar os indicadores."
        });
      }
    }

    void loadDashboard();

    return () => {
      isActive = false;
    };
  }, [period, reloadKey, token, user]);

  function retry() {
    setReloadKey((current) => current + 1);
  }

  return (
    <section className="page-section premium-dashboard">
      {state.status === "success" && state.store ? (
        <StoreDashboardView
          data={state.store}
          period={period}
          setPeriod={setPeriod}
          storeName={store?.name ?? state.store.dashboard.storeName}
        />
      ) : null}

      {state.status === "success" && state.admin ? (
        <AdminDashboardView dashboard={state.admin} />
      ) : null}

      {state.status === "loading" ? <DashboardLoading isPlatformAdmin={isPlatformAdmin} /> : null}

      {state.status === "error" ? (
        <div className="dashboard-error-wrap">
          <ErrorState message={state.error} onRetry={retry} />
        </div>
      ) : null}
    </section>
  );
}

function isAdminRole(role: string | undefined) {
  return role === "SUPER_ADMIN" || role === "PLATFORM_ADMIN";
}

function DashboardLoading({ isPlatformAdmin }: { isPlatformAdmin: boolean }) {
  return (
    <div className="dashboard-loading-grid">
      <SkeletonCard lines={4} />
      <div className="dashboard-metric-grid">
        {Array.from({ length: isPlatformAdmin ? 4 : 6 }).map((_, index) => (
          <SkeletonCard key={index} lines={3} />
        ))}
      </div>
      <SkeletonCard lines={6} />
    </div>
  );
}

function StoreDashboardView({
  data,
  period,
  setPeriod,
  storeName
}: {
  data: StoreDashboardData;
  period: DashboardPeriod;
  setPeriod: (period: DashboardPeriod) => void;
  storeName: string;
}) {
  const { dashboard, overview, readiness, sales, products, zones } = data;
  const revenueChartData = useMemo(() => buildRevenueChart(sales), [sales]);
  const paymentItems = useMemo(() => buildPaymentItems(overview), [overview]);
  const topProducts = overview?.stock.topSellingProducts.slice(0, 5) ?? [];
  const stockAttention = dashboard.lowStockProducts + dashboard.outOfStockProducts;
  const pendingReadinessItems = readiness?.items
    .filter((item) => !item.completed)
    .sort((first, second) => getCategoryPriority(first.category) - getCategoryPriority(second.category))
    .slice(0, 4);

  return (
    <>
      <div className="dashboard-hero">
        <div className="dashboard-hero-main">
          <span className="section-kicker">Central operacional</span>
          <h1>Ola, {storeName}</h1>
          <p>
            Indicadores reais do periodo, atencao operacional e atalhos para manter a loja pronta para vender.
          </p>
          <div className="dashboard-hero-badges">
            <StatusBadge tone="info">Dados do backend</StatusBadge>
            <StatusBadge tone={stockAttention > 0 ? "warning" : "success"}>
              {stockAttention > 0 ? `${stockAttention} alertas de estoque` : "Estoque sem alertas"}
            </StatusBadge>
            <StatusBadge tone={dashboard.pendingOrders > 0 ? "warning" : "success"}>
              {dashboard.pendingOrders > 0 ? `${dashboard.pendingOrders} pedidos pendentes` : "Sem pendencias"}
            </StatusBadge>
          </div>
        </div>
        <div className="dashboard-hero-actions">
          <PeriodFilter value={period} options={periodOptions} onChange={setPeriod} />
          <Link className="primary-button" to="/reports">
            Abrir relatorios
          </Link>
        </div>
      </div>

      {readiness ? (
        <ReadinessSummary readiness={readiness} pendingItems={pendingReadinessItems ?? []} />
      ) : null}

      <div className="dashboard-metric-grid">
        <MetricCard
          helper={overview?.period.label ?? "Periodo selecionado"}
          icon="R$"
          label="Faturamento"
          numericValue={overview?.sales.soldAmount ?? dashboard.estimatedRevenueToday}
          tone="primary"
          value={formatCurrency(overview?.sales.soldAmount ?? dashboard.estimatedRevenueToday)}
        />
        <MetricCard
          helper="Pedidos e vendas concluidas"
          icon="P"
          label="Movimento"
          tone="success"
          value={overview?.sales.realizedCount ?? dashboard.ordersToday}
        />
        <MetricCard
          helper="Media do periodo"
          icon="T"
          label="Ticket medio"
          numericValue={overview?.sales.averageTicket ?? 0}
          value={formatCurrency(overview?.sales.averageTicket ?? 0)}
        />
        <MetricCard
          helper="Pedidos ainda em operacao"
          icon="E"
          label="Em andamento"
          tone={dashboard.inProgressOrders > 0 ? "warning" : "neutral"}
          value={dashboard.inProgressOrders}
        />
        <MetricCard
          helper="Pagamentos aguardando baixa"
          icon="!"
          label="Pagamentos pendentes"
          tone={dashboard.pendingPayments > 0 ? "warning" : "neutral"}
          value={dashboard.pendingPayments}
        />
        <MetricCard
          helper={`${dashboard.outOfStockProducts} sem estoque`}
          icon="S"
          label="Estoque baixo"
          tone={stockAttention > 0 ? "danger" : "success"}
          value={stockAttention}
        />
      </div>

      <div className="dashboard-analytics-grid">
        <ContentCard className="dashboard-chart-card">
          <SectionHeader
            kicker="Faturamento"
            title="Evolucao no periodo"
            description="Soma de vendas e pedidos reais retornados pelos relatorios gerenciais."
          />
          <AreaChart data={revenueChartData} formatValue={formatCurrency} />
        </ContentCard>

        <ContentCard>
          <SectionHeader
            kicker="Pagamentos"
            title="Composicao por forma"
            description="Somente valores registrados no periodo selecionado."
          />
          <DonutChart
            formatValue={formatCurrency}
            items={paymentItems}
            totalLabel="total"
          />
        </ContentCard>
      </div>

      <div className="dashboard-bottom-grid">
        <ContentCard>
          <SectionHeader
            action={<Link className="secondary-button" to="/orders">Ver pedidos</Link>}
            kicker="Operacao"
            title="Movimentos recentes"
            description="Ultimos pedidos e vendas exibidos pelos relatorios."
          />
          {sales.length > 0 ? (
            <div className="dashboard-list">
              {sales.slice(0, 6).map((sale) => (
                <article className="dashboard-list-row" key={`${sale.origin}-${sale.id}`}>
                  <div>
                    <strong>{sale.friendlyId}</strong>
                    <p>{sale.customerName || (sale.origin === "PDV" ? "Venda de balcao" : "Cliente nao informado")}</p>
                  </div>
                  <div className="dashboard-list-meta">
                    <StatusBadge tone={sale.cancelled ? "danger" : sale.completed ? "success" : "warning"}>
                      {formatSaleStatus(sale)}
                    </StatusBadge>
                    <strong>{formatCurrency(sale.soldAmount)}</strong>
                    <small>{formatDateTime(sale.occurredAt)}</small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nenhuma movimentacao no periodo"
              description="Quando a loja vender pelo delivery ou PDV, os registros aparecem aqui."
            />
          )}
        </ContentCard>

        <ContentCard>
          <SectionHeader
            action={<Link className="secondary-button" to="/products">Ver produtos</Link>}
            kicker="Catalogo"
            title="Produtos em destaque"
            description="Itens com melhor desempenho e situacao de estoque."
          />
          {topProducts.length > 0 ? (
            <div className="product-rank-list">
              {topProducts.map((product, index) => (
                <article className="product-rank-row" key={`${product.productId ?? product.name}-${index}`}>
                  <div className="product-rank-index">{index + 1}</div>
                  <div>
                    <strong>{product.name}</strong>
                    <p>{formatQuantity(product.quantitySold)} vendidos</p>
                  </div>
                  <strong>{formatCurrency(product.soldAmount)}</strong>
                </article>
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="product-rank-list">
              {products.slice(0, 5).map((product, index) => (
                <article className="product-rank-row" key={product.product.id}>
                  <div className="product-rank-index">{index + 1}</div>
                  <div>
                    <strong>{product.product.name}</strong>
                    <p>{formatStockStatus(product.stockStatus)}</p>
                  </div>
                  <strong>{formatCurrency(product.soldAmount)}</strong>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nenhum produto com venda ainda"
              description="Cadastre produtos e acompanhe o desempenho aqui."
            />
          )}
        </ContentCard>

        <ContentCard>
          <SectionHeader
            action={<Link className="secondary-button" to="/delivery-zones">Editar taxas</Link>}
            kicker="Entrega"
            title="Taxas por bairro"
            description="Zonas ativas usadas para sugerir a taxa de entrega."
          />
          {zones.length > 0 ? (
            <div className="zone-summary-list">
              {zones.slice(0, 6).map((zone) => (
                <article className="zone-summary-row" key={zone.id}>
                  <div>
                    <strong>{zone.name}</strong>
                    <p>{zone.district}</p>
                  </div>
                  <div className="zone-summary-meta">
                    <StatusBadge tone={zone.isActive ? "success" : "neutral"}>
                      {zone.isActive ? "Ativa" : "Inativa"}
                    </StatusBadge>
                    <strong>{formatCurrency(zone.fee)}</strong>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nenhuma taxa por bairro"
              description="Crie zonas para reduzir erro manual na confirmacao de pedidos."
              action={<Link className="secondary-button" to="/delivery-zones">Cadastrar taxa</Link>}
            />
          )}
        </ContentCard>
      </div>

      <p className="dashboard-updated-at">Atualizado em {formatDateTime(dashboard.generatedAt)}</p>
    </>
  );
}

function ReadinessSummary({
  readiness,
  pendingItems
}: {
  readiness: StoreReadiness;
  pendingItems: StoreReadiness["items"];
}) {
  return (
    <ContentCard className="readiness-premium-card">
      <div className="readiness-premium-main">
        <div>
          <span className="section-kicker">Configuracao inicial</span>
          <h2>{readiness.ready ? "Operacao pronta para o piloto" : "Finalize a preparacao da loja"}</h2>
          <p className="muted-text">
            {readiness.ready
              ? "Os itens obrigatorios estao concluidos. Revise recomendacoes para melhorar a apresentacao."
              : "Conclua os itens obrigatorios para reduzir atritos no atendimento real."}
          </p>
        </div>
        <div className="readiness-premium-score">
          <strong>{readiness.percentage}%</strong>
          <span>{readiness.completedRequiredItems}/{readiness.totalRequiredItems} obrigatorios</span>
        </div>
      </div>

      <div className="readiness-progress" aria-label={`Progresso obrigatorio ${readiness.percentage}%`}>
        <span style={{ width: `${readiness.percentage}%` }} />
      </div>

      {pendingItems.length > 0 ? (
        <div className="readiness-pending-list">
          {pendingItems.map((item) => (
            <Link className="readiness-pending-item" key={item.key} to={item.route}>
              <span>{item.label}</span>
              <small>{item.actionLabel}</small>
            </Link>
          ))}
        </div>
      ) : (
        <div className="feedback feedback-success">
          Nenhum item obrigatorio pendente para a operacao inicial.
        </div>
      )}
    </ContentCard>
  );
}

function AdminDashboardView({ dashboard }: { dashboard: AdminDashboard }) {
  return (
    <>
      <div className="dashboard-hero dashboard-hero-admin">
        <div className="dashboard-hero-main">
          <span className="section-kicker">Administracao Mototake</span>
          <h1>Visao geral da plataforma</h1>
          <p>Indicadores operacionais para acompanhar empresas, usuarios e pedidos do piloto.</p>
          <div className="dashboard-hero-badges">
            <StatusBadge tone="info">Acesso restrito</StatusBadge>
            <StatusBadge tone={dashboard.suspendedStores > 0 ? "warning" : "success"}>
              {dashboard.suspendedStores} empresas suspensas
            </StatusBadge>
          </div>
        </div>
        <div className="dashboard-hero-actions">
          <Link className="primary-button" to="/admin/stores">Gerenciar empresas</Link>
        </div>
      </div>

      <div className="dashboard-metric-grid">
        <MetricCard icon="E" label="Empresas totais" value={dashboard.totalStores ?? dashboard.activeStores + dashboard.suspendedStores + dashboard.inactiveStores} />
        <MetricCard icon="A" label="Empresas ativas" tone="success" value={dashboard.activeStores} />
        <MetricCard icon="S" label="Empresas suspensas" tone="warning" value={dashboard.suspendedStores} />
        <MetricCard icon="I" label="Empresas encerradas" value={dashboard.inactiveStores} />
        <MetricCard icon="O" label="Lojas online" tone="primary" value={dashboard.onlineStores ?? 0} />
        <MetricCard icon="U" label="Usuarios ativos" value={dashboard.activeUsers} />
        <MetricCard icon="M" label="Motoboys ativos" value={dashboard.activeCouriers} />
        <MetricCard icon="P" label="Pedidos hoje" tone="primary" value={dashboard.ordersToday} />
        <MetricCard icon="7" label="Pedidos 7 dias" value={dashboard.ordersLast7Days ?? 0} />
        <MetricCard icon="30" label="Pedidos 30 dias" value={dashboard.ordersLast30Days ?? 0} />
        <MetricCard icon="!" label="Pagamentos pendentes" tone="warning" value={dashboard.pendingPayments} />
      </div>

      <ContentCard>
        <SectionHeader
          action={<Link className="secondary-button" to="/admin/stores">Ver empresas</Link>}
          kicker="Empresas recentes"
          title="Ultimas empresas cadastradas"
          description="Lista operacional para suporte e acompanhamento do piloto."
        />

        {dashboard.recentStores.length === 0 ? (
          <EmptyState title="Nenhuma empresa cadastrada recentemente" />
        ) : (
          <div className="dashboard-list">
            {dashboard.recentStores.map((recentStore) => (
              <article className="dashboard-list-row" key={recentStore.id}>
                <div>
                  <strong>{recentStore.name}</strong>
                  <p>
                    Dono: {recentStore.owner?.name ?? "Nao informado"} -{" "}
                    {recentStore.owner?.email ?? "sem e-mail"}
                  </p>
                </div>
                <div className="dashboard-list-meta">
                  <StatusBadge tone={getStoreStatusTone(recentStore.status)}>
                    {formatStoreStatus(recentStore.status)}
                  </StatusBadge>
                  <small>{formatDateTime(recentStore.createdAt)}</small>
                </div>
              </article>
            ))}
          </div>
        )}
      </ContentCard>

      <p className="dashboard-updated-at">Atualizado em {formatDateTime(dashboard.generatedAt)}</p>
    </>
  );
}

function buildRevenueChart(sales: ReportSaleRow[]) {
  const grouped = new Map<string, number>();

  sales
    .slice()
    .reverse()
    .forEach((sale) => {
      const label = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(
        new Date(sale.occurredAt)
      );
      grouped.set(label, (grouped.get(label) ?? 0) + sale.soldAmount);
    });

  return Array.from(grouped.entries()).map(([label, value]) => ({ label, value }));
}

function buildPaymentItems(overview: ReportOverview | null) {
  const source = overview?.sales.paidByPaymentMethod.length
    ? overview.sales.paidByPaymentMethod
    : overview?.sales.byPaymentMethod ?? [];

  return source.map((item, index) => ({
    label: formatPaymentMethod(item.method),
    value: item.amount,
    color: paymentColors[index % paymentColors.length]
  }));
}

function getCategoryPriority(category: StoreReadiness["items"][number]["category"]) {
  const priorities = {
    REQUIRED: 0,
    RECOMMENDED: 1,
    OPTIONAL: 2
  };

  return priorities[category];
}

function getStoreStatusTone(status: "ACTIVE" | "SUSPENDED" | "INACTIVE") {
  if (status === "ACTIVE") {
    return "success";
  }

  if (status === "SUSPENDED") {
    return "warning";
  }

  return "neutral";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2
  }).format(value);
}

function formatPaymentMethod(method: string) {
  const labels: Record<string, string> = {
    CASH: "Dinheiro",
    CARD: "Cartao",
    CARD_ON_DELIVERY: "Cartao na entrega",
    PIX_MANUAL: "Pix manual",
    ONLINE: "Pix automatico",
    MIXED: "Misto"
  };

  return labels[method] ?? method;
}

function formatSaleStatus(sale: ReportSaleRow) {
  if (sale.cancelled) {
    return "Cancelado";
  }

  if (sale.completed) {
    return sale.paymentStatus === "PAID" ? "Pago" : "Finalizado";
  }

  return "Em andamento";
}

function formatStockStatus(status: ReportProductRow["stockStatus"]) {
  const labels = {
    NO_CONTROL: "Sem controle de estoque",
    IN_STOCK: "Estoque normal",
    LOW_STOCK: "Estoque baixo",
    OUT_OF_STOCK: "Sem estoque"
  };

  return labels[status];
}

function formatStoreStatus(status: "ACTIVE" | "SUSPENDED" | "INACTIVE") {
  const labels = {
    ACTIVE: "Ativa",
    SUSPENDED: "Suspensa",
    INACTIVE: "Inativa"
  };

  return labels[status];
}
