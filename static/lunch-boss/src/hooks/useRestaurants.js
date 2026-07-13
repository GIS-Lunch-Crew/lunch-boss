import { useCallback, useEffect, useState } from "react";
import { invoke } from "@forge/bridge";

// Owns the restaurant list's lifecycle: loads it from the backend on mount,
// and keeps it in sync with Forge KVS through optimistic writes that roll
// back on failure.
export const useRestaurants = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    invoke("getRestaurants")
      .then((result) => {
        if (!cancelled) {
          setRestaurants(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Couldn't load your saved restaurants.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (nextList, previousList) => {
    setError(null);
    setRestaurants(nextList);

    try {
      const sanitized = await invoke("saveRestaurants", {
        restaurants: nextList,
      });
      setRestaurants(sanitized);
    } catch {
      setRestaurants(previousList);
      setError("Couldn't save that change — try again.");
    }
  }, []);

  const addRestaurant = useCallback(
    (name) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return;
      }

      const isDuplicate = restaurants.some(
        (existing) => existing.toLowerCase() === trimmed.toLowerCase(),
      );
      if (isDuplicate) {
        setError(`"${trimmed}" is already on the menu.`);
        return;
      }

      persist([...restaurants, trimmed], restaurants);
    },
    [restaurants, persist],
  );

  const removeRestaurant = useCallback(
    (name) => {
      persist(
        restaurants.filter((existing) => existing !== name),
        restaurants,
      );
    },
    [restaurants, persist],
  );

  return { restaurants, isLoading, error, addRestaurant, removeRestaurant };
};
