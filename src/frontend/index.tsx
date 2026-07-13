import React, { useCallback, useEffect, useState } from "react";
import ForgeReconciler, {
  Button,
  DynamicTable,
  Heading,
  Inline,
  Label,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  Textfield,
} from "@forge/react";
import { invoke, view } from "@forge/bridge";
import type { AddRestaurantResult, Restaurant } from "../types";

// invoke() may return the value directly or wrapped as { body, metadata };
// none of our resolver return types have a `body` field, so this check is a
// safe way to unwrap either form.
const unwrap = <T,>(value: T | { body: T }): T =>
  typeof value === "object" && value !== null && "body" in value
    ? (value as { body: T }).body
    : (value as T);

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : "Something went wrong";

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
    text: "Restaurant is now in your pool.",
  },
  resurrected: {
    appearance: "information",
    text: "Restaurant added to your pool.",
  },
};

const App = () => {
  // null = initial load still in flight (renders a spinner).
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  // When set, the form below operates in edit mode for this restaurant.
  const [editing, setEditing] = useState<Restaurant | null>(null);
  // null until view.getContext() resolves; the migrations button only
  // renders once we know we're NOT in production.
  const [environmentType, setEnvironmentType] = useState<string | null>(null);

  // Controlled add-restaurant form fields.
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [menuUrl, setMenuUrl] = useState("");
  // Textfields are cleared after a successful add by bumping this key,
  // which remounts them with empty values.
  const [formKey, setFormKey] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setRestaurants(unwrap(await invoke<Restaurant[]>("getSavedRestaurants")));
    } catch (error) {
      setMessage({ appearance: "error", text: describeError(error) });
      setRestaurants([]);
    }
  }, []);

  useEffect(() => {
    refresh();
    view
      .getContext()
      .then((context) => setEnvironmentType(context.environmentType));
  }, [refresh]);

  const clearForm = () => {
    setName("");
    setPhone("");
    setAddress("");
    setWebsite("");
    setMenuUrl("");
    setEditing(null);
    setFormKey((key) => key + 1);
  };

  const startEdit = (restaurant: Restaurant) => {
    setMessage(null);
    setName(restaurant.name);
    setPhone(restaurant.phone);
    setAddress(restaurant.address);
    setWebsite(restaurant.website ?? "");
    setMenuUrl(restaurant.menuUrl ?? "");
    setEditing(restaurant);
    setFormKey((key) => key + 1);
  };

  const handleSubmit = async () => {
    setBusy(true);
    setMessage(null);
    const fields = { name, phone, address, website, menuUrl };
    try {
      if (editing) {
        await invoke("updateRestaurant", {
          restaurantId: editing.id,
          ...fields,
        });
        setMessage({ appearance: "success", text: "Restaurant updated." });
      } else {
        const result = unwrap(
          await invoke<AddRestaurantResult>("addRestaurant", fields),
        );
        setMessage(OUTCOME_MESSAGES[result.outcome]);
      }
      clearForm();
      await refresh();
    } catch (error) {
      setMessage({ appearance: "error", text: describeError(error) });
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (restaurantId: number) => {
    setBusy(true);
    setMessage(null);
    try {
      await invoke("removeSavedRestaurant", { restaurantId });
      if (editing?.id === restaurantId) {
        clearForm();
      }
      await refresh();
    } catch (error) {
      setMessage({ appearance: "error", text: describeError(error) });
    } finally {
      setBusy(false);
    }
  };

  // Dev-only: applies pending SQL migrations on demand while tunnelling,
  // instead of waiting for the hourly scheduled trigger. Remove this button
  // once the install-time trigger flow is confirmed.
  const handleRunMigrations = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const applied = unwrap(await invoke<string[]>("runMigrations"));
      setMessage({
        appearance: "success",
        text:
          applied.length > 0
            ? `Migrations applied: ${applied.join(", ")}`
            : "Migrations already up to date.",
      });
      await refresh();
    } catch (error) {
      setMessage({ appearance: "error", text: describeError(error) });
    } finally {
      setBusy(false);
    }
  };

  const tableHead = {
    cells: [
      { key: "name", content: "Name" },
      { key: "phone", content: "Phone" },
      { key: "address", content: "Address" },
      { key: "actions", content: "" },
    ],
  };

  const tableRows = (restaurants ?? []).map((restaurant) => ({
    key: String(restaurant.id),
    cells: [
      { key: "name", content: restaurant.name },
      {
        key: "phone",
        content: restaurant.phone === "" ? "N/A" : restaurant.phone,
      },
      {
        key: "address",
        content: restaurant.address === "" ? "N/A" : restaurant.address,
      },
      {
        key: "actions",
        content: (
          <Inline space="space.050">
            <Button
              appearance="subtle"
              isDisabled={busy}
              onClick={() => startEdit(restaurant)}
            >
              Edit
            </Button>
            <Button
              appearance="subtle"
              isDisabled={busy}
              onClick={() => handleRemove(restaurant.id)}
            >
              Remove
            </Button>
          </Inline>
        ),
      },
    ],
  }));

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

      <Stack space="space.100" key={formKey}>
        <Heading as="h2">
          {editing ? "Edit restaurant" : "Add a restaurant"}
        </Heading>
        <Label labelFor="name">Name (required)</Label>
        <Textfield
          id="name"
          defaultValue={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Label labelFor="phone">Phone</Label>
        <Textfield
          id="phone"
          defaultValue={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
        <Label labelFor="address">Address</Label>
        <Textfield
          id="address"
          defaultValue={address}
          onChange={(event) => setAddress(event.target.value)}
        />
        <Label labelFor="website">Website</Label>
        <Textfield
          id="website"
          defaultValue={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
        <Label labelFor="menuUrl">Menu URL</Label>
        <Textfield
          id="menuUrl"
          defaultValue={menuUrl}
          onChange={(event) => setMenuUrl(event.target.value)}
        />
        <Inline space="space.100">
          <Button
            appearance="primary"
            isDisabled={busy || name.trim() === ""}
            onClick={handleSubmit}
          >
            {editing ? "Save changes" : "Add to my pool"}
          </Button>
          {editing && (
            <Button appearance="subtle" isDisabled={busy} onClick={clearForm}>
              Cancel
            </Button>
          )}
        </Inline>
      </Stack>

      <Stack space="space.100">
        <Heading as="h2">My restaurant pool</Heading>
        {restaurants === null ? (
          <Spinner label="Loading your restaurants" />
        ) : restaurants.length === 0 ? (
          <Text>No restaurants exist yet. Add one above.</Text>
        ) : (
          <DynamicTable head={tableHead} rows={tableRows} />
        )}
      </Stack>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
