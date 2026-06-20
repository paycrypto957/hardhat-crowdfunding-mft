// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract Crowdfunding {
    address public immutable owner;
    uint256 public immutable goal; // 目标金额 (wei)
    uint256 public immutable deadline; // 截止时间戳 (秒)
    uint256 public totalRaised;
    bool public withdrawn;

    // 每个地址的累计捐款额
    mapping(address => uint256) public contributions;

    event Funded(address indexed funder, uint256 amount, uint256 totalRaised);
    event Withdrawn(address indexed owner, uint256 amount);
    event Refunded(address indexed funder, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this");
        _;
    }

    modifier beforeDeadline() {
        require(block.timestamp < deadline, "Campaign has ended");
        _;
    }

    modifier afterDeadline() {
        require(block.timestamp >= deadline, "Campaign is still active");
        _;
    }

    constructor(uint256 _goal, uint256 _durationInSeconds) {
        require(_goal > 0, "Goal must be greater than zero");
        require(_durationInSeconds > 0, "Duration must be greater than zero");

        owner = payable(msg.sender);
        goal = _goal;
        deadline = block.timestamp + _durationInSeconds;
    }

    // 捐款：截止时间之前，任何人都可带 ETH 调用
    function fund() public payable beforeDeadline {
        require(msg.value > 0, "Must send ETH to fund");

        contributions[msg.sender] += msg.value;
        totalRaised += msg.value;

        emit Funded(msg.sender, msg.value, totalRaised);
    }

    // 创建者提款：到期 + 达标，且只能提一次
    function withdraw() public onlyOwner afterDeadline {
        require(totalRaised >= goal, "Goal not reached");
        require(!withdrawn, "Already withdrawn");

        withdrawn = true;
        uint256 amount = address(this).balance;

        emit Withdrawn(owner, amount);

        (bool success, ) = owner.call{value: amount}("");
        require(success, "Transfer failed");
    }

    // 捐款人退款：到期但未达标时，按本人捐款额退回
    function claimRefund() public afterDeadline {
        require(totalRaised < goal, "Goal reached, no refund");

        uint256 contributed = contributions[msg.sender];
        require(contributed > 0, "Nothing to refund");

        // Checks-Effects-Interactions: 先清零再转账，防止重入
        contributions[msg.sender] = 0;

        emit Refunded(msg.sender, contributed);

        (bool success, ) = payable(msg.sender).call{value: contributed}("");
        require(success, "Refund failed");
    }
}
