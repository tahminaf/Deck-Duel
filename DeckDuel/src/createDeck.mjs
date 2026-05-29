import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const respond = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
  },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { title, cards, createdBy } = body;

    if (!title || !cards || cards.length === 0) {
      return respond(400, { error: "title and cards are required" });
    }

    const deck = {
      deckId: randomUUID(),
      title,
      cards,
      createdBy: createdBy || 'unknown',
      createdAt: new Date().toISOString(),
    };

    await client.send(new PutCommand({
      TableName: process.env.DECKS_TABLE,
      Item: deck,
    }));

    return respond(201, { message: "Deck created!", deck });

  } catch (err) {
    console.error(err);
    return respond(500, { error: "Something went wrong" });
  }
};