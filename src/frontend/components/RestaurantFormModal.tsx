import React from "react";
import { Modal, ModalTransition } from "@forge/react";
import RestaurantForm from "./RestaurantForm";
import type { RestaurantFields } from "./RestaurantForm";
import type { Restaurant } from "../../types";

type Props = {
  isOpen: boolean;
  editing: Restaurant | null;
  busy: boolean;
  onSubmit: (fields: RestaurantFields) => void;
  onCancel: () => void;
  onDelete: (restaurantId: number) => void;
};

// Deliberately does NOT pass `onClose` to <Modal> — that's the mechanism
// for making backdrop-click/Esc inert. Only the explicit close icon (in
// RestaurantForm's ModalHeader) and Cancel/Delete buttons call onCancel.
const RestaurantFormModal = ({
  isOpen,
  editing,
  busy,
  onSubmit,
  onCancel,
  onDelete,
}: Props) => (
  <ModalTransition>
    {isOpen && (
      <Modal>
        <RestaurantForm
          editing={editing}
          busy={busy}
          onSubmit={onSubmit}
          onCancel={onCancel}
          onDelete={onDelete}
        />
      </Modal>
    )}
  </ModalTransition>
);

export default RestaurantFormModal;
