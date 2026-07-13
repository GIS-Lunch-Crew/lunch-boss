import React, { useCallback, useEffect, useState } from "react";
import ForgeReconciler, {
  Button,
  Heading,
  Inline,
  SectionMessage,
  Stack,
  Text,
} from "@forge/react";
import { invoke, view } from "@forge/bridge";
import { describeError, unwrap } from "./lib/invoke";
import CurrentOrder from "./components/CurrentOrder";
import RestaurantForm from "./components/RestaurantForm";
import type { RestaurantFields } from "./components/RestaurantForm";
import RestaurantTable from "./components/RestaurantTable";
import type {
  AddRestaurantResult,
  CurrentSubmission,
  CurrentSubmissionResult,
  Restaurant,
} from "../types";

type Message = {
  appearance: "success" | "information" | "error";
  text: string;
};

// User-facing text for each addRestaurant outcome (CONTEXT.md §3.10).
const OUTCOME_MESSAGES: Record<AddRestaurantResult["outcome"], Message> = {
  created: {
    appearance: "success",
    text: "Restaurant created and added to your pool.",
  },
  "linked-existing": {
    appearance: "information",
    text: "Restaurant added to your pool.",
  },
  resurrected: {
    appearance: "information",
    text: "Restaurant added to your pool.",
  },
};

// "" = omitted; anything unparseable or negative is rejected.
const parseTotal = (text: string): number | undefined | "invalid" => {
  if (text.trim() === "") {
    return undefined;
  }
  const value = Number(text);
  return Number.isNaN(value) || value < 0 ? "invalid" : value;
};

