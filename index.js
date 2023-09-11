const functions = require('@google-cloud/functions-framework');
const webpush = require('web-push');
const Knex = require('knex');

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:milena@near.org',
  process.env.VAPID_PUBLIC_KEY || "BCZN5uqYMBZ2VCV3y0F0emodyYRGyt5JTgfIIzYVXIHKSBwuG0kb0NpPA-DM4nfmfRFiFu-MpKS2eNG7bhxQWn0",
  process.env.VAPID_PRIVATE_KEY || "f1qlHM-Wsq9m6Z_WwQPPGL4zHyS2fKCoZFXOu2n5Dao"
);


// For local testing
// const DB_USER = "postgres";
// const DB_PASS = "postgres";
// const DB_NAME = "notifications-db";
// const INSTANCE_HOST = "localhost";
// const DB_PORT = 8087;

const createTcpPool = async config => {
    return Knex({
      client: 'pg',
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
      return await pool('Notification').insert({
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

const getSubscription = async (pool, accountId) => {
    try {
      return await pool('Subscription')
      .select('push_subscription_object')
      .where('account', accountId)
      .first()
    } catch (err) {
      throw Error(err);
    }
  };

  const getNotification = async (pool, id) => {
    try {
      return await pool('Notification')
      .select('*')
      .where('id', id)
      .first();
    } catch (err) {
      throw Error(err);
    }
  };

functions.cloudEvent('receiveNotification', (cloudevent) => {
    createTcpPool().then((pool) => {
        const data = JSON.parse(atob(cloudevent.data.message.data));

        getSubscription(pool, data.receiver).then((pso) => {
          if (!pso) {
            console.log(`No subscription found for ${data.receiver}`);
            return;
          }
          getNotification(pool, data.id).then((id) => {
            if (id) {
              console.log(`Notification with id ${data.id} has been sent already.`);
              return;
            }
  
            webpush.sendNotification(JSON.parse(pso.push_subscription_object), JSON.stringify(data)).then(res => {
              console.log(`Notification with id ${data.id} has been sent.`)
              insertNotification(pool, data).then(() => console.log(`Notification with id ${data.id} saved successfuly`));
            });
          })
        });
    });
});