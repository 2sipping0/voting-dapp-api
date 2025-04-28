// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Voting
 * @dev A decentralized voting system
 */
contract Voting {
    // Structure to store information about each candidate
    struct Candidate {
        uint id;
        string name;
        string party;
        string proposal;
        uint voteCount;
    }

    // Structure to store information about voters
    struct Voter {
        bool hasVoted;
        uint votedCandidateId;
        bool isRegistered;
    }

    // State variables
    address public admin;
    string public electionName;
    uint public startTime;
    uint public endTime;
    bool public electionStarted;
    bool public electionEnded;
    
    // Store candidates
    Candidate[] public candidates;
    
    // Map voter address to voter info
    mapping(address => Voter) public voters;
    
    // Total votes cast
    uint public totalVotes;
    
    // Events
    event VoterRegistered(address indexed voterAddress);
    event CandidateAdded(uint candidateId, string name);
    event VoteCast(address indexed voter, uint candidateId);
    event ElectionStarted(uint startTime);
    event ElectionEnded(uint endTime);
    
    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }
    
    modifier electionActive() {
        require(electionStarted, "Election has not started yet");
        require(!electionEnded, "Election has already ended");
        require(block.timestamp >= startTime && block.timestamp <= endTime, "Election is not active");
        _;
    }
    
    // Constructor - Set up the election
    constructor(string memory _electionName) {
        admin = msg.sender;
        electionName = _electionName;
        electionStarted = false;
        electionEnded = false;
    }
    
    // Add a candidate
    function addCandidate(string memory _name, string memory _party, string memory _proposal) public onlyAdmin {
        require(!electionStarted, "Cannot add candidate after election has started");
        uint candidateId = candidates.length;
        candidates.push(Candidate({
            id: candidateId,
            name: _name,
            party: _party,
            proposal: _proposal,
            voteCount: 0
        }));
        
        emit CandidateAdded(candidateId, _name);
    }
    
    // Register a voter
    function registerVoter(address _voter) public onlyAdmin {
        require(!voters[_voter].isRegistered, "Voter is already registered");
        
        voters[_voter].isRegistered = true;
        voters[_voter].hasVoted = false;
        
        emit VoterRegistered(_voter);
    }
    
    // Start the election
    function startElection(uint _durationInMinutes) public onlyAdmin {
        require(!electionStarted, "Election has already started");
        require(candidates.length > 0, "No candidates registered");
        
        electionStarted = true;
        startTime = block.timestamp;
        endTime = startTime + (_durationInMinutes * 1 minutes);
        
        emit ElectionStarted(startTime);
    }
    
    // Cast a vote
    function vote(uint _candidateId) public electionActive {
        Voter storage sender = voters[msg.sender];
        
        require(sender.isRegistered, "You are not registered to vote");
        require(!sender.hasVoted, "You have already voted");
        require(_candidateId < candidates.length, "Invalid candidate");
        
        sender.hasVoted = true;
        sender.votedCandidateId = _candidateId;
        
        candidates[_candidateId].voteCount++;
        totalVotes++;
        
        emit VoteCast(msg.sender, _candidateId);
    }
    
    // End the election
    function endElection() public onlyAdmin electionActive {
        electionEnded = true;
        emit ElectionEnded(block.timestamp);
    }
    
    // Get candidate details
    function getCandidate(uint _candidateId) public view returns (uint, string memory, string memory, string memory, uint) {
        require(_candidateId < candidates.length, "Invalid candidate ID");
        
        Candidate memory candidate = candidates[_candidateId];
        return (candidate.id, candidate.name, candidate.party, candidate.proposal, candidate.voteCount);
    }
    
    // Get total number of candidates
    function getCandidateCount() public view returns (uint) {
        return candidates.length;
    }
    
    // Get election results (only after election ends)
    function getResults() public view returns (uint[] memory, string[] memory, uint[] memory) {
        require(electionEnded, "Election has not ended yet");
        
        uint[] memory ids = new uint[](candidates.length);
        string[] memory names = new string[](candidates.length);
        uint[] memory voteCounts = new uint[](candidates.length);
        
        for (uint i = 0; i < candidates.length; i++) {
            ids[i] = candidates[i].id;
            names[i] = candidates[i].name;
            voteCounts[i] = candidates[i].voteCount;
        }
        
        return (ids, names, voteCounts);
    }
    
    // Check if a voter has voted
    function hasVoted(address _voter) public view returns (bool) {
        return voters[_voter].hasVoted;
    }
    
    // Check election status
    function getElectionStatus() public view returns (bool isStarted, bool isEnded, uint start, uint end, uint currentTime) {
        return (electionStarted, electionEnded, startTime, endTime, block.timestamp);
    }
}