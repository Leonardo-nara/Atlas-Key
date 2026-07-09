import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  OrderPaymentMethod,
  OrderPaymentStatus,
  PaymentTransactionProvider,
  PaymentTransactionStatus,
  Prisma
} from "@prisma/client";

export interface GatewayOrderInput {
  id: string;
  paymentMethod: OrderPaymentMethod;
  paymentStatus: OrderPaymentStatus;
  total: Prisma.Decimal | number;
}

export interface PaymentGatewayCreateResult {
  provider: PaymentTransactionProvider;
  providerPaymentId: string;
  status: PaymentTransactionStatus;
  amount: Prisma.Decimal;
  currency: "BRL";
  qrCodeText?: string;
  qrCodeImageUrl?: string;
  expiresAt?: Date;
  rawStatus?: string;
  metadataJson?: Prisma.InputJsonValue;
}

export interface PaymentGatewayStatusResult {
  status: PaymentTransactionStatus;
  paidAt?: Date;
  rawStatus?: string;
  metadataJson?: Prisma.InputJsonValue;
}

@Injectable()
export class PaymentGatewayService {
  constructor(private readonly configService: ConfigService) {}

  isEnabled() {
    return this.configService.get<string>("PAYMENT_GATEWAY_ENABLED") === "true";
  }

  getConfiguredProvider() {
    return this.configService.get<string>("PAYMENT_GATEWAY_PROVIDER")?.trim() ?? "";
  }

  async createPixPayment(order: GatewayOrderInput): Promise<PaymentGatewayCreateResult> {
    this.ensureGatewayEnabled();

    if (order.paymentMethod !== OrderPaymentMethod.ONLINE) {
      throw new BadRequestException(
        "Pagamento automatico so pode ser preparado para metodo ONLINE"
      );
    }

    if (order.paymentStatus !== OrderPaymentStatus.PENDING) {
      throw new BadRequestException("Pedido precisa estar com pagamento pendente");
    }

    const provider = this.resolveProvider();
    const amount = new Prisma.Decimal(order.total);

    return {
      provider,
      providerPaymentId: `stub-${order.id}`,
      status: PaymentTransactionStatus.PENDING,
      amount,
      currency: "BRL",
      qrCodeText: undefined,
      qrCodeImageUrl: undefined,
      expiresAt: undefined,
      rawStatus: "stub_pending",
      metadataJson: {
        mode: "stub",
        orderId: order.id,
        gatewayEnabled: true
      }
    };
  }

  async getPaymentStatus(): Promise<PaymentGatewayStatusResult> {
    this.ensureGatewayEnabled();

    return {
      status: PaymentTransactionStatus.PENDING,
      rawStatus: "stub_pending",
      metadataJson: { mode: "stub" }
    };
  }

  async handleWebhook(): Promise<PaymentGatewayStatusResult> {
    this.ensureGatewayEnabled();

    return {
      status: PaymentTransactionStatus.PENDING,
      rawStatus: "stub_ignored",
      metadataJson: {
        mode: "stub",
        accepted: false,
        reason: "webhook sem provider real configurado"
      }
    };
  }

  private ensureGatewayEnabled() {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException("Gateway de pagamento desativado");
    }
  }

  private resolveProvider() {
    const provider = this.getConfiguredProvider().toLowerCase();

    if (provider !== "stub") {
      throw new ServiceUnavailableException(
        "Provider de pagamento automatico nao configurado"
      );
    }

    return PaymentTransactionProvider.STUB;
  }
}
