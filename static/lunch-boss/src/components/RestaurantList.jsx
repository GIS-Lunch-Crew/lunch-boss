const RestaurantList = ({ restaurants, onRemove, disabled }) => {
  if (restaurants.length === 0) {
    return (
      <p className="restaurant-list__empty">
        The menu's empty. Add a restaurant to get started.
      </p>
    );
  }

  return (
    <ul className="restaurant-list">
      {restaurants.map((name) => (
        <li className="restaurant-list__chip" key={name}>
          <span>{name}</span>
          <button
            type="button"
            className="restaurant-list__remove"
            onClick={() => onRemove(name)}
            disabled={disabled}
            aria-label={`Remove ${name}`}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
};

export default RestaurantList;
