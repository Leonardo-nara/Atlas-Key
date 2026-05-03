import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import { mobileTheme } from "../theme";

export function useTabContentBottomPadding(extra = mobileTheme.spacing.xl) {
  const tabBarHeight = useBottomTabBarHeight();

  return tabBarHeight + extra;
}
