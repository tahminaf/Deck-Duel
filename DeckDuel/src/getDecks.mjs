import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const respond = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  try {
    const createdBy = event.queryStringParameters?.createdBy;

    if (!createdBy) {
      return respond(400, { error: "createdBy query parameter is required" });
    }

    const result = await client.send(new ScanCommand({
      TableName: process.env.DECKS_TABLE,
      FilterExpression: "createdBy = :createdBy",
      ExpressionAttributeValues: { ":createdBy": createdBy },
    }));

    const decks = (result.Items || []).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    return respond(200, { decks });
  } catch (err) {
    console.error(err);
    return respond(500, { error: "Something went wrong" });
  }
};
