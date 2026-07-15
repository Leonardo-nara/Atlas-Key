import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { http } from "../../lib/http";

type MobilePlatform = "android" | "ios" | "web";

class NotificationsService {
  configureForegroundPresentation() {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true
      })
    });
  }

  async registerDevice(accessToken: string) {
    const expoToken = await this.getExpoToken();

    if (!expoToken) {
      return null;
    }

    return http("/notifications/devices", {
      method: "POST",
      token: accessToken,
      body: JSON.stringify({
        token: expoToken,
        platform: this.getPlatform(),
        appProfile: "mobile"
      })
    });
  }

  async unregisterAll(accessToken: string) {
    try {
      await http("/notifications/devices", {
        method: "DELETE",
        token: accessToken
      });
    } catch {
      // Logout nao deve falhar por indisponibilidade de push.
    }
  }

  private async getExpoToken() {
    if (!Device.isDevice) {
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Pedidos",
        importance: Notifications.AndroidImportance.DEFAULT
      });
    }

    const currentPermissions = await Notifications.getPermissionsAsync();
    const finalPermissions = currentPermissions.granted
      ? currentPermissions
      : await Notifications.requestPermissionsAsync();

    if (!finalPermissions.granted) {
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  }

  private getPlatform(): MobilePlatform {
    if (Platform.OS === "ios") {
      return "ios";
    }

    if (Platform.OS === "android") {
      return "android";
    }

    return "web";
  }
}

export const notificationsService = new NotificationsService();
