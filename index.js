const functions = require('@google-cloud/functions-framework');
const axios = require("axios");


functions.cloudEvent('receiveNotification', (cloudevent) => {
    const data = atob(cloudevent.data.message.data);
    const webhookUrl = "";
    console.log(data);

    axios.post(
        webhookUrl,
        data
    ).catch((error)=>{
        console.error(error);
    });
});