import {
  BadRequestException,
  Injectable,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  OrderEventType,
  OrderPaymentMethod,
  OrderPaymentProvider,
  OrderPaymentStatus,
  PaymentTransactionProvider,
  PaymentTransactionStatus,
  Prisma
} from "@prisma/client";
import { timingSafeEqual } from "node:crypto";

import { PrismaService } from "../prisma/prisma.service";

type HeadersLike = Record<string, string | string[] | undefined>;

interface AsaasConfig {
  apiBaseUrl: string;
  apiKey: string;
  webhookToken: string;
}

interface AsaasPaymentResponse {
  id?: string;
  status?: string;
  value?: number;
  billingType?: string;
  externalReference?: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  confirmedDate?: string;
}

interface AsaasPixQrCodeResponse {
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
}

export interface GatewayOrderInput {
  id: string;
  paymentMethod: OrderPaymentMethod;
  paymentStatus: OrderPaymentStatus;
  total: Prisma.Decimal | number;
  asaasCustomerId?: string;
  payer?: {
    name?: string;
    cpfCnpj?: string;
    email?: string;
    phone?: string;
  };
  description?: string;
  expiresAt?: Date;
}

export interface PaymentGatewayTransactionInput {
  id?: string;
  orderId?: string;
  provider: PaymentTransactionProvider;
  providerPaymentId?: string | null;
  status?: PaymentTransactionStatus;
  amount?: Prisma.Decimal | number;
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
  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly prismaService?: PrismaService
  ) {}

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

    if (provider === PaymentTransactionProvider.ASAAS) {
      return this.createAsaasPixPayment(order);
    }

    return this.createStubPixPayment(order);
  }

  async getPaymentStatus(
    transaction?: PaymentGatewayTransactionInput
  ): Promise<PaymentGatewayStatusResult> {
    this.ensureGatewayEnabled();
    const provider = transaction?.provider ?? this.resolveProvider();

    if (provider === PaymentTransactionProvider.ASAAS) {
      return this.getAsaasPaymentStatus(transaction);
    }

    return {
      status: PaymentTransactionStatus.PENDING,
      rawStatus: "stub_pending",
      metadataJson: { mode: "stub" }
    };
  }

  async handleWebhook(
    payload?: unknown,
    headers: HeadersLike = {}
  ): Promise<PaymentGatewayStatusResult> {
    this.ensureGatewayEnabled();
    const provider = this.resolveProvider();

    if (provider === PaymentTransactionProvider.ASAAS) {
      return this.handleAsaasWebhook(payload, headers);
    }

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

  private createStubPixPayment(order: GatewayOrderInput) {
    const amount = new Prisma.Decimal(order.total);

    return {
      provider: PaymentTransactionProvider.STUB,
      providerPaymentId: `stub-${order.id}`,
      status: PaymentTransactionStatus.PENDING,
      amount,
      currency: "BRL" as const,
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

  private async createAsaasPixPayment(
    order: GatewayOrderInput
  ): Promise<PaymentGatewayCreateResult> {
    const amount = new Prisma.Decimal(order.total);
    const customer = order.asaasCustomerId ?? (await this.createAsaasCustomer(order));
    const dueDate = this.formatAsaasDate(order.expiresAt ?? this.addDays(new Date(), 1));
    const payment = await this.asaasRequest<AsaasPaymentResponse>("/v3/payments", {
      method: "POST",
      body: JSON.stringify({
        customer,
        billingType: "PIX",
        value: amount.toNumber(),
        dueDate,
        description: order.description?.trim() || `Pedido ${order.id} - Rotapronta`,
        externalReference: order.id
      })
    });

    if (!payment.id) {
      throw new ServiceUnavailableException("Asaas nao retornou identificador da cobranca");
    }

    const pixQrCode = await this.asaasRequest<AsaasPixQrCodeResponse>(
      `/v3/payments/${encodeURIComponent(payment.id)}/pixQrCode`
    );

    return {
      provider: PaymentTransactionProvider.ASAAS,
      providerPaymentId: payment.id,
      status: this.mapAsaasStatus(payment.status),
      amount,
      currency: "BRL",
      qrCodeText: pixQrCode.payload,
      qrCodeImageUrl: pixQrCode.encodedImage
        ? `data:image/png;base64,${pixQrCode.encodedImage}`
        : undefined,
      expiresAt: this.parseAsaasDate(pixQrCode.expirationDate) ?? order.expiresAt,
      rawStatus: payment.status ?? "asaas_pending",
      metadataJson: this.buildSafeAsaasMetadata(payment)
    };
  }

  private async getAsaasPaymentStatus(
    transaction?: PaymentGatewayTransactionInput
  ): Promise<PaymentGatewayStatusResult> {
    if (!transaction?.providerPaymentId) {
      throw new BadRequestException("Transacao Asaas sem identificador do provider");
    }

    const payment = await this.getAsaasPayment(transaction.providerPaymentId);

    return {
      status: this.mapAsaasStatus(payment.status),
      paidAt: this.extractAsaasPaidAt(payment),
      rawStatus: payment.status ?? "asaas_unknown",
      metadataJson: this.buildSafeAsaasMetadata(payment)
    };
  }

  private async handleAsaasWebhook(
    payload: unknown,
    headers: HeadersLike
  ): Promise<PaymentGatewayStatusResult> {
    const config = this.getAsaasConfig();
    const token = this.getHeader(headers, "asaas-access-token");

    if (!token || !this.safeCompare(token, config.webhookToken)) {
      throw new UnauthorizedException("Webhook Asaas nao autorizado");
    }

    if (!this.prismaService) {
      throw new ServiceUnavailableException("Prisma indisponivel para webhook Asaas");
    }

    const parsedPayload = this.parseAsaasWebhookPayload(payload);
    const transaction = await this.prismaService.paymentTransaction.findFirst({
      where: {
        provider: PaymentTransactionProvider.ASAAS,
        providerPaymentId: parsedPayload.paymentId
      },
      include: {
        order: true
      }
    });

    if (!transaction) {
      return {
        status: PaymentTransactionStatus.PENDING,
        rawStatus: "asaas_unknown_payment",
        metadataJson: {
          provider: "asaas",
          processed: false,
          reason: "providerPaymentId desconhecido"
        }
      };
    }

    const currentMetadata = this.asMetadataRecord(transaction.metadataJson);
    const processedWebhookIds = this.getProcessedWebhookIds(currentMetadata);

    if (parsedPayload.webhookId && processedWebhookIds.includes(parsedPayload.webhookId)) {
      return {
        status: transaction.status,
        paidAt: transaction.paidAt ?? undefined,
        rawStatus: transaction.rawStatus ?? "asaas_duplicate_webhook",
        metadataJson: {
          ...currentMetadata,
          duplicateWebhookId: parsedPayload.webhookId
        }
      };
    }

    const payment = await this.getAsaasPayment(parsedPayload.paymentId);
    const providerStatus = this.mapAsaasStatus(payment.status);
    const paidAt = this.extractAsaasPaidAt(payment);
    const validationFailure = this.validateAsaasPayment(transaction, payment);
    const nextMetadata: Prisma.InputJsonValue = {
      ...this.buildSafeAsaasMetadata(payment),
      webhookEvent: parsedPayload.event,
      processedWebhookIds: parsedPayload.webhookId
        ? [...processedWebhookIds, parsedPayload.webhookId].slice(-20)
        : processedWebhookIds,
      validation: validationFailure ?? "ok"
    };

    if (validationFailure) {
      await this.prismaService.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          rawStatus: payment.status ?? "asaas_validation_failed",
          metadataJson: nextMetadata
        }
      });

      return {
        status: transaction.status,
        paidAt: transaction.paidAt ?? undefined,
        rawStatus: payment.status ?? "asaas_validation_failed",
        metadataJson: nextMetadata
      };
    }

    await this.prismaService.$transaction(async (prisma) => {
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: providerStatus,
          paidAt: providerStatus === PaymentTransactionStatus.PAID ? paidAt ?? new Date() : null,
          rawStatus: payment.status ?? "asaas_unknown",
          metadataJson: nextMetadata
        }
      });

      if (
        providerStatus === PaymentTransactionStatus.PAID &&
        transaction.order.paymentStatus !== OrderPaymentStatus.PAID
      ) {
        await prisma.order.update({
          where: { id: transaction.orderId },
          data: {
            paymentStatus: OrderPaymentStatus.PAID,
            paymentProvider: OrderPaymentProvider.FUTURE_GATEWAY,
            paidAt: paidAt ?? new Date()
          }
        });

        await prisma.orderEvent.create({
          data: {
            orderId: transaction.orderId,
            type: OrderEventType.PAYMENT_PAID,
            actorUserId: null,
            actorRole: null,
            metadata: {
              source: "asaas_webhook",
              providerPaymentId: transaction.providerPaymentId
            }
          }
        });
      }
    });

    return {
      status: providerStatus,
      paidAt: providerStatus === PaymentTransactionStatus.PAID ? paidAt ?? new Date() : undefined,
      rawStatus: payment.status ?? "asaas_unknown",
      metadataJson: nextMetadata
    };
  }

  private async createAsaasCustomer(order: GatewayOrderInput) {
    const payerName = order.payer?.name?.trim();
    const payerDocument = order.payer?.cpfCnpj?.trim();

    if (!payerName || !payerDocument) {
      throw new BadRequestException(
        "Cliente Asaas obrigatorio para gerar Pix automatico em sandbox"
      );
    }

    const customer = await this.asaasRequest<{ id?: string }>("/v3/customers", {
      method: "POST",
      body: JSON.stringify({
        name: payerName,
        cpfCnpj: payerDocument,
        email: order.payer?.email?.trim() || undefined,
        mobilePhone: order.payer?.phone?.trim() || undefined,
        externalReference: `rotapronta-order-${order.id}`
      })
    });

    if (!customer.id) {
      throw new ServiceUnavailableException("Asaas nao retornou identificador do cliente");
    }

    return customer.id;
  }

  private async getAsaasPayment(providerPaymentId: string) {
    return this.asaasRequest<AsaasPaymentResponse>(
      `/v3/payments/${encodeURIComponent(providerPaymentId)}`
    );
  }

  private async asaasRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const config = this.getAsaasConfig();
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        access_token: config.apiKey,
        ...init.headers
      }
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Asaas retornou erro ${response.status} ao processar pagamento`
      );
    }

    return (await response.json()) as T;
  }

  private ensureGatewayEnabled() {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException("Gateway de pagamento desativado");
    }
  }

  private resolveProvider() {
    const provider = this.getConfiguredProvider().toLowerCase();

    if (provider === "stub") {
      return PaymentTransactionProvider.STUB;
    }

    if (provider === "asaas") {
      return PaymentTransactionProvider.ASAAS;
    }

    throw new ServiceUnavailableException(
      "Provider de pagamento automatico nao configurado"
    );
  }

  private getAsaasConfig(): AsaasConfig {
    const env = this.configService.get<string>("ASAAS_ENV")?.trim().toLowerCase() || "sandbox";

    if (env !== "sandbox") {
      throw new ServiceUnavailableException(
        "Provider Asaas esta habilitado apenas em sandbox nesta fase"
      );
    }

    const apiBaseUrl = this.configService.get<string>("ASAAS_API_BASE_URL")?.trim();
    const apiKey = this.configService.get<string>("ASAAS_API_KEY")?.trim();
    const webhookToken = this.configService.get<string>("ASAAS_WEBHOOK_TOKEN")?.trim();

    if (!apiBaseUrl) {
      throw new ServiceUnavailableException("ASAAS_API_BASE_URL nao configurada");
    }

    if (!apiKey) {
      throw new ServiceUnavailableException("ASAAS_API_KEY nao configurada");
    }

    if (!webhookToken) {
      throw new ServiceUnavailableException("ASAAS_WEBHOOK_TOKEN nao configurado");
    }

    return {
      apiBaseUrl: apiBaseUrl.replace(/\/+$/, ""),
      apiKey,
      webhookToken
    };
  }

  private parseAsaasWebhookPayload(payload: unknown) {
    if (!payload || typeof payload !== "object") {
      throw new BadRequestException("Payload Asaas invalido");
    }

    const record = payload as Record<string, unknown>;
    const payment = record.payment as Record<string, unknown> | undefined;
    const paymentId = typeof payment?.id === "string" ? payment.id : undefined;

    if (!paymentId) {
      throw new BadRequestException("Payload Asaas sem cobranca");
    }

    return {
      webhookId: typeof record.id === "string" ? record.id : undefined,
      event: typeof record.event === "string" ? record.event : undefined,
      paymentId
    };
  }

  private validateAsaasPayment(
    transaction: {
      orderId: string;
      amount: Prisma.Decimal;
    },
    payment: AsaasPaymentResponse
  ) {
    if (payment.externalReference && payment.externalReference !== transaction.orderId) {
      return "external_reference_divergente";
    }

    if (
      typeof payment.value === "number" &&
      this.toCents(payment.value) !== this.toCents(transaction.amount)
    ) {
      return "valor_divergente";
    }

    return undefined;
  }

  private mapAsaasStatus(status?: string) {
    switch (status) {
      case "RECEIVED":
      case "CONFIRMED":
      case "RECEIVED_IN_CASH":
        return PaymentTransactionStatus.PAID;
      case "CANCELLED":
      case "DELETED":
        return PaymentTransactionStatus.CANCELLED;
      case "OVERDUE":
        return PaymentTransactionStatus.EXPIRED;
      case "REFUNDED":
      case "REFUND_REQUESTED":
      case "REFUND_IN_PROGRESS":
        return PaymentTransactionStatus.REFUNDED;
      case "CHARGEBACK_REQUESTED":
      case "CHARGEBACK_DISPUTE":
      case "AWAITING_CHARGEBACK_REVERSAL":
        return PaymentTransactionStatus.FAILED;
      default:
        return PaymentTransactionStatus.PENDING;
    }
  }

  private buildSafeAsaasMetadata(
    payment: AsaasPaymentResponse
  ): Record<string, Prisma.JsonValue> {
    return {
      provider: "asaas",
      status: payment.status ?? null,
      billingType: payment.billingType ?? null,
      externalReference: payment.externalReference ?? null,
      value: typeof payment.value === "number" ? payment.value : null
    };
  }

  private extractAsaasPaidAt(payment: AsaasPaymentResponse) {
    const dateValue = payment.paymentDate ?? payment.clientPaymentDate ?? payment.confirmedDate;
    return this.parseAsaasDate(dateValue);
  }

  private parseAsaasDate(dateValue?: string) {
    if (!dateValue) {
      return undefined;
    }

    const parsed = new Date(dateValue);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private formatAsaasDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private addDays(date: Date, days: number) {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
  }

  private toCents(value: Prisma.Decimal | number) {
    return new Prisma.Decimal(value).mul(100).toDecimalPlaces(0).toNumber();
  }

  private getHeader(headers: HeadersLike, name: string) {
    const lowerName = name.toLowerCase();
    const foundKey = Object.keys(headers).find((key) => key.toLowerCase() === lowerName);
    const value = foundKey ? headers[foundKey] : undefined;
    return Array.isArray(value) ? value[0] : value;
  }

  private safeCompare(received: string, expected: string) {
    const receivedBuffer = Buffer.from(received);
    const expectedBuffer = Buffer.from(expected);
    return (
      receivedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(receivedBuffer, expectedBuffer)
    );
  }

  private asMetadataRecord(metadata: Prisma.JsonValue | null) {
    return metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, Prisma.JsonValue>)
      : {};
  }

  private getProcessedWebhookIds(metadata: Record<string, Prisma.JsonValue>) {
    const value = metadata.processedWebhookIds;
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  }
}
