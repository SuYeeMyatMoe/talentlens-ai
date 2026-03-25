// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * TalentLens AI - Hiring Record Contract
 * Deployed on Polygon Mumbai Testnet
 * Stores immutable hiring decisions with fairness scores
 */
contract TalentLensHiring {
    address public owner;

    struct HiringRecord {
        bytes32 resumeHash;
        uint256 score;
        uint256 fairnessScore;
        string decision;
        uint256 timestamp;
        bool exists;
    }

    mapping(uint256 => HiringRecord) public records;
    uint256[] public applicationIds;

    event HiringDecisionLogged(
        uint256 indexed applicationId,
        bytes32 resumeHash,
        uint256 score,
        uint256 fairnessScore,
        string decision,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function logHiringDecision(
        uint256 applicationId,
        bytes32 resumeHash,
        uint256 score,
        uint256 fairnessScore,
        string memory decision
    ) public onlyOwner {
        require(!records[applicationId].exists, "Record already exists");
        require(score <= 100, "Score must be 0-100");
        require(fairnessScore <= 100, "Fairness score must be 0-100");
        require(
            keccak256(bytes(decision)) == keccak256(bytes("shortlisted")) ||
            keccak256(bytes(decision)) == keccak256(bytes("rejected")),
            "Decision must be shortlisted or rejected"
        );

        records[applicationId] = HiringRecord({
            resumeHash: resumeHash,
            score: score,
            fairnessScore: fairnessScore,
            decision: decision,
            timestamp: block.timestamp,
            exists: true
        });

        applicationIds.push(applicationId);

        emit HiringDecisionLogged(
            applicationId,
            resumeHash,
            score,
            fairnessScore,
            decision,
            block.timestamp
        );
    }

    function getRecord(uint256 applicationId)
        public view returns (
            bytes32 resumeHash,
            uint256 score,
            uint256 fairnessScore,
            string memory decision,
            uint256 timestamp
        )
    {
        require(records[applicationId].exists, "Record not found");
        HiringRecord memory r = records[applicationId];
        return (r.resumeHash, r.score, r.fairnessScore, r.decision, r.timestamp);
    }

    function recordExists(uint256 applicationId) public view returns (bool) {
        return records[applicationId].exists;
    }

    function totalRecords() public view returns (uint256) {
        return applicationIds.length;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
}
