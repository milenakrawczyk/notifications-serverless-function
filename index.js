const functions = require("@google-cloud/functions-framework");
const webpush = require("web-push");
const Knex = require("knex");

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:milena@near.org",
  process.env.VAPID_PUBLIC_KEY ||
    "BCZN5uqYMBZ2VCV3y0F0emodyYRGyt5JTgfIIzYVXIHKSBwuG0kb0NpPA-DM4nfmfRFiFu-MpKS2eNG7bhxQWn0",
  process.env.VAPID_PRIVATE_KEY ||
    "f1qlHM-Wsq9m6Z_WwQPPGL4zHyS2fKCoZFXOu2n5Dao",
);

// allowed types of notifications
const ALLOWED_VALUE_TYPES = process.env.ALLOWED_VALUE_TYPES || [];

// max number of notifications per day
const MAX_NOTIFICATIONS_PER_DAY = process.env.MAX_NOTIFICATIONS_PER_DAY || 15;

// For local testing
// const DB_USER = "postgres";
// const DB_PASS = "postgres";
// const DB_NAME = "notifications-db";
// const INSTANCE_HOST = "localhost";
// const DB_PORT = 8087;

const createTcpPool = async () => {
  const config = { pool: {} };
  config.pool.max = 5;
  config.pool.min = 5;
  config.pool.acquireTimeoutMillis = 60000; // 60 seconds
  config.pool.createTimeoutMillis = 30000; // 30 seconds
  config.pool.idleTimeoutMillis = 600000; // 10 minutes
  return Knex({
    client: "pg",
    connection: {
      user: process.env.DB_USER || DB_USER,
      password: process.env.DB_PASS || DB_PASS,
      database: process.env.DB_NAME || DB_NAME,
      host: process.env.INSTANCE_HOST || INSTANCE_HOST,
      port: process.env.DB_PORT || DB_PORT,
    },
    ...config,
  });
};

const insertNotification = async (pool, notification) => {
  try {
    return await pool("Notification").insert({
      id: notification.id,
      block_height: notification.blockHeight,
      initiated_by: notification.initiatedBy,
      item_type: notification.itemType,
      message: notification.message,
      path: notification.path,
      receiver: notification.receiver,
      value_type: notification.valueType,
      sent_at: new Date(),
    });
  } catch (err) {
    throw Error(err);
  }
};

const getSubscriptions = async (pool, accountId) => {
  try {
    return await pool("Subscription")
      .select("push_subscription_object", "endpoint")
      .where("account", accountId);
  } catch (err) {
    throw Error(err);
  }
};

const getNotification = async (pool, id) => {
  try {
    return await pool("Notification").select("*").where("id", id).first();
  } catch (err) {
    throw Error(err);
  }
};

const deleteSubscription = async (pool, endpoint) => {
  try {
    return await pool("Subscription")
      .where("endpoint", endpoint)
      .del();
  } catch (err) {
    throw Error(err);
  }
};

const getPastNotifications = async (pool, accountId) => {
  try {
    const dayAgo = new Date(new Date().getTime() - (24 * 60 * 60 * 1000)).toISOString();
    return await pool("Notification")
      .select("id")
      .where("receiver", accountId)
      .where('sent_at', '>=', dayAgo);
  } catch (err) {
    throw Error(err);
  }
};

functions.cloudEvent("receiveNotification", async (cloudevent) => {
  const data = JSON.parse(atob(cloudevent.data.message.data));

  if (ALLOWED_VALUE_TYPES.length > 0) {
    if (ALLOWED_VALUE_TYPES.indexOf(data.valueType) === -1) {
      console.log(
        `Notification ${data.id} dropped due to unallowed type: ${data.valueType}.`,
      );
      return;
    }
  }

  let pool = await createTcpPool();
  let subscriptions;
  try {
    subscriptions = await getSubscriptions(pool, data.receiver);

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No subscription found for ${data.receiver}, notificationId: ${data.id}.`);
      return;
    }
    const id = await getNotification(pool, data.id);
    if (id) {
      console.log(`Notification with id ${data.id} has been sent already to ${data.receiver}.`);
      return;
    }
    const pastNotifications = await getPastNotifications(pool, data.receiver);
    if (pastNotifications.length > MAX_NOTIFICATIONS_PER_DAY) {
      console.log(`Notification with id ${data.id} has been dropped for ${data.receiver} because the daily limit has been reached.`);
      return;
    }

    await insertNotification(pool, data);
    console.log(`Notification with id ${data.id} saved successfuly, receiver: ${data.receiver}.`);
  
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(JSON.parse(subscription.push_subscription_object), JSON.stringify(data));
        console.log(`Notification with id ${data.id} has been sent to receiver: ${data.receiver}, endpoint: ${subscription.endpoint}.`)
      } catch(e) {
        console.error(`Error sending notification with id ${data.id} to receiver: ${data.receiver}, endpoint: ${subscription.endpoint}.`);
        switch (e.statusCode) {
          case 400: // bad parameters
          case 404: // endpoint not found
          case 410: // invalid endpoint
            // deleting subscription
            console.log(`Deleting invalid subscription of receiver: ${data.receiver}, endpoint: ${subscription.endpoint}.`);
            await deleteSubscription(pool, subscription.endpoint);
            return;
          default:
            console.error(`Error sending notification with id ${data?.id} to ${data?.receiver}, endpoint: ${subscription?.endpoint}.`)
            throw e;
        }
      };
    };
  } catch (e) {
    throw e;
  } finally {
    await pool.destroy();
  }
});
