// Required packages
const express = require('express');
const cors = require('cors');
const { Web3 } = require('web3'); 
const dotenv = require('dotenv');
const { body, validationResult } = require('express-validator');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
app.use(cors());
app.use(express.json());

// Utility function to convert BigInt values to strings
function sanitizeBigInt(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }
    
    if (typeof obj === 'bigint') {
        return obj.toString();
    }
    
    if (Array.isArray(obj)) {
        return obj.map(sanitizeBigInt);
    }
    
    if (typeof obj === 'object' && obj !== null) {
        const result = {};
        for (const key in obj) {
            result[key] = sanitizeBigInt(obj[key]);
        }
        return result;
    }
    
    return obj;
}

// Web3 configuration
const web3 = new Web3(process.env.BLOCKCHAIN_PROVIDER_URL || 'http://localhost:8545');

// Contract ABI and address (to be filled after deployment)
const contractABI = require('./contract/Voting.json').abi;
const contractAddress = process.env.CONTRACT_ADDRESS;

// Initialize contract instance
const votingContract = new web3.eth.Contract(contractABI, contractAddress);

// Admin wallet setup (from environment variables)
const adminWallet = {
    address: process.env.ADMIN_ADDRESS,
    privateKey: process.env.ADMIN_PRIVATE_KEY
};

// Middleware for admin authentication
const adminAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Admin access required' });
    }
    
    next();
};

// Helper function to handle contract transactions
async function sendTransaction(method, account, privateKey) {
    const gasEstimate = await method.estimateGas({ from: account });
    const data = method.encodeABI();
    const nonce = await web3.eth.getTransactionCount(account);
    const gasPrice = await web3.eth.getGasPrice();
    
    const tx = {
        from: account,
        to: contractAddress,
        gas: Math.round(Number(gasEstimate) * 1.2).toString(), // Convert to Number then to string
        gasPrice: gasPrice.toString(), // Convert BigInt to string
        data,
        nonce: nonce.toString() // Convert to string in case it's a BigInt
    };
    
    const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    
    // Sanitize the receipt before returning
    return sanitizeBigInt(receipt);
}

// API endpoints

