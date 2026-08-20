import { useState, useEffect } from "react";

type StockAdjusterProps = {
  productId: string;
  currentStock: number;
  onStockChange: (productId: string, newStock: number) => Promise<boolean | void>;
  size?: "sm" | "md";
  showQuickAdd?: boolean;
  disabled?: boolean;
};

export default function StockAdjuster({
  productId,
  currentStock,
  onStockChange,
  size = "md",
  showQuickAdd = false,
  disabled = false,
}: StockAdjusterProps) {
  const [stockVal, setStockVal] = useState(currentStock);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setStockVal(currentStock);
  }, [currentStock]);

  const handleAdjust = async (delta: number) => {
    const nextVal = Math.max(0, stockVal + delta);
    if (nextVal === currentStock) return;

    setIsUpdating(true);
    setStockVal(nextVal);
    try {
      const res = await onStockChange(productId, nextVal);
      if (res === false) {
        setStockVal(currentStock); // rollback on error
      }
    } catch {
      setStockVal(currentStock);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val)) {
      setStockVal(0);
    } else {
      setStockVal(Math.max(0, val));
    }
  };

  const handleBlur = async () => {
    if (stockVal === currentStock) return;
    setIsUpdating(true);
    try {
      const res = await onStockChange(productId, stockVal);
      if (res === false) {
        setStockVal(currentStock);
      }
    } catch {
      setStockVal(currentStock);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className={`stock-adjuster-wrapper stock-adjuster-${size}`}>
      <div className="stock-stepper">
        <button
          type="button"
          onClick={() => handleAdjust(-1)}
          disabled={disabled || isUpdating || stockVal <= 0}
          className="stock-btn stock-btn-dec"
          title="Decrease stock by 1"
          aria-label="Decrease stock"
        >
          −
        </button>
        <input
          type="number"
          min="0"
          value={stockVal}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled || isUpdating}
          className={`stock-input ${stockVal < 1 ? "stock-input-out" : stockVal < 5 ? "stock-input-low" : ""}`}
          title="Click to edit stock quantity"
          aria-label="Product stock count"
        />
        <button
          type="button"
          onClick={() => handleAdjust(1)}
          disabled={disabled || isUpdating}
          className="stock-btn stock-btn-inc"
          title="Increase stock by 1"
          aria-label="Increase stock"
        >
          +
        </button>
      </div>

      {showQuickAdd && (
        <div className="stock-quick-actions">
          <button
            type="button"
            onClick={() => handleAdjust(5)}
            disabled={disabled || isUpdating}
            className="stock-btn-quick"
            title="Add 5 units"
          >
            +5
          </button>
          <button
            type="button"
            onClick={() => handleAdjust(10)}
            disabled={disabled || isUpdating}
            className="stock-btn-quick"
            title="Add 10 units"
          >
            +10
          </button>
        </div>
      )}

      {isUpdating && <span className="stock-syncing-indicator" title="Syncing stock...">●</span>}
    </div>
  );
}
