import { useState } from "react";
import { useRestaurants } from "./hooks/useRestaurants.js";
import Header from "./components/Header.jsx";
import RestaurantInput from "./components/RestaurantInput.jsx";
import RestaurantList from "./components/RestaurantList.jsx";
import Wheel from "./components/Wheel.jsx";
import OrderTicket from "./components/OrderTicket.jsx";
import "./App.css";

const App = () => {
  const { restaurants, isLoading, error, addRestaurant, removeRestaurant } =
    useRestaurants();
  const [inputValue, setInputValue] = useState("");
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState(null);

  const handleAdd = () => {
    addRestaurant(inputValue);
    setInputValue("");
  };

  const handleSpinStart = () => {
    setWinner(null);
    setIsSpinning(true);
  };

  const handleSpinComplete = (winnerName) => {
    setWinner(winnerName);
    setIsSpinning(false);
  };

  if (isLoading) {
    return (
      <div className="app app--loading">
        <p>Loading the menu…</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Header />

      <RestaurantInput
        value={inputValue}
        onChange={setInputValue}
        onAdd={handleAdd}
        disabled={isSpinning}
      />

      {error && (
        <p className="app__error" role="alert">
          {error}
        </p>
      )}

      <RestaurantList
        restaurants={restaurants}
        onRemove={removeRestaurant}
        disabled={isSpinning}
      />

      <Wheel
        restaurants={restaurants}
        disabled={isSpinning}
        onSpinStart={handleSpinStart}
        onSpinComplete={handleSpinComplete}
      />

      <div className="app__ticket-slot">
        <OrderTicket key={winner} winner={winner} />
      </div>
    </div>
  );
};

export default App;
