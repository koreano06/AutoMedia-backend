import { prisma } from "../../database/prisma.js";
import type { Expense, SalesOrder } from "../../shared/types/domain.js";
import { expensesRepository, salesOrdersRepository } from "./finance.repository.js";

type SalesOrderPayload = Omit<Partial<SalesOrder>, "items"> & {
  items: Array<{
    product_id?: string;
    product_name: string;
    sku?: string;
    quantity: number;
    unit_price: number | string;
    unit_cost?: number | string;
  }>;
};

function asNumber(value?: number | string) {
  return Number(value || 0);
}

function fromDate(value?: string) {
  return value ? new Date(value) : undefined;
}

function serializeDecimal(value: unknown) {
  return value && typeof value === "object" && "toString" in value ? Number((value as { toString(): string }).toString()) : value;
}

function serializeOrder(order: Awaited<ReturnType<typeof prisma.salesOrder.create>>) {
  return JSON.parse(JSON.stringify(order, (_key, value) => serializeDecimal(value)));
}

export const financeService = {
  listOrders(order = "-sold_at", limit?: number) {
    return salesOrdersRepository.list(order, limit);
  },

  listExpenses(order = "-spent_at", limit?: number) {
    return expensesRepository.list(order, limit);
  },

  createExpense(payload: Partial<Expense>) {
    return expensesRepository.create(payload);
  },

  async createOrder(payload: SalesOrderPayload) {
    const items = payload.items || [];
    const subtotal = items.reduce((sum, item) => sum + asNumber(item.unit_price) * item.quantity, 0);
    const costTotal = items.reduce((sum, item) => sum + asNumber(item.unit_cost) * item.quantity, 0);
    const discount = asNumber(payload.discount);
    const shipping = asNumber(payload.shipping);
    const total = subtotal - discount + shipping;
    const profit = total - costTotal;

    const order = await prisma.salesOrder.create({
      data: {
        customerName: payload.customer_name,
        customerEmail: payload.customer_email,
        platform: payload.platform,
        status: payload.status || "paid",
        subtotal,
        discount,
        shipping,
        total,
        costTotal,
        profit,
        currency: payload.currency || "BRL",
        externalOrderId: payload.external_order_id,
        soldAt: fromDate(payload.sold_at),
        metadata: payload.metadata,
        items: {
          create: items.map((item) => {
            const itemTotal = asNumber(item.unit_price) * item.quantity;
            const itemCost = asNumber(item.unit_cost) * item.quantity;
            return {
              productId: item.product_id,
              productName: item.product_name,
              sku: item.sku,
              quantity: item.quantity,
              unitPrice: asNumber(item.unit_price),
              unitCost: asNumber(item.unit_cost),
              total: itemTotal,
              profit: itemTotal - itemCost,
            };
          }),
        },
      },
      include: { items: true },
    });

    return serializeOrder(order);
  },

  async summary() {
    const [orders, expenses] = await Promise.all([
      prisma.salesOrder.findMany({ where: { status: { not: "cancelled" } } }),
      prisma.expense.findMany(),
    ]);

    const revenue = orders.reduce((sum, order) => sum + asNumber(order.total.toString()), 0);
    const cost = orders.reduce((sum, order) => sum + asNumber(order.costTotal.toString()), 0);
    const grossProfit = orders.reduce((sum, order) => sum + asNumber(order.profit.toString()), 0);
    const expensesTotal = expenses.reduce((sum, expense) => sum + asNumber(expense.amount.toString()), 0);
    const netProfit = grossProfit - expensesTotal;

    return {
      orders_count: orders.length,
      revenue,
      cost,
      gross_profit: grossProfit,
      expenses: expensesTotal,
      net_profit: netProfit,
      average_ticket: orders.length ? revenue / orders.length : 0,
      margin_percent: revenue ? Math.round((netProfit / revenue) * 100) : 0,
    };
  },
};
