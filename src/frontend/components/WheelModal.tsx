import React from "react";
import {
  Button,
  Frame,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
  Text,
} from "@forge/react";

type Props = {
  isOpen: boolean;
  busy: boolean;
  onCancel: () => void;
};

// Rendered as a Modal overlay (rather than inline) so opening/closing it
// never shifts the rest of the page. Backdrop-click/Esc are wired to the
// same cancel handler as the Cancel button — clicking outside mid-spin
// closes the Frame before the wheel's Events-API result ever fires.
const WheelModal = ({ isOpen, busy, onCancel }: Props) => (
  <ModalTransition>
    {isOpen && (
      <Modal onClose={onCancel}>
        <ModalHeader>
          <ModalTitle>Spin the wheel</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <Text>Spin the wheel — fate picks where you're eating.</Text>
          <Frame resource="wheel" />
        </ModalBody>
        <ModalFooter>
          <Button appearance="subtle" isDisabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    )}
  </ModalTransition>
);

export default WheelModal;
