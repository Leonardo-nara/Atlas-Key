import { IsEnum } from "class-validator";

export enum CourierOrderStatusInput {
  ACCEPTED = "accepted",
  PICKED_UP = "picked_up",
  DELIVERED = "delivered"
}

export class UpdateCourierOrderStatusDto {
  @IsEnum(CourierOrderStatusInput)
  status!: CourierOrderStatusInput;
}
