import { http } from "../../lib/http";
import type { PickedImageFile } from "../../lib/image-picker";
import type { AuthResponse, AuthUser, CourierVehicleType } from "../../types/api";

export interface RegisterCourierInput {
  name: string;
  email: string;
  password: string;
  phone: string;
}

export interface UpdateCourierProfileInput {
  name: string;
  phone: string;
  city: string;
  vehicleType?: CourierVehicleType | "";
  vehicleModel: string;
  plate: string;
  profilePhotoUrl: string;
  vehiclePhotoUrl: string;
}

export const courierService = {
  register(input: RegisterCourierInput) {
    return http<AuthResponse>("/auth/register/courier", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  me(token: string) {
    return http<AuthUser>("/couriers/me", {
      token
    });
  },
  updateMe(token: string, input: UpdateCourierProfileInput) {
    return http<AuthUser>("/couriers/me", {
      method: "PATCH",
      token,
      body: JSON.stringify({
        name: input.name,
        phone: input.phone,
        city: input.city,
        vehicleType: input.vehicleType || undefined,
        vehicleModel: input.vehicleModel,
        plate: input.plate,
        profilePhotoUrl: input.profilePhotoUrl || undefined,
        vehiclePhotoUrl: input.vehiclePhotoUrl || undefined
      })
    });
  },
  uploadProfileImage(token: string, file: PickedImageFile) {
    const formData = new FormData();
    formData.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.type
    } as unknown as Blob);

    return http<AuthUser>("/couriers/me/profile-image", {
      method: "PATCH",
      token,
      body: formData
    });
  },
  removeProfileImage(token: string) {
    return http<AuthUser>("/couriers/me/profile-image", {
      method: "DELETE",
      token
    });
  }
};
