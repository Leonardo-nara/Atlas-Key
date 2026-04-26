import type { Order } from "../../types/api";

export type OrderTimelineAudience = "client" | "store" | "courier";

export interface OrderTimelineStep {
  key: string;
  title: string;
  description: string;
  state: "done" | "active" | "upcoming" | "cancelled";
}

export function normalizeOrderStatus(order: Order) {
  return (order.statusLabel ?? order.status).toLowerCase();
}

export function getFulfillmentText(order: Order) {
  return order.fulfillmentType === "PICKUP" ? "Retirada na loja" : "Entrega";
}

export function getOrderStatusText(order: Order, audience: OrderTimelineAudience) {
  const status = normalizeOrderStatus(order);

  if (status === "awaiting_store_confirmation") {
    return audience === "store"
      ? "Aguardando confirmacao"
      : "Aguardando confirmacao da loja";
  }

  if (status === "confirmed" || status === "pending") {
    return audience === "courier" ? "Disponivel" : "Confirmado pela loja";
  }

  if (status === "accepted") {
    return audience === "store" ? "Com motoboy" : "Motoboy aceitou";
  }

  if (status === "picked_up") {
    return order.fulfillmentType === "PICKUP"
      ? "Retirado para entrega"
      : "Saiu para entrega";
  }

  if (status === "delivered") {
    return "Entregue";
  }

  if (status === "cancelled") {
    return "Cancelado";
  }

  return "Em acompanhamento";
}

export function getOrderTimeline(
  order: Order,
  audience: OrderTimelineAudience
): OrderTimelineStep[] {
  const status = normalizeOrderStatus(order);
  const cancelled = status === "cancelled";
  const currentRank = getStatusRank(status);
  const steps = buildTimelineSteps(order, audience);

  return steps.map((step) => {
    if (cancelled && step.key === "cancelled") {
      return { ...step, state: "cancelled" as const };
    }

    if (cancelled) {
      return { ...step, state: step.rank <= 1 ? "done" : "upcoming" };
    }

    if (step.rank < currentRank) {
      return { ...step, state: "done" as const };
    }

    if (step.rank === currentRank) {
      return { ...step, state: "active" as const };
    }

    return { ...step, state: "upcoming" as const };
  });
}

function getStatusRank(status: string) {
  if (status === "awaiting_store_confirmation") {
    return 1;
  }

  if (status === "confirmed" || status === "pending") {
    return 2;
  }

  if (status === "accepted") {
    return 3;
  }

  if (status === "picked_up") {
    return 4;
  }

  if (status === "delivered") {
    return 5;
  }

  if (status === "cancelled") {
    return 6;
  }

  return 1;
}

function buildTimelineSteps(order: Order, audience: OrderTimelineAudience) {
  const isPickup = order.fulfillmentType === "PICKUP";

  if (audience === "courier") {
    return [
      {
        key: "available",
        rank: 2,
        title: "Disponivel",
        description: "Pedido liberado pela loja para motoboys aprovados."
      },
      {
        key: "accepted",
        rank: 3,
        title: "Aceito",
        description: "Voce assumiu esta entrega."
      },
      {
        key: "picked_up",
        rank: 4,
        title: isPickup ? "Coletado" : "Saiu para entrega",
        description: "Pedido retirado na loja e em deslocamento."
      },
      {
        key: "delivered",
        rank: 5,
        title: "Entregue",
        description: "Entrega finalizada."
      },
      {
        key: "cancelled",
        rank: 6,
        title: "Cancelado",
        description: "Pedido cancelado pela loja."
      }
    ];
  }

  if (audience === "store") {
    return [
      {
        key: "created",
        rank: 1,
        title: "Pedido recebido",
        description: "O cliente enviou o pedido para a loja."
      },
      {
        key: "confirmed",
        rank: 2,
        title: "Confirmado",
        description: isPickup
          ? "Pedido confirmado para retirada na loja."
          : "Pedido confirmado com taxa de entrega."
      },
      {
        key: "accepted",
        rank: 3,
        title: "Com motoboy",
        description: "Um motoboy aprovado aceitou a entrega."
      },
      {
        key: "picked_up",
        rank: 4,
        title: isPickup ? "Retirado" : "Em entrega",
        description: "Pedido saiu da loja para finalizacao."
      },
      {
        key: "delivered",
        rank: 5,
        title: "Entregue",
        description: "Pedido concluido."
      },
      {
        key: "cancelled",
        rank: 6,
        title: "Cancelado",
        description: "Pedido cancelado com registro no historico."
      }
    ];
  }

  return [
    {
      key: "created",
      rank: 1,
      title: "Pedido enviado para a loja",
      description: "Recebemos seu pedido e avisamos a empresa."
    },
    {
      key: "confirmed",
      rank: 2,
      title: "Confirmado pela loja",
      description: isPickup
        ? "A loja confirmou a retirada."
        : "A loja confirmou o pedido e a taxa de entrega."
    },
    {
      key: "accepted",
      rank: 3,
      title: "Motoboy aceitou",
      description: "Um motoboy aprovado assumiu a entrega."
    },
    {
      key: "picked_up",
      rank: 4,
      title: isPickup ? "Retirado" : "Saiu para entrega",
      description: "Pedido em deslocamento para finalizacao."
    },
    {
      key: "delivered",
      rank: 5,
      title: "Entregue",
      description: "Pedido finalizado."
    },
    {
      key: "cancelled",
      rank: 6,
      title: "Cancelado",
      description: "Pedido cancelado pela loja."
    }
  ];
}
