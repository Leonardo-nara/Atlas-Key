import { Body, Controller, Headers, HttpCode, Post } from "@nestjs/common";

import { PaymentGatewayService } from "../orders/payment-gateway.service";

@Controller("webhooks/payments")
export class PaymentWebhooksController {
  constructor(private readonly paymentGatewayService: PaymentGatewayService) {}

  @Post("asaas")
  @HttpCode(200)
  handleAsaasWebhook(
    @Body() payload: unknown,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    return this.paymentGatewayService.handleWebhook(payload, headers, {
      providerHint: "asaas"
    });
  }
}
