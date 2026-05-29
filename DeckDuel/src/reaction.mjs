import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const sendToConnection = async (endpoint, connectionId, data) => {
  const apigw = new ApiGatewayManagementApiClient({ endpoint });
  await apigw.send(new PostToConnectionCommand({
    ConnectionId: connectionId,
    Data: JSON.stringify(data),
  }));
};

export const handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const endpoint = process.env.WEBSOCKET_ENDPOINT;
  const { emoji } = JSON.parse(event.body);

  const connRecord = await dynamo.send(new GetCommand({
    TableName: process.env.CONNECTIONS_TABLE,
    Key: { connectionId },
  }));

  if (!connRecord.Item?.roomId) return { statusCode: 200, body: "OK" };

  const { roomId, username } = connRecord.Item;

  const allConnections = await dynamo.send(new ScanCommand({
    TableName: process.env.CONNECTIONS_TABLE,
    FilterExpression: "roomId = :roomId",
    ExpressionAttributeValues: { ":roomId": roomId },
  }));

  for (const conn of allConnections.Items) {
    if (conn.connectionId === connectionId) continue;
    try {
      await sendToConnection(endpoint, conn.connectionId, {
        type: "REACTION",
        emoji,
        from: username,
      });
    } catch {}
  }

  return { statusCode: 200, body: "OK" };
};