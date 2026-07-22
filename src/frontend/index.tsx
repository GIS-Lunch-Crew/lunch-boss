import React, { useCallback, useEffect, useState } from "react";
import ForgeReconciler, {
  Box,
  Button,
  Heading,
  Inline,
  SectionMessage,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  xcss,
} from "@forge/react";
import { events, invoke, requestConfluence, view } from "@forge/bridge";
import { describeError, unwrap } from "./lib/invoke";
import CurrentOrder from "./components/CurrentOrder";
import type { OrderPrefill, SelectionTarget } from "./components/CurrentOrder";
import HomeStats from "./components/HomeStats";
import OrderHistory from "./components/OrderHistory";
import RestaurantFormModal from "./components/RestaurantFormModal";
import type { RestaurantFields } from "./components/RestaurantForm";
import RestaurantTable from "./components/RestaurantTable";
import TeamsPanel from "./components/TeamsPanel";
import type {
  AddRestaurantResult,
  CreateTeamResult,
  CurrentSubmission,
  CurrentSubmissionResult,
  OrderStats,
  PlacedOrder,
  Restaurant,
  Team,
} from "../types";

type Message = {
  appearance: "success" | "information" | "error";
  text: string;
};

const tabPanelTopSpacing = xcss({ paddingTop: "space.200" });

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

// Order-history date filters. The picker deals in local calendar dates, but
// ordered_at is a UTC instant, so we convert each picked local day into UTC
// instant bounds and query the half-open range [from, to). This makes "today"
// mean the viewer's local day regardless of the database clock.
const toMysqlUtc = (date: Date): string =>
  date.toISOString().slice(0, 19).replace("T", " ");
const localDayStartUtc = (isoDate: string): string => {
  const [y, m, d] = isoDate.split("-").map(Number);
  return toMysqlUtc(new Date(y, m - 1, d));
};
const localDayEndUtc = (isoDate: string): string => {
  const [y, m, d] = isoDate.split("-").map(Number);
  return toMysqlUtc(new Date(y, m - 1, d + 1));
};

