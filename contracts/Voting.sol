// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

contract Voting {
    // Phase 1: Candidate Management
    address public immutable admin;

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "You are not the admin");
        _;
    }

    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
    }

    mapping(uint256 id => Candidate) public candidates;

    uint256 public candidatesCount;

    event CandidateAdded(uint256 indexed id, string name);

    function addCandidate(string memory _name) public onlyAdmin {
        require(
            electionStatus == ElectionStatus.NotStarted,
            "Cannot add candidates after election has started"
        );

        candidatesCount++;

        candidates[candidatesCount] = Candidate({
            id: candidatesCount,
            name: _name,
            voteCount: 0
        });

        emit CandidateAdded(candidatesCount, _name);
    }

    function getCandidate(uint256 id) public view returns (Candidate memory) {
        require(id > 0 && id <= candidatesCount, "Invalid candidate ID");
        return candidates[id];
    }

    function displayCandidateList() public view returns (Candidate[] memory) {
        Candidate[] memory list = new Candidate[](candidatesCount);

        for (uint256 i = 1; i <= candidatesCount; i++) {
            list[i - 1] = candidates[i];
        }

        return list;
    }

    //Phase 2: Voter Management
    struct Voter {
        bool hasVoted;
    }

    mapping(address voter => Voter) private voters;

    function statusOfVoter() public view returns (bool) {
        return voters[msg.sender].hasVoted;
    }

    //Phase 3: Election Control
    //By default NotStarted
    enum ElectionStatus {
        NotStarted,
        Ongoing,
        Ended
    }

    ElectionStatus public electionStatus;

    event ElectionStarted(uint256 timestamp);

    function startElection() public onlyAdmin {
        require(
            electionStatus == ElectionStatus.NotStarted,
            "Election already started or ended"
        );
        electionStatus = ElectionStatus.Ongoing;

        emit ElectionStarted(block.timestamp);
    }

    event ElectionEnded(uint256 timestamp);

    function endElection() public onlyAdmin {
        require(
            electionStatus == ElectionStatus.Ongoing,
            "Election is not active"
        );
        electionStatus = ElectionStatus.Ended;

        emit ElectionEnded(block.timestamp);
    }

    //Phase 4: Voting Functionality
    //later on add a functionality to prevent the admin from voting: require(msg.sender != admin, "Owner cannot vote");

    event VoteCast(address indexed voter, uint256 indexed id);

    function vote(uint256 _id) public {
        require(
            electionStatus == ElectionStatus.Ongoing,
            "Election is not active"
        );

        require(msg.sender != admin, "Admin cannot vote");
        require(_id > 0 && _id <= candidatesCount, "Invalid candidate ID");
        require(voters[msg.sender].hasVoted == false, "You have already voted");

        candidates[_id].voteCount++;
        voters[msg.sender].hasVoted = true;

        emit VoteCast(msg.sender, _id);
    }

    //Phase 5: Result and Visibility Functions
    function voteCount(uint256 _id) public view returns (uint256) {
        require(_id > 0 && _id <= candidatesCount, "Invalid candidate ID");
        return candidates[_id].voteCount;
    }

    function displayResult() public view returns (Candidate memory) {
        require(electionStatus == ElectionStatus.Ended, "Election is ongoing");

        uint256 highestVoteCount = 0;
        uint256 winningCandidateId = 0;

        for (uint256 i = 1; i <= candidatesCount; i++) {
            if (candidates[i].voteCount > highestVoteCount) {
                highestVoteCount = candidates[i].voteCount;
                winningCandidateId = i;
            }
        }

        return candidates[winningCandidateId];
    }

    //helper function
    function getWinnerName() public view returns(string memory){
        require(electionStatus == ElectionStatus.Ended, "Election is ongoing");
        return displayResult().name;
    }

    //helper function
    function getWinnerID() public view returns(uint256){
        require(electionStatus == ElectionStatus.Ended, "Election is ongoing");
        return displayResult().id;
    }
}
