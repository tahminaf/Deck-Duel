import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const respond = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "'POST,GET,PUT,OPTIONS'",
  },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  try {
    const deckId = event.pathParameters?.deckId;
    if (!deckId) return respond(400, { error: "deckId is required" });

    const body = JSON.parse(event.body);
    const { title, cards } = body;

    if (!title || !cards || cards.length === 0) {
      return respond(400, { error: "title and cards are required" });
    }

    const existing = await client.send(new GetCommand({
      TableName: process.env.DECKS_TABLE,
      Key: { deckId },
    }));

    if (!existing.Item) return respond(404, { error: "Deck not found" });

    await client.send(new UpdateCommand({
      TableName: process.env.DECKS_TABLE,
      Key: { deckId },
      UpdateExpression: "SET title = :title, cards = :cards, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":title": title,
        ":cards": cards,
        ":updatedAt": new Date().toISOString(),
      },
    }));

    return respond(200, { message: "Deck updated!", deck: { deckId, title, cards } });

  } catch (err) {
    console.error(err);
    return respond(500, { error: "Something went wrong" });
  }
};
