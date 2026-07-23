import React from "react";
import { Stack, Text } from "@forge/react";
import LoadingIcon from "./LoadingIcon";
import type { OrderStats } from "../../types";

type Props = {
  // null = still loading.
  stats: OrderStats | null;
};

// Purely presentational — all numbers come pre-computed from the
// getOrderStats resolver so this never has to touch full order history.
const HomeStats = ({ stats }: Props) => {
  if (stats === null) {
    return <LoadingIcon />;
  }

  return (
    <Stack grow="fill" space="space.100">
      <Text>Restaurants in your pool: {stats.totalRestaurants}</Text>
      <Text>Orders placed: {stats.totalOrders}</Text>
      <Text>
        Most-picked restaurant:{" "}
        {stats.topRestaurant
          ? `${stats.topRestaurant.restaurantName} (${stats.topRestaurant.count}x)`
          : "—"}
      </Text>
    </Stack>
  );
};

export default HomeStats;
