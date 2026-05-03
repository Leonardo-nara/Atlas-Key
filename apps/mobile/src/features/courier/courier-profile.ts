import type { AuthUser, CourierVehicleType } from "../../types/api";

export interface CourierProfileFormValues {
  name: string;
  phone: string;
  city: string;
  vehicleType: CourierVehicleType | "";
  vehicleModel: string;
  plate: string;
  profilePhotoUrl: string;
  vehiclePhotoUrl: string;
}

export const courierVehicleOptions: Array<{
  value: CourierVehicleType;
  label: string;
}> = [
  { value: "MOTO", label: "Moto" },
  { value: "SCOOTER", label: "Scooter" },
  { value: "BICICLETA", label: "Bicicleta" },
  { value: "CARRO", label: "Carro" }
];

export function buildCourierProfileForm(user: AuthUser | null): CourierProfileFormValues {
  return {
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    city: user?.courierProfile?.city ?? "",
    vehicleType: user?.courierProfile?.vehicleType ?? "",
    vehicleModel: user?.courierProfile?.vehicleModel ?? "",
    plate: user?.courierProfile?.plate ?? "",
    profilePhotoUrl: user?.courierProfile?.profilePhotoUrl ?? "",
    vehiclePhotoUrl: user?.courierProfile?.vehiclePhotoUrl ?? ""
  };
}

export function validateCourierProfileForm(values: CourierProfileFormValues) {
  if (!values.name.trim()) {
    return "Informe seu nome completo.";
  }

  if (!values.phone.trim()) {
    return "Informe seu telefone.";
  }

  if (!values.city.trim()) {
    return "Informe a cidade onde você opera.";
  }

  if (!values.vehicleType) {
    return "Selecione o tipo de veículo.";
  }

  if (!values.vehicleModel.trim()) {
    return "Informe o modelo do veículo.";
  }

  if (!values.plate.trim()) {
    return "Informe a placa.";
  }

  return null;
}
