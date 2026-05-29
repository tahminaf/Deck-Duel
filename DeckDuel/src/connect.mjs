import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event) => {
  const connectionId = event.requestContext.connectionId;

  await client.send(new PutCommand({
    TableName: process.env.CONNECTIONS_TABLE,
    Item: {
      connectionId,
      connectedAt: new Date().toISOString(),
    },
  }));

  return { statusCode: 200, body: "Connected" };
};