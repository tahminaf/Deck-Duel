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
  const { answer } = JSON.parse(event.body);

  const connRecord = await dynamo.send(new GetCommand({
    TableName: process.env.CONNECTIONS_TABLE,
    Key: { connectionId },
  }));

  if (!connRecord.Item) {
    await sendToConnection(endpoint, connectionId, { type: "ERROR", message: "Connection not found" });
    return { statusCode: 404, body: "Not found" };
  }

  const { roomId, username } = connRecord.Item;

  const roomRecord = await dynamo.send(new GetCommand({
    TableName: process.env.ROOMS_TABLE,
    Key: { roomId },
  }));

  const room = roomRecord.Item;
  if (!room) {
    await sendToConnection(endpoint, connectionId, { type: "ERROR", message: "Room not found" });
    return { statusCode: 404, body: "Room not found" };
  }

  const deckRecord = await dynamo.send(new GetCommand({
    TableName: process.env.DECKS_TABLE,
    Key: { deckId: room.deckId },
  }));

  const deck = deckRecord.Item;
  if (!deck) {
    await sendToConnection(endpoint, connectionId, { type: "ERROR", message: "Deck not found" });
    return { statusCode: 404, body: "Deck not found" };
  }

  // Per-player state — each player tracks their own question index and score
  const playerProgress = room.playerProgress || {};
  const myProgress = playerProgress[username] || { questionIndex: 0, score: 0, finished: false };

  // Already finished
  if (myProgress.finished) {
    return { statusCode: 200, body: "Already finished" };
  }

  const currentCard = deck.cards[myProgress.questionIndex];
  if (!currentCard) return { statusCode: 200, body: "No card" };

  const isCorrect = answer.trim().toLowerCase() === currentCard.answer.trim().toLowerCase();

  // Update this player's progress
  const newScore = isCorrect ? myProgress.score + 1 : myProgress.score;
  const newQuestionIndex = myProgress.questionIndex + 1;
  const playerFinished = newQuestionIndex >= deck.cards.length;

  const updatedProgress = {
    ...myProgress,
    questionIndex: newQuestionIndex,
    score: newScore,
    finished: playerFinished,
    lastAnswerCorrect: isCorrect,
  };

  // Compute car position for this player: score / total as percentage
  // Cars always move — base position is progress through questions, boost for correct
  const totalCards = deck.cards.length;
  const progressPct = (newQuestionIndex / totalCards) * 100;
  // Correct answers give full progress credit; wrong answers give 70% of the step
  const carPct = isCorrect
    ? progressPct
    : Math.max(0, ((myProgress.questionIndex / totalCards) * 100) + (100 / totalCards) * 0.7);

  const updatedPlayerProgress = {
    ...playerProgress,
    [username]: { ...updatedProgress, carPct },
  };

  // Update shared scores map too (for leaderboard display)
  const updatedScores = { ...room.scores, [username]: newScore };

  // Build carPositions map from all players' carPct
  const carPositions = {};
  for (const [player, prog] of Object.entries(updatedPlayerProgress)) {
    carPositions[player] = Math.round(prog.carPct || 0);
  }
  // Fill in any players not yet in progress
  for (const player of room.players) {
    if (!(player in carPositions)) carPositions[player] = 0;
  }

  // Check if ALL players are finished
  const allFinished = room.players.every(p =>
    updatedPlayerProgress[p]?.finished === true
  );

  await dynamo.send(new UpdateCommand({
    TableName: process.env.ROOMS_TABLE,
    Key: { roomId },
    UpdateExpression: "SET scores = :scores, playerProgress = :progress, #s = :status",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: {
      ":scores": updatedScores,
      ":progress": updatedPlayerProgress,
      ":status": allFinished ? "finished" : "active",
    },
  }));

  // Next question for this player (if not finished)
  const nextQuestion = !playerFinished ? {
    index: newQuestionIndex,
    question: deck.cards[newQuestionIndex].question,
    totalQuestions: totalCards,
  } : null;

  const allConnections = await dynamo.send(new ScanCommand({
    TableName: process.env.CONNECTIONS_TABLE,
    FilterExpression: "roomId = :roomId",
    ExpressionAttributeValues: { ":roomId": roomId },
  }));

  if (allFinished) {
    const sortedScores = Object.entries(updatedScores).sort((a, b) => b[1] - a[1]);
    const message = {
      type: "GAME_OVER",
      scores: updatedScores,
      carPositions,
      winner: sortedScores[0][0],
      totalQuestions: totalCards,
    };
    for (const conn of allConnections.Items) {
      try { await sendToConnection(endpoint, conn.connectionId, message); } catch {}
    }
    return { statusCode: 200, body: "OK" };
  }

  // Send ANSWER_RESULT to everyone — includes car positions so all tracks update
  const broadcastMessage = {
    type: "ANSWER_RESULT",
    answeredBy: username,
    isCorrect,
    scores: updatedScores,
    carPositions,
    // Only the answering player gets next question
    nextQuestion: null,
  };

  // Send personalized message to answering player with their next question
  const personalMessage = {
    ...broadcastMessage,
    nextQuestion,
    playerFinished,
  };

  const notified = new Set();
  for (const conn of allConnections.Items) {
    try {
      const msg = conn.connectionId === connectionId ? personalMessage : broadcastMessage;
      await sendToConnection(endpoint, conn.connectionId, msg);
      notified.add(conn.connectionId);
    } catch (err) {
      console.warn("Failed to send to", conn.connectionId, err.name);
    }
  }
  if (!notified.has(connectionId)) {
    try { await sendToConnection(endpoint, connectionId, personalMessage); } catch {}
  }

  return { statusCode: 200, body: "OK" };
};