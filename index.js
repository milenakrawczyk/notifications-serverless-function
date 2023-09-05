const functions = require('@google-cloud/functions-framework');
const axios = require("axios");
const Knex = require('knex');

// For local testing
const DB_USER="postgres";
const DB_PASS="postgres";
const DB_NAME="notifications-db";
const INSTANCE_HOST="localhost";
const DB_PORT=8087;

const createTcpPool = async config => {
    return Knex({
      client: 'pg',
      connection: {
        user: DB_USER || process.env.DB_USER,
        password: DB_PASS || process.env.DB_PASS,
        database: DB_NAME || process.env.DB_NAME,
        host: INSTANCE_HOST || process.env.INSTANCE_HOST,
        port: DB_PORT || process.env.DB_PORT,
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

functions.cloudEvent('receiveNotification', (cloudevent) => {
    createTcpPool().then((pool) => {
        const data = JSON.parse(atob(cloudevent.data.message.data));
        const webhookUrl = "";
    
        insertNotification(pool, data).then(() => console.log(`Notification with id ${notification.id} saved successfuly`));
    });

    // axios.post(
    //     webhookUrl,
    //     data
    // ).catch((error)=>{
    //     console.error(error);
    // });
});