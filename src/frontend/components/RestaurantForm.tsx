import React, { useState } from "react";
import {
  Box,
  Button,
  Icon,
  Inline,
  Label,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Pressable,
  Stack,
  Textfield,
  xcss,
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

// Each field sits in a flexible column that wraps to a single column below
// ~2×192px combined width, via Inline's native flex-wrap — no explicit
// breakpoints needed. `minWidth` on Box is XCSS-token-restricted per the
// compiler-enforced dist types (`tsc` rejects arbitrary pixel values even
// though the `allowCSS: true` marker in the package's `src/` codegen source
// suggests otherwise — the compiled `dist/types` the compiler actually uses
// is stricter); "size.1000" (12rem/192px) is the largest available token.
const fieldStyle = xcss({ flexGrow: 1, minWidth: "size.1000" });

// Rendered inside a Modal (RestaurantFormModal); header/body/footer are
// produced here so all field state/logic stays in one place.
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
    <>
      <ModalHeader>
        <Inline grow="fill" spread="space-between" alignBlock="center">
          <ModalTitle>
            {editing ? "Edit restaurant" : "Add a restaurant"}
          </ModalTitle>
          <Pressable onClick={onCancel} isDisabled={busy}>
            <Icon glyph="cross" label="Close" />
          </Pressable>
        </Inline>
      </ModalHeader>
      <ModalBody>
        <Stack space="space.150">
          <Inline shouldWrap space="space.150">
            <Box xcss={fieldStyle}>
              <Stack space="space.050">
                <Label labelFor="name">Name (required)</Label>
                <Textfield
                  id="name"
                  defaultValue={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Stack>
            </Box>
            <Box xcss={fieldStyle}>
              <Stack space="space.050">
                <Label labelFor="phone">Phone</Label>
                <Textfield
                  id="phone"
                  defaultValue={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </Stack>
            </Box>
          </Inline>
          <Stack space="space.050">
            <Label labelFor="address">Address</Label>
            <Textfield
              id="address"
              defaultValue={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </Stack>
          <Inline shouldWrap space="space.150">
            <Box xcss={fieldStyle}>
              <Stack space="space.050">
                <Label labelFor="website">Website</Label>
                <Textfield
                  id="website"
                  defaultValue={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </Stack>
            </Box>
            <Box xcss={fieldStyle}>
              <Stack space="space.050">
                <Label labelFor="menuUrl">Menu URL</Label>
                <Textfield
                  id="menuUrl"
                  defaultValue={menuUrl}
                  onChange={(event) => setMenuUrl(event.target.value)}
                />
              </Stack>
            </Box>
          </Inline>
        </Stack>
      </ModalBody>
      <ModalFooter>
        <Inline space="space.100">
          <Button
            appearance="primary"
            isDisabled={busy || name.trim() === ""}
            onClick={() => onSubmit({ name, phone, address, website, menuUrl })}
          >
            {editing ? "Save changes" : "Add to my pool"}
          </Button>
          <Button appearance="subtle" isDisabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          {editing && (
            <Button
              appearance="danger"
              isDisabled={busy}
              onClick={() => onDelete(editing.id)}
            >
              Delete restaurant
            </Button>
          )}
        </Inline>
      </ModalFooter>
    </>
  );
};

export default RestaurantForm;