const App = () => {
  // null = pool still loading; undefined = submission still loading.
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [submission, setSubmission] = useState<
    CurrentSubmission | null | undefined
  >(undefined);
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [editing, setEditing] = useState<Restaurant | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const [environmentType, setEnvironmentType] = useState<string | null>(null);
  // Bumped after a successful add so the (uncontrolled) form fields clear.
  const [formVersion, setFormVersion] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setRestaurants(unwrap(await invoke<Restaurant[]>("getSavedRestaurants")));
    } catch (error) {
      setMessage({ appearance: "error", text: describeError(error) });
      setRestaurants([]);
    }
  }, []);

  const refreshSubmission = useCallback(async () => {
    try {
      const result = unwrap(
        await invoke<CurrentSubmissionResult>("getCurrentSubmission"),
      );
      setSubmission(result?.submission ?? null);
    } catch (error) {
      setMessage({ appearance: "error", text: describeError(error) });
      setSubmission(null);
    }
  }, []);

  useEffect(() => {
    refresh();
    refreshSubmission();
    view
      .getContext()
      .then((context) => setEnvironmentType(context.environmentType));
  }, [refresh, refreshSubmission]);

  // Wraps a mutation handler with the shared busy/message bookkeeping.
  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage({ appearance: "error", text: describeError(error) });
    } finally {
      setBusy(false);
    }
  };

  // --- Restaurant pool ---

  const handleRestaurantSubmit = (fields: RestaurantFields) =>
    runAction(async () => {
      if (editing) {
        await invoke("updateRestaurant", {
          restaurantId: editing.id,
          ...fields,
        });
        setMessage({ appearance: "success", text: "Restaurant updated." });
        setEditing(null);
      } else {
        const result = unwrap(
          await invoke<AddRestaurantResult>("addRestaurant", fields),
        );
        setMessage(OUTCOME_MESSAGES[result.outcome]);
        setFormVersion((version) => version + 1);
      }
      await refresh();
    });

  const handleRemove = (restaurantId: number) =>
    runAction(async () => {
      await invoke("removeSavedRestaurant", { restaurantId });
      if (editing?.id === restaurantId) {
        setEditing(null);
      }
      if (selected?.id === restaurantId) {
        setSelected(null);
      }
      await refresh();
    });

  // --- Order lifecycle (CONTEXT.md §3.12) ---

  const startSelection = (restaurant: Restaurant) => {
    setMessage(null);
    setSelected(restaurant);
  };

  const pickRandom = () => {
    const pool = restaurants ?? [];
    if (pool.length === 0) {
      return;
    }
    startSelection(pool[Math.floor(Math.random() * pool.length)]);
  };

  const handleSubmitOrder = (
    itemsText: string,
    totalText: string,
    notesText: string,
  ) => {
    if (!selected) {
      return;
    }
    const total = parseTotal(totalText);
    if (total === "invalid") {
      setMessage({
        appearance: "error",
        text: "Total must be a non-negative number.",
      });
      return;
    }
    return runAction(async () => {
      const created = unwrap(
        await invoke<CurrentSubmission>("submitOrder", {
          restaurantId: selected.id,
          ...(itemsText.trim() !== "" ? { items: itemsText } : {}),
          ...(total !== undefined ? { total } : {}),
          ...(notesText.trim() !== "" ? { notes: notesText } : {}),
        }),
      );
      setSubmission(created);
      setSelected(null);
      setMessage({ appearance: "success", text: "Order submitted." });
    });
  };

  const handleSaveSubmission = (
    itemsText: string,
    totalText: string,
    notesText: string,
  ) => {
    const total = parseTotal(totalText);
    if (total === "invalid") {
      setMessage({
        appearance: "error",
        text: "Total must be a non-negative number.",
      });
      return;
    }
    return runAction(async () => {
      await invoke("updateSubmission", {
        ...(itemsText.trim() !== "" ? { items: itemsText } : {}),
        ...(total !== undefined ? { total } : {}),
        ...(notesText.trim() !== "" ? { notes: notesText } : {}),
      });
      await refreshSubmission();
      setMessage({ appearance: "success", text: "Order updated." });
    });
  };

  const handleClearSubmission = () =>
    runAction(async () => {
      await invoke("clearSubmission");
      setSubmission(null);
      setMessage({ appearance: "information", text: "Order cleared." });
    });

  const handlePlaceOrder = () =>
    runAction(async () => {
      await invoke("placeOrder");
      setSubmission(null);
      setMessage({ appearance: "success", text: "Order placed." });
    });

  // Dev-only; hidden in production and guarded resolver-side too.
  const handleRunMigrations = () =>
    runAction(async () => {
      const applied = unwrap(await invoke<string[]>("runMigrations"));
      setMessage({
        appearance: "success",
        text:
          applied.length > 0
            ? `Migrations applied: ${applied.join(", ")}`
            : "Migrations already up to date.",
      });
      await refresh();
      await refreshSubmission();
    });

  // Remount keys: components hold their field state locally and re-read
  // initial values only on mount, so the key encodes the lifecycle stage.
  const orderKey =
    submission === undefined
      ? "loading"
      : submission
        ? `sub-${submission.restaurantId}-${submission.items ?? ""}-${submission.total ?? ""}-${submission.notes ?? ""}`
        : selected
          ? `sel-${selected.id}`
          : "none";
  const restaurantFormKey = editing ? `edit-${editing.id}` : `add-${formVersion}`;

  return (
    <Stack space="space.300">
      <Inline spread="space-between" alignBlock="center">
        <Heading as="h1">Lunch Boss</Heading>
        {environmentType !== null && environmentType !== "PRODUCTION" && (
          <Button isDisabled={busy} onClick={handleRunMigrations}>
            Run migrations (dev)
          </Button>
        )}
      </Inline>

      {message && (
        <SectionMessage appearance={message.appearance}>
          <Text>{message.text}</Text>
        </SectionMessage>
      )}

      <CurrentOrder
        key={orderKey}
        submission={submission}
        selected={selected}
        busy={busy}
        poolEmpty={(restaurants ?? []).length === 0}
        onPickRandom={pickRandom}
        onCancelSelection={() => setSelected(null)}
        onSubmitOrder={handleSubmitOrder}
        onSaveSubmission={handleSaveSubmission}
        onClearSubmission={handleClearSubmission}
        onPlaceOrder={handlePlaceOrder}
      />

      <RestaurantForm
        key={restaurantFormKey}
        editing={editing}
        busy={busy}
        onSubmit={handleRestaurantSubmit}
        onCancel={() => setEditing(null)}
      />

      <RestaurantTable
        restaurants={restaurants}
        busy={busy}
        selectionDisabled={submission != null}
        onSelect={startSelection}
        onEdit={(restaurant) => {
          setMessage(null);
          setEditing(restaurant);
        }}
        onRemove={handleRemove}
      />
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
