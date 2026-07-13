import "../styles/OrderTicket.css";

const OrderTicket = ({ winner }) => {
  if (!winner) {
    return null;
  }

  return (
    <div className="order-ticket" role="status">
      <span className="order-ticket__label">Today's pick</span>
      <span className="order-ticket__name">{winner}</span>
      <span className="order-ticket__stamp">ORDER UP!</span>
    </div>
  );
};

export default OrderTicket;
