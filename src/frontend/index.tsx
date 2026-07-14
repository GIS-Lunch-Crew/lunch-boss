import React, { useCallback, useEffect, useState } from "react";
import ForgeReconciler, {
  Button,
  Heading,
  Inline,
  SectionMessage,
  Stack,
  Text,
} from "@forge/react";
import { invoke, requestConfluence, view } from "@forge/bridge";
import { describeError, unwrap } from "./lib/invoke";
import CurrentOrder from "./components/CurrentOrder";
import type {
  OrderPrefill,
  SelectionTarget,
} from "./components/CurrentOrder";
import OrderHistory from "./components/OrderHistory";
import RestaurantForm from "./components/RestaurantForm";
import type { RestaurantFields } from "./components/RestaurantForm";
import RestaurantTable from "./components/RestaurantTable";
import type {
  AddRestaurantResult,
  CurrentSubmission,
  CurrentSubmissionResult,
  PlacedOrder,
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
  const [selected, setSelected] = useState<SelectionTarget | null>(null);
  const [prefill, setPrefill] = useState<OrderPrefill | null>(null);
  // Bumped on every startSelection so CurrentOrder remounts (and its fields
  // reset/prefill) even when the same restaurant is selected again.
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [editing, setEditing] = useState<Restaurant | null>(null);
  const [orders, setOrders] = useState<PlacedOrder[] | null>(null);
  const [orderFilter, setOrderFilter] = useState<{
    from?: string;
    to?: string;
  }>({});
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const [environmentType, setEnvironmentType] = useState<string | null>(null);
  // Session-only greeting; fetched per page load, never persisted (§3.2).
  const [displayName, setDisplayName] = useState<string | null>(null);
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
    // Cosmetic — on failure just omit the greeting, no error banner.
    requestConfluence("/wiki/rest/api/user/current")
      .then((response) => response.json())
      .then((user: { displayName?: string }) =>
        setDisplayName(user.displayName ?? null),
      )
      .catch(() => setDisplayName(null));
  }, [refresh, refreshSubmission]);

  const refreshOrders = useCallback(async () => {
    try {
      setOrders(
        unwrap(await invoke<PlacedOrder[]>("getOrders", { ...orderFilter })),
      );
    } catch (error) {
      setMessage({ appearance: "error", text: describeError(error) });
      setOrders([]);
    }
  }, [orderFilter]);

  // Separate effect so pool/submission don't refetch on filter changes.
  useEffect(() => {
    refreshOrders();
  }, [refreshOrders]);

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

  const startSelection = (
    target: SelectionTarget,
    withPrefill?: OrderPrefill,
  ) => {
    setMessage(null);
    setSelected(target);
    // No prefill (plain select / random pick) clears any staged re-order.
    setPrefill(withPrefill ?? null);
    setSelectionVersion((version) => version + 1);
  };

  const cancelSelection = () => {
    setSelected(null);
    setPrefill(null);
  };

  const pickRandom = () => {
    const pool = restaurants ?? [];
    if (pool.length === 0) {
      return;
    }
    startSelection(pool[Math.floor(Math.random() * pool.length)]);
  };

  const handleReorder = (order: PlacedOrder) =>
    startSelection(
      { id: order.restaurantId, name: order.restaurantName },
      { items: order.items, total: order.total, notes: order.notes },
    );

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
      setPrefill(null);
      setMessage({ appearance: "success", text: "Order submitted." });
      // The submit may have resurrected a deleted restaurant or linked one
      // into the pool server-side — refetch so the table reflects it.
      await refresh();
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
      await refreshOrders();
    });

  const handleDelete = (restaurantId: number) =>
    runAction(async () => {
      await invoke("deleteRestaurant", { restaurantId });
      setEditing(null);
      if (selected?.id === restaurantId) {
        setSelected(null);
      }
      setMessage({ appearance: "information", text: "Restaurant deleted." });
      await refresh();
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
          ? `sel-${selected.id}-v${selectionVersion}`
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

      {displayName && <Text>Ordering as {displayName}</Text>}

      {message && (
        <SectionMessage appearance={message.appearance}>
          <Text>{message.text}</Text>
        </SectionMessage>
      )}

      <CurrentOrder
        key={orderKey}
        submission={submission}
        selected={selected}
        prefill={prefill}
        busy={busy}
        poolEmpty={(restaurants ?? []).length === 0}
        onPickRandom={pickRandom}
        onCancelSelection={cancelSelection}
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
        onDelete={handleDelete}
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

      <OrderHistory
        key={`history-${orderFilter.from ?? ""}-${orderFilter.to ?? ""}`}
        orders={orders}
        from={orderFilter.from}
        to={orderFilter.to}
        busy={busy}
        reorderDisabled={submission != null}
        onFilterChange={(from, to) => setOrderFilter({ from, to })}
        onReorder={handleReorder}
      />
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
