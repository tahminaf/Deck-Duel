# DeckDuel ⚔️

A real-time multiplayer flashcard battle game. Two players join a room and race to answer questions from the same deck. Live scoring updates after every answer.

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Vite
- **Backend:** AWS Lambda, API Gateway (REST + WebSocket), DynamoDB, Cognito
- **Deployment:** AWS SAM

## Running Locally

**Backend**
```bash
cd DeckDuel
sam build && sam deploy --guided
```

**Frontend**
```bash
cd client
npm install
npm run dev
```