// Get election information
app.get('/api/election', async (req, res) => {
    try {
        const electionName = await votingContract.methods.electionName().call();
        const status = await votingContract.methods.getElectionStatus().call();
        
        // Sanitize and format the response
        const responseData = sanitizeBigInt({
            name: electionName,
            isStarted: status.isStarted,
            isEnded: status.isEnded,
            startTime: new Date(Number(status.start) * 1000).toISOString(),
            endTime: new Date(Number(status.end) * 1000).toISOString(),
            currentTime: new Date(Number(status.currentTime) * 1000).toISOString()
        });
        
        res.json(responseData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all candidates
app.get('/api/candidates', async (req, res) => {
    try {
        const candidateCount = await votingContract.methods.getCandidateCount().call();
        const candidates = [];
        
        for (let i = 0; i < Number(candidateCount); i++) {
            const candidate = await votingContract.methods.getCandidate(i).call();
            candidates.push({
                id: Number(candidate[0]),
                name: candidate[1],
                party: candidate[2],
                proposal: candidate[3],
                voteCount: Number(candidate[4])
            });
        }
        
        // Sanitize any remaining BigInt values
        res.json(sanitizeBigInt(candidates));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add a candidate (admin only)
app.post('/api/candidates', 
    adminAuth,
    [
        body('name').notEmpty().withMessage('Candidate name is required'),
        body('party').notEmpty().withMessage('Party name is required'),
        body('proposal').notEmpty().withMessage('Proposal is required')
    ], 
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const { name, party, proposal } = req.body;
            
            const method = votingContract.methods.addCandidate(name, party, proposal);
            const receipt = await sendTransaction(method, adminWallet.address, adminWallet.privateKey);
            
            res.status(201).json(sanitizeBigInt({ 
                message: 'Candidate added successfully',
                transactionHash: receipt.transactionHash
            }));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// Register a voter (admin only)
app.post('/api/voters/register', 
    adminAuth,
    [
        body('voterAddress').notEmpty().withMessage('Voter Ethereum address is required')
    ], 
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const { voterAddress } = req.body;
            
            // Validate address format
            if (!web3.utils.isAddress(voterAddress)) {
                return res.status(400).json({ error: 'Invalid Ethereum address' });
            }
            
            const method = votingContract.methods.registerVoter(voterAddress);
            const receipt = await sendTransaction(method, adminWallet.address, adminWallet.privateKey);
            
            res.status(201).json(sanitizeBigInt({ 
                message: 'Voter registered successfully',
                transactionHash: receipt.transactionHash
            }));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// Start election (admin only)
app.post('/api/election/start', 
    adminAuth,
    [
        body('durationInMinutes').isInt({ min: 1 }).withMessage('Duration must be a positive integer')
    ], 
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const { durationInMinutes } = req.body;
            
            const method = votingContract.methods.startElection(durationInMinutes);
            const receipt = await sendTransaction(method, adminWallet.address, adminWallet.privateKey);
            
            res.json(sanitizeBigInt({ 
                message: 'Election started successfully',
                transactionHash: receipt.transactionHash
            }));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// End election (admin only)
app.post('/api/election/end', adminAuth, async (req, res) => {
    try {
        const method = votingContract.methods.endElection();
        const receipt = await sendTransaction(method, adminWallet.address, adminWallet.privateKey);
        
        res.json(sanitizeBigInt({ 
            message: 'Election ended successfully',
            transactionHash: receipt.transactionHash
        }));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cast vote
app.post('/api/vote', 
    [
        body('candidateId').isInt({ min: 0 }).withMessage('Candidate ID must be a non-negative integer'),
        body('voterAddress').notEmpty().withMessage('Voter address is required'),
        body('privateKey').notEmpty().withMessage('Private key is required')
    ], 
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const { candidateId, voterAddress, privateKey } = req.body;
            
            // Verify voter is registered and hasn't voted yet
            const voter = await votingContract.methods.voters(voterAddress).call();
            
            // Sanitize the voter data
            const sanitizedVoter = sanitizeBigInt(voter);
            
            if (!sanitizedVoter.isRegistered) {
                return res.status(403).json({ error: 'Voter is not registered' });
            }
            
            if (sanitizedVoter.hasVoted) {
                return res.status(403).json({ error: 'Voter has already cast a vote' });
            }
            
            const method = votingContract.methods.vote(candidateId);
            const receipt = await sendTransaction(method, voterAddress, privateKey);
            
            res.json(sanitizeBigInt({ 
                message: 'Vote cast successfully',
                transactionHash: receipt.transactionHash
            }));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// Get results (only after election ends)
app.get('/api/results', async (req, res) => {
    try {
        // Check if election has ended
        const status = await votingContract.methods.getElectionStatus().call();
        const sanitizedStatus = sanitizeBigInt(status);
        
        if (!sanitizedStatus.isEnded) {
            return res.status(403).json({ error: 'Election has not ended yet' });
        }
        
        const results = await votingContract.methods.getResults().call();
        const totalVotes = await votingContract.methods.totalVotes().call();
        
        // Sanitize results and totalVotes
        const sanitizedResults = sanitizeBigInt(results);
        const sanitizedTotalVotes = sanitizeBigInt(totalVotes);
        
        // Format results
        const formattedResults = [];
        for (let i = 0; i < sanitizedResults[0].length; i++) {
            formattedResults.push({
                id: Number(sanitizedResults[0][i]),
                name: sanitizedResults[1][i],
                voteCount: Number(sanitizedResults[2][i]),
                percentage: Number(sanitizedTotalVotes) > 0 ? 
                    (Number(sanitizedResults[2][i]) / Number(sanitizedTotalVotes) * 100).toFixed(2) : 
                    '0.00'
            });
        }
        
        // Sort by vote count (descending)
        formattedResults.sort((a, b) => b.voteCount - a.voteCount);
        
        res.json(sanitizeBigInt({
            totalVotes: Number(sanitizedTotalVotes),
            candidates: formattedResults
        }));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Check if a voter has voted
app.get('/api/voters/:address/status', async (req, res) => {
    try {
        const address = req.params.address;
        
        // Validate address format
        if (!web3.utils.isAddress(address)) {
            return res.status(400).json({ error: 'Invalid Ethereum address' });
        }
        
        const hasVoted = await votingContract.methods.hasVoted(address).call();
        const voter = await votingContract.methods.voters(address).call();
        
        // Sanitize voter data
        const sanitizedVoter = sanitizeBigInt(voter);
        const sanitizedHasVoted = sanitizeBigInt(hasVoted);
        
        res.json(sanitizeBigInt({
            address,
            isRegistered: sanitizedVoter.isRegistered,
            hasVoted: sanitizedHasVoted,
            votedFor: sanitizedHasVoted ? Number(sanitizedVoter.votedCandidateId) : null
        }));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Voting DApp API server running on port ${PORT}`);
});

module.exports = app; // For testing purposes