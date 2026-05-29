import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const respond = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
  },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  try {
    const deckId = event.pathParameters?.deckId;

    if (!deckId) {
      return respond(400, { error: "deckId is required" });
    }

    const result = await client.send(new GetCommand({
      TableName: process.env.DECKS_TABLE,
      Key: { deckId },
    }));

    if (!result.Item) {
      return respond(404, { error: "Deck not found" });
    }

    return respond(200, { deck: result.Item });
  } catch (err) {
    console.error(err);
    return respond(500, { error: "Something went wrong" });
  }
};
