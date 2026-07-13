import React, { useState } from "react";
import {
  Button,
  Heading,
  Inline,
  Label,
  Spinner,
  Stack,
  Strong,
  Text,
  TextArea,
  Textfield,
} from "@forge/react";
import type { CurrentSubmission, Restaurant } from "../../types";

type Props = {
  // undefined = still loading, null = no submitted order.
  submission: CurrentSubmission | null | undefined;
  // Frontend-only "selecting" stage (CONTEXT.md §3.12).
  selected: Restaurant | null;
  busy: boolean;
  poolEmpty: boolean;
  onPickRandom: () => void;
  onCancelSelection: () => void;
  onSubmitOrder: (
    itemsText: string,
    totalText: string,
    notesText: string,
  ) => void;
  onSaveSubmission: (
    itemsText: string,
    totalText: string,
    notesText: string,
  ) => Promise<void> | void;
  onClearSubmission: () => void;
  onPlaceOrder: () => void;
};

// Total/notes state is local, initialized from the submission; the parent
// remounts this component (via key) whenever the lifecycle stage changes.
const CurrentOrder = ({
  submission,
  selected,
  busy,
  poolEmpty,
  onPickRandom,
  onCancelSelection,
  onSubmitOrder,
  onSaveSubmission,
  onClearSubmission,
  onPlaceOrder,
}: Props) => {
  const [items, setItems] = useState(submission?.items ?? "");
  const [total, setTotal] = useState(
    submission?.total != null ? String(submission.total) : "",
  );
  const [notes, setNotes] = useState(submission?.notes ?? "");
  // Submitted orders are read-only until the user explicitly edits them.
  const [editingDetails, setEditingDetails] = useState(false);

  if (submission === undefined) {
    return (
      <Stack space="space.100">
        <Heading as="h2">Current order</Heading>
        <Spinner label="Loading your order" />
      </Stack>
    );
  }

  if (submission == null) {
    if (!selected) {
      return (
        <Stack space="space.100">
          <Heading as="h2">Current order</Heading>
          <Text>
            No order in progress — select a restaurant from your pool below,
            or let fate decide.
          </Text>
          <Inline>
            <Button isDisabled={busy || poolEmpty} onClick={onPickRandom}>
              Pick a random restaurant
            </Button>
          </Inline>
        </Stack>
      );
    }

    // Selecting stage: fields seed the submission.
    return (
      <Stack space="space.100">
        <Heading as="h2">Current order</Heading>
        <Text>
          Ordering from <Strong>{selected.name}</Strong>. Submit to lock it
          in.
        </Text>
        <Label labelFor="orderItems">Order</Label>
        <TextArea
          id="orderItems"
          defaultValue={items}
          onChange={(event) => setItems(event.target.value)}
        />
        <Label labelFor="orderTotal">Total</Label>
        <Textfield
          id="orderTotal"
          defaultValue={total}
          onChange={(event) => setTotal(event.target.value)}
        />
        <Label labelFor="orderNotes">Notes</Label>
        <TextArea
          id="orderNotes"
          defaultValue={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        <Inline space="space.100">
          <Button
            appearance="primary"
            isDisabled={busy}
            onClick={() => onSubmitOrder(items, total, notes)}
          >
            Submit order
          </Button>
          <Button isDisabled={busy} onClick={onPickRandom}>
            Re-pick random
          </Button>
          <Button
            appearance="subtle"
            isDisabled={busy}
            onClick={onCancelSelection}
          >
            Cancel
          </Button>
        </Inline>
      </Stack>
    );
  }

  if (!editingDetails) {
    return (
      <Stack space="space.100">
        <Heading as="h2">Current order</Heading>
        <Text>
          Submitted for <Strong>{submission.restaurantName}</Strong>. The
          restaurant is locked — clear the order to choose a different one.
        </Text>
        <Text>Order: {submission.items ?? "—"}</Text>
        <Text>
          Total:{" "}
          {submission.total != null ? `$${submission.total.toFixed(2)}` : "—"}
        </Text>
        <Text>Notes: {submission.notes ?? "—"}</Text>
        <Inline space="space.100">
          <Button appearance="primary" isDisabled={busy} onClick={onPlaceOrder}>
            Place order
          </Button>
          <Button isDisabled={busy} onClick={() => setEditingDetails(true)}>
            Edit order
          </Button>
          <Button
            appearance="subtle"
            isDisabled={busy}
            onClick={onClearSubmission}
          >
            Clear order
          </Button>
        </Inline>
      </Stack>
    );
  }

  return (
    <Stack space="space.100">
      <Heading as="h2">Current order</Heading>
      <Text>
        Editing order for <Strong>{submission.restaurantName}</Strong>. The
        restaurant stays locked — clear the order to choose a different one.
      </Text>
      <Label labelFor="orderItems">Order</Label>
      <TextArea
        id="orderItems"
        defaultValue={items}
        onChange={(event) => setItems(event.target.value)}
      />
      <Label labelFor="orderTotal">Total</Label>
      <Textfield
        id="orderTotal"
        defaultValue={total}
        onChange={(event) => setTotal(event.target.value)}
      />
      <Label labelFor="orderNotes">Notes</Label>
      <TextArea
        id="orderNotes"
        defaultValue={notes}
        onChange={(event) => setNotes(event.target.value)}
      />
      <Inline space="space.100">
        <Button
          appearance="primary"
          isDisabled={busy}
          onClick={async () => {
            await onSaveSubmission(items, total, notes);
            setEditingDetails(false);
          }}
        >
          Save changes
        </Button>
        <Button
          appearance="subtle"
          isDisabled={busy}
          onClick={() => {
            setItems(submission.items ?? "");
            setTotal(submission.total != null ? String(submission.total) : "");
            setNotes(submission.notes ?? "");
            setEditingDetails(false);
          }}
        >
          Cancel
        </Button>
      </Inline>
    </Stack>
  );
};

export default CurrentOrder;
