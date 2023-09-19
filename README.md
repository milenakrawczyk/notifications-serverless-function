# Notifications Serverless Function

## Running locally

`npm start`

## Testing

1. Run the Pub/Sub emulator.
2. Run the function:

`npm start`

3. Create a topic:

```console
curl --location --request PUT 'http://localhost:8085/v1/projects/test-project/topics/test'
```

4. Create a push subscription:

```console
curl --location --request PUT 'http://localhost:8085/v1/projects/test-project/subscriptions/test-sub4' \
--header 'Content-Type: application/json' \
--data-raw '{"topic":"projects/test-project/topics/test",
"pushConfig":{"pushEndpoint":"http://localhost:8383/projects/test-project/topics/test"
}}'
```
