import React, { useCallback, useEffect, useRef, useState } from "react";
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
import OutingsSection from "./components/OutingsSection";
import EventsCalendar, { localDateKey } from "./components/EventsCalendar";
import CreateOutingModal from "./components/CreateOutingModal";
import EventDetailModal from "./components/EventDetailModal";
import EditEventModal from "./components/EditEventModal";
import { SECTION_MIN_WIDTH } from "./layout";
import type {
  AbandonEventResult,
  AddRestaurantResult,
  CreateTeamResult,
  CurrentSubmission,
  CurrentSubmissionResult,
  EventDetail,
  EventOrder,
  EventSummary,
  OrderStats,
  PlacedOrder,
  Restaurant,
  Team,
} from "../types";

type Message = {
  appearance: "success" | "information" | "error";
  text: string;
};

// Tab content is capped well short of the full viewport and left-justified
// (via the wrapping Stack's alignInline="start") rather than stretching
// edge-to-edge. minWidth keeps the table-bearing tabs from ever going
// narrower than the tables themselves need.
const tabPanelContentStyle = xcss({
  paddingTop: "space.200",
  width: "88%",
  minWidth: SECTION_MIN_WIDTH,
});
// Teams has no table and far less content — half the standard tab width.
const teamsPanelContentStyle = xcss({
  paddingTop: "space.200",
  width: "44%",
  minWidth: "380px",
});
const messageSlot = xcss({ height: "2.25rem" });

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

// Mirrors validation/orderSchemas.ts MAX_TOTAL.
const MAX_TOTAL = 100000;

