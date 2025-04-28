const fs = require('fs');
const path = require('path');
const { Web3 } = require('web3'); 
const dotenv = require('dotenv');
const solc = require('solc');

// Load environment variables
dotenv.config();

async function deployContract() {
    try {
        // Connect to blockchain
        const web3 = new Web3(process.env.BLOCKCHAIN_PROVIDER_URL || 'http://localhost:8545');
        
        // Get private key and handle format
        let privateKey = process.env.ADMIN_PRIVATE_KEY;
        if (!privateKey.startsWith('0x')) {
            privateKey = '0x' + privateKey;
        }
        
        // Set up deployer account
        const deployerAccount = web3.eth.accounts.privateKeyToAccount(privateKey);
        web3.eth.accounts.wallet.add(deployerAccount);
        
        console.log(`Deploying from address: ${deployerAccount.address}`);
        
        // Read the Solidity source code
        const contractPath = path.resolve(__dirname, 'contracts', 'Voting.sol');
        const source = fs.readFileSync(contractPath, 'utf8');
        
        // Compile the source code
        const input = {
            language: 'Solidity',
            sources: {
                'Voting.sol': {
                    content: source
                }
            },
            settings: {
                outputSelection: {
                    '*': {
                        '*': ['*']
                    }
                }
            }
        };
        
        console.log('Compiling contract...');
        const compiledContract = JSON.parse(solc.compile(JSON.stringify(input)));
        
        // Check for compilation errors
        if (compiledContract.errors) {
            compiledContract.errors.forEach(error => {
                console.error(error.formattedMessage);
            });
            throw new Error('Contract compilation failed');
        }
        
        // Get contract data
        const contractName = 'Voting';
        const contractData = compiledContract.contracts['Voting.sol'][contractName];
        
        // Save ABI to file
        const contractDir = path.resolve(__dirname, 'contract');
        if (!fs.existsSync(contractDir)) {
            fs.mkdirSync(contractDir);
        }
        
        fs.writeFileSync(
            path.resolve(contractDir, 'Voting.json'),
            JSON.stringify({ abi: contractData.abi }, null, 2)
        );
        
        // Create contract instance for deployment
        const contract = new web3.eth.Contract(contractData.abi);
        
        // Prompt for election name
        const electionName = process.argv[2] || 'General Election 2025';
        
        // Deploy the contract
        console.log(`Deploying with election name: ${electionName}`);
        
        const deployTx = contract.deploy({
            data: '0x' + contractData.evm.bytecode.object,
            arguments: [electionName]
        });
        
        // Estimate gas - Handle BigInt conversion properly
        const gasEstimate = await deployTx.estimateGas({ from: deployerAccount.address });
        console.log(`Estimated gas: ${gasEstimate.toString()}`);
        
        // Add 20% buffer using proper BigInt arithmetic
        const gasBuffer = gasEstimate / BigInt(5); // 20% = 1/5
        const totalGas = gasEstimate + gasBuffer;
        console.log(`Gas with buffer: ${totalGas.toString()}`);
        
        // Send deployment transaction
        const deployedContract = await deployTx.send({
            from: deployerAccount.address,
            gas: totalGas
        });
        
        console.log(`Contract deployed successfully at: ${deployedContract.options.address}`);
        console.log(`Update your .env file with the new contract address.`);
        
        // Update .env file with contract address
        let envContent = fs.readFileSync('.env', 'utf8');
        envContent = envContent.replace(
            /CONTRACT_ADDRESS=.*/,
            `CONTRACT_ADDRESS=${deployedContract.options.address}`
        );
        fs.writeFileSync('.env', envContent);
        
        console.log('Environment file updated with contract address.');
        
    } catch (error) {
        console.error('Deployment failed:', error);
        console.error(error.stack);
    }
}

deployContract();