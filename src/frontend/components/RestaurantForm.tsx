import React, { useState } from "react";
import {
  Button,
  Heading,
  Inline,
  Label,
  Stack,
  Textfield,
} from "@forge/react";
import type { Restaurant } from "../../types";

export type RestaurantFields = {
  name: string;
  phone: string;
  address: string;
  website: string;
  menuUrl: string;
};

type Props = {
  editing: Restaurant | null;
  busy: boolean;
  onSubmit: (fields: RestaurantFields) => void;
  onCancel: () => void;
  // Global soft delete; recoverable by re-adding the same identity.
  onDelete: (restaurantId: number) => void;
};

// Field state is local, initialized from `editing`; the parent remounts this
// component (via key) when edit mode starts/ends so fields reset or prefill.
const RestaurantForm = ({
  editing,
  busy,
  onSubmit,
  onCancel,
  onDelete,
}: Props) => {
  const [name, setName] = useState(editing?.name ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [address, setAddress] = useState(editing?.address ?? "");
  const [website, setWebsite] = useState(editing?.website ?? "");
  const [menuUrl, setMenuUrl] = useState(editing?.menuUrl ?? "");

  return (
    <Stack space="space.100">
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
      {/* --- Actions --- */}
      <Inline space="space.100">
        <Button
          appearance="primary"
          isDisabled={busy || name.trim() === ""}
          onClick={() => onSubmit({ name, phone, address, website, menuUrl })}
        >
          {editing ? "Save changes" : "Add to my pool"}
        </Button>
        {editing && (
          <>
            <Button appearance="subtle" isDisabled={busy} onClick={onCancel}>
              Cancel
            </Button>
            <Button
              appearance="danger"
              isDisabled={busy}
              onClick={() => onDelete(editing.id)}
            >
              Delete restaurant
            </Button>
          </>
        )}
      </Inline>
    </Stack>
  );
};

export default RestaurantForm;
