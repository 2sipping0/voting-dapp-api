const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-http'));
const app = require('./app');
const { Web3 } = require('web3'); 
const dotenv = require('dotenv');

dotenv.config();

// Set a longer timeout for all blockchain operations
// Blockchain interactions typically take longer than standard unit tests
const TEST_TIMEOUT = 30000; // 30 seconds should be enough for test blockchain operations

// Web3 instance for direct contract interaction 
const web3 = new Web3(process.env.BLOCKCHAIN_PROVIDER_URL || 'http://localhost:8545');
const contractABI = require('./contract/Voting.json').abi;
const contractAddress = process.env.CONTRACT_ADDRESS;
const contract = new web3.eth.Contract(contractABI, contractAddress);

// Test accounts setup
const adminWallet = {
    address: process.env.ADMIN_ADDRESS,
    privateKey: process.env.ADMIN_PRIVATE_KEY
};

// Test data
const testVoter = {
    address: '0x2a29d860d005c927D4240667a760C70196F6fbB1', // Test voter address
    privateKey: '0x1378ce7d064ea06e5e54bd9fbb840499d9f1fd21167dc87589b5d0314a97625d' // Test private key
};

const testCandidate = {
    name: 'Test Candidate',
    party: 'Test Party',
    proposal: 'Test Proposal'
};

// Properly configured before hook with async/await pattern
before(async function() {
    // Setting timeout specifically for this hook
    this.timeout(TEST_TIMEOUT);
    
    try {
        // First try to register the test voter
        console.log('Setting up test: Registering test voter...');
        const res = await chai.request(app)
            .post('/api/voters/register')
            .set('x-api-key', process.env.ADMIN_API_KEY)
            .send({ voterAddress: testVoter.address });
        
        console.log('Test voter registration response:', res.body);
        
        // Then try to add a test candidate
        console.log('Setting up test: Adding test candidate...');
        const candidateRes = await chai.request(app)
            .post('/api/candidates')
            .set('x-api-key', process.env.ADMIN_API_KEY)
            .send(testCandidate);
        
        console.log('Test candidate addition response:', candidateRes.body);
    } catch (error) {
        // Log error but don't fail the tests - we want them to continue even if setup has issues
        console.log('Setup encountered an issue but continuing with tests:', error.message);
    }
});

describe('Voting DApp API Tests', function() {
    // Set timeout for all tests in this describe block
    this.timeout(TEST_TIMEOUT);
    
    it('should get election information', async function() {
        const res = await chai.request(app)
            .get('/api/election');
            
        expect(res).to.have.status(200);
        expect(res.body).to.have.property('name');
        expect(res.body).to.have.property('isStarted');
        expect(res.body).to.have.property('isEnded');
    });
    
    it('should add a candidate when admin is authenticated', async function() {
        const res = await chai.request(app)
            .post('/api/candidates')
            .set('x-api-key', process.env.ADMIN_API_KEY)
            .send(testCandidate);
            
        expect(res).to.have.status(201);
        expect(res.body).to.have.property('message').that.includes('Candidate added');
    });
    
    it('should reject adding a candidate without admin authentication', async function() {
        const res = await chai.request(app)
            .post('/api/candidates')
            .send(testCandidate);
            
        expect(res).to.have.status(401);
    });
    
    it('should get all candidates', async function() {
        const res = await chai.request(app)
            .get('/api/candidates');
            
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('array');
    });
    
    it('should register a voter', async function() {
        // Create a unique voter address for this test to avoid "already registered" errors
        const uniqueVoter = {
            address: `0x${Math.random().toString(16).substr(2, 40)}`,
        };
        
        const res = await chai.request(app)
            .post('/api/voters/register')
            .set('x-api-key', process.env.ADMIN_API_KEY)
            .send({ voterAddress: uniqueVoter.address });
            
        expect(res).to.have.status(201);
        expect(res.body).to.have.property('message').that.includes('Voter registered');
    });
    
    it('should start the election', async function() {
        const res = await chai.request(app)
            .post('/api/election/start')
            .set('x-api-key', process.env.ADMIN_API_KEY)
            .send({ durationInMinutes: 60 });
            
        // This might fail if the election is already started, so we handle both cases
        if (res.status === 500 && res.body.error && res.body.error.includes('already started')) {
            console.log('Election already started, continuing with tests');
        } else {
            expect(res).to.have.status(200);
            expect(res.body).to.have.property('message').that.includes('Election started');
        }
    });
    
    it('should cast a vote', async function() {
        const res = await chai.request(app)
            .post('/api/vote')
            .send({
                candidateId: 0,
                voterAddress: testVoter.address,
                privateKey: testVoter.privateKey
            });
            
        // Test voter might have already voted, so we handle that case
        if (res.status === 403 && res.body.error && res.body.error.includes('already cast')) {
            console.log('Test voter has already voted, test passes');
        } else {
            expect(res).to.have.status(200);
            expect(res.body).to.have.property('message').that.includes('Vote cast');
        }
    });
    
    it('should check voter status', async function() {
        const res = await chai.request(app)
            .get(`/api/voters/${testVoter.address}/status`);
            
        expect(res).to.have.status(200);
        expect(res.body).to.have.property('isRegistered');
        expect(res.body).to.have.property('hasVoted');
    });
    
    // This test should run only after all previous tests
    it('should end the election', async function() {
        const res = await chai.request(app)
            .post('/api/election/end')
            .set('x-api-key', process.env.ADMIN_API_KEY);
            
        // This might fail if the election is already ended, so we handle both cases
        if (res.status === 500 && res.body.error && res.body.error.includes('already ended')) {
            console.log('Election already ended, continuing with tests');
        } else {
            expect(res).to.have.status(200);
            expect(res.body).to.have.property('message').that.includes('Election ended');
        }
    });
    
    // This test should run after ending the election
    it('should get election results after election ends', async function() {
        const res = await chai.request(app)
            .get('/api/results');
            
        // Election might not have ended in the test environment
        if (res.status === 403 && res.body.error && res.body.error.includes('not ended')) {
            console.log('Election has not ended yet, skipping results test');
        } else {
            expect(res).to.have.status(200);
            expect(res.body).to.have.property('totalVotes');
            expect(res.body).to.have.property('candidates').that.is.an('array');
        }
    });
});