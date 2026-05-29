import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event) => {
  const connectionId = event.requestContext.connectionId;

  await client.send(new DeleteCommand({
    TableName: process.env.CONNECTIONS_TABLE,
    Key: { connectionId },
  }));

  return { statusCode: 200, body: "Disconnected" };
};