import { createClient } from "@libsql/client";

const client = createClient({ url: "file:apps/api/data/store.db" });

async function seed() {
  console.log("Seeding demo order and demo return...");

  // Check if MG-10294 already exists
  const check = await client.execute({
    sql: "SELECT id FROM orders WHERE number = ?",
    args: ["MG-10294"],
  });

  let orderId: number;
  if (check.rows.length === 0) {
    const orderRes = await client.execute({
      sql: `INSERT INTO orders (
        number, access_token, customer_name, customer_phone, customer_email,
        city, area, line1,
        subtotal, discount, shipping, total,
        status, payment_method, payment_status, created_at, updated_at
      ) VALUES (
        'MG-10294', 'token_mg10294', 'Hamza Tariq', '+923001234567', 'hamza@example.pk',
        'Lahore', 'Gulberg III', 'House 14-B, Street 3, Gulberg III, Lahore',
        3999, 0, 0, 3999,
        'delivered', 'cod', 'paid', datetime('now', '-3 days'), datetime('now', '-3 days')
      ) RETURNING id`,
      args: [],
    });

    orderId = orderRes.rows[0].id as number;

    // Add order item
    await client.execute({
      sql: `INSERT INTO order_items (
        order_id, product_id, product_slug, product_name, model_name,
        color_name, color_hex, sku, unit_price, qty, line_total, category
      ) VALUES (
        ?, 1, 'crystal-clear-magsafe-case', 'Crystal Clear MagSafe Case', 'iPhone 16 Pro Max',
        'Crystal Clear', '#f4f7fb', 'CASE-CLR-IP16PM', 3999, 1, 3999, 'magsafe-cases'
      )`,
      args: [orderId],
    });

    // Add order event
    await client.execute({
      sql: `INSERT INTO order_events (order_id, status, note, created_at)
        VALUES (?, 'delivered', 'Parcel successfully delivered by TCS courier.', datetime('now', '-2 days'))`,
      args: [orderId],
    });

    console.log("Created demo order: MG-10294 (Phone: +923001234567)");
  } else {
    orderId = check.rows[0].id as number;
  }

  // Check if demo return RT10001 exists
  const checkReturn = await client.execute({
    sql: "SELECT id FROM return_requests WHERE number = ?",
    args: ["RT10001"],
  });

  if (checkReturn.rows.length === 0) {
    const orderItem = await client.execute({
      sql: "SELECT id FROM order_items WHERE order_id = ? LIMIT 1",
      args: [orderId],
    });
    const itemId = (orderItem.rows[0]?.id as number) ?? 1;

    const returnRes = await client.execute({
      sql: `INSERT INTO return_requests (
        number, order_id,
        resolution, reason, details, exchange_note, refund_method,
        status, admin_note, items, created_at, updated_at
      ) VALUES (
        'RT10001', ?,
        'exchange', 'Ordered the wrong phone model',
        'I mistakenly ordered iPhone 16 Pro Max instead of iPhone 16 Pro',
        'Please exchange with iPhone 16 Pro (Crystal Clear)',
        NULL,
        'approved',
        'Approved by QC. Rider will swap at doorstep.',
        ?,
        datetime('now', '-1 day'), datetime('now')
      ) RETURNING id`,
      args: [orderId, JSON.stringify([{ orderItemId: itemId, qty: 1 }])],
    });

    const returnId = returnRes.rows[0].id as number;

    await client.execute({
      sql: `INSERT INTO return_events (return_id, status, note, created_at)
        VALUES (?, 'requested', 'Return request received via online portal', datetime('now', '-1 day'))`,
      args: [returnId],
    });

    await client.execute({
      sql: `INSERT INTO return_events (return_id, status, note, created_at)
        VALUES (?, 'approved', 'Approved by QC team. Pickup assigned to TCS Courier.', datetime('now', '-12 hours'))`,
      args: [returnId],
    });

    console.log("Created demo return request: RT10001");
  }

  console.log("Seed complete!");
}

seed().catch(console.error);
