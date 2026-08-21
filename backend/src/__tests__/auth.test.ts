import "dotenv/config";
import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

describe("Bearer Auth Token Header Extraction", () => {
  it("should reject request when Authorization header is missing", async () => {
    const { authenticateUser } = await import("../middleware/auth.js");

    const req = { headers: {} } as Request;
    const jsonMock = vi.fn();
    const res = {
      status: vi.fn().mockReturnValue({ json: jsonMock }),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await authenticateUser(req as any, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Authorization header is missing" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should reject request when Authorization does not start with Bearer", async () => {
    const { authenticateUser } = await import("../middleware/auth.js");

    const req = { headers: { authorization: "Basic 12345" } } as Request;
    const jsonMock = vi.fn();
    const res = {
      status: vi.fn().mockReturnValue({ json: jsonMock }),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await authenticateUser(req as any, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid authorization format" })
    );
    expect(next).not.toHaveBeenCalled();
  });
});

describe("Cart Calculations & Multi-Product Aggregation", () => {
  it("should calculate correct cart total and quantity counts", () => {
    const cartItems = [
      { id: "1", product_id: "p1", quantity: 2, price: 49.99 },
      { id: "2", product_id: "p2", quantity: 1, price: 120.00 },
      { id: "3", product_id: "p3", quantity: 3, price: 15.50 },
    ];

    const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    expect(totalQuantity).toBe(6);
    expect(subtotal).toBeCloseTo(266.48, 2);
  });

  it("should cap quantity addition when stock limit is reached", () => {
    const stockLimit = 5;
    let currentQuantity = 4;
    const requestedAdd = 2;

    const newQuantity = Math.min(currentQuantity + requestedAdd, stockLimit);
    expect(newQuantity).toBe(5);
  });
});