// "" = omitted; anything unparseable, negative, or over MAX_TOTAL is rejected.
const parseTotal = (text: string): number | undefined | "invalid" => {
  if (text.trim() === "") {
    return undefined;
  }
  const value = Number(text);
  return Number.isNaN(value) || value < 0 || value > MAX_TOTAL
    ? "invalid"
    : value;
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

// Today as a local YYYY-MM-DD (for the outing date picker + today's-outings
// bounds).
const todayLocalDate = (): string => {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
};

// The Create Outing modal's default date+time: today + the next half-hour
// slot from HALF_HOUR_TIMES (11:15 -> 11:30, 11:30 stays 11:30). Past 23:30
// there's no slot left today, so it rolls the date to tomorrow at 00:00.
const nextAvailableSlot = (): { date: string; time: string } => {
  const now = new Date();
  const totalMinutes = now.getHours() * 60 + now.getMinutes();
  const roundedUp = Math.ceil(totalMinutes / 30) * 30;
  const rollsToTomorrow = roundedUp >= 24 * 60;
  const wrapped = roundedUp % (24 * 60);
  const hour = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const minute = String(wrapped % 60).padStart(2, "0");
  const time = `${hour}:${minute}`;
  if (!rollsToTomorrow) {
    return { date: todayLocalDate(), time };
  }
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  const m = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const d = String(tomorrow.getDate()).padStart(2, "0");
  return { date: `${tomorrow.getFullYear()}-${m}-${d}`, time };
};

// A picked local date ("YYYY-MM-DD") + time ("HH:mm", trailing seconds/zone
// tolerated) → a UTC instant string for the backend.
const localDateTimeToUtc = (date: string, time: string): string => {
  const [y, mo, d] = date.split("-").map(Number);
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  const h = match ? Number(match[1]) : 0;
  const mi = match ? Number(match[2]) : 0;
  return toMysqlUtc(new Date(y, mo - 1, d, h, mi, 0, 0));
};

const App = () => {
  // null = pool still loading; undefined = submission still loading.
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [submission, setSubmission] = useState<
    CurrentSubmission | null | undefined
  >(undefined);
  const [selected, setSelected] = useState<SelectionTarget | null>(null);
  const [prefill, setPrefill] = useState<OrderPrefill | null>(null);
  // True while the solo spin-the-wheel Frame is showing (pool of 2+ only).
  const [wheelOpen, setWheelOpen] = useState(false);
  // Why the wheel was last opened. The wheel emits its winner to one shared
  // channel; this tells the (once-subscribed) handler where to route it. A ref,
  // not state, because the handler captures its value at subscribe-time — state
  // would go stale and misroute a create-panel spin to the solo flow.
  const wheelPurposeRef = useRef<"solo" | "create-event">("solo");
  // A wheel result routed to the create panel (null until a spin lands there).
  const [createEventWheelWinner, setCreateEventWheelWinner] =
    useState<SelectionTarget | null>(null);
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
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(timer);
  }, [message]);
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
  // Today's outings visible to the caller. null = still loading. Named
  // `outings` (not `events`) to avoid colliding with the bridge Events API.
  const [outings, setOutings] = useState<EventSummary[] | null>(null);
  const [createOutingOpen, setCreateOutingOpen] = useState(false);
  // Calendar tab: the displayed month (viewer-local), that month's visible
  // events (null = loading), and the day whose strip shows under the grid.
  const [calMonth, setCalMonth] = useState<{ year: number; month: number }>(
    () => {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() + 1 };
    },
  );
  const [calEvents, setCalEvents] = useState<EventSummary[] | null>(null);
  const [calSelectedDate, setCalSelectedDate] = useState<string | null>(() =>
    todayLocalDate(),
  );
  // Create-modal date override — set when "Be a Lunch Boss" is pressed from
  // a Calendar day strip so the modal defaults to that day; null = Home's
  // usual next-available-slot default.
  const [outingDefaultDate, setOutingDefaultDate] = useState<string | null>(
    null,
  );
  // The card the user clicked (null = detail page closed) and its full detail
  // from getEvent (null = still loading). The summary seeds the instant paint.
  const [openedEvent, setOpenedEvent] = useState<EventSummary | null>(null);
  const [eventDetail, setEventDetail] = useState<EventDetail | null>(null);
  // The boss's Edit Details modal (over the open event).
  const [editEventOpen, setEditEventOpen] = useState(false);
  // The caller's own accountId (view context) — tells the detail page
  // whether the caller is the event's Lunch Boss. null until loaded.
  const [myAccountId, setMyAccountId] = useState<string | null>(null);
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

  const refreshOutings = useCallback(async () => {
    try {
      const today = todayLocalDate();
      setOutings(
        unwrap(
          await invoke<EventSummary[]>("getTodaysEvents", {
            from: localDayStartUtc(today),
            to: localDayEndUtc(today),
          }),
        ),
      );
    } catch (error) {
      setMessage({ appearance: "error", text: describeError(error) });
      setOutings([]);
    }
  }, []);

  // The Calendar month is just a wider window through the same resolver the
  // Home strip uses — [first local day of month, first local day of next
  // month), so visibility rules match exactly.
  const refreshCalendar = useCallback(async () => {
    try {
      const first = `${calMonth.year}-${String(calMonth.month).padStart(2, "0")}-01`;
      const next =
        calMonth.month === 12
          ? { year: calMonth.year + 1, month: 1 }
          : { year: calMonth.year, month: calMonth.month + 1 };
      const nextFirst = `${next.year}-${String(next.month).padStart(2, "0")}-01`;
      setCalEvents(
        unwrap(
          await invoke<EventSummary[]>("getTodaysEvents", {
            from: localDayStartUtc(first),
            to: localDayStartUtc(nextFirst),
          }),
        ),
      );
    } catch (error) {
      setMessage({ appearance: "error", text: describeError(error) });
      setCalEvents([]);
    }
  }, [calMonth]);

  // Own effect so month navigation refetches without re-running the boot
  // fetches above.
  useEffect(() => {
    refreshCalendar();
  }, [refreshCalendar]);

  useEffect(() => {
    refresh();
    refreshSubmission();
    refreshStats();
    refreshTeams();
    refreshOutings();
    view.getContext().then((context) => {
      setEnvironmentType(context.environmentType);
      setMyAccountId(context.accountId ?? null);
    });
    // Cosmetic — on failure just omit the greeting, no error banner.
    requestConfluence("/wiki/rest/api/user/current")
      .then((response) => response.json())
      .then((user: { displayName?: string }) =>
        setDisplayName(user.displayName ?? null),
      )
      .catch(() => setDisplayName(null));
  }, [refresh, refreshSubmission, refreshStats, refreshTeams, refreshOutings]);

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

  // --- Outings ---
  const handleStartOuting = () => {
    setMessage(null);
    setOutingDefaultDate(null);
    setCreateOutingOpen(true);
  };

  // Calendar-strip variant: the create modal defaults to the selected day.
  const handleStartOutingForDate = (date: string) => {
    setMessage(null);
    setOutingDefaultDate(date);
    setCreateOutingOpen(true);
  };

  const handleCalPrevMonth = () => {
    setCalSelectedDate(null);
    setCalEvents(null);
    setCalMonth((prev) =>
      prev.month === 1
        ? { year: prev.year - 1, month: 12 }
        : { year: prev.year, month: prev.month - 1 },
    );
  };

  const handleCalNextMonth = () => {
    setCalSelectedDate(null);
    setCalEvents(null);
    setCalMonth((prev) =>
      prev.month === 12
        ? { year: prev.year + 1, month: 1 }
        : { year: prev.year, month: prev.month + 1 },
    );
  };

  // Tag the next wheel result for the create panel before its Frame mounts, so
  // the shared result handler routes the winner into the form (not solo).
  const handleOpenCreateWheel = () => {
    wheelPurposeRef.current = "create-event";
  };

  // Open the Event-detail page: paint from the card's summary immediately,
  // then fill contact fields + orders when getEvent lands. On failure (e.g.
  // the event was deleted, or visibility changed) close and refresh the strip.
  const handleOpenEvent = (event: EventSummary) => {
    setMessage(null);
    setOpenedEvent(event);
    setEventDetail(null);
    invoke<EventDetail>("getEvent", { eventId: event.id })
      .then((result) => setEventDetail(unwrap(result)))
      .catch((error) => {
        setMessage({ appearance: "error", text: describeError(error) });
        setOpenedEvent(null);
        refreshOutings();
        refreshCalendar();
      });
  };

  const handleCloseEvent = () => {
    setOpenedEvent(null);
    setEventDetail(null);
  };

  // Re-fetch the open event after a write so the detail view (form state,
  // orders table) reflects it.
  const refreshEventDetail = async (eventId: number) => {
    setEventDetail(unwrap(await invoke<EventDetail>("getEvent", { eventId })));
  };

  const handleSubmitEventOrder = (
    itemsText: string,
    totalText: string,
    notesText: string,
    addToPool: boolean,
  ) => {
    if (!openedEvent) {
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
      await invoke<EventOrder>("submitEventOrder", {
        eventId: openedEvent.id,
        ...(itemsText.trim() !== "" ? { items: itemsText } : {}),
        ...(total !== undefined ? { total } : {}),
        ...(notesText.trim() !== "" ? { notes: notesText } : {}),
        ...(addToPool ? { addToPool: true } : {}),
      });
      setMessage({ appearance: "success", text: "Order submitted." });
      await refreshEventDetail(openedEvent.id);
      // The submit may have added to the pool (opt-in) or resurrected a
      // deleted restaurant server-side; the order also counts toward strip
      // visibility.
      if (addToPool) {
        await refresh();
      }
      await refreshOutings();
      await refreshCalendar();
    });
  };

  const handleSaveEventOrder = (
    itemsText: string,
    totalText: string,
    notesText: string,
  ): Promise<boolean> => {
    if (!openedEvent) {
      return Promise.resolve(false);
    }
    const total = parseTotal(totalText);
    if (total === "invalid") {
      setMessage({
        appearance: "error",
        text: "Total must be a non-negative number.",
      });
      return Promise.resolve(false);
    }
    return runAction(async () => {
      await invoke("updateEventOrder", {
        eventId: openedEvent.id,
        ...(itemsText.trim() !== "" ? { items: itemsText } : {}),
        ...(total !== undefined ? { total } : {}),
        ...(notesText.trim() !== "" ? { notes: notesText } : {}),
      });
      setMessage({ appearance: "success", text: "Order updated." });
      await refreshEventDetail(openedEvent.id);
    });
  };

  const handleCancelEventOrder = () => {
    if (!openedEvent) {
      return;
    }
    return runAction(async () => {
      await invoke("cancelEventOrder", { eventId: openedEvent.id });
      setMessage({ appearance: "information", text: "Order canceled." });
      await refreshEventDetail(openedEvent.id);
      // Losing the order can change strip/calendar visibility.
      await refreshOutings();
      await refreshCalendar();
    });
  };

  // Claim works from a card or the open detail page. A card claim also
  // bubbles into the card's open-press (no stopPropagation in UI Kit), so
  // the page opens alongside — refresh the detail unconditionally so the
  // freshly claimed state always wins over the bubble's earlier getEvent.
  const handleClaimEvent = (event: EventSummary) =>
    runAction(async () => {
      await invoke("claimEvent", { eventId: event.id });
      setMessage({
        appearance: "success",
        text: "You are now the Lunch Boss.",
      });
      await refreshOutings();
      await refreshCalendar();
      await refreshEventDetail(event.id);
    });

  const handleAbandonEvent = (deleteMyOrder: boolean) => {
    if (!openedEvent) {
      return;
    }
    return runAction(async () => {
      const result = unwrap(
        await invoke<AbandonEventResult>("abandonEvent", {
          eventId: openedEvent.id,
          ...(deleteMyOrder ? { deleteMyOrder: true } : {}),
        }),
      );
      // Close the page on both outcomes — an ex-boss lingering on a stale
      // view could otherwise press Abandon again.
      setOpenedEvent(null);
      setEventDetail(null);
      setMessage({
        appearance: "information",
        text:
          result.outcome === "deleted"
            ? "Event deleted."
            : "Bossdom abandoned.",
      });
      await refreshOutings();
      await refreshCalendar();
    });
  };

  const handleUpdateEvent = (date: string, time: string, teamIds: number[]) => {
    if (!openedEvent) {
      return;
    }
    const current = eventDetail ?? openedEvent;
    const scheduledAt = localDateTimeToUtc(date, time);
    return runAction(async () => {
      await invoke("updateEvent", {
        eventId: openedEvent.id,
        // An unchanged time is a teams-only edit — the service rejects a
        // scheduledAt that isn't strictly later, so omit it.
        ...(scheduledAt !== current.scheduledAt ? { scheduledAt } : {}),
        teamIds,
      });
      setEditEventOpen(false);
      setMessage({ appearance: "success", text: "Event updated." });
      await refreshEventDetail(openedEvent.id);
      await refreshOutings();
      await refreshCalendar();
    });
  };

  const handlePlaceEventOrders = () => {
    if (!openedEvent) {
      return;
    }
    return runAction(async () => {
      await invoke("placeEventOrders", { eventId: openedEvent.id });
      setMessage({ appearance: "success", text: "Orders placed." });
      // The re-fetch flips the button to "Orders Placed" and shows the
      // preserved table; losing the race surfaces the service error instead,
      // and the same re-fetch in the next open shows who won.
      await refreshEventDetail(openedEvent.id);
      // The caller's own history gained a row, and the event's calendar
      // line grays out now that placed_at is set.
      await refreshOrders();
      await refreshStats();
      await refreshCalendar();
    });
  };

  const handleCreateOuting = (
    restaurantId: number,
    date: string,
    time: string,
    teamIds: number[],
  ) =>
    runAction(async () => {
      await invoke<EventSummary>("createEvent", {
        restaurantId,
        scheduledAt: localDateTimeToUtc(date, time),
        teamIds,
      });
      setCreateOutingOpen(false);
      setOutingDefaultDate(null);
      setMessage({ appearance: "success", text: "Event Created." });
      await refreshOutings();
      await refreshCalendar();
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
  // Events API — the documented Frame↔host communication channel. One shared
  // channel serves both the solo flow and the create panel; wheelPurposeRef
  // (read live, hence a ref) decides where each result goes.
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;
    events
      .on("lunch-boss.wheel-result", (payload?: SelectionTarget) => {
        const winner =
          payload &&
          typeof payload.id === "number" &&
          typeof payload.name === "string"
            ? { id: payload.id, name: payload.name }
            : null;
        if (wheelPurposeRef.current === "create-event") {
          // Route into the create panel; its own state closes the wheel view.
          if (winner) {
            setCreateEventWheelWinner(winner);
          }
        } else {
          if (winner) {
            startSelection(winner);
          }
          setWheelOpen(false);
        }
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
    wheelPurposeRef.current = "solo";
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
        text: `Total must be a non-negative number under $${MAX_TOTAL.toLocaleString()}.`,
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
        text: `Total must be a non-negative number under $${MAX_TOTAL.toLocaleString()}.`,
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
  const outingDefaultSlot = nextAvailableSlot();
  // Calendar strip: the selected day's events, filtered client-side from the
  // month already in hand (no second fetch), plus day-aware copy.
  const todayDate = todayLocalDate();
  const calDayEvents =
    calEvents === null || calSelectedDate === null
      ? null
      : calEvents.filter(
          (event) => localDateKey(event.scheduledAt) === calSelectedDate,
        );
  const calSelectedIsPast =
    calSelectedDate !== null && calSelectedDate < todayDate;
  const calStripTitle =
    calSelectedDate === null || calSelectedDate === todayDate
      ? "Today's Events"
      : `Events for ${(() => {
          const [y, m, d] = calSelectedDate.split("-").map(Number);
          return new Date(y, m - 1, d).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          });
        })()}`;

  return (
    <Stack grow="fill" space="space.150">
      <Stack space="space.050">
        <Inline grow="fill" spread="space-between" alignBlock="center">
          <Heading as="h1">Lunch Boss</Heading>
          {environmentType !== null && environmentType !== "PRODUCTION" && (
            <Button isDisabled={busy} onClick={handleRunMigrations}>
              Run migrations (dev)
            </Button>
          )}
        </Inline>

        {displayName && <Text>Ordering as {displayName}</Text>}

        <Box xcss={messageSlot}>
          {message && (
            <SectionMessage appearance={message.appearance}>
              <Text>{message.text}</Text>
            </SectionMessage>
          )}
        </Box>
      </Stack>

      <Stack space="space.100">
        <Tabs
          id="lunch-boss-tabs"
          selected={activeTab}
          onChange={(index) => setActiveTab(index)}
        >
          <TabList>
            <Tab>Home</Tab>
            <Tab>Restaurants</Tab>
            <Tab>Teams</Tab>
            <Tab>Calendar</Tab>
            <Tab>History</Tab>
          </TabList>

          <TabPanel>
            <Stack alignInline="start" grow="fill">
              <Box xcss={tabPanelContentStyle}>
                <Stack grow="fill" space="space.300">
                  <Stack grow="fill" space="space.150">
                    <Heading as="h2">Current Order</Heading>
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

                  <OutingsSection
                    title="Today's Events"
                    events={outings}
                    teams={allTeams}
                    busy={busy}
                    onStartOuting={handleStartOuting}
                    onOpenEvent={handleOpenEvent}
                    onClaimEvent={handleClaimEvent}
                  />
                </Stack>
              </Box>
            </Stack>
          </TabPanel>

          <TabPanel>
            <Stack alignInline="start" grow="fill">
              <Box xcss={tabPanelContentStyle}>
                <Stack grow="fill" space="space.300">
                  <Stack grow="fill" space="space.150">
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
            </Stack>
          </TabPanel>

          <TabPanel>
            <Stack alignInline="start" grow="fill">
              <Box xcss={teamsPanelContentStyle}>
                <TeamsPanel
                  myTeams={myTeams}
                  allTeams={allTeams}
                  busy={busy}
                  onCreateOrJoinByName={handleCreateOrJoinByName}
                  onJoin={handleJoinTeam}
                  onLeave={handleLeaveTeam}
                />
              </Box>
            </Stack>
          </TabPanel>

          <TabPanel>
            <Stack alignInline="start" grow="fill">
              <Box xcss={tabPanelContentStyle}>
                <Stack grow="fill" space="space.300">
                  {calSelectedDate !== null && (
                    <OutingsSection
                      title={calStripTitle}
                      events={calDayEvents}
                      teams={allTeams}
                      busy={busy}
                      createDisabled={calSelectedIsPast}
                      reserveSpace
                      emptyText={
                        calSelectedIsPast
                          ? "No events were held on this day."
                          : "No events on this day yet — be a Lunch Boss!"
                      }
                      onStartOuting={() =>
                        handleStartOutingForDate(calSelectedDate)
                      }
                      onOpenEvent={handleOpenEvent}
                      onClaimEvent={handleClaimEvent}
                    />
                  )}
                  <EventsCalendar
                    year={calMonth.year}
                    month={calMonth.month}
                    events={calEvents}
                    selectedDate={calSelectedDate}
                    todayDate={todayDate}
                    onSelectDay={setCalSelectedDate}
                    onPrevMonth={handleCalPrevMonth}
                    onNextMonth={handleCalNextMonth}
                  />
                </Stack>
              </Box>
            </Stack>
          </TabPanel>

          <TabPanel>
            <Stack alignInline="start" grow="fill">
              <Box xcss={tabPanelContentStyle}>
                <Stack grow="fill" space="space.150">
                  <Heading as="h2">Order History</Heading>
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
            </Stack>
          </TabPanel>
        </Tabs>
      </Stack>

      {/* Modals live OUTSIDE the Tabs: inactive TabPanels don't render, and
          the event modals must open from Home and Calendar alike. */}
      <EventDetailModal
        summary={openedEvent}
        detail={eventDetail}
        teams={allTeams}
        inPool={
          openedEvent !== null &&
          (restaurants ?? []).some(
            (restaurant) => restaurant.id === openedEvent.restaurantId,
          )
        }
        busy={busy}
        onClose={handleCloseEvent}
        onSubmitOrder={handleSubmitEventOrder}
        onSaveOrder={handleSaveEventOrder}
        onCancelOrder={handleCancelEventOrder}
        onPlaceOrders={handlePlaceEventOrders}
        myAccountId={myAccountId}
        onAbandon={handleAbandonEvent}
        onClaim={() => {
          if (openedEvent) {
            handleClaimEvent(openedEvent);
          }
        }}
        onOpenEdit={() => setEditEventOpen(true)}
      />

      <EditEventModal
        isOpen={editEventOpen}
        event={eventDetail ?? openedEvent}
        teams={myTeams}
        busy={busy}
        todayDate={todayDate}
        onSave={handleUpdateEvent}
        onCancel={() => setEditEventOpen(false)}
      />

      <CreateOutingModal
        isOpen={createOutingOpen}
        restaurants={restaurants}
        teams={myTeams}
        busy={busy}
        todayDate={todayDate}
        defaultDate={outingDefaultDate ?? outingDefaultSlot.date}
        earliestTimeToday={outingDefaultSlot.time}
        wheelWinner={createEventWheelWinner}
        onOpenWheel={handleOpenCreateWheel}
        onCreate={handleCreateOuting}
        onCancel={() => {
          setCreateOutingOpen(false);
          setOutingDefaultDate(null);
        }}
      />
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
