import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

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
    const { deckId, createdBy, maxPlayers = 2 } = body;

    if (!deckId || !createdBy) {
      return respond(400, { error: "deckId and createdBy are required" });
    }

    const room = {
      roomId: randomUUID(),
      roomCode: generateRoomCode(),
      deckId,
      createdBy,
      maxPlayers: Math.min(Math.max(parseInt(maxPlayers), 2), 4),
      players: [createdBy],
      status: "waiting",
      currentQuestionIndex: 0,
      currentQuestionAnswers: {},
      scores: {},
      createdAt: new Date().toISOString(),
    };

    await client.send(new PutCommand({
      TableName: process.env.ROOMS_TABLE,
      Item: room,
    }));

    return respond(201, { message: "Room created!", room });

  } catch (err) {
    console.error(err);
    return respond(500, { error: "Something went wrong" });
  }
};