const App = () => {
  // null = pool still loading; undefined = submission still loading.
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [submission, setSubmission] = useState<
    CurrentSubmission | null | undefined
  >(undefined);
  const [selected, setSelected] = useState<SelectionTarget | null>(null);
  const [prefill, setPrefill] = useState<OrderPrefill | null>(null);
  // True while the spin-the-wheel Frame is showing (pool of 2+ only).
  const [wheelOpen, setWheelOpen] = useState(false);
  // Bumped on every startSelection so CurrentOrder remounts (and its fields
  // reset/prefill) even when the same restaurant is selected again.
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [editing, setEditing] = useState<Restaurant | null>(null);
  // Add/Edit Restaurant modal open-state, separate from `editing` since the
  // modal can be open in either add-mode (no `editing`) or edit-mode.
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [orders, setOrders] = useState<PlacedOrder[] | null>(null);
  const [orderFilter, setOrderFilter] = useState<{
    from?: string;
    to?: string;
  }>({});
  // null = still loading. Fetched via a dedicated resolver (not derived from
  // `orders`) so a History-tab date filter never silently skews the counts.
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const [environmentType, setEnvironmentType] = useState<string | null>(null);
  // Session-only greeting; fetched per page load, never persisted (§3.2).
  const [displayName, setDisplayName] = useState<string | null>(null);
  // Bumped after a successful add so the (uncontrolled) form fields clear.
  const [formVersion, setFormVersion] = useState(0);
  // Teams: myTeams = the caller's memberships; allTeams = every site team
  // (powers the join dropdown). null = still loading.
  const [myTeams, setMyTeams] = useState<Team[] | null>(null);
  const [allTeams, setAllTeams] = useState<Team[] | null>(null);
  // Not persisted; always resets to Home on load.
  const [activeTab, setActiveTab] = useState(0);

  // --- Data fetching ---
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

  const refreshStats = useCallback(async () => {
    try {
      setStats(unwrap(await invoke<OrderStats>("getOrderStats")));
    } catch (error) {
      setMessage({ appearance: "error", text: describeError(error) });
    }
  }, []);

  const refreshTeams = useCallback(async () => {
    try {
      const [mine, all] = await Promise.all([
        invoke<Team[]>("getMyTeams"),
        invoke<Team[]>("getTeams"),
      ]);
      setMyTeams(unwrap(mine));
      setAllTeams(unwrap(all));
    } catch (error) {
      setMessage({ appearance: "error", text: describeError(error) });
      setMyTeams([]);
      setAllTeams([]);
    }
  }, []);

  useEffect(() => {
    refresh();
    refreshSubmission();
    refreshStats();
    refreshTeams();
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
  }, [refresh, refreshSubmission, refreshStats, refreshTeams]);

  const refreshOrders = useCallback(async () => {
    try {
      const params: { from?: string; to?: string } = {};
      if (orderFilter.from) params.from = localDayStartUtc(orderFilter.from);
      if (orderFilter.to) params.to = localDayEndUtc(orderFilter.to);
      setOrders(unwrap(await invoke<PlacedOrder[]>("getOrders", params)));
    } catch (error) {
      setMessage({ appearance: "error", text: describeError(error) });
      setOrders([]);
    }
  }, [orderFilter]);

  // Separate effect so pool/submission don't refetch on filter changes.
  useEffect(() => {
    refreshOrders();
  }, [refreshOrders]);

  // --- Shared action wrapper ---
  // Wraps a mutation handler with the shared busy/message bookkeeping.
  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      return true;
    } catch (error) {
      setMessage({ appearance: "error", text: describeError(error) });
      return false;
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

  // --- Teams ---
  // createTeam is create-or-join on the normalized name (like addRestaurant):
  // a new name creates, an existing one joins. Outcome drives the message.
  const handleCreateOrJoinByName = (name: string) =>
    runAction(async () => {
      const result = unwrap(
        await invoke<CreateTeamResult>("createTeam", { name }),
      );
      setMessage({
        appearance: "success",
        text: result.outcome === "created" ? "Team created." : "Joined team.",
      });
      await refreshTeams();
    });

  const handleJoinTeam = (teamId: number) =>
    runAction(async () => {
      await invoke("joinTeam", { teamId });
      setMessage({ appearance: "success", text: "Joined team." });
      await refreshTeams();
    });

  const handleLeaveTeam = (teamId: number) =>
    runAction(async () => {
      await invoke("leaveTeam", { teamId });
      setMessage({ appearance: "information", text: "Left team." });
      await refreshTeams();
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
    // Current Order (where the selecting stage renders) lives on Home —
    // jump there regardless of which tab triggered the selection (Restaurants'
    // "Select" row action or History's "Re-order").
    setActiveTab(0);
  };

  // The wheel (Custom UI inside a Frame) reports its winner through the
  // Events API — the documented Frame↔host communication channel.
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;
    events
      .on("lunch-boss.wheel-result", (payload?: SelectionTarget) => {
        if (
          payload &&
          typeof payload.id === "number" &&
          typeof payload.name === "string"
        ) {
          startSelection({ id: payload.id, name: payload.name });
        }
        setWheelOpen(false);
      })
      .then((sub) => {
        subscription = sub;
      });
    return () => subscription?.unsubscribe();
    // startSelection only calls stable setters, so subscribing once is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelSelection = () => {
    setSelected(null);
    setPrefill(null);
  };

  const pickRandom = () => {
    const pool = restaurants ?? [];
    if (pool.length === 0) {
      return;
    }
    // A one-wedge wheel is silly — instant pick for a pool of one.
    if (pool.length === 1) {
      startSelection(pool[0]);
      return;
    }
    setMessage(null);
    setWheelOpen(true);
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
      return Promise.resolve(false);
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
      await refreshStats();
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

  // --- Render ---
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
  const restaurantFormKey = editing
    ? `edit-${editing.id}`
    : `add-${formVersion}`;
  const restaurantModalOpen = addModalOpen || editing !== null;
  const closeRestaurantModal = () => {
    setEditing(null);
    setAddModalOpen(false);
  };

  return (
    <Stack grow="fill" space="space.300">
      <Inline grow="fill" spread="space-between" alignBlock="center">
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

      <Tabs
        id="lunch-boss-tabs"
        selected={activeTab}
        onChange={(index) => setActiveTab(index)}
      >
        <TabList>
          <Tab>Home</Tab>
          <Tab>Restaurants</Tab>
          <Tab>Teams</Tab>
          <Tab>History</Tab>
        </TabList>

        <TabPanel>
          <Box xcss={tabPanelTopSpacing}>
            <Stack grow="fill" space="space.300">
              <Stack grow="fill" space="space.150">
                <Heading as="h2">Current order</Heading>
                <CurrentOrder
                  key={orderKey}
                  submission={submission}
                  selected={selected}
                  prefill={prefill}
                  busy={busy}
                  poolEmpty={(restaurants ?? []).length === 0}
                  wheelOpen={wheelOpen}
                  onCancelWheel={() => setWheelOpen(false)}
                  onPickRandom={pickRandom}
                  onCancelSelection={cancelSelection}
                  onSubmitOrder={handleSubmitOrder}
                  onSaveSubmission={handleSaveSubmission}
                  onClearSubmission={handleClearSubmission}
                  onPlaceOrder={handlePlaceOrder}
                />
              </Stack>

              <Stack grow="fill" space="space.150">
                <Heading as="h2">Stats</Heading>
                <HomeStats stats={stats} />
              </Stack>
            </Stack>
          </Box>
        </TabPanel>

        <TabPanel>
          <Box xcss={tabPanelTopSpacing}>
            <Stack grow="fill" space="space.300">
              <Stack grow="fill" space="space.150">
                <Heading as="h2">My restaurant pool</Heading>
                <RestaurantTable
                  restaurants={restaurants}
                  busy={busy}
                  selectionDisabled={submission != null}
                  selectedRestaurantId={
                    selected?.id ?? submission?.restaurantId ?? null
                  }
                  onSelect={startSelection}
                  onEdit={(restaurant) => {
                    setMessage(null);
                    setEditing(restaurant);
                  }}
                  onRemove={handleRemove}
                />
                <Inline>
                  <Button
                    appearance="primary"
                    isDisabled={busy}
                    onClick={() => setAddModalOpen(true)}
                  >
                    Add restaurant
                  </Button>
                </Inline>
              </Stack>

              <RestaurantFormModal
                key={restaurantFormKey}
                isOpen={restaurantModalOpen}
                editing={editing}
                busy={busy}
                onSubmit={handleRestaurantSubmit}
                onCancel={closeRestaurantModal}
                onDelete={handleDelete}
              />
            </Stack>
          </Box>
        </TabPanel>

        <TabPanel>
          <Box xcss={tabPanelTopSpacing}>
            <TeamsPanel
              myTeams={myTeams}
              allTeams={allTeams}
              busy={busy}
              onCreateOrJoinByName={handleCreateOrJoinByName}
              onJoin={handleJoinTeam}
              onLeave={handleLeaveTeam}
            />
          </Box>
        </TabPanel>

        <TabPanel>
          <Box xcss={tabPanelTopSpacing}>
            <Stack grow="fill" space="space.150">
              <Heading as="h2">Order history</Heading>
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
          </Box>
        </TabPanel>
      </Tabs>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
