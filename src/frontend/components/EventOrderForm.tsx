import React, { useState } from "react";
import {
  Button,
  Inline,
  Label,
  Stack,
  Strong,
  Text,
  TextArea,
  Textfield,
  Toggle,
} from "@forge/react";
import type { EventOrder } from "../../types";

type Props = {
  // The caller's order on this event (null = hasn't ordered → show the form).
  myOrder: EventOrder | null;
  restaurantName: string;
  // True when the event's restaurant is already in the caller's saved pool —
  // hides the opt-in toggle (nothing to add).
  inPool: boolean;
  busy: boolean;
};

// The order form on the Event-detail page — a visual clone of the solo
// CurrentOrder stages (selecting → submitted → editing), with the restaurant
// fixed to the event's (no re-pick/re-randomize) and no Place button (batch
// placement is the table's job). Unlike solo, submitting here does NOT
// auto-save the restaurant to your pool — the "Add to Your Pool" toggle is the
// opt-in (default off), shown only when it isn't already in your pool.
//
// Events slice: every control renders but is inert — nothing writes. The
// Orders slice wires submit/edit/cancel + the pool opt-in.
const EventOrderForm = ({ myOrder, restaurantName, inPool, busy }: Props) => {
  const [items, setItems] = useState(myOrder?.items ?? "");
  const [total, setTotal] = useState(
    myOrder?.total != null ? String(myOrder.total) : "",
  );
  const [notes, setNotes] = useState(myOrder?.notes ?? "");
  const [addToPool, setAddToPool] = useState(false);
  // Submitted orders are read-only until the user explicitly edits them.
  const [editingDetails, setEditingDetails] = useState(false);

  const fields = (
    <>
      <Label labelFor="eventOrderItems">Order</Label>
      <TextArea
        id="eventOrderItems"
        defaultValue={items}
        onChange={(event) => setItems(event.target.value)}
      />
      <Label labelFor="eventOrderTotal">Total $</Label>
      <Textfield
        id="eventOrderTotal"
        defaultValue={total}
        onChange={(event) => setTotal(event.target.value)}
      />
      <Label labelFor="eventOrderNotes">Notes</Label>
      <TextArea
        id="eventOrderNotes"
        defaultValue={notes}
        onChange={(event) => setNotes(event.target.value)}
      />
    </>
  );

  // --- Stage: no order yet (the form) ---
  if (myOrder === null) {
    return (
      <Stack grow="fill" space="space.100">
        <Text>
          Ordering from <Strong>{restaurantName}</Strong>. Submit to join the
          event.
        </Text>
        {fields}
        {!inPool && (
          <Inline space="space.100" alignBlock="center">
            <Toggle
              id="eventOrderAddToPool"
              isChecked={addToPool}
              onChange={() => setAddToPool((value) => !value)}
            />
            <Label labelFor="eventOrderAddToPool">Add to Your Pool</Label>
          </Inline>
        )}
        <Inline space="space.100">
          {/* Inert until the Orders slice wires submitEventOrder. */}
          <Button appearance="primary" isDisabled={busy} onClick={() => {}}>
            Submit order
          </Button>
        </Inline>
      </Stack>
    );
  }

  // --- Stage: submitted (read-only view) ---
  if (!editingDetails) {
    return (
      <Stack grow="fill" space="space.100">
        <Text>
          Submitted for <Strong>{restaurantName}</Strong>. The restaurant is
          set by the event.
        </Text>
        <Text>Order: {myOrder.items ?? "—"}</Text>
        <Text>
          Total: {myOrder.total != null ? `$${myOrder.total.toFixed(2)}` : "—"}
        </Text>
        <Text>Notes: {myOrder.notes ?? "—"}</Text>
        <Inline space="space.100">
          <Button isDisabled={busy} onClick={() => setEditingDetails(true)}>
            Edit order
          </Button>
          {/* Inert until the Orders slice wires cancelEventOrder. */}
          <Button appearance="subtle" isDisabled={busy} onClick={() => {}}>
            Cancel order
          </Button>
        </Inline>
      </Stack>
    );
  }

  // --- Stage: editing a submitted order ---
  return (
    <Stack grow="fill" space="space.100">
      <Text>
        Editing order for <Strong>{restaurantName}</Strong>. The restaurant is
        set by the event.
      </Text>
      {fields}
      <Inline space="space.100">
        {/* Inert until the Orders slice wires updateEventOrder. */}
        <Button appearance="primary" isDisabled={busy} onClick={() => {}}>
          Save changes
        </Button>
        <Button
          appearance="subtle"
          isDisabled={busy}
          onClick={() => {
            setItems(myOrder.items ?? "");
            setTotal(myOrder.total != null ? String(myOrder.total) : "");
            setNotes(myOrder.notes ?? "");
            setEditingDetails(false);
          }}
        >
          Cancel
        </Button>
      </Inline>
    </Stack>
  );
};

export default EventOrderForm;
