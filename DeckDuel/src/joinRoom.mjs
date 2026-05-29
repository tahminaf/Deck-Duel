import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
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
  const { roomCode, username } = JSON.parse(event.body);

  const scan = await dynamo.send(new ScanCommand({
    TableName: process.env.ROOMS_TABLE,
    FilterExpression: "roomCode = :code",
    ExpressionAttributeValues: { ":code": roomCode },
  }));

  if (!scan.Items || scan.Items.length === 0) {
    await sendToConnection(endpoint, connectionId, { type: "ERROR", message: "Room not found" });
    return { statusCode: 404, body: "Room not found" };
  }

  const room = scan.Items[0];
  const maxPlayers = room.maxPlayers || 2;

  if (room.players.length >= maxPlayers && !room.players.includes(username)) {
    await sendToConnection(endpoint, connectionId, { type: "ERROR", message: "Room is full" });
    return { statusCode: 400, body: "Room full" };
  }

  const updatedPlayers = [...new Set([...room.players, username])];
  const updatedScores = { ...room.scores, [username]: 0 };

  // Init per-player progress
  const playerProgress = room.playerProgress || {};
  if (!playerProgress[username]) {
    playerProgress[username] = { questionIndex: 0, score: 0, finished: false, carPct: 0 };
  }

  await dynamo.send(new UpdateCommand({
    TableName: process.env.ROOMS_TABLE,
    Key: { roomId: room.roomId },
    UpdateExpression: "SET players = :players, scores = :scores, playerProgress = :progress",
    ExpressionAttributeValues: {
      ":players": updatedPlayers,
      ":scores": updatedScores,
      ":progress": playerProgress,
    },
  }));

  await dynamo.send(new UpdateCommand({
    TableName: process.env.CONNECTIONS_TABLE,
    Key: { connectionId },
    UpdateExpression: "SET roomId = :roomId, username = :username",
    ExpressionAttributeValues: {
      ":roomId": room.roomId,
      ":username": username,
    },
  }));

  // Notify everyone of the new join
  const allConnections = await dynamo.send(new ScanCommand({
    TableName: process.env.CONNECTIONS_TABLE,
    FilterExpression: "roomId = :roomId",
    ExpressionAttributeValues: { ":roomId": room.roomId },
  }));

  const joinedPayload = {
    type: "JOINED",
    roomCode,
    players: updatedPlayers,
    maxPlayers,
  };

  const notified = new Set();
  for (const conn of allConnections.Items) {
    try {
      await sendToConnection(endpoint, conn.connectionId, joinedPayload);
      notified.add(conn.connectionId);
    } catch {}
  }
  if (!notified.has(connectionId)) {
    await sendToConnection(endpoint, connectionId, joinedPayload);
  }

  // Start when room is full
  if (updatedPlayers.length >= maxPlayers) {
    const deckRecord = await dynamo.send(new GetCommand({
      TableName: process.env.DECKS_TABLE,
      Key: { deckId: room.deckId },
    }));

    const cards = deckRecord.Item?.cards || [];
    const firstQuestion = cards[0]?.question || '';
    const totalQuestions = cards.length;

    await dynamo.send(new UpdateCommand({
      TableName: process.env.ROOMS_TABLE,
      Key: { roomId: room.roomId },
      UpdateExpression: "SET #s = :status",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":status": "active" },
    }));

    const gameStartingPayload = {
      type: "GAME_STARTING",
      players: updatedPlayers,
      maxPlayers,
      firstQuestion,
      totalQuestions,
      message: "All players connected! Race starting...",
    };

    const freshConns = await dynamo.send(new ScanCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      FilterExpression: "roomId = :roomId",
      ExpressionAttributeValues: { ":roomId": room.roomId },
    }));

    const notified2 = new Set();
    for (const conn of freshConns.Items) {
      try {
        await sendToConnection(endpoint, conn.connectionId, gameStartingPayload);
        notified2.add(conn.connectionId);
      } catch {}
    }
    if (!notified2.has(connectionId)) {
      await sendToConnection(endpoint, connectionId, gameStartingPayload);
    }
  }

  return { statusCode: 200, body: "Joined" };
};