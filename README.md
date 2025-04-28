# Voting DApp API

A decentralized voting system API built with Solidity smart contracts and Node.js.

## Features

- Secure blockchain-based voting system
- Transparent and immutable vote recording
- RESTful API for easy integration with front-end applications
- Comprehensive election management capabilities
- Admin dashboard for election control
- Real-time results tabulation

## System Architecture

This application consists of:

1. **Smart Contract**: A Solidity contract deployed on the Ethereum blockchain that manages the core voting logic
2. **API Server**: A Node.js/Express server that provides RESTful endpoints to interact with the blockchain
3. **Authentication System**: Secure admin access using API keys and voter authentication via blockchain keys

## Prerequisites

- Node.js (v16+)
- npm or yarn
- Access to an Ethereum node (Infura, Alchemy, or local node)
- MetaMask or other Ethereum wallet for deployment

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/voting-dapp-api.git
   cd voting-dapp-api
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file based on the provided sample:
   ```
   cp .env.sample .env
   ```

4. Edit the `.env` file with your configuration:
   - Add your Ethereum node provider URL
   - Set up admin address and private key
   - Generate a secure API key

## Deployment

1. Deploy the smart contract:
   ```
   npm run deploy [Election Name]
   ```
   Example: `npm run deploy "Presidential Election 2025"`

2. The contract address will be automatically updated in your `.env` file

## Running the API Server

1. Start the server:
   ```
   npm start
   ```

2. For development with auto-reload:
   ```
   npm run dev
   ```

## API Endpoints

### Election Management

- `GET /api/election` - Get election information
- `POST /api/election/start` - Start the election (admin only)
- `POST /api/election/end` - End the election (admin only)

### Candidates

- `GET /api/candidates` - Get all candidates
- `POST /api/candidates` - Add a candidate (admin only)

### Voters

- `POST /api/voters/register` - Register a voter (admin only)
- `GET /api/voters/:address/status` - Check voter status

### Voting

- `POST /api/vote` - Cast a vote
- `GET /api/results` - Get election results (available after election ends)

## Detailed API Documentation

### Election Management

#### Get Election Information
```
GET /api/election
```

Response:
```json
{
  "name": "Presidential Election 2025",
  "isStarted": true,
  "isEnded": false,
  "startTime": "2025-04-27T10:00:00.000Z",
  "endTime": "2025-04-27T16:00:00.000Z",
  "currentTime": "2025-04-27T12:30:00.000Z"
}
```

#### Start Election (Admin)
```
POST /api/election/start
Headers: x-api-key: YOUR_ADMIN_API_KEY
```

Request Body:
```json
{
  "durationInMinutes": 360
}
```

Response:
```json
{
  "message": "Election started successfully",
  "transactionHash": "0x123..."
}
```

#### End Election (Admin)
```
POST /api/election/end
Headers: x-api-key: YOUR_ADMIN_API_KEY
```

Response:
```json
{
  "message": "Election ended successfully",
  "transactionHash": "0x123..."
}
```

### Candidates

#### Get All Candidates
```
GET /api/candidates
```

Response:
```json
[
  {
    "id": 0,
    "name": "Candidate A",
    "party": "Party X",
    "proposal": "Proposal description...",
    "voteCount": 5
  },
  {
    "id": 1,
    "name": "Candidate B",
    "party": "Party Y",
    "proposal": "Proposal description...",
    "voteCount": 3
  }
]
```

#### Add Candidate (Admin)
```
POST /api/candidates
Headers: x-api-key: YOUR_ADMIN_API_KEY
```

Request Body:
```json
{
  "name": "Candidate C",
  "party": "Party Z",
  "proposal": "Proposal description..."
}
```

Response:
```json
{
  "message": "Candidate added successfully",
  "transactionHash": "0x123..."
}
```

### Voters

#### Register Voter (Admin)
```
POST /api/voters/register
Headers: x-api-key: YOUR_ADMIN_API_KEY
```

Request Body:
```json
{
  "voterAddress": "0x123..."
}
```

Response:
```json
{
  "message": "Voter registered successfully",
  "transactionHash": "0x123..."
}
```

#### Check Voter Status
```
GET /api/voters/0x123.../status
```

Response:
```json
{
  "address": "0x123...",
  "isRegistered": true,
  "hasVoted": true,
  "votedFor": 1
}
```

### Voting

#### Cast Vote
```
POST /api/vote
```

Request Body:
```json
{
  "candidateId": 1,
  "voterAddress": "0x123...",
  "privateKey": "voter-private-key"
}
```

Response:
```json
{
  "message": "Vote cast successfully",
  "transactionHash": "0x123..."
}
```

#### Get Results
```
GET /api/results
```

Response:
```json
{
  "totalVotes": 8,
  "candidates": [
    {
      "id": 0,
      "name": "Candidate A",
      "voteCount": 5,
      "percentage": "62.50"
    },
    {
      "id": 1,
      "name": "Candidate B",
      "voteCount": 3,
      "percentage": "37.50"
    }
  ]
}
```

## Security Considerations

- Never share your admin private key
- Store sensitive information like private keys securely
- Use HTTPS in production
- Implement additional authentication mechanisms for production use
- Consider rate limiting to prevent DoS attacks

## Testing

Run the included tests:
```
npm test
```

## License

MIT# voting-dapp-api
