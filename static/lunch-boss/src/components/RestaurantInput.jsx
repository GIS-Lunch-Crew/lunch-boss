const RestaurantInput = ({ value, onChange, onAdd, disabled }) => {
  const handleSubmit = (event) => {
    event.preventDefault();
    onAdd();
  };

  return (
    <form className="restaurant-input" onSubmit={handleSubmit}>
      <input
        className="restaurant-input__field"
        type="text"
        placeholder="Where should we eat?"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        maxLength={60}
        aria-label="Restaurant name"
      />
      <button
        className="restaurant-input__button"
        type="submit"
        disabled={disabled || !value.trim()}
      >
        Add to the menu
      </button>
    </form>
  );
};

export default RestaurantInput;
